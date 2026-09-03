import { useEffect, useMemo, useRef, useState } from "react";
import { getDocumentMassima } from "@/shared/services/document";
import { getDocumentStorage } from "@/shared/services/storage";
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";
import { trackEvent } from "@/infrastructure/analytics";

type DocumentoAny =
  | Sentenza
  | Ordinanza
  | Decreto
  | DocumentoGiurisprudenzaGenerico;

export const useDocumento = (id?: string | null) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentoAny | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [deny, setDeny] = useState<boolean>(false);
  
  const { collectionName, isGiurisprudenza } = useMemo(() => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    const isGiu = currentUrl.includes("/giurisprudenza/");
    return {
      isGiurisprudenza: isGiu,
      collectionName: isGiu ? "sentences" : "documents",
    };
  }, []);

  const fetchedRef = useRef<string | null>(null);
  const trackedOpenRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      console.log(`[useDocumento] Inizio fetch. ID: ${id}, Collection: ${collectionName}`);
      
      if (!id || !collectionName) {
        console.log("[useDocumento] ID o collectionName mancante. Reset degli state.");
        if (!id) {
          setSelectedDoc(null);
          setPdfUrl(null);
          setDeny(false);
        }
        return;
      }

      if (fetchedRef.current === id) return;
      fetchedRef.current = id;

      if (trackedOpenRef.current !== id) {
        trackedOpenRef.current = id;
        trackEvent(isGiurisprudenza ? "sentence_opened" : "document_opened", { source: "direct" });
      }

      setLoading(true);
      setDeny(false);

      try {
        console.log(`[useDocumento] Chiamata a getDocumentMassima per ID: ${id}`);
        // 1. Recuperiamo il documento
        const document = await getDocumentMassima(id, collectionName);
        console.log("[useDocumento] Risposta getDocumentMassima:", document);

        if (document === "denied") {
          console.warn("[useDocumento] Accesso negato al documento.");
          setDeny(true);
          setSelectedDoc(null);
          setPdfUrl(null);
          trackEvent("analytics_error", {
            name: isGiurisprudenza ? "sentence_opened" : "document_opened",
            reason: "denied",
          });
          return;
        }

        if (document && typeof document !== "string") {
          const docData = document as DocumentoAny;
          setSelectedDoc(docData);

          // 2. Leggiamo il campo 'user' e costruiamo lo storageName
          const documentUserId = (docData as DocumentoAny).user; 
          console.log("[useDocumento] ID Utente proprietario del documento (docData.user):", documentUserId);

          if (!documentUserId && !isGiurisprudenza) {
             console.error("[useDocumento] ATTENZIONE: Il campo 'user' è mancante nel documento! Il path dello storage sarà invalido.");
          }

          const storageName = isGiurisprudenza 
            ? "sentences" 
            : `users/${documentUserId}/documents`;
            
          console.log(`[useDocumento] Storage Path calcolato: ${storageName}`);

          // 3. Recuperiamo l'URL del PDF
          console.log(`[useDocumento] Chiamata a getDocumentStorage per ID: ${id}`);
          const url = await getDocumentStorage(id, storageName);
          console.log("[useDocumento] Risposta getDocumentStorage (PDF URL):", url);
          
          setPdfUrl(url);

        } else {
          console.warn("[useDocumento] Documento non trovato o formato non valido. Tipo ricevuto:", typeof document);
          setSelectedDoc(null);
          setPdfUrl(null);
          if (document) {
             trackEvent("analytics_error", {
              name: "useDocumento",
              reason: `unexpected_document_type:${typeof document}`,
            });
          }
        }
      } catch (err) {
        console.error("[useDocumento] Errore bloccante nel blocco try/catch:", err);
        setSelectedDoc(null);
        setPdfUrl(null);
        trackEvent("analytics_error", {
          name: "useDocumento",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      } finally {
        console.log("[useDocumento] Fetch terminato. Loading: false");
        setLoading(false);
      }
    };

    fetchDocument();
    
    return () => {
      if (fetchedRef.current !== id) {
        fetchedRef.current = null;
      }
    };
  }, [id, collectionName, isGiurisprudenza]);

  return { selectedDoc, pdfUrl, loading, deny, isGiurisprudenza };
};