import { z } from 'genkit';

const SafeString = z.preprocess((val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}, z.string());

const SafeStringArray = z.preprocess((val) => {
  if (val === null || val === undefined) return [];
  if (typeof val === "string") return val.trim() !== "" ? [val] : [];
  if (Array.isArray(val)) return val.map(v => v === null || v === undefined ? "" : String(v));
  return [String(val)];
}, z.array(z.string()));

const SafeNumber = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseInt(val.replace(/\D/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}, z.number());

const PrecedenteSchema = z.object({
  sezione: SafeString,
  numero: SafeString,
  anno: SafeNumber,
});

// Vertex AI validates structured output against the JSON schema before the
// local Zod preprocessors run. Ask the model for the year as text, then coerce
// it to a number with DoctrineOutputSchema before returning/saving the result.
const PrecedenteGenerationSchema = z.object({
  sezione: SafeString,
  numero: SafeString,
  anno: SafeString,
});

const SafePrecedentiArray = z.preprocess((val) => {
  if (!Array.isArray(val)) return [];
  return val.map(item => (typeof item === 'object' && item !== null) ? item : {});
}, z.array(PrecedenteSchema));

const TemaDottrinaSchema = z.object({
  tipo_documento: SafeString,
  origine: SafeString,
  numero_anno: SafeString,
  data_documento: SafeString,
  tematica: SafeString,
  questione_di_diritto: SafeString,
  orientamento: SafeString,
  tipo_orientamento: SafeString,
  sezioni_coinvolte: SafeStringArray,
  materia: SafeString,
  norme_citate: SafeStringArray,
  precedenti_citati: SafePrecedentiArray,
  tag: SafeStringArray,
  summary: SafeString,
  pagine: SafeString,
  testo: SafeString,
});

const SafePrecedentiGenerationArray = z.preprocess((val) => {
  if (!Array.isArray(val)) return [];
  return val.map(item => (typeof item === 'object' && item !== null) ? item : {});
}, z.array(PrecedenteGenerationSchema));

const TemaDottrinaGenerationSchema = TemaDottrinaSchema.extend({
  precedenti_citati: SafePrecedentiGenerationArray,
});

export const DoctrineGenerationSchema = z.object({
  tematiche: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(TemaDottrinaGenerationSchema)
  ),
});

export const DoctrineOutputSchema = z.object({
  tematiche: z.preprocess(
    (val) => (Array.isArray(val) ? val : []), 
    z.array(TemaDottrinaSchema)
  ),
});
