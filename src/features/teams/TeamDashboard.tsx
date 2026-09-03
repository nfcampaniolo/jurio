import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useTeamDashboard } from "./hooks/useTeamDashboard";
import TeamSettings from "@/features/teams/components/TeamSettings";
import TeamVouchers from "@/features/teams/components/TeamVouchers";
import TeamMembers from "@/features/teams/components/TeamMembers";
import JoinTeamWithVoucher from "@/features/teams/components/JoinTeamWithVoucher";
import { YourDocument } from "@/shared/components/YourDocument";
import { Loader2 } from "lucide-react";

export default function TeamDashboard() {
  const navigate = useNavigate();
  const { user, team, loading, isManager } = useTeamDashboard();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-(--color-muted) gap-2 bg-(--color-bg)">
        <Loader2 size={16} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento Workspace in corso...</span>
      </div>
    );
  }

  if (!user || !team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-(--color-bg)">
        <JoinTeamWithVoucher />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-text) py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Intestazione pagina */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            {/* Titolo e Sottotitolo */}
            <div className="min-w-0 flex-1">
              <h1 
                className="text-xl sm:text-3xl font-medium tracking-tight text-(--color-text) truncate" 
                style={{ fontFamily: 'var(--font-serif)' }}
                title={team.name || "Workspace"}
              >
                {team.name || "Workspace"}
              </h1>
              <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-1 leading-relaxed">
                {isManager ? "Pannello di controllo manager" : "Il tuo spazio di lavoro condiviso"}
              </p>
            </div>
            
            {/* Bottone Indietro */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) active:scale-[0.98] text-(--color-text) text-[11px] sm:text-xs font-bold uppercase tracking-widest transition-all shadow-xs outline-none cursor-pointer"
              aria-label="Torna al profilo"
            >
              <FiArrowLeft size={14} className="opacity-70 shrink-0" />
              <span>Torna al profilo</span>
            </button>
          </div>
        </div>
        {/* Membri del Team */}
        <TeamMembers 
          teamId={team.id} 
          isManager={isManager} 
          currentUserUid={user.uid} 
        />
        {/* Documenti */}
        <YourDocument />
        
        {/* Sezioni Manager (Settings & Vouchers) */}
        {isManager && (
          <>
            <TeamSettings team={team} isManager={isManager} />
            <TeamVouchers team={team} />
          </>
        )}
      </div>
    </div>
  );
}