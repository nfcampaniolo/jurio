import React from "react";
import { FaDatabase, FaListUl, FaChevronRight } from "react-icons/fa";
import { SectionTitle, SectionText, SectionContainer } from "./SharedUI";

// Helper ricorsivo per renderizzare qualsiasi struttura dati in modo leggibile
const RecursiveViewer: React.FC<{ value: unknown }> = ({ value }) => {
  // 1. Gestione di null, undefined o stringhe vuote
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-400 italic text-sm">Nessun dato</span>;
  }

  // 2. Gestione dei primitivi (stringhe, numeri, booleani)
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-sm text-(--color-text) wrap-break-word">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-sm font-mono bg-black/5 px-2 py-0.5 rounded">{value ? "Sì" : "No"}</span>;
  }

  // 3. Gestione di Timestamp di Firebase senza usare 'any'
  if (typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value) {
    // Effettuiamo un cast sicuro del tipo invece di usare any
    const timestamp = value as { seconds: number; nanoseconds: number };
    const date = new Date(timestamp.seconds * 1000);
    return (
      <span className="text-sm text-(--color-text)">
        {date.toLocaleDateString("it-IT", { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric', 
          hour: '2-digit', 
          minute:'2-digit' 
        })}
      </span>
    );
  }

  // 4. Gestione degli Array
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400 italic text-sm">Lista vuota</span>;
    return (
      <ul className="space-y-2 mt-1">
        {value.map((item, index) => (
          <li key={index} className="flex gap-2 items-start">
            <FaChevronRight className="text-[10px] mt-1.5 text-gray-400 shrink-0" />
            <div className="flex-1">
              <RecursiveViewer value={item} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // 5. Gestione degli Oggetti Nidificati
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );

    if (entries.length === 0) return null;

    return (
      <div className="grid grid-cols-1 gap-2 mt-2 bg-black/5 p-3 rounded-md border border-black/5">
        {entries.map(([k, v]) => {
          // Rinomina createdAt in "data creazione", altrimenti sostituisce gli underscore con gli spazi
          const label = k === "createdAt" ? "data creazione" : k.replace(/_/g, " ");
          
          return (
            <div key={k} className="flex flex-col sm:flex-row sm:gap-4 border-b border-black/5 pb-2 last:border-0 last:pb-0">
              <span className="text-xs font-semibold uppercase text-(--color-muted) shrink-0 sm:w-1/3 pt-0.5">
                {label}
              </span>
              <div className="flex-1">
                <RecursiveViewer value={v} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback estremo
  return <span>{String(value)}</span>;
};

// Componente Principale Esportato
export const RenderFallback: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const keysToIgnore = [
    "embedding",
    "isEmbeddingFinished",
    "nome_file",
    "promptId",
    "user",
    "lastVectorizedAt",
  ];

  const validEntries = Object.entries(data).filter(
    ([key, value]) =>
      !keysToIgnore.includes(key) &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );

  return (
    <SectionContainer className="border-t-0 pt-0">
      <div className="mb-6 bg-yellow-50/50 p-4 rounded-md border border-yellow-200">
        <p className="text-sm text-yellow-800 flex items-center gap-2 font-medium">
          <FaDatabase className="opacity-70 text-yellow-600" />
          Modalità compatibilità: visualizzazione dati grezzi strutturati
        </p>
      </div>
      
      <div className="space-y-8">
        {validEntries.map(([key, value]) => {
          // Rinomina createdAt a livello della SectionTitle
          const formattedTitle = key === "createdAt" ? "Data creazione" : key.replace(/_/g, " ");

          return (
            <div key={key} className="relative">
              <SectionTitle icon={FaListUl} title={formattedTitle} />
              
              {/* Se è un oggetto o un array complesso, usiamo il visualizzatore ricorsivo */}
              {typeof value === "object" ? (
                <div className="mt-3">
                  <RecursiveViewer value={value} />
                </div>
              ) : (
                /* Se è una stringa semplice di primo livello */
                <SectionText>
                  <RecursiveViewer value={value} />
                </SectionText>
              )}
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
};