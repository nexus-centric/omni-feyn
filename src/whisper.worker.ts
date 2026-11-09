/// <reference lib="webworker" />
// Whisper speech-to-text in a Web Worker via transformers.js. The main thread picks model, device and dtype;
// if the WebGPU load fails the worker retries on WASM with the fallback model.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

type Dtype = string | Record<string, string>;
type Msg = { type: 'transcribe'; audio: Float32Array; model: string; dtype: Dtype; language: string; device: 'webgpu' | 'wasm'; fallback: { model: string; dtype: Dtype } };

let current: { key: string; asr: Promise<any>; device: string; model: string } | null = null;

function load(model: string, device: 'webgpu' | 'wasm', dtype: Dtype) {
  const files = new Map<string, { loaded: number; total: number }>();
  return pipeline('automatic-speech-recognition', model, {
    device,
    dtype,
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
    const key = `${m.model}|${m.device}|${JSON.stringify(m.dtype)}`;
    if (current?.key !== key) {
      current = { key, device: m.device, model: m.model, asr: load(m.model, m.device, m.dtype) };
      try { await current.asr; } catch (err) {
        if (m.device !== 'webgpu') { current = null; throw err; }
        current = { key: `${m.fallback.model}|wasm`, device: 'wasm', model: m.fallback.model, asr: load(m.fallback.model, 'wasm', m.fallback.dtype) };
        await current.asr;
      }
    }
    const asr = await current!.asr;
    self.postMessage({ type: 'status', device: current!.device });
    const out = await asr(m.audio, {
      language: m.language, task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 5,
    });
    self.postMessage({ type: 'done', text: String(out.text || '').trim(), chunks: out.chunks || [], device: current!.device, model: current!.model });
  } catch (err) {
    current = null;
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
