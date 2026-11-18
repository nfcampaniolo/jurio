import { describe, expect, it } from "vitest";
import { DictationError, downsample, encodeWav, TARGET_SAMPLE_RATE, wavToBase64 } from "@word/tools/recorder";

describe("registrazione per la dettatura", () => {
  it("downsample 48 kHz → 16 kHz fa la media a gruppi di 3 campioni", () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1, 0.5]), 48000, 16000);
    expect(Array.from(out).map((v) => Math.round(v * 100) / 100)).toEqual([0.3, 1]);
    const same = new Float32Array([0.1]);
    expect(downsample(same, 16000)).toBe(same);
    expect(() => downsample(same, 8000)).toThrow(DictationError);
  });

  it("encodeWav produce un WAV PCM 16 bit mono a 16 kHz, con clipping", () => {
    const wav = new DataView(encodeWav(new Float32Array([0, 1, -1, 2])));
    const ascii = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(o + i)));
    expect(ascii(0)).toBe("RIFF");
    expect(ascii(8)).toBe("WAVE");
    expect(ascii(36)).toBe("data");
    expect(wav.getUint16(20, true)).toBe(1);
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint32(24, true)).toBe(TARGET_SAMPLE_RATE);
    expect(wav.getUint16(34, true)).toBe(16);
    expect(wav.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => wav.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });

  it("wavToBase64 codifica il contenuto binario (anche oltre un blocco da 32 KB)", () => {
    expect(wavToBase64(new Uint8Array([0, 255, 16]).buffer)).toBe(Buffer.from([0, 255, 16]).toString("base64"));
    const big = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(wavToBase64(big.buffer)).toBe(Buffer.from(big).toString("base64"));
  });
});
