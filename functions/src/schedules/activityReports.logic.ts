import { getDb, getAdminStorage } from "../_deps";
import { logSafeError } from "../_logging";

/**
 * Report mensili di attività per il controllo qualità dell'applicativo.
 * Contengono i contenuti degli utenti: vengono salvati in reports/ (nessuna regola client → solo Admin SDK/console).
 *
 * - reports/conversations/monthly/{YYYY_MM}.json → chat e fascicoli (thread + messaggi)
 * - reports/deep_analysis/monthly/{YYYY_MM}.json → deep_analysis_sessions
 */

const MAX_TEXT_CHARS = 6000;
const READ_CONCURRENCY = 10;
const STUCK_JOB_MS = 30 * 60 * 1000;

type Plain = string | number | boolean | null | Plain[] | { [key: string]: Plain };

export interface MonthRange {
  start: Date;
  end: Date;
  meseId: string;
  meseDescrittivo: string;
}

export function getPreviousMonthRange(now: Date = new Date()): MonthRange {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const meseId = `${start.getFullYear()}_${String(start.getMonth() + 1).padStart(2, "0")}`;
  const raw = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(start);
  return { start, end, meseId, meseDescrittivo: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

// ----------------------------------------------------------------------------
// Utility di normalizzazione
// ----------------------------------------------------------------------------

function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function toIso(value: unknown): string | null {
  const ms = toMillis(value);
  return ms === null ? null : new Date(ms).toISOString();
}

/** Converte ricorsivamente un valore Firestore in JSON leggibile (Timestamp → ISO, undefined rimossi). */
export function toPlain(value: unknown): Plain {
  if (value === undefined || value === null) return null;
  const ms = toMillis(value);
  if (ms !== null) return new Date(ms).toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    const out: Record<string, Plain> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (inner !== undefined) out[key] = toPlain(inner);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function truncateText(value: unknown): { testo: string; troncato?: true; lunghezza_originale?: number } {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  if (text.length <= MAX_TEXT_CHARS) return { testo: text };
  return { testo: `${text.slice(0, MAX_TEXT_CHARS)}…`, troncato: true, lunghezza_originale: text.length };
}

function secondsBetween(from: unknown, to: unknown): number | null {
  const a = toMillis(from);
  const b = toMillis(to);
  return a === null || b === null ? null : Math.round((b - a) / 1000);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getUserPlans(uids: string[]): Promise<Record<string, string | null>> {
  const db = getDb();
  const entries = await mapWithConcurrency(uids, READ_CONCURRENCY, async (uid) => {
    const snap = await db.collection("register").doc(uid).get();
    return [uid, snap.exists ? (snap.data()?.planId ?? null) : null] as const;
  });
  return Object.fromEntries(entries);
}

async function saveReport(path: string, report: unknown): Promise<void> {
  await getAdminStorage().bucket().file(path).save(JSON.stringify(report, null, 2), {
    contentType: "application/json",
    metadata: { cacheControl: "private, no-store" },
  });
}

// ----------------------------------------------------------------------------
// Report 1: chat e fascicoli
// ----------------------------------------------------------------------------

interface ReportMessage {
  id: string;
  ora: string | null;
  ruolo: string;
  testo: string;
  troncato?: true;
  lunghezza_originale?: number;
  migrato?: true;
  fonti?: Plain[];
}

interface ConversationSignals {
  messaggi_utente: number;
  messaggi_modello: number;
  risposte_vuote: number;
  risposte_senza_fonti: number;
  domande_senza_risposta: number;
  lunghezza_media_risposta: number;
}

function summarizeSource(source: unknown): Plain {
  if (!source || typeof source !== "object") return toPlain(source);
  const s = source as Record<string, unknown>;
  return toPlain({
    tipo: s._type ?? null,
    identificativo: s.identificativo ?? s.titolo ?? s.title ?? null,
    documento_id: s.documento_id ?? null,
    organo_giudicante: s.organo_giudicante ?? null,
    data_pubblicazione: s.data_pubblicazione ?? null,
    match_percentage: s.match_percentage ?? null,
    url: s.url_riferimento ?? null,
  });
}

function mapMessage(doc: FirebaseFirestore.QueryDocumentSnapshot): ReportMessage {
  const data = doc.data();
  const role = String(data.role ?? "user");
  const message: ReportMessage = {
    id: doc.id,
    ora: toIso(data.timestamp ?? data.createdAt),
    ruolo: role === "model" ? "assistente" : role === "user" ? "utente" : role,
    ...truncateText(data.content),
  };
  if (data.migrated) message.migrato = true;
  if (role === "model") {
    message.fonti = Array.isArray(data.sources) ? data.sources.map(summarizeSource) : [];
  }
  return message;
}

export function computeConversationSignals(messages: ReportMessage[]): ConversationSignals {
  const user = messages.filter((m) => m.ruolo === "utente");
  const model = messages.filter((m) => m.ruolo === "assistente");
  const unanswered = messages.filter((m, i) => m.ruolo === "utente" && messages[i + 1]?.ruolo !== "assistente").length;
  const totalModelLength = model.reduce((sum, m) => sum + (m.lunghezza_originale ?? m.testo.length), 0);
  return {
    messaggi_utente: user.length,
    messaggi_modello: model.length,
    risposte_vuote: model.filter((m) => !m.testo.trim()).length,
    risposte_senza_fonti: model.filter((m) => (m.fonti?.length ?? 0) === 0).length,
    domande_senza_risposta: unanswered,
    lunghezza_media_risposta: model.length ? Math.round(totalModelLength / model.length) : 0,
  };
}

async function readMessagesInRange(
  ref: FirebaseFirestore.CollectionReference,
  range: MonthRange
): Promise<ReportMessage[]> {
  const snap = await ref
    .where("timestamp", ">=", range.start)
    .where("timestamp", "<", range.end)
    .orderBy("timestamp", "asc")
    .get();
  return snap.docs.map(mapMessage);
}

interface UserConversations {
  chat: Record<string, Plain>[];
  fascicoli: Record<string, Plain>[];
}

export async function buildConversationsReport(range: MonthRange) {
  const db = getDb();

  // updatedAt >= inizio mese (senza limite superiore): un'attività successiva non deve escludere quella del mese
  const [chatSnap, fascicoliSnap] = await Promise.all([
    db.collection("chats").where("updatedAt", ">=", range.start).get(),
    db.collection("fascicoli").where("updatedAt", ">=", range.start).get(),
  ]);

  const byUser: Record<string, UserConversations> = {};
  const bucketFor = (uid: string) => (byUser[uid] ??= { chat: [], fascicoli: [] });

  const chats = await mapWithConcurrency(chatSnap.docs, READ_CONCURRENCY, async (chatDoc) => {
    const data = chatDoc.data();
    const messaggi = await readMessagesInRange(chatDoc.ref.collection("messages"), range);
    return { uid: String(data.user ?? "sconosciuto"), data, id: chatDoc.id, messaggi };
  });

  for (const chat of chats) {
    if (chat.messaggi.length === 0) continue;
    bucketFor(chat.uid).chat.push({
      id: chat.id,
      titolo: toPlain(chat.data.title ?? null),
      creata_il: toIso(chat.data.createdAt),
      aggiornata_il: toIso(chat.data.updatedAt),
      segnali: toPlain(computeConversationSignals(chat.messaggi)),
      messaggi: toPlain(chat.messaggi),
    });
  }

  const fascicoli = await mapWithConcurrency(fascicoliSnap.docs, READ_CONCURRENCY, async (fascicoloDoc) => {
    const data = fascicoloDoc.data();
    const threadsSnap = await fascicoloDoc.ref.collection("threads").get();
    const threads = await mapWithConcurrency(threadsSnap.docs, READ_CONCURRENCY, async (threadDoc) => {
      const threadData = threadDoc.data();
      const messaggi = await readMessagesInRange(threadDoc.ref.collection("messages"), range);
      return { id: threadDoc.id, data: threadData, messaggi };
    });
    return { uid: String(data.user ?? "sconosciuto"), id: fascicoloDoc.id, data, threads };
  });

  for (const fascicolo of fascicoli) {
    const activeThreads = fascicolo.threads
      .filter((t) => t.messaggi.length > 0)
      .sort((a, b) => (a.messaggi[0].ora ?? "").localeCompare(b.messaggi[0].ora ?? ""));
    const updatedInMonth = (toMillis(fascicolo.data.updatedAt) ?? 0) < range.end.getTime();
    // Senza messaggi nel mese il fascicolo resta solo se modificato nel mese (es. metadati o titolo)
    if (activeThreads.length === 0 && !updatedInMonth) continue;

    bucketFor(fascicolo.uid).fascicoli.push({
      id: fascicolo.id,
      titolo: toPlain(fascicolo.data.title ?? null),
      creato_il: toIso(fascicolo.data.createdAt),
      aggiornato_il: toIso(fascicolo.data.updatedAt),
      condiviso_con_utenti: Array.isArray(fascicolo.data.visibleTo) ? fascicolo.data.visibleTo.length : 0,
      metadati: toPlain(fascicolo.data.metadati ?? {}),
      metadati_controllati_il: toIso(fascicolo.data.metadatiCheckedAt),
      thread_totali: fascicolo.threads.length,
      thread: activeThreads.map((t) => ({
        id: t.id,
        titolo: toPlain(t.data.title ?? null),
        creato_il: toIso(t.data.createdAt),
        aggiornato_il: toIso(t.data.updatedAt),
        segnali: toPlain(computeConversationSignals(t.messaggi)),
        messaggi: toPlain(t.messaggi),
      })),
    });
  }

  const uids = Object.keys(byUser).sort((a, b) => a.localeCompare(b));
  const plans = await getUserPlans(uids);
  const firstMessageTime = (entry: Record<string, Plain>) => {
    const msgs = (entry.messaggi ?? (entry.thread as Record<string, Plain>[] | undefined)?.[0]?.messaggi) as
      | Array<{ ora: string | null }>
      | undefined;
    return msgs?.[0]?.ora ?? String(entry.aggiornato_il ?? "");
  };

  const totals = { utenti: uids.length, chat: 0, fascicoli: 0, thread: 0, messaggi: 0, risposte_vuote: 0, risposte_senza_fonti: 0, domande_senza_risposta: 0 };
  const utenti = uids.map((uid) => {
    const entry = byUser[uid];
    entry.chat.sort((a, b) => firstMessageTime(a).localeCompare(firstMessageTime(b)));
    entry.fascicoli.sort((a, b) => firstMessageTime(a).localeCompare(firstMessageTime(b)));

    const signals = [
      ...entry.chat.map((c) => c.segnali),
      ...entry.fascicoli.flatMap((f) => (f.thread as Record<string, Plain>[]).map((t) => t.segnali)),
    ] as unknown as ConversationSignals[];
    const messaggi = signals.reduce((sum, s) => sum + s.messaggi_utente + s.messaggi_modello, 0);

    totals.chat += entry.chat.length;
    totals.fascicoli += entry.fascicoli.length;
    totals.thread += entry.fascicoli.reduce((sum, f) => sum + (f.thread as unknown[]).length, 0);
    totals.messaggi += messaggi;
    for (const s of signals) {
      totals.risposte_vuote += s.risposte_vuote;
      totals.risposte_senza_fonti += s.risposte_senza_fonti;
      totals.domande_senza_risposta += s.domande_senza_risposta;
    }

    return {
      uid,
      piano: plans[uid] ?? null,
      riepilogo: { chat: entry.chat.length, fascicoli: entry.fascicoli.length, messaggi },
      chat: entry.chat,
      fascicoli: entry.fascicoli,
    };
  });

  return {
    type: "monthly_conversations_activity",
    mese_id: range.meseId,
    mese_descrittivo: range.meseDescrittivo,
    periodo: { da: range.start.toISOString(), a: range.end.toISOString() },
    generato_il: new Date().toISOString(),
    guida_lettura: [
      "Report delle conversazioni con l'agente legale nel mese, raggruppate per utente (uid).",
      "Ogni utente ha 'chat' (conversazioni libere) e 'fascicoli' (pratiche con metadati e uno o più 'thread').",
      "I messaggi sono in ordine cronologico; ruolo 'utente' = domanda, 'assistente' = risposta del modello con le relative 'fonti'.",
      "Sono inclusi solo i messaggi del periodo; testi oltre " + MAX_TEXT_CHARS + " caratteri sono troncati ('troncato': true).",
      "'segnali' riassume possibili anomalie: risposte vuote, risposte senza fonti, domande senza risposta, lunghezza media delle risposte.",
      "Obiettivo dell'analisi: individuare errori, risposte non pertinenti o non supportate da fonti, metadati estratti male e possibili miglioramenti.",
    ],
    riepilogo: totals,
    utenti,
  };
}

// ----------------------------------------------------------------------------
// Report 2: deep_analysis_sessions
// ----------------------------------------------------------------------------

function countSources(mappa: unknown): { favorevoli: number; contrarie: number; escluse: number } {
  const m = (mappa ?? {}) as Record<string, { fonti?: Array<{ escluso?: boolean }> } | undefined>;
  const fav = Array.isArray(m.orientamentoFavorevole?.fonti) ? m.orientamentoFavorevole!.fonti! : [];
  const con = Array.isArray(m.orientamentoContrario?.fonti) ? m.orientamentoContrario!.fonti! : [];
  return {
    favorevoli: fav.length,
    contrarie: con.length,
    escluse: [...fav, ...con].filter((f) => f?.escluso === true).length,
  };
}

export function mapDeepAnalysisSession(id: string, data: FirebaseFirestore.DocumentData, nowMs: number) {
  const job = (data.job ?? {}) as Record<string, unknown>;
  const progress = (data.progress ?? {}) as Record<string, unknown>;
  const status = String(data.status ?? "sconosciuto");
  const jobStatus = typeof job.status === "string" ? job.status : null;
  const jobRefMs = toMillis(job.startedAt) ?? toMillis(job.createdAt);
  const fonti = countSources(data.mappaDialettica);
  const hasResult = Boolean(data.inquadramento) && Boolean(data.mappaDialettica);

  const anomalie: string[] = [];
  if (jobStatus === "failed") anomalie.push("job_fallito");
  if ((jobStatus === "queued" || jobStatus === "processing") && jobRefMs !== null && nowMs - jobRefMs > STUCK_JOB_MS) {
    anomalie.push("job_bloccato");
  }
  if (typeof job.attemptCount === "number" && job.attemptCount > 1) anomalie.push("tentativi_multipli");
  if ((status === "review" || status === "completed") && !hasResult) anomalie.push("risultato_mancante");
  if (status === "completed" && !data.sintesiStrategica) anomalie.push("sintesi_mancante");
  if (hasResult && fonti.favorevoli + fonti.contrarie === 0) anomalie.push("nessuna_fonte_reperita");
  if (status === "draft" && !jobStatus) anomalie.push("sessione_mai_avviata");

  const documenti = Array.isArray(data.documentiAllegati) ? data.documentiAllegati : [];

  return {
    id,
    titolo: toPlain(data.title ?? null),
    stato: status,
    creata_il: toIso(data.createdAt),
    aggiornata_il: toIso(data.updatedAt),
    quesito: truncateText(data.promptOriginale).testo,
    configurazione: toPlain(data.configurazione ?? null),
    documenti_allegati: documenti.map((d: unknown) => {
      const doc = (d ?? {}) as Record<string, unknown>;
      return toPlain({ id: doc.id ?? null, nome: doc.nome_file ?? doc.name ?? doc.fileName ?? null });
    }),
    ultimo_job: jobStatus
      ? toPlain({
          azione: job.action ?? null,
          stato: jobStatus,
          tentativi: job.attemptCount ?? 0,
          direttiva_hitl: job.direttivaHitl ?? null,
          in_coda_il: toIso(job.createdAt),
          avviato_il: toIso(job.startedAt),
          completato_il: toIso(job.completedAt),
          attesa_in_coda_secondi: secondsBetween(job.createdAt, job.startedAt),
          durata_secondi: secondsBetween(job.startedAt, job.completedAt),
        })
      : null,
    ultimo_progresso: toPlain({
      fase: progress.phase ?? null,
      stato: progress.status ?? null,
      messaggio: progress.message ?? null,
      aggiornato_il: toIso(progress.updatedAt),
    }),
    segnali: { anomalie, fonti },
    risultato: toPlain({
      inquadramento: data.inquadramento ?? null,
      mappaDialettica: data.mappaDialettica ?? null,
      mappaConcettuale: data.mappaConcettuale ?? null,
      fontiUsate: data.fontiUsate ?? [],
      sintesiStrategica: data.sintesiStrategica ?? null,
    }),
  };
}

export async function buildDeepAnalysisReport(range: MonthRange) {
  const db = getDb();
  const snap = await db.collection("deep_analysis_sessions").where("updatedAt", ">=", range.start).get();
  const nowMs = Date.now();

  const byUser: Record<string, ReturnType<typeof mapDeepAnalysisSession>[]> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    const createdMs = toMillis(data.createdAt);
    if (createdMs !== null && createdMs >= range.end.getTime()) continue; // nata dopo il periodo
    const uid = String(data.user ?? "sconosciuto");
    (byUser[uid] ??= []).push(mapDeepAnalysisSession(doc.id, data, nowMs));
  }

  const uids = Object.keys(byUser).sort((a, b) => a.localeCompare(b));
  const plans = await getUserPlans(uids);
  const perStato: Record<string, number> = {};
  const perAnomalia: Record<string, number> = {};
  let sessioni = 0;

  const utenti = uids.map((uid) => {
    const list = byUser[uid].sort((a, b) => (a.creata_il ?? "").localeCompare(b.creata_il ?? ""));
    for (const s of list) {
      sessioni++;
      perStato[s.stato] = (perStato[s.stato] ?? 0) + 1;
      for (const a of s.segnali.anomalie) perAnomalia[a] = (perAnomalia[a] ?? 0) + 1;
    }
    return { uid, piano: plans[uid] ?? null, sessioni_count: list.length, sessioni: list };
  });

  return {
    type: "monthly_deep_analysis_activity",
    mese_id: range.meseId,
    mese_descrittivo: range.meseDescrittivo,
    periodo: { da: range.start.toISOString(), a: range.end.toISOString() },
    generato_il: new Date().toISOString(),
    guida_lettura: [
      "Report delle indagini di Deep Analysis attive nel mese, raggruppate per utente (uid) e ordinate per data di creazione.",
      "Flusso: 'draft' → start_research → 'review' (inquadramento + mappaDialettica + mappaConcettuale) → eventuali refine_research → generate_synthesis → 'completed' (sintesiStrategica).",
      "'ultimo_job' descrive solo l'ultima elaborazione (non lo storico): tempi di coda, durata e tentativi.",
      "'segnali.anomalie' elenca problemi rilevati automaticamente; 'segnali.fonti' conta i precedenti favorevoli/contrari e quelli esclusi a mano dall'utente.",
      "Lo stato riflette il momento di generazione del report, che può essere successivo alla fine del mese.",
      "Obiettivo dell'analisi: valutare coerenza tra quesito e risultato, qualità e pertinenza delle fonti, errori e lentezze dei job, possibili miglioramenti.",
    ],
    riepilogo: { utenti: uids.length, sessioni, per_stato: perStato, per_anomalia: perAnomalia },
    utenti,
  };
}

// ----------------------------------------------------------------------------
// Entry point del cron
// ----------------------------------------------------------------------------

export async function computeAndSaveMonthlyActivityReports(now: Date = new Date()) {
  const range = getPreviousMonthRange(now);
  const conversationsPath = `reports/conversations/monthly/${range.meseId}.json`;
  const deepAnalysisPath = `reports/deep_analysis/monthly/${range.meseId}.json`;

  // I due report sono indipendenti: il fallimento di uno non blocca l'altro
  const [conversations, deepAnalysis] = await Promise.allSettled([
    buildConversationsReport(range).then(async (report) => {
      await saveReport(conversationsPath, report);
      return report.riepilogo;
    }),
    buildDeepAnalysisReport(range).then(async (report) => {
      await saveReport(deepAnalysisPath, report);
      return report.riepilogo;
    }),
  ]);

  if (conversations.status === "rejected") logSafeError("MONTHLY_CONVERSATIONS_REPORT_FAILED", conversations.reason);
  if (deepAnalysis.status === "rejected") logSafeError("MONTHLY_DEEP_ANALYSIS_REPORT_FAILED", deepAnalysis.reason);
  if (conversations.status === "rejected") throw conversations.reason;
  if (deepAnalysis.status === "rejected") throw deepAnalysis.reason;

  return {
    mese_id: range.meseId,
    conversazioni: { path: conversationsPath, ...conversations.value },
    deep_analysis: { path: deepAnalysisPath, ...deepAnalysis.value },
  };
}
