import { describe, expect, it } from "vitest";
import { redirectTargetFrom } from "@/routes/redirectTarget";

describe("redirectTargetFrom", () => {
  it("torna alla pagina protetta di partenza, con la query", () => {
    expect(redirectTargetFrom({ from: { pathname: "/word-login", search: "?s=abc" } })).toBe("/word-login?s=abc");
  });

  it.each([
    [null],
    [{}],
    [{ from: { pathname: "https://evil.example" } }],
    [{ from: { pathname: "//evil.example" } }],
    [{ from: { pathname: "/login" } }],
    [{ from: { pathname: 42 } }],
  ])("senza una destinazione interna valida usa /profilo (%j)", (state) => {
    expect(redirectTargetFrom(state)).toBe("/profilo");
  });
});
