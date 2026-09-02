import { useState, useEffect } from 'react';
import { vectorSearch, type SentenceMatch } from '@/services/vectorSearch'; 
import { cercaPrecedentiPerNorme } from '@/hooks/cercaPrecedenti'; 
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

export type DocumentData = Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico;

const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

interface UseRelatedDocumentsParams {
  uid: string;
  massima: string;
  mode: 'semantic' | 'normative';
  selectedNorms: string[];
  shouldFetch: boolean;
}

export const useRelatedDocuments = ({
  uid,
  massima,
  mode,
  selectedNorms,
  shouldFetch
}: UseRelatedDocumentsParams) => {
  const [relatedDocs, setRelatedDocs] = useState<SentenceMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldFetch) {
      return;
    }

    const fetchRelatedDocs = async () => {
      if (!uid || (mode === 'semantic' && !massima) || (mode === 'normative' && selectedNorms.length === 0)) {
        return;
      }

      setLoading(true);
      setError(null);

      // 1. GENERAZIONE CACHE KEY DINAMICA
      const cacheKeyBase = `related_docs_data_${uid}`;
      const cacheKey = mode === 'semantic' 
        ? `${cacheKeyBase}_semantic` 
        : `${cacheKeyBase}_normative_${selectedNorms.join('_').replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // 2. CONTROLLO CACHE
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsedCache = JSON.parse(cachedData);
          const now = Date.now();
          
          if (now - parsedCache.timestamp < CACHE_EXPIRATION_MS) {
            setRelatedDocs(parsedCache.documents);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Cache obsoleta o corrotta:", e);
        }
      }

      // 3. CHIAMATA API
      try {
        let allMatches: SentenceMatch[] = [];

        if (mode === 'semantic') {
          const result = await vectorSearch(massima, [], 11);
          allMatches = result.allMatches;
        } else {
          const normativeResults = await cercaPrecedentiPerNorme(selectedNorms, 11);
          allMatches = normativeResults as unknown as SentenceMatch[];
        }

        // 4. FILTRO E PULIZIA (Senza usare any)
        const filteredDocs = allMatches
          .filter((doc) => {
            // Estendiamo il tipo in modo sicuro per TypeScript
            const safeDoc = doc as SentenceMatch & { uid?: string };
            return safeDoc.id !== uid && safeDoc.uid !== uid;
          })
          .slice(0, 10);

        // 5. SALVATAGGIO IN CACHE
        const cachePayload = {
          timestamp: Date.now(),
          documents: filteredDocs,
        };

        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('related_docs_data_') && !k.startsWith(cacheKeyBase)) {
              keysToRemove.push(k);
            }
          }

          keysToRemove.forEach(k => localStorage.removeItem(k));
          localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
        } catch (storageErr: unknown) {
          console.warn("Impossibile salvare in cache:", storageErr);
        }

        setRelatedDocs(filteredDocs);
      } catch (err) {
        console.error(`Errore ricerca ${mode}:`, err);
        setError(`Impossibile caricare i documenti correlati in modalità ${mode}.`);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedDocs();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, massima, mode, selectedNorms.join(','), shouldFetch]); 

  return { relatedDocs, loading, error };
};