import { trackEvent } from "@/infrastructure/analytics";
import { fetchWithSecurity } from "@/config/apiClient"; 
import { getDb } from "@/infrastructure/db";

export interface CouponData {
  code: string;
  percentage: number;
  durationLabel: string;
}

export async function fetchApplyCoupon(
  couponCode: string
): Promise<CouponData> {

  const url = import.meta.env.VITE_APPLY_DISCOUNT_URL;; 
  
  const r = await fetchWithSecurity(url, { couponCode });
  const text = await r.text();

  if (!r.ok) {
    let errorMessage = "Errore durante l'applicazione del codice promozionale.";
    
    // Proviamo a estrarre il messaggio di errore specifico dal backend (es. "Utente non trovato", "Scaduto")
    try {
      const errData = JSON.parse(text);
      if (errData.error) {
        errorMessage = errData.error;
      }
    } catch (e) {
      console.log(e);
    }

    // Tracciamo l'errore per Analytics come fai tu
    trackEvent("analytics_error", {
      name: "fetchApplyCoupon",
      reason: `applyCoupon failed (${r.status}): ${text}`,
    });
    
    throw new Error(errorMessage);
  }

  const data = JSON.parse(text);
  
  if (data.status !== "SUCCESS" || !data.coupon) {
    trackEvent("analytics_error", { name: "fetchApplyCoupon", reason: "Invalid format from server" });
    throw new Error("Risposta non valida dal server");
  }

  return {
    code: data.coupon.code,
    percentage: data.coupon.percentage,
    durationLabel: data.coupon.durationLabel,
  };
}

export const fetchUserCoupon = async (uid: string): Promise<CouponData | null> => {
  if (!uid) return null;

  try {
    const db = await getDb();
      const {
    doc,
    getDoc,
    } = await import("firebase/firestore");

    const userDocRef = doc(db, "register", uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const couponMap = data.coupon;

      if (couponMap && couponMap.name) {
        let isValid = true;
        
        // Verifica la scadenza del coupon, se presente
        if (couponMap.expire) {
          const expireDate = typeof couponMap.expire.toDate === 'function'
            ? couponMap.expire.toDate()
            : new Date(couponMap.expire);
            
          // Se la data di scadenza è passata, il coupon non è più valido
          if (expireDate < new Date()) {
            isValid = false;
          }
        }

        // Se valido, restituisce l'oggetto CouponData
        if (isValid) {
          return {
            code: couponMap.name,
            percentage: couponMap.discount || 0,
            durationLabel: "Sconto riservato al tuo account",
          };
        }
      }
    }
  } catch (error) {
    console.error("Errore durante il caricamento del coupon dell'utente:", error);
  }

  // Se non esiste, non è valido o c'è stato un errore, restituisce null
  return null;
};