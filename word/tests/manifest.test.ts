import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";

const xml = readFileSync(resolve(__dirname, "../manifest.xml"), "utf8");
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const manifest = parser.parse(xml).OfficeApp;

const allResIds = (tag: "bt:Image" | "bt:Url" | "bt:String") =>
  [...xml.matchAll(new RegExp(`<${tag}\\s+id="([^"]+)"`, "g"))].map((m) => m[1]);

describe("manifest.xml – struttura", () => {
  it("è XML ben formato", () => {
    expect(XMLValidator.validate(xml)).toBe(true);
  });

  it("ha un Id GUID e una Version a 4 numeri", () => {
    expect(manifest.Id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(manifest.Version).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("è un TaskPaneApp per Word (host Document) in it-IT", () => {
    expect(manifest["@xsi:type"]).toBe("TaskPaneApp");
    expect(manifest.Hosts.Host["@Name"]).toBe("Document");
    expect(manifest.DefaultLocale).toBe("it-IT");
  });

  it("chiede il permesso minimo necessario (lettura/scrittura del documento)", () => {
    expect(manifest.Permissions).toBe("ReadWriteDocument");
  });

  it("ogni resid referenziato è definito nelle Resources", () => {
    const defined = new Set([...allResIds("bt:Image"), ...allResIds("bt:Url"), ...allResIds("bt:String")]);
    const referenced = [...xml.matchAll(/resid="([^"]+)"/g)].map((m) => m[1]);
    expect(referenced.filter((r) => !defined.has(r))).toEqual([]);
  });

  it("tutte le URL sono https", () => {
    const urls = [...xml.matchAll(/DefaultValue="(https?:[^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !u.startsWith("https://"))).toEqual([]);
  });

  it("le stringhe brevi rispettano il limite di 125 caratteri", () => {
    const short = xml.split("<bt:ShortStrings>")[1].split("</bt:ShortStrings>")[0];
    const values = [...short.matchAll(/DefaultValue="([^"]*)"/g)].map((m) => m[1]);
    expect(values.every((v) => v.length <= 125)).toBe(true);
  });
});
