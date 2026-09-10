// src/features/analisi/components/PrecedenteCard.tsx
import React from "react";
import {
  Globe,
  Landmark,
  ToggleLeft,
  ToggleRight,
  CalendarDays,
  Scale,
  BookOpen,
  ExternalLink,
  Loader2,
} from "lucide-react";

import type { PrecedenteReperito } from "../hooks/types";
import { usePrecedente } from "../hooks/usePrecedente";
import CitationTree from "@/features/document/components/CitationGraph";

interface Props {
  precedente: PrecedenteReperito;
  onToggleEsclusione: (id: string, escluso: boolean) => void;
}

function formatData(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function text(value?: string | null): string {
  return value?.trim() || "";
}

export const PrecedenteCard: React.FC<Props> = ({
  precedente,
  onToggleEsclusione,
}) => {
  const isWeb = precedente.fonte === "web";
  const escluso = Boolean(precedente.escluso);

  const {
    precedente: documento,
    loading,
    error,
  } = usePrecedente(precedente.id, !isWeb);

  // Se è una fonte interna non reperita o andata in errore, non renderizzare nulla
  if (!isWeb && !loading && (!documento || error)) {
    return null;
  }

  const organo =
    documento?.organo_giudicante || "Autorità giudiziaria";

  const numero =
    documento?.numero_sentenza ||
    documento?.ecli ||
    documento?.urn ||
    "";

  const data = documento?.data_sentenza || "";
  const massima = text(documento?.massima || documento?.sintesi);
  const ratio = text(documento?.ratio_decidendi);
  const norme = documento?.riferimenti_normativi || [];
  const precedentiRichiamati = documento?.precedenti_richiamati || [];

  // URL della fonte interna basato sull'id del precedente
  const internalSourceUrl = `https://jurio.it/giurisprudenza/${precedente.id}`;

  return (
    <article
      className={[
        "rounded-lg border transition-opacity",
        escluso
          ? "border-(--color-border) bg-(--color-bg) opacity-50"
          : "border-(--color-border) bg-(--color-surface)",
      ].join(" ")}
    >
      {/* HEADER */}
      <header className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0 text-(--color-muted)">
            {isWeb ? <Globe size={16} /> : <Landmark size={16} />}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3
                className={[
                  "text-sm font-medium",
                  escluso ? "line-through" : "",
                ].join(" ")}
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isWeb ? "Fonte web" : organo}
              </h3>

              {precedente.nuova && (
                <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
                  Nuova
                </span>
              )}
            </div>

            {!isWeb && (numero || data) && (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-(--color-muted)">
                {numero && <span>N. {numero}</span>}

                {numero && data && <span>·</span>}

                {data && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={11} />
                    {formatData(data)}
                  </span>
                )}

                {documento?.grado_giudizio && (
                  <>
                    <span>·</span>
                    <span>{documento.grado_giudizio}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onToggleEsclusione(precedente.id, !escluso)
          }
          title={escluso ? "Includi precedente" : "Escludi precedente"}
          aria-label={escluso ? "Includi precedente" : "Escludi precedente"}
          className="shrink-0 text-(--color-muted) transition-colors hover:text-(--color-text)"
        >
          {escluso ? (
            <ToggleLeft size={20} />
          ) : (
            <ToggleRight size={20} />
          )}
        </button>
      </header>

      {/* WEB */}
      {isWeb && (
        <div className="border-t border-(--color-border) px-4 py-3">
          <a
            href={precedente.id}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 break-all text-xs text-(--color-text) underline underline-offset-2"
          >
            {precedente.id}
            <ExternalLink size={11} className="shrink-0" />
          </a>

          <div className="mt-2 text-[10px] uppercase tracking-wide text-(--color-muted)">
            Pertinenza{" "}
            <span className="text-(--color-text)">
              {precedente.gradoPertinenza}/100
            </span>
          </div>
        </div>
      )}

      {/* LOADING */}
      {!isWeb && loading && (
        <div className="flex items-center gap-2 border-t border-(--color-border) px-4 py-4 text-xs text-(--color-muted)">
          <Loader2 size={13} className="animate-spin" />
          Recupero del provvedimento...
        </div>
      )}

      {/* DOCUMENT */}
      {!isWeb && documento && !loading && (
        <div className="divide-y divide-(--color-border)">
          {/* MASSIMA */}
          {massima && (
            <section className="px-4 py-4">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-(--color-muted)">
                <Scale size={12} />
                Massima
              </div>

              <p className="text-xs leading-relaxed text-(--color-text)">
                {massima}
              </p>
            </section>
          )}

          {/* RATIO */}
          {ratio && (
            <section className="px-4 py-4">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-(--color-muted)">
                <BookOpen size={12} />
                Ratio decidendi
              </div>

              <p className="text-xs leading-relaxed text-(--color-text)">
                {ratio}
              </p>
            </section>
          )}

          {/* NORME */}
          {norme.length > 0 && (
            <section className="px-4 py-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-(--color-muted)">
                Norme
              </div>

              <div className="flex flex-wrap gap-1.5">
                {norme.map((norma, index) => (
                  <span
                    key={`${norma}-${index}`}
                    className="rounded border border-(--color-border) px-2 py-1 text-[10px]"
                  >
                    {norma}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* CITAZIONI */}
          {precedentiRichiamati.length > 0 && (
            <section className="px-4 py-4">
              <CitationTree precedenti={precedentiRichiamati} />
            </section>
          )}

          {/* FOOTER CON LINK ALLA FONTE E PERTINENZA */}
          <footer className="flex items-center justify-between px-4 py-2.5 text-[10px] uppercase tracking-wide text-(--color-muted)">
            <a
              href={internalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-(--color-muted) hover:text-(--color-text) underline underline-offset-2 lowercase"
            >
              <span>vedi su jurio</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>

            <div>
              Pertinenza{" "}
              <span className="ml-1 text-(--color-text)">
                {precedente.gradoPertinenza}/100
              </span>
            </div>
          </footer>
        </div>
      )}
    </article>
  );
};