import { Request, Response } from "express";
import { createHash } from "node:crypto";
import { validateUserPlanAndLimits, withSecureApiEndpoint } from "../../_utils";
import { getDb } from "../../_deps";
import { MAX_INPUT_CHARS_DOCUMENT } from "../../_constants";
import { reasoningFlow, doctrineFlow } from "./flow";
import { ReasoningRequestBody, ReasoningFlowOutput } from "../_interfaces";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { createDoctrineEmbeddings } from "./_embedding";

const db = getDb();
const DOCTRINE_UPLOAD_LOCK_MS = 25 * 60 * 1000;

export async function executeReasoning(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Sanitizzazione input
    const body = (req.body ?? {}) as ReasoningRequestBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const promptId = typeof body.promptId === "string" ? body.promptId.trim() : null;
    const extractMultiple = body.extractMultiple === true;
    const requestedMaxDocuments = typeof body.maxDocuments === "number" && Number.isInteger(body.maxDocuments)
      ? Math.min(10, Math.max(1, body.maxDocuments))
      : 10;

    if (!question) {
      res.status(400).json({ error: "Bad Request: Invalid or missing 'question'" });
      return;
    }

    if (question.length > MAX_INPUT_CHARS_DOCUMENT) {
      res.status(413).json({ error: "Payload Too Large: Question exceeds character limit" });
      return;
    }

    // 2. Recupero parallelo del documento utente e conteggio documenti
    const [snap, docsCountSnap] = await Promise.all([
      db.collection("register").doc(uid).get(),
      db.collection("documents").where("userId", "==", uid).count().get().catch(() => null),
    ]);

    if (!snap.exists) {
      throw new Error("NOT_FOUND");
    }

    // 3. Validazione unificata del piano e consumo quote (tramite helper centralizzato)
    await validateUserPlanAndLimits(uid, "reasoning", snap);

    // 4. Controllo limite massimo di 100 documenti
    const currentDocsCount = docsCountSnap?.data().count ?? 0;
    if (currentDocsCount >= 100) {
      res.status(403).json({
        error: "document_limit_reached",
        details: "Hai già raggiunto il limite massimo di 100 documenti analizzati.",
      });
      return;
    }

    // 5. Recupero del prompt custom da Firestore (Privacy Segregation)
    let customPromptText: string | undefined = undefined;

    if (promptId && promptId !== "default") {
      const safePromptId = promptId.replace(/[^a-zA-Z0-9_-]/g, "");

      if (safePromptId) {
        const promptDoc = await db.collection("register").doc(uid).collection("prompts").doc(safePromptId).get();
        
        if (promptDoc.exists) {
          const content = promptDoc.data()?.content;
          customPromptText = typeof content === "string" ? content : undefined;
        } else {
          const publicPromptDoc = await db.collection("prompt_list").doc(safePromptId).get();
          
          if (publicPromptDoc.exists) {
            const content = publicPromptDoc.data()?.content;
            customPromptText = typeof content === "string" ? content : undefined;
          } else {
            console.warn("[JURIO-REASONING] Prompt personalizzato non trovato. Fallback default.");
          }
        }
      }
    }

    // 6. Esecuzione del flow Genkit
    const parsedJson = (await reasoningFlow({
      question,
      customPrompt: customPromptText,
      extractMultiple,
      maxDocuments: Math.min(requestedMaxDocuments, Math.max(1, 100 - currentDocsCount)),
    })) as ReasoningFlowOutput;

    // 7. Risposta al client
    res.status(200).json({
      message: parsedJson,
      status: "SENT_BY_BOT",
      model: "gemini-3.5-flash",
      provider: "google",
    });
  });
}

