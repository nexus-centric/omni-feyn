// Speech-to-text front: Whisper worker (local, open-source) and optional Web Speech API.

export type WhisperModel = 'auto' | 'onnx-community/whisper-large-v3-turbo' | 'huuquyet/PhoWhisper-small' | 'onnx-community/whisper-small' | 'onnx-community/whisper-base';
export type Device = 'webgpu' | 'wasm';

export interface ModelInfo {
  id: Exclude<WhisperModel, 'auto'>;
  label: string;
  note: string;
  /** Approximate download in MB per device (encoder + merged decoder, from the Hugging Face file listing on 2026-11-05). */
  sizeMB: Record<Device, number>;
  dtype: Record<Device, string | Record<string, string>>;
  wasmOk: boolean;
}

export const WHISPER_MODELS: ModelInfo[] = [
  { id: 'onnx-community/whisper-large-v3-turbo', label: 'Whisper large-v3-turbo', note: 'Chính xác nhất cho máy có WebGPU. Rất nặng nếu chạy bằng CPU.', sizeMB: { webgpu: 760, wasm: 1085 },
    dtype: { webgpu: { encoder_model: 'q4', decoder_model_merged: 'q4' }, wasm: 'q8' }, wasmOk: false },
  { id: 'huuquyet/PhoWhisper-small', label: 'PhoWhisper small (tinh chỉnh cho tiếng Việt)', note: 'VinAI tinh chỉnh trên 844 giờ tiếng Việt. Tốt nhất khi không có WebGPU.', sizeMB: { webgpu: 249, wasm: 249 },
    dtype: { webgpu: 'q8', wasm: 'q8' }, wasmOk: true },
  { id: 'onnx-community/whisper-small', label: 'Whisper small (đa ngôn ngữ)', note: 'Bản gốc của OpenAI, cân bằng.', sizeMB: { webgpu: 586, wasm: 249 },
    dtype: { webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, wasm: 'q8' }, wasmOk: true },
  { id: 'onnx-community/whisper-base', label: 'Whisper base (nhẹ, kém chính xác)', note: 'Nhanh, dùng cho máy yếu.', sizeMB: { webgpu: 206, wasm: 77 },
    dtype: { webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, wasm: 'q8' }, wasmOk: true },
];

export const AUTO_MODEL: Record<Device, ModelInfo['id']> = { webgpu: 'onnx-community/whisper-large-v3-turbo', wasm: 'huuquyet/PhoWhisper-small' };

let gpuProbe: Promise<boolean> | null = null;
export function detectWebGPU(): Promise<boolean> {
  gpuProbe ??= (async () => {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;
    try { return !!(await gpu.requestAdapter()); } catch { return false; }
  })();
  return gpuProbe;
}

/** Resolve the user's choice into a concrete model and device. */
export async function resolveModel(model: WhisperModel, pref: 'auto' | Device): Promise<{ info: ModelInfo; device: Device }> {
  const gpu = pref !== 'wasm' && (await detectWebGPU());
  const device: Device = gpu ? 'webgpu' : 'wasm';
  let id = model === 'auto' ? AUTO_MODEL[device] : model;
  let info = WHISPER_MODELS.find((m) => m.id === id)!;
  if (device === 'wasm' && !info.wasmOk && model === 'auto') info = WHISPER_MODELS.find((m) => m.id === AUTO_MODEL.wasm)!;
  return { info, device };
}

export interface AsrResult { text: string; chunks: { text: string; timestamp: [number, number | null] }[]; device: string; model: string; }
export interface AsrProgress { kind: 'download' | 'status'; loaded?: number; total?: number; text?: string; }

let worker: Worker | null = null;

export async function transcribeWhisper(audio: Float32Array, model: WhisperModel, onProgress: (p: AsrProgress) => void, pref: 'auto' | Device = 'auto', language = 'vietnamese'): Promise<AsrResult> {
  const { info, device } = await resolveModel(model, pref);
  worker ??= new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  onProgress({ kind: 'status', text: `${info.label} trên ${device === 'webgpu' ? 'WebGPU' : 'CPU (WASM)'}, khoảng ${info.sizeMB[device]} MB nếu chưa có trong cache` });
  return new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'progress') onProgress({ kind: 'download', loaded: d.loaded, total: d.total });
      else if (d.type === 'ready') onProgress({ kind: 'status', text: `Đã nạp mô hình (${d.device})` });
      else if (d.type === 'status') onProgress({ kind: 'status', text: `Đang nhận dạng bằng ${info.label} (${d.device})...` });
      else if (d.type === 'done') resolve({ text: d.text, chunks: d.chunks, device: d.device, model: d.model });
      else if (d.type === 'error') reject(new Error(d.message));
    };
    w.onerror = (e) => reject(new Error(e.message || 'Worker error'));
    const copy = audio.slice();
    const fallback = WHISPER_MODELS.find((m) => m.id === AUTO_MODEL.wasm)!;
    w.postMessage({ type: 'transcribe', audio: copy, model: info.id, dtype: info.dtype[device], device, language,
      fallback: { model: info.wasmOk ? info.id : fallback.id, dtype: (info.wasmOk ? info : fallback).dtype.wasm } }, [copy.buffer]);
  });
}

// ---- Web Speech API (fast, but audio is processed by the browser vendor's servers) ----

type SR = any;
export function webSpeechSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export class LiveSpeech {
  private rec: SR;
  private finalText = '';
  private interim = '';
  private running = false;
  onUpdate: (text: string) => void = () => {};

  constructor(lang = 'vi-VN') {
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.rec = new C();
    this.rec.lang = lang;
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.onresult = (e: any) => {
      this.interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finalText += r[0].transcript.trim() + ' ';
        else this.interim += r[0].transcript;
      }
      this.onUpdate(this.text());
    };
    this.rec.onend = () => { if (this.running) { try { this.rec.start(); } catch { /* ignore */ } } };
  }
  text(): string { return (this.finalText + this.interim).trim(); }
  start(): void { this.running = true; this.rec.start(); }
  stop(): string { this.running = false; try { this.rec.stop(); } catch { /* ignore */ } return this.text(); }
}
