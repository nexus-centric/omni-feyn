// Speech-to-text front: Whisper worker (local, open-source) and optional Web Speech API.

export type WhisperModel = 'onnx-community/whisper-tiny' | 'onnx-community/whisper-base' | 'onnx-community/whisper-small';
export const WHISPER_MODELS: { id: WhisperModel; label: string }[] = [
  { id: 'onnx-community/whisper-tiny', label: 'Whisper tiny (nhanh nhất, kém chính xác)' },
  { id: 'onnx-community/whisper-base', label: 'Whisper base (cân bằng, mặc định)' },
  { id: 'onnx-community/whisper-small', label: 'Whisper small (chính xác hơn, tải nặng hơn)' },
];

export interface AsrResult { text: string; chunks: { text: string; timestamp: [number, number | null] }[]; device: string; }
export interface AsrProgress { kind: 'download' | 'status'; loaded?: number; total?: number; text?: string; }

let worker: Worker | null = null;

export function transcribeWhisper(audio: Float32Array, model: WhisperModel, onProgress: (p: AsrProgress) => void, device: 'auto' | 'webgpu' | 'wasm' = 'auto'): Promise<AsrResult> {
  worker ??= new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'progress') onProgress({ kind: 'download', loaded: d.loaded, total: d.total });
      else if (d.type === 'ready') onProgress({ kind: 'status', text: `Đã tải mô hình (${d.device})` });
      else if (d.type === 'status') onProgress({ kind: 'status', text: `Đang nhận dạng (${d.device})...` });
      else if (d.type === 'done') resolve({ text: d.text, chunks: d.chunks, device: d.device });
      else if (d.type === 'error') reject(new Error(d.message));
    };
    w.onerror = (e) => reject(new Error(e.message || 'Worker error'));
    const copy = audio.slice();
    w.postMessage({ type: 'transcribe', audio: copy, model, language: 'vietnamese', device }, [copy.buffer]);
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
