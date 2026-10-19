import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { 
  withSecureApiEndpoint, 
  validateUserPlanAndLimits,
} from "../_utils";
import { corsHandlerDomain, requireAppCheck, consumePerMinuteFeature, consumeDailyFeature } from "../_utils";
import { JURIO_USAGE_LIMITS } from "../_constants";
import { getDb } from "../_deps";
import { GetRegisterResponse, GetPriceRequestBody, GetPriceResponse, ApplyCouponRequestBody, ApplyCouponResponse } from "./_interfaces";
import { enqueueWelcomeEmail, enqueueTrialEmail } from "../email/comms/logic";
import { scheduleDowngradeTask } from "../schedules/schedule.logic"

const db = getDb();

export async function executeGetRegister(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Controllo documento register (se esiste) e validazione rate limit/quote per feature "register"
    const ref = db.collection("register").doc(uid);
    const existingSnap = await ref.get();

    await validateUserPlanAndLimits(uid, "register", existingSnap);

    // 2. Transazione Atomica su Firestore per la creazione del trial di 7 giorni
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const data = snap.data() ?? {};
        return {
          created: false,
          uid,
          start: data.start ?? null,
          expireSec: typeof data.expireSec === "number" ? data.expireSec : null,
        };
      }
      
      const start = Timestamp.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const expire = Timestamp.fromMillis(start.toMillis() + SEVEN_DAYS_MS);
      const expireSec = Math.floor(expire.toMillis() / 1000);
      
      // A) Crea document register/{uid}
      tx.set(
        ref,
        { uid, start, expire, expireSec, planId: "prova" },
        { merge: true }
      );

      // B) Aggiorna status in users/{uid}
      const userRef = db.collection("users").doc(uid);
      tx.set(userRef, { status: "prova" }, { merge: true });

      return { created: true, uid, start, expireSec };
    }) as GetRegisterResponse;

    // 3. Task Asincroni Post-Creazione (Email di benvenuto e trial)
    if (out.created) {
      Promise.allSettled([
        enqueueWelcomeEmail({ uid }),
        enqueueTrialEmail({ uid })
      ]).catch(emailErr => {
        console.error(`[JURIO-REGISTER] Errore nell'accodamento email per UID ${uid}:`, emailErr);
      });
    }

    // 4. Pianificazione Task Downgrade su Cloud Tasks
    if (out.created && typeof out.expireSec === "number") {
      const currentProjectId = process.env.PROJECT_ID || "jurio-it";
      const taskServiceAccount = process.env.TASK_SERVICE_ACCOUNT || "130993418358-compute@developer.gserviceaccount.com";
      const dynamicTargetUrl = `https://europe-west1-${currentProjectId}.cloudfunctions.net/tasksDowngrade`;

      try {
        await scheduleDowngradeTask({
          projectId: currentProjectId,
          location: "europe-west1",
          queue: "subscription-expire",
          targetUrl: dynamicTargetUrl,
          serviceAccountEmail: taskServiceAccount,
          uid,
          expireSec: out.expireSec,
        });
      } catch (taskErr) {
        console.error(`[JURIO-REGISTER] Impossibile pianificare il task di downgrade per UID ${uid}:`, taskErr);
      }
    }

    // 5. Risposta al Client
    res.status(200).json(out);
  });
}

