import { getDb } from "../../../infrastructure/db";

export interface PaymentRecord {
  id: string;
  provider: "paypal" | "stripe";
  status: string;
  completedAt: Date;
  paidCurrency: string;
  paidValue: number;
  planId?: string;
  paypalCaptureId?: string;
  customerId?: string;
}

export const fetchUserPayments = async (uid: string): Promise<PaymentRecord[]> => {
  if (!uid) return [];
  const db = await getDb();
    const {
    Timestamp,
    collection,
    query,
    where,
    getDocs,
  } = await import("firebase/firestore");
  // Query per PayPal
  const paypalQuery = query(
    collection(db, "paypalOrders"),
    where("uid", "==", uid),
    where("status", "==", "COMPLETED")
  );

  // Query per Stripe
  const stripeQuery = query(
    collection(db, "stripeSessions"),
    where("uid", "==", uid),
    where("status", "==", "COMPLETED")
  );

  // Eseguiamo le due query in parallelo
  const [paypalSnap, stripeSnap] = await Promise.all([
    getDocs(paypalQuery),
    getDocs(stripeQuery),
  ]);

  const records: PaymentRecord[] = [];

  // Parsing dei risultati PayPal
  paypalSnap.forEach((doc) => {
    const data = doc.data();
    records.push({
      id: doc.id,
      provider: "paypal",
      status: data.status,
      completedAt: data.completedAt instanceof Timestamp 
        ? data.completedAt.toDate() 
        : new Date(data.completedAt),
      paidCurrency: data.paidCurrency || "EUR",
      paidValue: Number(data.paidValue || 0),
      planId: data.planId,
      paypalCaptureId: data.paypalCaptureId,
    });
  });

  // Parsing dei risultati Stripe
  stripeSnap.forEach((doc) => {
    const data = doc.data();
    records.push({
      id: doc.id,
      provider: "stripe",
      status: data.status,
      completedAt: data.completedAt instanceof Timestamp 
        ? data.completedAt.toDate() 
        : new Date(data.completedAt),
      paidCurrency: data.paidCurrency || "EUR",
      // Stripe memorizza i centesimi (minor units), quindi dividiamo per 100
      paidValue: data.paidAmountMinor ? data.paidAmountMinor / 100 : 0,
      planId: data.planId,
      customerId: data.customerId,
    });
  });

  // Ordiniamo l'array unito dal più recente al più vecchio
  records.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  return records;
};