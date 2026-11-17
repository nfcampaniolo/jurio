import { AREE } from "../_constants";

export const JURIO_VECTOR_SEARCH_URL = "https://vectorsearchjurio-vqoobrenua-ew.a.run.app";
export const JURIO_EXTRACT_TEXT_URL = "https://extractdocumenttext-vqoobrenua-ew.a.run.app";
export const JURIO_DOCTRINE_SEARCH_URL = "https://vectorsearchdoctrine-vqoobrenua-ew.a.run.app";

export const NOMI_AREE = Object.values(AREE).join("', '");

// Valori ammessi per il filtro `area` di ricercaSemantica: coincidono con il campo `area` dei documenti in `sentences`,
// assegnato in massimazione scegliendo da AREE.
export const VALORI_AREA = Object.values(AREE) as [string, ...string[]];
