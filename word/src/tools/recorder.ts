/* global navigator, window, AudioContext, MediaStream, btoa */
/**
 * Registrazione per la dettatura: PCM catturato con Web Audio e codificato in WAV 16 bit mono a 16 kHz.
 * Non usa MediaRecorder perché su Word per Mac (WKWebView) produce solo AAC/MP4, non accettato da
 * Speech-to-Text; il WAV funziona ovunque ed è leggero per frasi brevi (≈32 KB al secondo).
 */

export const TARGET_SAMPLE_RATE = 16_000;
/** Il backend accetta al massimo 60 s: ci fermiamo prima. */
export const MAX_RECORDING_SECONDS = 55;

export class DictationError extends Error {}

export interface Recording {
  /** Termina e restituisce l'audio in WAV. */
  stop: () => Promise<ArrayBuffer>;
  /** Interrompe senza produrre audio. */
  cancel: () => void;
}

/** Media dei campioni: riduce la frequenza (es. 48 kHz → 16 kHz). */
export function downsample(
  input: Float32Array,
  fromRate: number,
  toRate = TARGET_SAMPLE_RATE
): Float32Array {
  if (fromRate === toRate) return input;
  if (fromRate < toRate)
    throw new DictationError("Frequenza di campionamento del microfono troppo bassa.");
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  });
  return buffer;
}

export function wavToBase64(wav: ArrayBuffer): string {
  const bytes = new Uint8Array(wav);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

async function requestOfficeMicrophonePermission(): Promise<void> {
  // Alcuni host Office richiedono un consenso esplicito per il microfono.
  const office =
    typeof Office !== "undefined" ? (Office as unknown as Record<string, any>) : undefined;
  const api = office?.devicePermission;
  const type = office?.DevicePermissionType?.microphone;
  if (!api?.requestPermissionsAsync || !type) return;
  try {
    await api.requestPermissionsAsync([type]);
  } catch {
    throw new DictationError(
      "Accesso al microfono negato. Consenti il microfono per Jurio e riprova."
    );
  }
}

export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DictationError("La registrazione non è supportata in questa versione di Word.");
  }
  await requestOfficeMicrophonePermission();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new DictationError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "Accesso al microfono negato. Consenti il microfono a Word nelle impostazioni di sistema."
        : "Nessun microfono disponibile."
    );
  }

  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
  const source = context.createMediaStreamSource(stream);
  // ScriptProcessor è deprecato ma supportato ovunque, senza file worklet separati.
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  const release = () => {
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
    mute.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
  };

  return {
    stop: async () => {
      release();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      const pcm = downsample(merged, context.sampleRate);
      return encodeWav(pcm);
    },
    cancel: release,
  };
}
