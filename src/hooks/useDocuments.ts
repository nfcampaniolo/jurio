import { useEffect, useState, useCallback } from "react";
import {
  deleteDocument,
  listDocumentsByUser,
  renameDocument,
} from "@/services/document";
import {
  deleteSaveSentence,
  listSavedSentenzeByUser,
} from "@/services/saveSentences";
import { deleteDocumentStorage } from "@/services/storage";
import { type Documento} from "@/interfaces/interfaces";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/services/analytics";
import type{ Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

type DocumentoAny =
  | Sentenza
  | Ordinanza
  | Decreto
  | DocumentoGiurisprudenzaGenerico;

export const useDocuments = () => {
  const [documents, setDocuments] = useState<DocumentoAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const userId = user?.uid;

  const fetchDocuments = useCallback(async () => {
    if (!userId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await listDocumentsByUser(userId);
      setDocuments(data);
      
    } catch (err) {
      console.error("Errore caricamento documenti:", err);
      setError("Errore nel caricamento dei documenti");

      trackEvent("analytics_error", {
        name: "listDocumentsByUser",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const deleteDocumento = useCallback(async (id: string) => {
    try {
      await deleteDocument("documents", id);
      await deleteDocumentStorage(id, `users/${userId}/documents`);

      trackEvent("document_deleted", {});
    } catch (err) {
      trackEvent("analytics_error", {
        name: "deleteDocumento",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
      throw err;
    }
  }, [userId]);

  const handleRenameDocumento = useCallback(
    async (id: string, name: string) => {
      try {
        await renameDocument(id, name);
      } catch (err) {
        console.error("Errore rinominazione documento:", err);
      }
    },
    []
  );

    return { documents, loading, error, reload: fetchDocuments, deleteDocumento, handleRenameDocumento };
  };

export function useSavedSentenze() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [savedDocs, setSavedDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const fetchSentences = useCallback(async () => {
    if (!uid) {
      setSavedDocs([]);
      setLoading(false);
      setIsUnauthorized(true);
      return;
    }

    setLoading(true);
    setError(null);
    setIsUnauthorized(false);

    try {
      const data = await listSavedSentenzeByUser(uid);
      setSavedDocs(data);
      trackEvent("saved_sentence_opened", {});
    } catch (err) {
      console.error("Errore caricamento documenti:", err);

      if (err instanceof FirebaseError) {
        if (err.code === "permission-denied" || err.code === "unauthenticated") {
          setIsUnauthorized(true);
          setError("Non sei autorizzato a visualizzare queste sentenze.");

          trackEvent("analytics_error", {
            name: "listSavedSentenzeByUser",
            reason: err.code,
          });
          return;
        }
      }

      setError("Errore nel caricamento dei documenti");
      trackEvent("analytics_error", {
        name: "listSavedSentenzeByUser",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchSentences();
  }, [fetchSentences]);

  const unsaveSentence = useCallback(
    async (sentenceId: string) => {
      if (!uid) {
        setIsUnauthorized(true);
        trackEvent("analytics_error", {
          name: "unsaveSentence",
          reason: "unauthenticated",
        });
        return;
      }
      try {
        await deleteSaveSentence(uid, sentenceId);
      } catch (err) {
        trackEvent("analytics_error", {
          name: "unsaveSentence",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
        throw err;
      }
    },
    [uid]
  );

  return {
    savedSentenze: savedDocs,
    loading,
    error,
    isUnauthorized,
    fetchSentences,
    unsaveSentence,
  };
}
