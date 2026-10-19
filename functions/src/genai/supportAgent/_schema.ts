import { z } from 'genkit';

//CHAT
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "model", "system"]),
  content: z.string(),
});

//RESEARCH
export const GeminiFallbackInputSchema = z.object({
  query: z.string(),
});

export const GeminiFallbackOutputSchema = z.object({
  sintesi: z.string().describe("Sintesi strutturata (max 3 paragrafi) sull'argomento giuridico."),
  queryAlternativa: z.string().describe("Nuova frase di ricerca semantica ottimizzata con termini tecnici."),
}).nullable();

//METADATI
export const EstraiMetadatiInputSchema = z.object({
  chatContext: z.string(),
  metadatiAttuali: z.record(z.any()),
});

export const EstraiMetadatiOutputSchema = z.object({
  dati_nuovi_o_aggiornati: z.array(
    z.object({
      chiave: z.string().describe("Esempio: 'Giudice', 'Valore Causa', 'Controparte', 'Data Sinistro'"),
      valore: z.string().describe("Il valore estratto. Usa formati standard (es. YYYY-MM-DD per le date) se possibile.")
    })
  )
});