import { describe, expect, it } from "vitest";
import {
  button,
  detailsTable,
  escapeHtml,
  renderEmailLayout,
} from "../../../functions/src/email/_layout";
import { generateRequestEmail, generateWelcomeEmail } from "../../../functions/src/email/comms/html";
import { generateVoucherInviteEmail } from "../../../functions/src/email/team/html";
import { generateInternalPurchaseNotificationEmail } from "../../../functions/src/email/plans/html";

describe("email layout", () => {
  it("compone il layout con titolo, anteprima, intestazione, firma e footer", () => {
    // Act
    const html = renderEmailLayout({
      title: "Titolo | Jurio",
      preheader: "Anteprima <importante>",
      eyebrow: "Etichetta",
      heading: "Intestazione",
      body: "<p>Corpo</p>",
      footerNote: "Nota a piè di pagina",
    });

    // Assert
    expect(html).toContain("<title>Titolo | Jurio</title>");
    expect(html).toContain("Anteprima &lt;importante&gt;");
    expect(html).toContain("Etichetta");
    expect(html).toContain("Intestazione</h1>");
    expect(html).toContain("<p>Corpo</p>");
    expect(html).toContain("Il team di Jurio");
    expect(html).toContain("Nota a piè di pagina");
    expect(html).toContain(`© ${new Date().getFullYear()} Jurio`.replace("©", "&copy;"));
    expect(html).toContain("https://jurio.it/contatti");
    expect(html).not.toContain("Preferenze email");
  });

  it("mostra le preferenze email solo quando richiesto e consente di omettere la firma", () => {
    // Act
    const html = renderEmailLayout({
      title: "T", preheader: "P", heading: "H", body: "", showPreferences: true, signature: false,
    });

    // Assert
    expect(html).toContain("https://jurio.it/profilo/modifica");
    expect(html).not.toContain("Il team di Jurio");
  });

  it("esegue l'escape dei caratteri HTML, anche per valori nulli", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("genera pulsanti e tabelle di dettaglio con href protetti", () => {
    // Act
    const cta = button(`https://jurio.it/?a=1&b="2"`, "Apri");
    const table = detailsTable([["Chiave", "Valore"], ["Altra", "Riga"]]);

    // Assert
    expect(cta).toContain(`href="https://jurio.it/?a=1&amp;b=&quot;2&quot;"`);
    expect(cta).toContain("Apri");
    expect(table).toMatch(/Chiave<\/td>\s*<td[^>]*>Valore<\/td>/);
    expect(table.match(/<tr>/g)).toHaveLength(2);
  });

  it("neutralizza l'HTML inserito dagli utenti nei template", () => {
    // Arrange
    const payload = "<script>alert(1)</script>";

    // Act
    const welcome = generateWelcomeEmail(payload);
    const request = generateRequestEmail(payload, "T-1", payload, payload);
    const invite = generateVoucherInviteEmail(payload, payload);
    const internal = generateInternalPurchaseNotificationEmail({
      customerEmail: payload, uid: "u", planId: "p", amountLabel: "1 EUR", provider: "stripe",
      orderId: "o", dataAcquisto: "", dataScadenza: "",
    });

    // Assert
    for (const html of [welcome, request, invite, internal]) {
      expect(html).not.toContain(payload);
      expect(html).toContain("&lt;script&gt;");
    }
    expect(internal).not.toContain("Il team di Jurio");
  });
});
