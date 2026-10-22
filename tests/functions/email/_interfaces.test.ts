import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  DispatchMailArgs,
  EnqueueCloseTeamEmailArgs,
  EnqueueEmailArgs,
  EnqueueEmailArgsContact,
  EnqueueMonthlyUsageEmailArgs,
  EnqueuePurchaseEmailArgs,
  EnqueueTeamEmailArgs,
  EnqueueVoucherEmailArgs,
  NotificationPayload,
  NotificationType,
  QueuePurchasePayPalArgs,
  QueuePurchaseStripeArgs,
} from "@functions/email/_interfaces";

describe("email interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defines notification types and email dispatch payloads", () => {
    // Arrange
    const type: NotificationType = "billing";
    const notification: NotificationPayload = {
      user: "user-1",
      title: "Pagamento",
      message: "Ricevuto",
      type,
      link: "/billing",
    };
    const dispatch: DispatchMailArgs = {
      to: ["user@example.test"],
      cc: "copy@example.test",
      subject: "Ricevuta",
      html: "<p>Ricevuto</p>",
      notifications: notification,
    };
    const contact: EnqueueEmailArgsContact = {
      nome: "Utente",
      id: "user-1",
      subject: "Richiesta",
      message: "Dettaglio",
      email: "user@example.test",
    };

    // Act
    const recipients = dispatch.to;

    // Assert
    expectTypeOf(type).toMatchTypeOf<NotificationType>();
    expectTypeOf(dispatch).toMatchTypeOf<DispatchMailArgs>();
    expect(contact.email).toBe("user@example.test");
    expect(recipients).toEqual(["user@example.test"]);
  });

  it("models purchase queue and recipient payloads", () => {
    // Arrange
    const purchase: EnqueuePurchaseEmailArgs = {
      uid: "user-1",
      provider: "stripe",
      orderId: "order-1",
      paidValue: 20,
      paidCurrency: "EUR",
    };
    const paypal: QueuePurchasePayPalArgs = {
      requestId: "request-1",
      uid: "user-1",
      orderId: "order-1",
      paidValue: 20,
      paidCurrency: "EUR",
    };
    const stripe: QueuePurchaseStripeArgs = {
      requestId: "request-2",
      uid: "user-1",
      sessionId: "session-1",
      paidValue: 20,
      paidCurrency: "EUR",
    };
    const email: EnqueueEmailArgs = { uid: "user-1" };
    const voucher: EnqueueVoucherEmailArgs = { email: "user@example.test", voucherCode: "SAVE" };
    const team: EnqueueTeamEmailArgs = { email: "user@example.test", teamName: "Legale" };
    const closeTeam: EnqueueCloseTeamEmailArgs = { email: ["a@example.test", "b@example.test"] };

    // Act
    const values = [purchase.provider, paypal.orderId, stripe.sessionId, email.uid, voucher.voucherCode, team.teamName];

    // Assert
    expectTypeOf(purchase.provider).toMatchTypeOf<"paypal" | "stripe">();
    expect(closeTeam.email).toHaveLength(2);
    expect(values).toEqual(["stripe", "order-1", "session-1", "user-1", "SAVE", "Legale"]);
  });

  it("models monthly usage report data", () => {
    // Arrange
    const report: EnqueueMonthlyUsageEmailArgs = {
      email: "user@example.test",
      reportData: {
        mese: "ottobre",
        haFattoPrompting: true,
        interazioniCount: 4,
        ricerca: { count: 1, timeSavedMinutes: 5 },
        analisi: { count: 1, timeSavedMinutes: 10 },
        sintesi: { count: 1, timeSavedMinutes: 8 },
        deepAnalysis: { count: 1, timeSavedMinutes: 20 },
        totalTimeSavedMinutes: 43,
      },
    };

    // Act
    const totalSaved = report.reportData.totalTimeSavedMinutes;

    // Assert
    expectTypeOf(report).toMatchTypeOf<EnqueueMonthlyUsageEmailArgs>();
    expect(totalSaved).toBe(43);
  });
});
