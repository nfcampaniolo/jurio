import { beforeEach, describe, expect, it, vi } from "vitest";
import emailStyles from "../../../functions/src/email/emailStyles";

describe("emailStyles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("esporta gli stili condivisi per layout, contenuti e dispositivi mobili", () => {
    // Arrange
    const requiredRules = [
      "body {",
      ".container {",
      ".header {",
      ".subheader {",
      ".feature {",
      ".button {",
      ".footer {",
      "@media (max-width: 600px)",
    ];

    // Act
    const result = emailStyles;

    // Assert
    expect(typeof result).toBe("string");
    requiredRules.forEach((rule) => expect(result).toContain(rule));
  });
});