export async function executeAdminDoctrineUpload(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    const reqId = randomUUID().slice(0, 6);
    console.log(`[DOCTRINE-${reqId}] Inizio elaborazione POST`);

    // 1. Controllo utente e validazione unificata piano/limiti (feature "admin")
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    const planId = String(userSnap.data()?.planId ?? "");
    if (planId !== "admin") {
      console.warn(`[DOCTRINE-${reqId}] Accesso negato per piano non amministrativo`);
      res.status(403).json({
        error: "Forbidden: Only admins can upload doctrine documents.",
      });
      return;
    }

    await validateUserPlanAndLimits(uid, "admin", userSnap);
    console.log(`[DOCTRINE-${reqId}] Autenticazione e quote superate`);

    // 2. Lettura e validazione payload
    const extractedText =
      typeof req.body?.extractedText === "string"
        ? req.body.extractedText.trim()
        : "";

    const sourceUrl =
      typeof req.body?.sourceUrl === "string"
        ? req.body.sourceUrl.trim()
        : "";

    if (!extractedText || !sourceUrl) {
      console.warn(`[DOCTRINE-${reqId}] Payload incompleto. URL: ${!!sourceUrl}, Testo: ${!!extractedText}`);
      res.status(400).json({
        error: "Bad Request: Missing extractedText or sourceUrl",
      });
      return;
    }

    const contentHash = createHash("sha256")
      .update(JSON.stringify([sourceUrl, extractedText]))
      .digest("hex");
    const lockOwner = randomUUID();
    const sourceLockRef = db.collection("doctrine_upload_locks").doc(
      createHash("sha256").update(sourceUrl).digest("hex")
    );
    const lockClaim = await db.runTransaction(async (transaction) => {
      const lockSnap = await transaction.get(sourceLockRef);
      const lock = lockSnap.data();
      const leaseExpiry = lock?.leaseExpiresAt;
      const leaseExpiryMs =
        leaseExpiry instanceof Date
          ? leaseExpiry.getTime()
          : typeof leaseExpiry?.toMillis === "function"
            ? leaseExpiry.toMillis()
            : 0;

      if (lockSnap.exists && leaseExpiryMs > Date.now()) {
        return { claimed: false };
      }

      transaction.set(sourceLockRef, {
        owner: lockOwner,
        contentHash,
        leaseExpiresAt: new Date(Date.now() + DOCTRINE_UPLOAD_LOCK_MS),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { claimed: true };
    });

    if (!lockClaim.claimed) {
      res.status(409).json({
        error: "DOCUMENT_PROCESSING",
        details: "Questo documento è già in elaborazione. Attendi il completamento prima di riprovare.",
      });
      return;
    }

    try {
      console.log(`[DOCTRINE-${reqId}] URL presente: ${Boolean(sourceUrl)} | Testo: ${extractedText.length} caratteri`);

      const previousVersion = await db
        .collection("doctrine")
        .where("contentHash", "==", contentHash)
        .get();

      if (!previousVersion.empty) {
        const existingData = previousVersion.docs[0].data();
        const docBaseId = String(existingData.document_base_id ?? "");
        console.info(`[DOCTRINE-${reqId}] Contenuto già indicizzato (${previousVersion.size} tematiche): salto AI, embedding e scrittura.`);
        res.status(200).json({
          message: "Documento già indicizzato",
          tematiche_estratte: previousVersion.size,
          tematiche_salvate: previousVersion.size,
          docBaseId,
          alreadyIndexed: true,
          processing_time_seconds: 0,
        });
        return;
      }

      // 3. Esecuzione Flow AI
      console.log(`[DOCTRINE-${reqId}] Invocazione doctrineFlow...`);
      const startTime = performance.now();

      const parsedDoctrine = await doctrineFlow({
        extractedText,
        sourceUrl,
      });

      const elapsedTimeSec = Number(
        ((performance.now() - startTime) / 1000).toFixed(1)
      );

      if (!parsedDoctrine?.tematiche || parsedDoctrine.tematiche.length === 0) {
        throw new Error("L'AI non ha estratto alcuna tematica dal documento.");
      }

      console.log(`[DOCTRINE-${reqId}] Gemini completato in ${elapsedTimeSec}s. Tematiche: ${parsedDoctrine.tematiche.length}`);

      const embeddingByTopic: Array<number[] | undefined> = new Array(parsedDoctrine.tematiche.length);
      const embeddingInputs = parsedDoctrine.tematiche
        .map((tema, index) => {
          const text = tema.summary;
          return typeof text === "string" && text.trim()
            ? { index, text: text.trim() }
            : null;
        })
        .filter((entry): entry is { index: number; text: string } => entry !== null);
      const embeddingTopicIndexes = new Set(embeddingInputs.map(({ index }) => index));
      const embeddingStartedAt = Date.now();
      const embeddings = await createDoctrineEmbeddings(
        embeddingInputs.map(({ text }) => text),
        reqId
      );
      let embeddingCount = 0;
      embeddingInputs.forEach(({ index }, inputIndex) => {
        const embedding = embeddings[inputIndex];
        if (embedding) {
          embeddingByTopic[index] = embedding;
          embeddingCount += 1;
        }
      });
      if (embeddingInputs.length > 0) {
        console.info(
          `[DOCTRINE-${reqId}] Embedding in batch: ${embeddingCount}/${embeddingInputs.length} tematiche in ${Date.now() - embeddingStartedAt}ms`
        );
      }

      // 4. Rimozione documenti esistenti (stesso sourceUrl)
      console.log(`[DOCTRINE-${reqId}] Ricerca documenti esistenti`);
      const existingDocsSnap = await db
        .collection("doctrine")
        .where("sourceUrl", "==", sourceUrl)
        .get();

      if (!existingDocsSnap.empty) {
        console.log(`[DOCTRINE-${reqId}] Trovati ${existingDocsSnap.size} documenti esistenti da eliminare.`);
        const DELETE_BATCH_SIZE = 450;
        let deletedCount = 0;

        for (let i = 0; i < existingDocsSnap.docs.length; i += DELETE_BATCH_SIZE) {
          const deleteBatch = db.batch();
          const chunk = existingDocsSnap.docs.slice(i, i + DELETE_BATCH_SIZE);

          chunk.forEach((docSnap) => {
            deleteBatch.delete(docSnap.ref);
          });

          await deleteBatch.commit();
          deletedCount += chunk.length;
        }

        console.log(`[DOCTRINE-${reqId}] Eliminazione completata. Rimossi ${deletedCount} vecchi documenti.`);
      } else {
        console.log(`[DOCTRINE-${reqId}] Nessun documento esistente trovato per il sourceUrl specificato.`);
      }

      // 5. Generazione ID documento e salvataggio batch su Firestore
      const documentBaseId = randomUUID();
      const doctrineCollection = db.collection("doctrine");

      const BATCH_SIZE = 450;
      let savedCount = 0;

      for (let start = 0; start < parsedDoctrine.tematiche.length; start += BATCH_SIZE) {
        const batch = db.batch();
        const batchItems = parsedDoctrine.tematiche.slice(start, start + BATCH_SIZE);

        batchItems.forEach((tema, localIndex) => {
          const index = start + localIndex;
          const nodeDocId = `${documentBaseId}_theme_${index}`;
          const nodeRef = doctrineCollection.doc(nodeDocId);
          const embedding = embeddingByTopic[index];
          const hasEmbeddingText = embeddingTopicIndexes.has(index);

          batch.set(nodeRef, {
            id: nodeDocId,
            document_base_id: documentBaseId,
            ...tema,
            sourceUrl,
            contentHash,
            uploaded_by: uid,
            created_at: FieldValue.serverTimestamp(),
            ...(embedding
              ? {
                  embedding: FieldValue.vector(embedding),
                  lastVectorizedAt: FieldValue.serverTimestamp(),
                  isEmbeddingFinished: true,
                }
              : {
                  isEmbeddingFinished: !hasEmbeddingText,
                }),
            isEmbeddingFailed: false,
          });
        });

        await batch.commit();
        savedCount += batchItems.length;

        console.log(`[DOCTRINE-${reqId}] Batch Firestore ${Math.floor(start / BATCH_SIZE) + 1} completato: ${batchItems.length} documenti`);
      }

      console.log(`[DOCTRINE-${reqId}] Operazione conclusa. Salvati ${savedCount} documenti.`);

      // 6. Risposta finale
      res.status(200).json({
        message: "Documento indicizzato con successo",
        tematiche_estratte: parsedDoctrine.tematiche.length,
        tematiche_salvate: savedCount,
        docBaseId: documentBaseId,
        processing_time_seconds: elapsedTimeSec,
      });
    } finally {
      await db.runTransaction(async (transaction) => {
        const lockSnap = await transaction.get(sourceLockRef);
        if (lockSnap.exists && lockSnap.data()?.owner === lockOwner) {
          transaction.delete(sourceLockRef);
        }
      });
    }
  });
}
