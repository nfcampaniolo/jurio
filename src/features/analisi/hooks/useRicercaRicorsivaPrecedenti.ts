// src/features/analisi/hooks/useRicercaRicorsivaPrecedenti.ts

import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";
import { cercaPrecedente } from "@/features/document/hooks/cercaPrecedenti";
import type { PrecedenteDocumento } from "./usePrecedente";
import type { PrecedenteReperito } from "./types";

export interface NodoAlberoPrecedente {
  citazioneTestuale: string;
  documentoTrovato: PrecedenteDocumento | null;
  figli: NodoAlberoPrecedente[];
}

export interface AlberoSessioneElemento {
  radiceId: string;
  datiRadice: PrecedenteDocumento;
  alberoFigli: NodoAlberoPrecedente[];
}

export function useRicercaRicorsivaPrecedenti() {
  const [isSearchingRecursive, setIsSearchingRecursive] = useState(false);

  const esploraAlberoRicorsivo = async (
    citazioni: string[],
    visitati: Set<string>,
    profondita: number = 0,
    maxProfondita: number = 3
  ): Promise<NodoAlberoPrecedente[]> => {
    if (profondita > maxProfondita || !citazioni || citazioni.length === 0) {
      return [];
    }

    const risultatiNodi: NodoAlberoPrecedente[] = [];

    for (const cit of citazioni) {
      const chiaveUnica = cit.trim().toUpperCase();
      if (visitati.has(chiaveUnica)) continue;
      visitati.add(chiaveUnica);

      const risultatoRicerca = await cercaPrecedente(cit);
      const docTrovato = risultatoRicerca ? (risultatoRicerca as unknown as PrecedenteDocumento) : null;
      
      let figliNodi: NodoAlberoPrecedente[] = [];

      if (
        docTrovato && 
        docTrovato.precedenti_richiamati && 
        Array.isArray(docTrovato.precedenti_richiamati) && 
        docTrovato.precedenti_richiamati.length > 0
      ) {
        figliNodi = await esploraAlberoRicorsivo(
          docTrovato.precedenti_richiamati,
          visitati,
          profondita + 1,
          maxProfondita
        );
      }

      risultatiNodi.push({
        citazioneTestuale: cit,
        documentoTrovato: docTrovato,
        figli: figliNodi,
      });
    }

    return risultatiNodi;
  };

  const avviaAnalisiRicorsivaCompleta = async (
    precedentiReperiti: PrecedenteReperito[]
  ): Promise<AlberoSessioneElemento[]> => {
    setIsSearchingRecursive(true);
    const db = await getDb();
    const alberoCompletoSessione: AlberoSessioneElemento[] = [];
    const setVisitatiGlobali = new Set<string>();

    try {
      console.log("=== INIZIO ANALISI RICORSIVA COMPLETA DELLE FONTI ===");

      for (const p of precedentiReperiti) {
        if (p.fonte === "interna") {
          const docRef = doc(db, "sentences", p.id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const datiDoc = docSnap.data() as Omit<PrecedenteDocumento, "id">;
            const documentoRadice: PrecedenteDocumento = {
              id: docSnap.id,
              ...datiDoc,
            };

            console.log(`\n📁 Documento Radice [ID: ${p.id}] (Pertinenza: ${p.gradoPertinenza}%, Escluso: ${Boolean(p.escluso)}):`, documentoRadice);

            let alberoCitazioni: NodoAlberoPrecedente[] = [];
            if (documentoRadice.precedenti_richiamati && Array.isArray(documentoRadice.precedenti_richiamati)) {
              alberoCitazioni = await esploraAlberoRicorsivo(
                documentoRadice.precedenti_richiamati,
                setVisitatiGlobali,
                0,
                3
              );
            }

            console.log(`🌳 Albero Ricorsivo Citazioni per [${p.id}]:`, alberoCitazioni);
            
            alberoCompletoSessione.push({
              radiceId: p.id,
              datiRadice: documentoRadice,
              alberoFigli: alberoCitazioni,
            });
          }
        } else {
          console.log(`\n🌐 Fonte Web [URL: ${p.id}] (Pertinenza: ${p.gradoPertinenza}%, Escluso: ${Boolean(p.escluso)})`);
        }
      }

      console.log("\n=== FINE ANALISI RICORSIVA COMPLETATA ===");
      return alberoCompletoSessione;

    } catch (error: unknown) {
      console.error("Errore durante l'analisi ricorsiva dei precedenti:", error);
      return [];
    } finally {
      setIsSearchingRecursive(false);
    }
  };

  return {
    avviaAnalisiRicorsivaCompleta,
    isSearchingRecursive,
  };
}