import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import { 
  normalizePlanId, 
  getStripe,
  getWebhookSecret,
  processSubscriptionInTx,
  PlanDoc
} from "./_utils";
import { withSecureApiEndpoint, validateUserPlanAndLimits } from "../_utils";
import { getDb } from "../_deps";
import { CheckoutSessionRequestBody } from "./_interfaces";
import { queuePurchaseEmailOnceStripe } from "../email/plans/logic";
import { tryScheduleDowngradeTask } from "../schedules/schedule.logic";

const db = getDb();

export async function executePayWithStripeCreateCheckoutSession(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Validazione unificata limiti e consumo quote per la feature "stripe_checkout"
    const userRegisterSnap = await db.collection("register").doc(uid).get();
    if (!userRegisterSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(uid, "stripe_checkout", userRegisterSnap);

    // 2. Validazione input e normalizzazione Plan ID
    const body = (req.body ?? {}) as CheckoutSessionRequestBody;
    const rawId = typeof body.id === "string" ? body.id : "";
    
    const planId = normalizePlanId(rawId);
    if (!planId) {
      res.status(400).json({ error: "Bad Request: Missing/invalid 'id' (planId)" });
      return;
    }

    // 3. Recupero piano da Firestore
    const snap = await db.collection("plans").doc(planId).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Not Found: Plan not found" });
      return;
    }

    const plan = snap.data() as PlanDoc;
    const currency = String(plan.currency ?? "EUR").toLowerCase();

    if (!plan.stripePriceId || typeof plan.stripePriceId !== "string") {
      console.error(`[JURIO-STRIPE] stripePriceId mancante nel documento piano: ${planId}`);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    const stripe = getStripe();

    // 4. Gestione Customer Stripe (Associato a users/{uid})
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    let customerId = typeof userSnap.get("stripeCustomerId") === "string" 
      ? userSnap.get("stripeCustomerId") 
      : undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { uid } });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const appUrl = "https://jurio.it";

    // Configurazione della sessione Stripe
    const sessionConfig: Record<string, unknown> = {
      mode: "payment",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { uid, planId },
    };

    // 5. Logica applicazione Coupon da Register
    let appliedStripeCoupon = false;

    const coupon = userRegisterSnap.get("coupon");
    
    if (coupon && typeof coupon === "object" && coupon.id) {
      let isValid = true;
      if (coupon.expire) {
        const expireDate = typeof coupon.expire.toDate === "function" 
          ? coupon.expire.toDate() 
          : new Date(coupon.expire);
        if (expireDate < new Date()) isValid = false;
      }

      if (isValid) {
        const couponIdStr = String(coupon.id);
        if (couponIdStr.startsWith("promo_")) {
          sessionConfig.discounts = [{ promotion_code: couponIdStr }];
        } else {
          sessionConfig.discounts = [{ coupon: couponIdStr }];
        }
        appliedStripeCoupon = true;
      }
    }

    if (!appliedStripeCoupon) {
      sessionConfig.allow_promotion_codes = true;
    }

    // 6. Creazione Checkout Session su Stripe
    const session = await stripe.checkout.sessions.create(sessionConfig as any);

    // 7. Registrazione sessione su Firestore
    await db.collection("stripeSessions").doc(session.id).set({
      user: uid,
      planId,
      expectedCurrency: currency.toUpperCase(),
      expectedPriceId: plan.stripePriceId,
      status: "CREATED",
      createdAt: Timestamp.now(),
      customerId,
    });

    // 8. Risposta al client
    res.status(200).json({ 
      url: session.url, 
      sessionId: session.id 
    });
  });
}

