import { describe, expect, it } from "vitest";
import { generateEmailVerificationEmail } from "@functions/email/auth/html";

describe("generateEmailVerificationEmail", () => {
  it("renders the verification link and escapes the recipient address", () => {
    // Act
    const html = generateEmailVerificationEmail(
      "https://jurio.it/verifica-email?mode=verifyEmail&oobCode=ABC",
      "<x>@example.test"
    );

    // Assert
    expect(html).toContain("Conferma il tuo indirizzo email");
    expect(html).toContain("https://jurio.it/verifica-email?mode=verifyEmail&amp;oobCode=ABC");
    expect(html).toContain("&lt;x&gt;@example.test");
    expect(html).not.toContain("<x>@example.test");
  });
});
