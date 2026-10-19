import { z } from 'genkit';

export const FonteSchema = z.object({
  id: z.string(),
  titolo: z.string(),
  url: z.string().optional(),
  score: z.number().optional(),
});

export const FonteDettagliataSchema = z.object({
  id: z.string().optional().describe("L'identificativo esatto (id) restituito dal tool. DEVE essere sempre conservato per creare il link."),
  url: z.string().optional().describe("L'indirizzo web (url) restituito dal tool, se presente."),
  tipo: z.enum(["Sezioni Unite", "Cassazione", "Merito", "Altra"]).describe("La gerarchia dell'organo giudicante."),
  riferimento: z.string().describe("Estremi della pronuncia (es. Cass. Civ. n. 1234/2023)."),
  data: z.string().optional().describe("Data della pronuncia, se verificata."),
  rilevanza: z.string().describe("Spiegazione sintetica del perché questa specifica fonte è pertinente alla tesi."),
});

export const ContrastoSchema = z.object({
  riferimento: z.string().describe("Estremi della pronuncia contrastante."),
  descrizione: z.string().describe("Breve sintesi dell'orientamento difforme."),
});

export const TesiReviewSchema = z.object({
  id: z.string().describe("Identificativo univoco della tesi analizzata (es. T1, T2)."),
  testoOriginale: z.string().describe("Copia-incolla letterale, contiguo e verbatim dal testo dell'utente. VIETATO parafrasare o correggere errori."),
  tesiGiuridica: z.string().describe("Formulazione sintetica e tecnica della questione giuridica individuata nel frammento."),
  semaforo: z.enum(["VERDE", "GIALLO", "ROSSO"]),
  livelloVerifica: z.enum(["ALTO", "MEDIO", "BASSO"]).describe("Riflette la qualità e la quantità delle fonti trovate, non la correttezza della tesi."),
  motivazione: z.string().describe("Spiegazione tecnica e sintetica del motivo della classificazione a semaforo."),
  orientamento: z.string().describe("Ricostruzione dell'attuale orientamento giurisprudenziale rilevato."),
  fonti: z.array(FonteDettagliataSchema).describe("Fonti REALI restituite dai tool a supporto della decisione."),
  contrasti: z.array(ContrastoSchema).optional().describe("Eventuali orientamenti difformi rilevati."),
  notaRicerca: z.string().optional().describe("Eventuali limitazioni riscontrate durante la ricerca (es. 'Nessuna pronuncia a Sezioni Unite rinvenuta')."),
});

export const ReviewListSchema = z.object({
  tesi: z.array(TesiReviewSchema).describe("Lista delle tesi giuridiche individuate e analizzate. Vuoto se non ci sono tesi rilevanti.")
});