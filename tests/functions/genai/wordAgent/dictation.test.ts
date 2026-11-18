import { createRequire } from "node:module";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recognize: vi.fn(), ctor: vi.fn() }));
// Il pacchetto è installato in functions/node_modules: va mockato con il percorso risolto da lì.
const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/genai/wordAgent/_dictation.ts"));
vi.doMock(sourceRequire.resolve("@google-cloud/speech"), () => ({
  SpeechClient: vi.fn(function (this: unknown, opts: unknown) {
    mocks.ctor(opts);
    return { recognize: mocks.recognize };
  }),
}));

const { isSupportedWav, transcribeDictation } = await import("@functions/genai/wordAgent/_dictation");

const header = (sampleRate = 16000, channels = 1, bits = 16, format = 1) => {
  const b = Buffer.alloc(44);
  b.write("RIFF", 0, "ascii");
  b.write("WAVE", 8, "ascii");
  b.writeUInt16LE(format, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt16LE(bits, 34);
  return b;
};

describe("wordAgent – dettatura", () => {
  beforeEach(() => {
    mocks.recognize.mockReset();
  });

  it("accetta solo WAV PCM 16 bit mono a 16 kHz", () => {
    expect(isSupportedWav(header())).toBe(true);
    expect(isSupportedWav(header(48000))).toBe(false);
    expect(isSupportedWav(header(16000, 2))).toBe(false);
    expect(isSupportedWav(header(16000, 1, 8))).toBe(false);
    expect(isSupportedWav(header(16000, 1, 16, 3))).toBe(false);
    expect(isSupportedWav(Buffer.from("short"))).toBe(false);
  });

  it("usa l'endpoint UE in italiano e unisce i segmenti trascritti", async () => {
    mocks.recognize.mockResolvedValue([
      { results: [{ alternatives: [{ transcript: "Il conduttore " }] }, { alternatives: [{ transcript: " recede." }] }, {}] },
    ]);
    await expect(transcribeDictation(header())).resolves.toBe("Il conduttore recede.");
    expect(mocks.ctor).toHaveBeenCalledWith({ apiEndpoint: "eu-speech.googleapis.com" });
    expect(mocks.recognize.mock.calls[0][0].config).toMatchObject({
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "it-IT",
    });
  });
});
