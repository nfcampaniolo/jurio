import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { handleTeamCreationInTx } from "../team/_utils";

export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

export type PlanDoc = { price: number; currency?: string; durationDays?: number; stripePriceId?: string };

export function getStripe(): Stripe {
  const sk = STRIPE_SECRET_KEY.value();
  if (!sk) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(sk);
}

export function getWebhookSecret(): string {
  const whsec = STRIPE_WEBHOOK_SECRET.value();
  if (!whsec) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return whsec;
}

export function normalizePlanId(id: unknown):
  | "personale" | "business" | "personale_m" | "business_m"
  | null {
  if (typeof id !== "string") return null;
  const v = id.toLowerCase().trim();
  if (v === "personale" || v === "business" || v === "personale_m" || v === "business_m") return v;
  return null;
}

export async function processSubscriptionInTx(
  tx: any,
  db: any,
  uid: string,
  purchasedPlanId: string,
  providerData: Record<string, any>,
  amountTotal: number | null
): Promise<{ expireSec: number; needsTask: boolean }> {
  
  // 1. Leggi durata piano e calcola il paidValue direttamente qui dentro
  const planSnap = await tx.get(db.collection("plans").doc(purchasedPlanId));
  const planData = planSnap.data();
  const durationDays = planData?.durationDays ?? (purchasedPlanId.endsWith("_m") ? 30 : 365);
  
  // Calcolo del valore pagato (ammontare Stripe / 100 o prezzo del piano)
  const paidValue = typeof amountTotal === "number" 
    ? amountTotal / 100 
    : (typeof planData?.price === "number" ? planData.price : 0);

  // 2. Calcola date
  const now = Timestamp.now();
  const expire = Timestamp.fromMillis(now.toMillis() + durationDays * 24 * 60 * 60 * 1000);
  const expireSec = Math.floor(expire.toMillis() / 1000);

  // 3. Esegui logica Team/Business
  const { finalUserStatus, needsTask } = await handleTeamCreationInTx(tx, db, uid, purchasedPlanId, expireSec, now);

  // ---> ESEGUIAMO LA FUNZIONE DI PULIZIA COUPON <---
  const hasCouponToClear = await processCouponInTx(tx, db, uid, paidValue);

  // 4. Prepara i dati per Register
  const registerUpdateData: any = {
    planId: finalUserStatus, 
    status: "active",
    ...providerData,
    start: now,
    expire,
    expireSec,
    update: now,
  };

  // Se il coupon è stato processato, aggiungiamo il comando per eliminarlo da register
  if (hasCouponToClear) {
    registerUpdateData.coupon = FieldValue.delete();
  }

  // Scrivi Register (eseguirà sia update dei campi che delete del coupon in un unico passaggio atomico)
  tx.set(db.collection("register").doc(uid), registerUpdateData, { merge: true });

  // 5. Aggiorna utente
  tx.set(db.collection("users").doc(uid), { status: finalUserStatus }, { merge: true });

  return { expireSec, needsTask };
}

export async function processCouponInTx(
  tx: any,
  db: any,
  uid: string,
  paidValue: number
): Promise<boolean> {
  const registerRef = db.collection("register").doc(uid);
  const registerSnap = await tx.get(registerRef);

  if (!registerSnap.exists) return false;

  const registerData = registerSnap.data();
  const coupon = registerData?.coupon;

  // Se c'è una mappa coupon con una proprietà 'name'
  if (coupon && typeof coupon === "object" && coupon.name) {
    const couponName = coupon.name;

    // Crea la reference alla subcollection: discount/{couponName}/userby/{uid}
    const discountUserRef = db
      .collection("discount")
      .doc(couponName)
      .collection("userby")
      .doc(uid);

    // Scrive il documento nella subcollection (aggiungendo merge: true per sicurezza se c'è già)
    tx.set(
      discountUserRef,
      {
        uid: uid,
        paidValue: paidValue,
        purchasedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return true; // Segnala che dobbiamo eliminare il campo da register
  }

  return false;
}