export async function executeGetPrice(req: Request, res: Response): Promise<void> {
  return corsHandlerDomain(req, res, async (): Promise<void> => {
    // 1. CORS e Metodo HTTP
    if (req.method === "OPTIONS") { 
      res.status(204).end(); 
      return; 
    }
    if (req.method !== "POST") { 
      res.status(405).json({ error: "Method Not Allowed" }); 
      return; 
    }

    try {
      // 2. Verifica AppCheck (Protezione da scraper/client non autorizzati)
      try {
        await requireAppCheck(req);
      } catch (appCheckError) {
        console.warn(`[JURIO-PRICE] Fallimento AppCheck per IP: ${req.ip}`);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // 3. Rate Limiting basato su IP (Anti-Scraping / DoS)
      const clientIp = (req.ip || req.socket?.remoteAddress || "unknown").replace(/[^a-fA-F0-9:.]/g, "");
      const limits = JURIO_USAGE_LIMITS.stripe_checkout?.global ?? { perMinute: 5, perDay: 100 };

      try {
        await Promise.all([
          consumePerMinuteFeature(`ip_${clientIp}`, "stripe_checkout", limits.perMinute),
          consumeDailyFeature(`ip_${clientIp}`, "stripe_checkout", limits.perDay),
        ]);
      } catch (rateLimitError: unknown) {
        console.warn(`[JURIO-PRICE] Rate limit superato per IP: ${clientIp}`);
        res.status(429).json({ error: "Too Many Requests" });
        return;
      }

      // 4. Sanitizzazione e Type-Safety Input
      const body = (req.body ?? {}) as GetPriceRequestBody;
      const rawId = typeof body.id === "string" ? body.id : "";

      if (!rawId.trim()) {
        res.status(400).json({ error: "Bad Request: Missing or invalid 'id'" });
        return;
      }

      // Sanitizzazione dell'ID del piano
      const planId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").substring(0, 50);

      if (!planId) {
        res.status(400).json({ error: "Bad Request: Invalid plan ID format" });
        return;
      }

      // 5. Lettura da Firestore (Collection 'plans')
      const snap = await db.collection("plans").doc(planId).get();

      if (!snap.exists) {
        res.status(404).json({ error: "Not Found: Plan not found" });
        return;
      }

      const data = snap.data() as {
        price?: unknown;
        currency?: unknown;
      };

      const price = typeof data?.price === "number" ? data.price : null;
      if (price === null) {
        console.error(`[JURIO-PRICE] Formato prezzo non valido nel DB per il piano: ${planId}`);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const currency = typeof data?.currency === "string" && data.currency.trim() 
        ? data.currency.trim().toUpperCase().substring(0, 3) 
        : "EUR";

      // 6. Risposta al Client
      const responsePayload: GetPriceResponse = {
        id: planId,
        price,
        currency,
      };

      res.status(200).json(responsePayload);

    } catch (err: unknown) {
      // 7. Anti Information Disclosure
      const msg = err instanceof Error ? err.message : "Internal error";
      console.error(`[JURIO-PRICE] Errore critico nel recupero prezzo:`, msg);
      
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
}

export async function executeApplyDiscountCoupon(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Controllo utente nel DB e validazione unificata piano/limiti per la feature "apply_coupon"
    const userRef = db.collection("register").doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found: Utente non trovato" });
      return;
    }

    await validateUserPlanAndLimits(uid, "apply_coupon", userSnap);

    // 2. Validazione e Sanitizzazione Input
    const body = (req.body ?? {}) as ApplyCouponRequestBody;
    const couponCodeRaw = typeof body.couponCode === "string" ? body.couponCode : "";

    if (!couponCodeRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Codice coupon mancante o non valido" });
      return;
    }

    // Normalizzazione e sanitizzazione rigorosa per prevenire injection nel path di Firestore
    const normalizedCode = couponCodeRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

    if (!normalizedCode) {
      res.status(400).json({ error: "Bad Request: Formato codice coupon non valido" });
      return;
    }

    // 3. Verifica se l'utente ha già un coupon attivo sul proprio account
    const existingCoupon = userSnap.get("coupon");
    if (existingCoupon) {
      res.status(400).json({ error: "Conflict: Hai già un coupon attivo sul tuo account." });
      return;
    }

    // 4. Controllo esistenza coupon nella collection 'discount'
    const couponRef = db.collection("discount").doc(normalizedCode);
    const couponSnap = await couponRef.get();

    if (!couponSnap.exists) {
      res.status(404).json({ error: "Not Found: Codice promozionale non valido." });
      return;
    }

    const couponData = couponSnap.data() ?? {};

    // 5. Controllo Scadenza Coupon
    const expireField = couponData.expire;
    if (expireField) {
      const expireDate = typeof expireField.toDate === "function" 
        ? expireField.toDate() 
        : new Date(expireField);
        
      if (expireDate < new Date()) {
        res.status(400).json({ error: "Bad Request: Questo coupon è scaduto." });
        return;
      }
    }

    // 6. Preparazione Mappa Coupon da Salvare
    const stripeCouponId = typeof couponData.stripeCustomerId === "string" ? couponData.stripeCustomerId : "";
    const discountPercentage = typeof couponData.discount === "number" ? couponData.discount : 0;
    const durationLabel = typeof couponData.durationLabel === "string" ? couponData.durationLabel : "Applicato con successo";

    const couponMapToSave: Record<string, unknown> = {
      id: stripeCouponId,
      name: normalizedCode,
      discount: discountPercentage,
    };
    
    if (expireField) {
      couponMapToSave.expire = expireField;
    }

    // 7. Salvataggio su Firestore
    await userRef.update({
      coupon: couponMapToSave
    });

    // 8. Risposta di Successo
    const responsePayload: ApplyCouponResponse = {
      status: "SUCCESS",
      coupon: {
        code: normalizedCode,
        percentage: discountPercentage,
        durationLabel: durationLabel
      }
    };

    res.status(200).json(responsePayload);
  });
}