// src/features/deep-analysis/components/AnalysisSettingsSection.tsx

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings2, 
  Database, 
  Globe, 
  SlidersHorizontal, 
  AlertCircle, 
  Play, 
  X,
  Info,
  Target,
  Hash,
  Search
} from "lucide-react";
import type { DeepAnalysisConfig } from "@/features/analisi/hooks/types";

// Interfaccia per le props del sottocomponente
interface LabelWithInfoProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description: string;
  rightElement?: React.ReactNode;
  isActive: boolean;
  onToggle: (id: string) => void;
}

// Sottocomponente estratto per evitare ricreazioni a ogni render
const LabelWithInfo: React.FC<LabelWithInfoProps> = ({ 
  id, 
  label, 
  icon, 
  description, 
  rightElement,
  isActive,
  onToggle
}) => (
  <div className="mb-3">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
          {icon} {label}
        </label>
        <button 
          type="button" 
          onClick={() => onToggle(id)} 
          className="outline-none cursor-pointer p-0.5 rounded-full hover:bg-(--color-border) transition-colors"
        >
          <Info size={12} className={isActive ? 'text-(--color-text)' : 'text-(--color-muted) opacity-70'} />
        </button>
      </div>
      {rightElement}
    </div>
    <AnimatePresence>
      {isActive && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }} 
          animate={{ height: 'auto', opacity: 1 }} 
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-2 text-[11px] font-light leading-relaxed text-(--color-muted) bg-(--color-bg) p-2.5 rounded-md border border-(--color-border) shadow-xs">
            {description}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface AnalysisSettingsSectionProps {
  isOpen: boolean;
  onClose: () => void;
  config: DeepAnalysisConfig;
  setConfig: React.Dispatch<React.SetStateAction<DeepAnalysisConfig>>;
  isProcessing: boolean;
  canStart: boolean;
  onStartAnalysis: () => void;
}

