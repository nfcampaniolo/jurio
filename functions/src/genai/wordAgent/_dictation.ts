/**
 * Dettatura dall'add-in Word: trascrizione di brevi registrazioni con Google Speech-to-Text.
 * Endpoint regionale UE; l'audio non viene salvato.
 */
import { SpeechClient } from "@google-cloud/speech";

export const DICTATION_SAMPLE_RATE = 16_000;
/** Il riconoscimento sincrono accetta al massimo ~60 s di audio. */
export const DICTATION_MAX_SECONDS = 60;
/** WAV PCM 16 bit mono a 16 kHz: 32 KB/s + intestazione. */
export const DICTATION_MAX_BYTES = DICTATION_SAMPLE_RATE * 2 * DICTATION_MAX_SECONDS + 44;

let client: SpeechClient | null = null;
const getClient = () => (client ??= new SpeechClient({ apiEndpoint: "eu-speech.googleapis.com" }));

/** Verifica che il buffer sia un WAV PCM 16 bit mono a 16 kHz (quello prodotto dal pannello). */
export function isSupportedWav(buf: Buffer): boolean {
  if (buf.length < 44) return false;
  return (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WAVE" &&
    buf.readUInt16LE(20) === 1 && // PCM
    buf.readUInt16LE(22) === 1 && // mono
    buf.readUInt32LE(24) === DICTATION_SAMPLE_RATE &&
    buf.readUInt16LE(34) === 16
  );
}

export async function transcribeDictation(wav: Buffer): Promise<string> {
  const [response] = await getClient().recognize({
    audio: { content: wav.toString("base64") },
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: DICTATION_SAMPLE_RATE,
      languageCode: "it-IT",
      enableAutomaticPunctuation: true,
    },
  });
  return (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript ?? "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
