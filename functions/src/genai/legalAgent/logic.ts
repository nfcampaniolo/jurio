import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { validateUserPlanAndLimits, withSecureApiEndpoint } from "../../_utils";
import { getDb, sanitize } from "../../_deps";
import { legalAgentFlow } from "./flow";
import { extractMetadataFromThread } from "../supportAgent/_metadata";
import { 
  setupLegalAgentSse, 
  sendLegalAgentSse, 
  sendLegalAgentSseRaw, 
  persistLegalAgentConversation, 
  migrateChatToFascicolo,
  processFascicoloDocs
} from "./_utils";

const db = getDb();

export async function executeLegalAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    let clientDisconnected = false;

    req.on("aborted", () => {
      clientDisconnected = true;
    });

    res.on("close", () => {
      clientDisconnected = true;
    });

    const body = req.body ?? {};
    const {
      prompt,
      context,
      filters,
      docs,
      metadatiFascicolo,
      action,
      old_chat_uuid,
      new_fascicolo_uuid,
      title,
    } = body;

    // --- Azione: Migrazione Chat a Fascicolo ---
    if (action === "migrate") {
      if (!old_chat_uuid || !new_fascicolo_uuid) {
        res.status(400).json({ error: "Identificativi mancanti per migrazione" });
        return;
      }
      await migrateChatToFascicolo({
        uid,
        oldChatId: old_chat_uuid,
        newFascicoloId: new_fascicolo_uuid,
        title,
      });
      // Predispone i metadati del caso dall'intera chat importata; un errore non blocca la conversione.
      // Attesa limitata: la risposta non deve restare bloccata sulla chiamata al modello.
      const extraction = extractMetadataFromThread(new_fascicolo_uuid, old_chat_uuid).catch((error) => {
        console.error("[legalAgent] Errore estrazione metadati dopo migrazione:", error);
      });
      await Promise.race([extraction, new Promise((resolve) => setTimeout(resolve, 8000))]);
      res.status(200).json({ success: true });
      return;
    }

    // --- Validazioni di base ---
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Bad Request", details: "Parametro 'prompt' mancante." });
      return;
    }

    if (prompt.length > 20_000) {
      res.status(413).json({ error: "Payload Too Large", details: "La richiesta è troppo lunga." });
      return;
    }

    const isFascicolo = context?.type === "fascicolo";
    const fascicoloId = isFascicolo ? context?.fascicolo_uuid ?? null : null;
    const parentId = isFascicolo ? context?.fascicolo_uuid : context?.chat_uuid;
    const threadId = isFascicolo ? context?.thread_uuid ?? null : null;

    if (typeof parentId !== "string" || !parentId.trim()) {
      res.status(400).json({ error: "Bad Request", details: "Identificativo sessione mancante." });
      return;
    }

    if (isFascicolo && !threadId) {
      res.status(400).json({ error: "Bad Request", details: "Thread del fascicolo mancante." });
      return;
    }

    // --- Normalizzazione Dati ---
    const normalizedDocs = Array.isArray(docs)
      ? docs.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 50)
      : [];
    const normalizedFilters = Array.isArray(filters) ? filters : [];
    const normalizedMetadata = (metadatiFascicolo && typeof metadatiFascicolo === "object" && !Array.isArray(metadatiFascicolo))
      ? metadatiFascicolo
      : {};

    const messagesRef = isFascicolo
      ? db.collection("fascicoli").doc(parentId).collection("threads").doc(threadId!).collection("messages")
      : db.collection("chats").doc(parentId).collection("messages");

    const backgroundTasks: Promise<void>[] = [];

    if (isFascicolo && fascicoloId && normalizedDocs.length > 0) {
      backgroundTasks.push(
        processFascicoloDocs(fascicoloId, normalizedDocs).catch((error) => {
          console.error("[legalAgent] Errore processFascicoloDocs:", error);
        })
      );
    }

    // Recupero parallelo di utente e cronologia
    const [userSnap, historySnap] = await Promise.all([
      db.collection("register").doc(uid).get(),
      messagesRef.orderBy("timestamp", "desc").limit(6).get()
    ]);

    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }
    
    // Validazione piano e limiti
    await validateUserPlanAndLimits(uid, "legal_agent", userSnap);

    const dbHistory = historySnap.docs
      .map((doc: admin.firestore.QueryDocumentSnapshot) => {
        const data = doc.data();
        return {
          role: String(data.role ?? "user"),
          content: String(data.content ?? ""),
        };
      })
      .reverse();

    const isFirstMessage = historySnap.empty;

    // Avvio dello streaming Server-Sent Events
    setupLegalAgentSse(res);
    sendLegalAgentSse(res, { status: "Avvio dell'agente legale..." });

    try {
      const flowStream = legalAgentFlow.stream({
        prompt: prompt.trim(),
        filters: normalizedFilters,
        docs: normalizedDocs,
        history: dbHistory,
        isFirstMessage,
        userId: uid,
        fascicoloId,
        metadatiFascicolo: normalizedMetadata,
        fascicoloTitolo: isFascicolo && typeof context?.title === "string" ? context.title : null,
      });

      for await (const chunk of flowStream.stream) {
        if (clientDisconnected || res.writableEnded) break;
        sendLegalAgentSse(res, { message: chunk });
      }

      if (clientDisconnected) {
        console.warn(`[legalAgent] Client disconnesso prematuramente: ${uid}`);
        return; 
      }

      const finalOutput = await flowStream.output;
      const sanitizedResult = sanitize(finalOutput);

      if (!res.writableEnded) {
        sendLegalAgentSse(res, { result: sanitizedResult });
        sendLegalAgentSseRaw(res, "[DONE]");
        res.end();
      }

      backgroundTasks.push(
        persistLegalAgentConversation({
          uid,
          prompt: prompt.trim(),
          result: sanitizedResult,
          messagesRef,
          parentId,
          isFascicolo,
          threadId,
          isFirstMessage,
          contextTitle: context?.title,
        }).catch((error) => {
          console.error("[legalAgent] Errore persistenza:", error);
        })
      );

      await Promise.all(backgroundTasks);
    } catch (streamErr) {
      const msg = streamErr instanceof Error ? streamErr.message : "Internal error";
      console.error("[legalAgent] ERRORE DURANTE LO STREAMING:", streamErr);

      // Se gli header SSE sono già partiti, inviamo l'errore come evento SSE
      if (res.headersSent && !res.writableEnded) {
        try {
          sendLegalAgentSse(res, { error: { message: msg } });
          res.end();
        } catch (_) {
          if (!res.writableEnded) res.end();
        }
        return;
      }
      
      // Altrimenti rilanciamo l'errore per farlo catturare dal wrapper standard
      throw streamErr;
    }
  });
}