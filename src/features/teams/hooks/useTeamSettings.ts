import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { fetchWithSecurity } from "@/config/apiClient";
import { getAssign } from "@/config/env";
import { getDb } from "@/infrastructure/db";
import type { Team } from "@/interfaces/interfaces";

export interface UseTeamSettingsProps {
  team: Team;
  isManager: boolean;
}

const SHARE_ALL_URL = getAssign().SHARE_ALL_URL;
const DELETE_TEAM_ENDPOINT = getAssign().DELETE_TEAM_ENDPOINT;

export function useTeamSettings({ team, isManager }: UseTeamSettingsProps) {
  const [name, setName] = useState(team.name);
  const [isTeamDefault, setIsTeamDefault] = useState(team.visibility_default === "team");

  const [saving, setSaving] = useState(false);
  const [isSharingAll, setIsSharingAll] = useState(false);
  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    setSaving(true);
    try {
      const db = await getDb();
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        name: name.trim(),
        visibility_default: isTeamDefault ? "team" : "private",
      });
      toast.success("Impostazioni salvate con successo!");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Errore nel salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleShareAllPastDocuments = () => {
    if (!isManager) return;
    setIsShareConfirmOpen(true);
  };

  const closeShareConfirm = () => {
    setIsShareConfirmOpen(false);
  };

  const executeShareAll = async () => {
    setIsShareConfirmOpen(false);
    setIsSharingAll(true);

    try {
      if (!SHARE_ALL_URL) throw new Error("URL Cloud Function non configurato");

      const res = await fetchWithSecurity(SHARE_ALL_URL, { teamId: team.id });

      if (!res.ok) {
        throw new Error("Errore durante la risposta dal server");
      }

      toast.success("Tutti i documenti storici sono ora visibili al team!");
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto";
      toast.error(`Errore durante la condivisione massiva: ${errorMessage}`);
    } finally {
      setIsSharingAll(false);
    }
  };

  const toggleTeamDefault = () => {
    if (isManager && !saving && !isSharingAll) {
      setIsTeamDefault((prev) => !prev);
    }
  };

  const deleteTeamAction = async (teamId: string, revokeDocumentAccess: boolean) => {
    try {
      const response = await fetchWithSecurity(DELETE_TEAM_ENDPOINT, {
        teamId,
        revokeDocumentAccess,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'eliminazione del workspace");
      }
      return data;
    } catch (error) {
      console.error("[deleteTeamAPI] Error:", error);
      throw error;
    }
  };

  return {
    name,
    setName,
    isTeamDefault,
    toggleTeamDefault,
    saving,
    isSharingAll,
    isShareConfirmOpen,
    handleSave,
    handleShareAllPastDocuments,
    closeShareConfirm,
    executeShareAll,
    deleteTeamAction,
  };
}