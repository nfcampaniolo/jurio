// src/features/analisi/components/SidebarStorico.tsx

import React from "react";
import { CheckCircle2, Clock, Edit2, FileText, Trash2 } from "lucide-react";
import { useDeepAnalysisSession } from "../hooks/useDeepAnalysis";
import type { Timestamp } from "firebase/firestore";

type FirebaseDate = Date | string | number | Timestamp | null | undefined;

interface SidebarStoricoProps {
  sessioneAttivaId: string | null;
  onSelectSession: (id: string) => void;
  onOpenDeleteConfirm: (id: string, titolo: string) => void;
  eliminandoId: string | null;
}

export const SidebarStorico: React.FC<SidebarStoricoProps> = ({
  sessioneAttivaId,
  onSelectSession,
  onOpenDeleteConfirm,
  eliminandoId,
}) => {
  const { sessionsList, loading } = useDeepAnalysisSession(null);

  const formattaData = (data: FirebaseDate) => {
    if (!data) return "";
    try {
      let d: Date;
      if (typeof data === "object" && "toDate" in data && typeof data.toDate === "function") {
        d = data.toDate();
      } else {
        d = new Date(data as Date | string | number);
      }
      if (isNaN(d.getTime())) return "In elaborazione...";
      return new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch (e: unknown) {
      console.error(e);
      return "";
    }
  };

  const handleApriConferma = (e: React.MouseEvent, id: string, titolo: string) => {
    e.stopPropagation();
    onOpenDeleteConfirm(id, titolo || "Indagine Senza Titolo");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 w-full animate-pulse rounded-md bg-(--color-text) opacity-5 dark:opacity-10"
          />
        ))}
      </div>
    );
  }

  if (sessionsList.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText size={24} className="mx-auto mb-3 text-(--color-muted) opacity-40" />
        <p className="text-xs font-light text-(--color-muted) leading-relaxed">
          Nessuna indagine in archivio. <br /> Inizia creandone una nuova.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-2">
      <div className="px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
          Storico Indagini
        </span>
      </div>

      <div className="flex flex-col">
        {sessionsList.map((session) => {
          const isActive = session.id === sessioneAttivaId;
          const isDeleting = eliminandoId === session.id;

          return (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => !isDeleting && onSelectSession(session.id)}
              onKeyDown={(e) => {
                if (!isDeleting && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectSession(session.id);
                }
              }}
              className={`group relative flex flex-col gap-2 border-l-2 px-4 py-3 text-left outline-none transition-colors cursor-pointer ${
                isActive
                  ? "border-(--color-text) bg-(--color-text)/5 dark:bg-(--color-text)/10"
                  : "border-transparent hover:bg-(--color-border)/30"
              } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span
                  className={`line-clamp-2 font-medium leading-snug tracking-tight pr-6 ${
                    isActive ? "text-(--color-text)" : "text-(--color-text)/80"
                  }`}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {session.title || "Indagine Senza Titolo"}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleApriConferma(e, session.id, session.title)}
                  className="absolute right-3 top-3 p-1 rounded-md opacity-0 group-hover:opacity-100 text-(--color-muted) hover:text-red-600 hover:bg-red-500/10 transition-all cursor-pointer"
                  title="Elimina indagine"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex w-full items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1">
                  {session.status === "completed" && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckCircle2 size={12} /> Completata
                    </span>
                  )}
                  {session.status === "review" && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-500">
                      <Edit2 size={12} /> In Revisione
                    </span>
                  )}
                  {session.status === "draft" && (
                    <span className="flex items-center gap-1 text-(--color-muted)">
                      <Clock size={12} /> Bozza
                    </span>
                  )}
                </div>

                <span className="font-light normal-case tracking-normal text-(--color-muted)">
                  {formattaData(session.updatedAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};