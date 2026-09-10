// src/features/analisi/hooks/usePrecedente.ts

import { useEffect, useState } from "react";
import { doc, getDoc, type Timestamp } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";

export interface PrecedenteDocumento {
  id: string;
  numero_sentenza?: string | null;
  organo_giudicante?: string | null;
  data_sentenza?: string | null;
  dataSentenza?: Timestamp | null;
  presidente?: string | null;
  relatore?: string | null;
  sezione?: string | null;
  materia?: string | null;
  grado_giudizio?: string | null;
  tipo_documento?: string | null;
  tipo_massima?: string | null;
  massima?: string | null;
  sintesi?: string | null;
  fatti?: string | null;
  fattispecie_rilevante?: string | null;
  questione_di_diritto?: string | null;
  ratio_decidendi?: string | null;
  contenuto_precettivo?: string | null;
  riferimenti_normativi?: string[];
  precedenti_richiamati?: string[];
  sottocategoria?: string[];
  note?: string | null;
  fonte?: string | null;
  ecli?: string | null;
  urn?: string | null;
}

interface UsePrecedenteResult {
  precedente: PrecedenteDocumento | null;
  loading: boolean;
  error: string | null;
}

export function usePrecedente(
  id: string | null | undefined,
  enabled = true
): UsePrecedenteResult {
  const [precedente, setPrecedente] = useState<PrecedenteDocumento | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrecedente() {
      // Controllo di validità: se l'ID contiene "/" non è un ID di documento Firestore valido (ha un numero dispari di segmenti)
      if (!enabled || !id || (typeof id === 'string' && id.includes('/'))) {
        setPrecedente(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const db = await getDb();
        const ref = doc(db, "sentences", id);
        const snapshot = await getDoc(ref);

        if (cancelled) return;

        if (!snapshot.exists()) {
          setPrecedente(null);
          setError(`Precedente non trovato: ${id}`);
          return;
        }

        setPrecedente({
          id: snapshot.id,
          ...(snapshot.data() as Omit<PrecedenteDocumento, "id">),
        });
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("[usePrecedente] Errore nel recupero del precedente:", err);
        setPrecedente(null);
        setError(
          err instanceof Error
            ? err.message
            : "Errore durante il recupero del precedente."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPrecedente();

    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  return { precedente, loading, error };
}