// Microphone recording with MediaRecorder, plus decoding to 16 kHz mono for analysis.

export interface Recording { blob: Blob; mime: string; durationSec: number; }

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private started = 0;
  stream: MediaStream | null = null;
  analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;

  static supported(): boolean { return !!(navigator.mediaDevices && "getUserMedia" in navigator.mediaDevices && 'MediaRecorder' in window); }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    this.started = performance.now();
    try {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    } catch { /* level meter is optional */ }
  }

  level(): number {
    if (!this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let s = 0;
    for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
    return Math.min(1, Math.sqrt(s / buf.length) * 4);
  }

  stop(): Promise<Recording> {
    return new Promise((resolve) => {
      const rec = this.rec!;
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm';
        this.stream?.getTracks().forEach((t) => t.stop());
        this.ctx?.close().catch(() => {});
        resolve({ blob: new Blob(this.chunks, { type: mime }), mime, durationSec: (performance.now() - this.started) / 1000 });
      };
      rec.stop();
    });
  }
}

/** Decode any browser-supported audio blob to 16 kHz mono Float32 (Whisper input format). */
export async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const decoded = await ctx.decodeAudioData(buf);
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}
