import { useState } from "react";
import { fetchWithSecurity } from "@/config/apiClient";
import { getAssign } from "@/config/env";
import { toast } from "react-hot-toast";

export interface TeamOption {
  id: string;
  name: string;
}

export interface UseJoinTeamWithVoucherOptions {
  onJoinSuccess?: () => void;
}

const JOIN_TEAM_URL = getAssign().ASSIGN_SEAT_URL;
const VERIFY_VOUCHER_URL = getAssign().VERIFY_VOUCHER_URL;

export function useJoinTeamWithVoucher({ onJoinSuccess }: UseJoinTeamWithVoucherOptions = {}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [voucherCode, setVoucherCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const handleVerifyVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    setLoading(true);
    try {
      if (!VERIFY_VOUCHER_URL) throw new Error("URL non configurato");

      const res = await fetchWithSecurity(VERIFY_VOUCHER_URL, { voucher: voucherCode.trim() });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Codice non valido o scaduto");

      if (!data.teams || data.teams.length === 0) {
        toast.error("Nessun Workspace trovato per questo codice.");
        return;
      }

      setTeams(data.teams);
      setSelectedTeamId(data.teams[0].id);
      setStep(2);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Errore durante la verifica del codice.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!selectedTeamId) return;

    setJoining(true);
    try {
      if (!JOIN_TEAM_URL) throw new Error("URL non configurato");

      const res = await fetchWithSecurity(JOIN_TEAM_URL, {
        teamId: selectedTeamId,
        voucher: voucherCode.trim(),
      });

      const text = await res.text();

      if (!res.ok) {
        let errData: { error?: string } = {};
        try {
          errData = JSON.parse(text);
        } catch (e) {
          console.error("Errore nel parsing della risposta di errore:", e);
        }
        throw new Error(errData.error || `Errore (${res.status})`);
      }

      toast.success("Benvenuto nel Workspace!");
      if (onJoinSuccess) onJoinSuccess();
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Impossibile unirsi al team. Riprova.");
    } finally {
      setJoining(false);
    }
  };

  return {
    step,
    setStep,
    voucherCode,
    setVoucherCode,
    loading,
    joining,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    handleVerifyVoucher,
    handleJoinTeam,
  };
}