export async function executeStripeWebhook(req: Request, res: Response): Promise<void> {
  // 1. Gestione Preflight e Metodo HTTP
  if (req.method === "OPTIONS") { 
    res.status(204).end(); 
    return; 
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();
    
    // 2. Verifica firma crittografica Stripe
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") { 
      res.status(400).json({ error: "Missing stripe-signature" }); 
      return; 
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Missing rawBody for webhook verification" });
      return;
    }

    let event: Stripe.Event;
    try { 
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret); 
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Invalid signature";
      console.warn(`[JURIO-WEBHOOK] Fallimento verifica firma Stripe: ${errMessage}`);
      res.status(400).json({ error: "Invalid signature" }); 
      return; 
    }

    // 3. Controllo Idempotenza (Prevenzione elaborazione duplicati)
    const eventRef = db.collection("stripeEvents").doc(event.id);
    const already = await eventRef.get();
    if (already.exists) { 
      res.status(200).json({ received: true, already: true }); 
      return; 
    }

    // Ignoriamo eventi diversi da checkout.session.completed ma tracciamo la ricezione
    if (event.type !== "checkout.session.completed") {
      await eventRef.set({ type: event.type, ignored: true, createdAt: Timestamp.now() }, { merge: true });
      res.status(200).json({ received: true, ignored: event.type }); 
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const planId = session.metadata?.planId ? String(session.metadata.planId) : "";

    if (!uid || !planId) {
      console.warn(`[JURIO-WEBHOOK] Evento ${event.id} ricevuto senza metadata 'uid' o 'planId'.`);
      await eventRef.set({ type: event.type, missing: true, createdAt: Timestamp.now() }, { merge: true });
      res.status(200).json({ received: true, skipped: "missing_metadata" }); 
      return;
    }

    // 4. Transazione Atomica su Firestore
    const out = await db.runTransaction(async (tx) => {
      const providerData = { 
        provider: "stripe", 
        stripeSessionId: session.id, 
        stripePaymentIntentId: session.payment_intent ?? null 
      };
      
      const { expireSec, needsTask } = await processSubscriptionInTx(
        tx, 
        db, 
        uid, 
        planId, 
        providerData, 
        session.amount_total
      );

      tx.set(eventRef, { type: event.type, createdAt: Timestamp.now() }, { merge: true });
      tx.set(
        db.collection("stripeSessions").doc(session.id),
        { 
          status: "COMPLETED", 
          completedAt: Timestamp.now(), 
          paidCurrency: session.currency, 
          paidAmountMinor: session.amount_total 
        },
        { merge: true }
      );

      return { status: "COMPLETED", expireSec, needsTask };
    });

    // 5. Side-effects: Pianificazione Task di Downgrade (Cloud Tasks)
    if (out.needsTask && typeof out.expireSec === "number") {
      try {
        await tryScheduleDowngradeTask(uid, out.expireSec);
      } catch (taskErr) {
        console.error(`[JURIO-WEBHOOK] Impossibile pianificare il task di downgrade per l'utente ${uid}:`, taskErr);
      }
    }

    // 6. Invio Email di Conferma Acquisto (Asincrono)
    try {
      const planSnap = await db.collection("plans").doc(planId).get();
      const plan = (planSnap.exists ? planSnap.data() : {}) as PlanDoc;
      const amountTotal = session.amount_total;
      const expectedCurrency = String(plan.currency ?? "EUR").toUpperCase();
      
      const paidValue = typeof amountTotal === "number" 
        ? amountTotal / 100 
        : (typeof plan.price === "number" ? plan.price : 0);

      void queuePurchaseEmailOnceStripe({
        requestId: event.id.slice(0, 8), 
        uid, 
        sessionId: session.id, 
        paidValue, 
        paidCurrency: session.currency || expectedCurrency,
      });
    } catch (emailErr) {
      console.error(`[JURIO-WEBHOOK] Errore nell'accodamento email di acquisto per event ${event.id}:`, emailErr);
    }

    // 7. Risposta di successo a Stripe
    res.status(200).json({ received: true, out: { status: out.status } });

  } catch (err: unknown) {
    // 8. Anti Information Disclosure
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error(`[JURIO-WEBHOOK] Errore critico nell'elaborazione del webhook Stripe:`, msg);
    
    res.status(500).json({ error: "Webhook handler failed" });
  }
}