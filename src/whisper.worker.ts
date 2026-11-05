/// <reference lib="webworker" />
// Whisper speech-to-text in a Web Worker via transformers.js. WebGPU when available, else WASM.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

type Msg = { type: 'transcribe'; audio: Float32Array; model: string; language: string; device: 'auto' | 'webgpu' | 'wasm' };

let current: { key: string; asr: Promise<any>; device: string } | null = null;

async function pickDevice(pref: string): Promise<'webgpu' | 'wasm'> {
  if (pref === 'wasm') return 'wasm';
  const gpu = (self.navigator as any).gpu;
  if (!gpu) return 'wasm';
  try { return (await gpu.requestAdapter()) ? 'webgpu' : 'wasm'; } catch { return 'wasm'; }
}

function load(model: string, device: 'webgpu' | 'wasm') {
  const files = new Map<string, { loaded: number; total: number }>();
  return pipeline('automatic-speech-recognition', model, {
    device,
    dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p: any) => {
      if (p.status === 'progress' && p.file) {
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
        let l = 0, t = 0;
        for (const f of files.values()) { l += f.loaded; t += f.total; }
        self.postMessage({ type: 'progress', loaded: l, total: t, file: p.file });
      } else if (p.status === 'ready') {
        self.postMessage({ type: 'ready', device });
      }
    },
  } as any);
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type !== 'transcribe') return;
  try {
    let device = await pickDevice(m.device);
    const key = `${m.model}|${device}`;
    if (current?.key !== key) {
      current = { key, device, asr: load(m.model, device) };
      try { await current.asr; } catch (err) {
        if (device === 'webgpu') {
          device = 'wasm';
          current = { key: `${m.model}|wasm`, device, asr: load(m.model, 'wasm') };
        } else { current = null; throw err; }
      }
    }
    const asr = await current!.asr;
    self.postMessage({ type: 'status', text: 'transcribing', device: current!.device });
    const out = await asr(m.audio, {
      language: m.language, task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 5,
    });
    self.postMessage({ type: 'done', text: String(out.text || '').trim(), chunks: out.chunks || [], device: current!.device });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
