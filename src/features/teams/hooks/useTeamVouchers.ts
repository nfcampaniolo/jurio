import { useState } from "react";
import { fetchWithSecurity } from "@/config/apiClient";
import { getAssign } from "@/config/env";
import type { Team } from "@/interfaces/interfaces";

export type FeedbackMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

export interface UseTeamVouchersProps {
  team: Team;
}

const ASSIGN_SEAT_URL = getAssign().ASSIGN_SEAT_URL;
const SEND_INVITE_URL = getAssign().SEND_INVITE_URL;

export function useTeamVouchers({ team }: UseTeamVouchersProps) {
  // Stati per l'assegnazione diretta
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Stati per l'invio via email di un voucher specifico
  const [emailingVoucherId, setEmailingVoucherId] = useState<string | null>(null);
  const [voucherEmail, setVoucherEmail] = useState("");
  const [sendingVoucherId, setSendingVoucherId] = useState<string | null>(null);

  // Stati generali per feedback UI
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage>(null);

  const availableVouchers = team.vouchers?.filter((v) => !v.used) || [];

  const handleAssignSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || availableVouchers.length === 0) return;

    setLoading(true);
    setMessage(null);
    setEmailingVoucherId(null);

    try {
      if (!ASSIGN_SEAT_URL) return;
      const r = await fetchWithSecurity(ASSIGN_SEAT_URL, {
        teamId: team.id,
        email: email.trim().toLowerCase(),
      });

      const text = await r.text();

      if (!r.ok) {
        let errData: { errorCode?: string } = {};

        try {
          const parsed = JSON.parse(text) as unknown;
          if (typeof parsed === "object" && parsed !== null) {
            errData = parsed as { errorCode?: string };
          }
        } catch (err: unknown) {
          console.warn("Impossibile parsare l'errore API come JSON", err);
        }

        if (r.status === 404 && errData.errorCode === "user-not-found") {
          setMessage({
            type: "info",
            text: "L'utente non è ancora registrato. Puoi inviargli un codice d'invito via email dalla lista qui sotto.",
          });
          return;
        }

        if (r.status === 409 && errData.errorCode === "already-exists") {
          setMessage({
            type: "error",
            text: "Questo utente fa già parte del Workspace.",
          });
          return;
        }

        throw new Error(`Assegnazione fallita (${r.status}): ${text}`);
      }

      setMessage({
        type: "success",
        text: `${email} è stato aggiunto al Workspace con successo!`,
      });
      setEmail("");
    } catch (error: unknown) {
      console.error(error);
      setMessage({
        type: "error",
        text: "Si è verificato un errore. Assicurati di essere connesso e riprova.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInviteEmail = async (voucherId: string) => {
    if (!voucherEmail.trim()) return;

    setSendingVoucherId(voucherId);
    setMessage(null);

    try {
      if (!SEND_INVITE_URL) {
        throw new Error("Configurazione mancante: URL per l'invio non definito.");
      }

      const r = await fetchWithSecurity(SEND_INVITE_URL, {
        teamId: team.id,
        email: voucherEmail.trim().toLowerCase(),
        voucher: voucherId,
      });

      const text = await r.text();

      if (!r.ok) {
        let errData: { error?: string; errorCode?: string } = {};

        try {
          const parsed = JSON.parse(text) as unknown;
          if (typeof parsed === "object" && parsed !== null) {
            errData = parsed as { error?: string; errorCode?: string };
          }
        } catch (err: unknown) {
          console.warn("Impossibile parsare l'errore API come JSON", err);
        }

        const errorMessage = errData.error || `Invio fallito (${r.status})`;
        throw new Error(errorMessage);
      }

      setMessage({
        type: "success",
        text: `Il codice d'invito è stato inviato via email a ${voucherEmail}!`,
      });
      setEmailingVoucherId(null);
      setVoucherEmail("");
    } catch (error: unknown) {
      console.error("Errore invio email:", error);
      const displayMsg =
        error instanceof Error && !error.message.includes("fetch")
          ? error.message
          : "Errore durante l'invio dell'email. Riprova più tardi.";

      setMessage({ type: "error", text: displayMsg });
    } finally {
      setSendingVoucherId(null);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Errore durante la copia:", err);
    }
  };

  const openEmailForm = (voucherId: string) => {
    setEmailingVoucherId(voucherId);
    setVoucherEmail("");
    setMessage(null);
  };

  const closeEmailForm = () => {
    setEmailingVoucherId(null);
  };

  return {
    email,
    setEmail,
    loading,
    voucherEmail,
    setVoucherEmail,
    emailingVoucherId,
    sendingVoucherId,
    copiedId,
    message,
    availableVouchers,
    handleAssignSeat,
    handleSendInviteEmail,
    copyToClipboard,
    openEmailForm,
    closeEmailForm,
  };
}