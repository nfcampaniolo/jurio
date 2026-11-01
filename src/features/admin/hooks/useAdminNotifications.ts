import { useState } from "react";
import { toast } from "react-hot-toast";
import { fetchWithSecurity } from "@/config/apiClient";

export interface NotificationPayload {
  targetMode: "single" | "broadcast";
  consentFilter?: "all" | "comms" | "marketing";
  uid?: string;
  sendInApp: boolean;
  sendEmail: boolean;
  title: string;
  message: string;
  emailHtml?: string;
  link?: string;
  type?: string;
}

// Funzione helper per minimizzare l'HTML
const minifyEmailHtml = (html: string): string => {
  if (!html) return "";
  return html
    .replace(/<!--(?!\[if).*?-->/gs, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const useAdminNotifications = () => {
  const [isSending, setIsSending] = useState(false);

  const sendNotification = async (payload: NotificationPayload) => {
    setIsSending(true);

    try {
      const optimizedPayload = {
        ...payload,
        emailHtml: payload.emailHtml ? minifyEmailHtml(payload.emailHtml) : undefined,
      };

      // Adegua il path della tua variabile d'ambiente o la costante
      const NOTIFICATIONS_URL = import.meta.env.VITE_ADMIN_NOTIFICATION;

      if (!NOTIFICATIONS_URL) return;

      const r = await fetchWithSecurity(NOTIFICATIONS_URL, optimizedPayload);
      const text = await r.text();

      if (!r.ok) {
        let errData: { error?: string } = {};

        try {
          const parsed = JSON.parse(text) as unknown;
          if (typeof parsed === "object" && parsed !== null) {
            errData = parsed as { error?: string };
          }
        } catch (err: unknown) {
          console.warn("Impossibile parsare l'errore API come JSON", err);
        }

        if (r.status === 403) {
          toast.error("Accesso negato: Operazione riservata agli admin.");
          return;
        }

        if (r.status === 429) {
          toast.error("Limite di richieste superato. Riprova più tardi.");
          return;
        }

        throw new Error(`Invio fallito (${r.status}): ${errData.error || text}`);
      }

      // Parsing del risultato positivo (il nostro BE ritorna { success: true, message: "..." })
      let successData: { message?: string } = {};
      try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed === "object" && parsed !== null) {
          successData = parsed as { message?: string };
        }
      } catch (err: unknown) {
        console.warn("Impossibile parsare la risposta API come JSON", err);
      }

      toast.success(successData.message || "Comunicazione inviata con successo!");

    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Si è verificato un errore di rete.";
      toast.error(`Si è verificato un errore: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  return { sendNotification, isSending };
};