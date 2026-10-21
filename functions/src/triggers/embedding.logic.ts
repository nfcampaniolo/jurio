import { FirestoreEvent, Change, DocumentSnapshot } from "firebase-functions/v2/firestore";
import { FieldValue, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getDb } from "../_deps";
import { applyTeamVisibility } from "./_helper";
import OpenAI from "openai";

const db = getDb();

export async function handleEmbeddingCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const docId = event.params.docId;

  // Selezione del testo
  let textToEmbed = data.summary || data.massima || data.sintesi;
  if (!textToEmbed) {
    textToEmbed = data.tipo_documento === "documento_giurisprudenza_generico" 
      ? (data.nucleo || data.sintesi) 
      : data.fattispecie_rilevante;
  }

  if (!textToEmbed || typeof textToEmbed !== "string" || textToEmbed.trim() === "") {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: textToEmbed.trim(),
      dimensions: 1536
    });
    
    const embedding = response.data[0].embedding;

    await snap.ref.update({
      isEmbeddingFinished: true,
      embedding: FieldValue.vector(embedding),
      lastVectorizedAt: FieldValue.serverTimestamp(),
      // Pulizia eventuale array se presente
      ...(Array.isArray(data.testo_integrale) ? { testo_integrale: FieldValue.delete() } : {})
    });

    console.log(`✅ Embedding creato per sentence: ${docId}`);
  } catch (error) {
    console.error(`❌ Error embedding sentence ${docId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}

export async function handleEmbeddingManualCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const docId = event.params.docId;

  // Selezione del testo
  let textToEmbed = data.text;

  if (!textToEmbed || typeof textToEmbed !== "string" || textToEmbed.trim() === "") {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: textToEmbed.trim(),
      dimensions: 1536
    });
    
    const embedding = response.data[0].embedding;

    await snap.ref.update({
      isEmbeddingFinished: true,
      embedding: FieldValue.vector(embedding),
      lastVectorizedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Embedding creato per sentence: ${docId}`);
  } catch (error) {
    console.error(`❌ Error embedding sentence ${docId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}

export async function handleEmbeddingDocumentCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const parentId = event.params.docId;
  
  // Prepariamo gli input per OpenAI
  const inputsToEmbed: string[] = [];
  const metadataMapping: string[] = []; 
  const chunksToEmbed: string[] = Array.isArray(data.testo_integrale) ? data.testo_integrale : [];

  // Gestione testo principale (Metadata)
  let mainText = data.summary || data.massima || data.text || data.contenuto;
  if (!mainText && typeof data.testo_integrale === "string") {
    mainText = data.testo_integrale;
  }

  if (mainText && typeof mainText === "string" && mainText.trim() !== "") {
    inputsToEmbed.push(mainText.trim());
    metadataMapping.push("embedding"); // Il campo nel doc padre dove salvare il vettore principale
  }

  // Se non c'è nulla da processare
  if (inputsToEmbed.length === 0 && chunksToEmbed.length === 0) {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  // Uniamo tutto in un'unica chiamata batch per risparmiare tempo e costi
  const fullInputArray = [...inputsToEmbed, ...chunksToEmbed];

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: fullInputArray,
      dimensions: 1536
    });
    const embeddingsResult = response.data.map(d => d.embedding);

    const batch = db.batch();
    
    // A. Update Padre
    const parentUpdate: any = {
      isEmbeddingFinished: true,
      testo_integrale: FieldValue.delete(),
      lastVectorizedAt: FieldValue.serverTimestamp()
    };

    metadataMapping.forEach((fieldName, index) => {
      parentUpdate[fieldName] = FieldValue.vector(embeddingsResult[index]);
    });
    batch.update(snap.ref, parentUpdate);

    // B. Creazione Chunks
    const metadataCount = metadataMapping.length;
    chunksToEmbed.forEach((chunkText, i) => {
      const vectorIndex = metadataCount + i;
      const chunkDocRef = db.collection("document_chunks").doc(`${parentId}_chunk_${i}`);
      
      batch.set(chunkDocRef, {
        parentId: parentId,
        text: chunkText,
        index: i,
        embedding: FieldValue.vector(embeddingsResult[vectorIndex]),
        urn: data.urn || null,
        organo_giudicante: data.organo_giudicante || null,
        sezione: data.sezione || null,
        dataSentenza: data.dataSentenza || null,
        tipo_documento: data.tipo_documento || null,
        tipo_ordinanza: data.tipo_ordinanza || null,
        tipo_massima: data.tipo_massima || null,
        fascicoloId: data.fascicoloId || null,
        user: data.user || null,
        nome_file: data.nome_file || null,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`✅ Documento ${parentId} completato con ${chunksToEmbed.length} chunk.`);
    await applyTeamVisibility(snap.ref, snap.data())

  } catch (error) {
    console.error(`❌ Critical error embedding document ${parentId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}

export async function handleChunkEmbedding(
  event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { docId: string }>
) {
  const snap = event.data?.after;
  if (!snap || !snap.exists) return; // Documento eliminato

  const data = snap.data();
  if (!data) return;

  // 1. GUARDIA: Evitiamo loop infiniti
  // Se l'embedding esiste già o abbiamo segnato un fallimento, usciamo.
  if (data.embedding || data.isEmbeddingFailed) return;

  // 2. Controllo presenza testo
  const textToEmbed = data.text;
  if (!textToEmbed || typeof textToEmbed !== "string") {
    console.warn(`Chunk ${event.params.docId} non contiene testo valido.`);
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3. Generazione Embedding (Singolo input)
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
      dimensions: 1536
    });

    const vector = response.data[0].embedding;

    // 4. Salvataggio del vettore nel documento del chunk
    await snap.ref.update({
      embedding: FieldValue.vector(vector),
      processedAt: FieldValue.serverTimestamp(),
      isEmbeddingFailed: FieldValue.delete() // Rimuoviamo eventuali flag di errore precedenti
    });

    console.log(`✅ Embedding creato con successo per il chunk: ${event.params.docId}`);
    await applyTeamVisibility(snap.ref, snap.data())
  } catch (error) {
    console.error(`❌ Errore embedding per chunk ${event.params.docId}:`, error);
    
    // Segnamo il fallimento per evitare loop infiniti e per monitoraggio
    await snap.ref.update({ 
      isEmbeddingFailed: true,
      errorDetails: error instanceof Error ? error.message : "Unknown error"
    });
  }
}