export const AnalysisSettingsSection: React.FC<AnalysisSettingsSectionProps> = ({
  isOpen,
  onClose,
  config,
  setConfig,
  isProcessing,
  canStart,
  onStartAnalysis,
}) => {
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const handleSourceToggle = (source: 'web' | 'db') => {
    setConfig(prev => {
      const nextState = { ...prev };
      if (source === 'web') nextState.sourceWeb = !prev.sourceWeb;
      if (source === 'db') nextState.sourceInternalDB = !prev.sourceInternalDB;
      
      // Vincolo: se entrambe le fonti vengono deselezionate, impedisci l'azione bloccando lo stato
      if (!nextState.sourceWeb && !nextState.sourceInternalDB) {
        return prev;
      }
      return nextState;
    });
  };

  const toggleInfo = (id: string) => {
    setActiveInfo(prev => prev === id ? null : id);
  };

  // Funzione di utilità per limitare i valori inseriti manualmente (Clamp)
  const clampValue = (val: number, min: number, max: number) => {
    return Math.min(Math.max(val, min), max);
  };

  // Determina se almeno una fonte è attiva per validare lo stato d'avvio
  const hasAtleastOneSource = config.sourceWeb || config.sourceInternalDB;
  const isReadyToStart = canStart && hasAtleastOneSource;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay di oscuramento sfondo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Pannello Laterale */}
          <motion.aside
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-(--color-border) bg-(--color-surface) shadow-2xl"
          >
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-50" />

            {/* Intestazione */}
            <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-bg) px-5 py-4 mt-0.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-text)">
                <Settings2 size={16} className="opacity-80" />
                <span>Parametri Avanzati</span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-(--color-muted) outline-none transition hover:bg-(--color-border) hover:text-(--color-text) cursor-pointer"
                title="Chiudi impostazioni"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenuto scorrevole */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              
              {/* 1. Tipologia di Fonti */}
              <div className="mb-8">
                <LabelWithInfo 
                  id="fonti" 
                  label="Tipologia di Fonti" 
                  icon={<Search size={13} className="opacity-70" />}
                  description="Definisce il perimetro di ricerca. 'Banca Dati Interna' interroga il database vettoriale interno e i tuoi allegati. 'Ricerca Web' esplora portali istituzionali in tempo reale per recuperare orientamenti recenti e non consolidati."
                  isActive={activeInfo === "fonti"}
                  onToggle={toggleInfo}
                />
                
                <div className="flex flex-col gap-3 mt-3">
                  <label className={`flex items-center justify-between p-3.5 border rounded-md cursor-pointer transition-all shadow-xs ${config.sourceInternalDB ? 'border-(--color-text) bg-(--color-bg)' : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-text)'}`}>
                    <div className="flex items-center gap-3 text-(--color-text)">
                      <Database size={16} className="opacity-80" />
                      <span className="text-sm font-light">Banca Dati Interna</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={config.sourceInternalDB} 
                      onChange={() => handleSourceToggle('db')} 
                      disabled={config.sourceInternalDB && !config.sourceWeb}
                      className="w-4 h-4 cursor-pointer accent-(--color-text) disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                  </label>
                  
                  <label className={`flex items-center justify-between p-3.5 border rounded-md cursor-pointer transition-all shadow-xs ${config.sourceWeb ? 'border-(--color-text) bg-(--color-bg)' : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-text)'}`}>
                    <div className="flex items-center gap-3 text-(--color-text)">
                      <Globe size={16} className="opacity-80" />
                      <span className="text-sm font-light">Ricerca Web</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={config.sourceWeb} 
                      onChange={() => handleSourceToggle('web')} 
                      disabled={config.sourceWeb && !config.sourceInternalDB}
                      className="w-4 h-4 cursor-pointer accent-(--color-text) disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                  </label>
                </div>
                {(!config.sourceWeb && !config.sourceInternalDB) && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-2.5 flex items-center gap-1.5 font-light"><AlertCircle size={13}/> È obbligatorio selezionare almeno una fonte di ricerca.</p>
                )}
              </div>

              {/* 2. Livello di Confidenza */}
              <div className="mb-8">
                <LabelWithInfo 
                  id="confidenza" 
                  label="Livello di Confidenza" 
                  icon={<Target size={13} className="opacity-70" />}
                  description="Rappresenta la soglia minima di similarità semantica. Valori alti (85-100%) garantiscono risultati estremamente mirati. Valori inferiori allargano la ricerca esplorando concetti trasversali. Il range ammesso è 50-100%."
                  isActive={activeInfo === "confidenza"}
                  onToggle={toggleInfo}
                  rightElement={
                    <span className="text-xs font-mono font-medium text-(--color-text) bg-(--color-bg) px-2 py-0.5 rounded-sm border border-(--color-border) shadow-xs">
                      {config.confidenceLevel}%
                    </span>
                  }
                />
                <input 
                  type="range" min="50" max="100" step="5"
                  value={config.confidenceLevel}
                  onChange={(e) => setConfig({...config, confidenceLevel: Number(e.target.value)})}
                  className="w-full accent-(--color-text) cursor-pointer mt-2"
                />
              </div>

              <hr className="border-(--color-border) my-6" />

              {/* 3. Parametri LLM */}
              <div className="space-y-6">
                <div>
                  <LabelWithInfo 
                    id="temperatura" 
                    label="Temperatura" 
                    icon={<SlidersHorizontal size={13} className="opacity-70"/>}
                    description="Controlla la creatività del modello linguistico (0.0 - 1.0). Verso 0.0 (Analitico) favorisce risposte logiche e aderenti alle fonti. Valori più alti introducono variabilità lessicale, ma aumentano il rischio di parafrasi imprecise."
                    isActive={activeInfo === "temperatura"}
                    onToggle={toggleInfo}
                    rightElement={
                      <span className="text-xs font-mono text-(--color-text) bg-(--color-bg) px-2 py-0.5 rounded-sm border border-(--color-border) shadow-xs">
                        {config.temperature.toFixed(1)}
                      </span>
                    }
                  />
                  <input 
                    type="range" min="0" max="1" step="0.1"
                    value={config.temperature}
                    onChange={(e) => setConfig({...config, temperature: Number(e.target.value)})}
                    className="w-full accent-(--color-text) cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-(--color-muted) px-0.5 mt-1.5 font-light uppercase tracking-widest">
                    <span>Analitico</span>
                    <span>Creativo</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <LabelWithInfo 
                      id="topk" 
                      label="N. Risultati (k)" 
                      icon={<Hash size={13} className="opacity-70"/>}
                      description="Numero massimo di frammenti più rilevanti da analizzare (Range: 1 - 50). Oltre i 50 risultati si rischia di saturare il contesto disorientando il modello (Lost in the middle)."
                      isActive={activeInfo === "topk"}
                      onToggle={toggleInfo}
                    />
                    <input 
                      type="number" min="1" max="50"
                      value={config.topK}
                      onChange={(e) => setConfig({...config, topK: Number(e.target.value)})}
                      onBlur={(e) => setConfig({...config, topK: clampValue(Number(e.target.value), 1, 50)})}
                      className="w-full p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md text-sm text-center text-(--color-text) focus:border-(--color-text) outline-none shadow-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer / Pulsante Avvio */}
            <div className="border-t border-(--color-border) bg-(--color-bg) p-5">
              <button 
                type="button"
                onClick={() => {
                  if (isReadyToStart) {
                    onStartAnalysis();
                    onClose();
                  }
                }}
                disabled={!isReadyToStart}
                className={`w-full py-3 px-4 rounded-md font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2 transition-all shadow-xs outline-none cursor-pointer
                  ${isReadyToStart
                    ? 'bg-(--color-text) text-(--color-surface) hover:opacity-90' 
                    : 'bg-(--color-border) text-(--color-muted) cursor-not-allowed opacity-60'}`}
              >
                {isProcessing ? (
                  <>Elaborazione In Corso...</>
                ) : (
                  <><Play size={15} /> Avvia Analisi Profonda</>
                )}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};