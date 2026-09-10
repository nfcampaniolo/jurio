import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc, 
  where, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { getDb } from "@/infrastructure/db"; 

// --- INTERFACCE ---
export interface MetricDetail {
  count: number;
  timeSavedMinutes: number;
}

export interface MonthlyUsageReportData {
  mese: string; 
  isCurrentMonth: boolean;
  haFattoPrompting: boolean;
  interazioniCount: number;
  ricerca: MetricDetail;
  analisi: MetricDetail;
  sintesi: MetricDetail;
  deepAnalysis: MetricDetail;
  totalTimeSavedMinutes: number;
}

export interface PlanLimits {
  research: number;
  analysis: number;
  synthesis: number;
  deep_analysis: number;
}

// Limiti base per i vari piani
const PLAN_LIMITS: Record<string, PlanLimits> = {
  personale: { research: 100, analysis: 0, synthesis: 0, deep_analysis: 30 },
  personale_m: { research: 100, analysis: 0, synthesis: 0, deep_analysis: 30 },
  business: { research: 100, analysis: 200, synthesis: 200, deep_analysis: 30 },
  business_m: { research: 100, analysis: 200, synthesis: 200, deep_analysis: 30 },
  admin: { research: 100, analysis: 200, synthesis: 200, deep_analysis: 30 },
  default: { research: 100, analysis: 0, synthesis: 5, deep_analysis: 30 } // Fallback
};

// Costanti per il calcolo del tempo (in minuti)
export const TIME_MULTIPLIERS = {
  research: 10,
  analysis: 30,
  synthesis: 15,
  deepAnalysis: 60,
};

// Utility Typescript sicura per estrarre numeri
function getNum(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  return typeof val === 'number' ? val : Number(val) || 0;
}

// --- FUNZIONE DI CALCOLO ---
export function calculateReportData(rawUsage: Record<string, unknown>, targetMonthStr: string, isCurrentMonth: boolean): MonthlyUsageReportData {
  const haFattoPrompting = getNum(rawUsage, 'prompting') > 0;
  const interazioniCount = getNum(rawUsage, 'legal_agent');
  
  const analisiCount = getNum(rawUsage, 'review_agent') + 
                       getNum(rawUsage, 'reasoning') + 
                       getNum(rawUsage, 'speech_to_text');
  const analisiTime = analisiCount * TIME_MULTIPLIERS.analysis;
  
  const ricercaCount = getNum(rawUsage, 'research_agent') + 
                       getNum(rawUsage, 'research');
  const ricercaTime = ricercaCount * TIME_MULTIPLIERS.research;
  
  const sintesiCount = getNum(rawUsage, 'drafting_agent');
  const sintesiTime = sintesiCount * TIME_MULTIPLIERS.synthesis;

  const deepAnalysisCount = getNum(rawUsage, 'deep_analysis');
  const deepAnalysisTime = deepAnalysisCount * TIME_MULTIPLIERS.deepAnalysis;

  return {
    mese: targetMonthStr,
    isCurrentMonth,
    haFattoPrompting,
    interazioniCount, 
    ricerca: { count: ricercaCount, timeSavedMinutes: ricercaTime },
    analisi: { count: analisiCount, timeSavedMinutes: analisiTime },
    sintesi: { count: sintesiCount, timeSavedMinutes: sintesiTime },
    deepAnalysis: { count: deepAnalysisCount, timeSavedMinutes: deepAnalysisTime },
    totalTimeSavedMinutes: analisiTime + ricercaTime + sintesiTime + deepAnalysisTime
  };
}

// Utility per unire oggetti raw in modo sicuro
function mergeRawUsage(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  allKeys.forEach((key) => {
    result[key] = getNum(a, key) + getNum(b, key);
  });
  return result;
}

// --- HOOK PRINCIPALE ---
export function useUsageData(uid: string | undefined) {
  const [usageList, setUsageList] = useState<MonthlyUsageReportData[]>([]);
  const [limits, setLimits] = useState<PlanLimits>(PLAN_LIMITS.default);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const validUid = uid; 
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const db = await getDb();
        
        // 1. Recupero Limiti dal Piano
        const userSnap = await getDoc(doc(db, "register", validUid));
        const userData = userSnap.data() as Record<string, unknown> | undefined;
        const planId = userData?.planId ? String(userData.planId) : "default";
        if (isMounted) setLimits(PLAN_LIMITS[planId] || PLAN_LIMITS.default);

        // Mappa dei raw data mese per mese
        const rawMonthsMap = new Map<string, Record<string, number>>();

        // 2. Recupero Storico (Dati aggregati mensili)
        const historyRef = collection(db, "register", validUid, "usage");
        const historySnap = await getDocs(query(historyRef, orderBy("__name__", "desc")));
        
        historySnap.forEach((docSnap) => {
          rawMonthsMap.set(docSnap.id, docSnap.data() as Record<string, number>);
        });

        // 3. Recupero Attuale (Live giornaliero)
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const daysRef = collection(db, "usage", validUid, "days");
        const daysQuery = query(
          daysRef,
          where("updatedAt", ">=", Timestamp.fromDate(startOfMonth)),
          where("updatedAt", "<=", Timestamp.fromDate(endOfMonth))
        );
        
        const daysSnap = await getDocs(daysQuery);
        
        // 4. Mappiamo la struttura partendo dal nome documento (es. 2026-09-09_reasoning)
        const liveRawUsage: Record<string, number> = {};
        daysSnap.forEach((docSnap) => {
          const docId = docSnap.id; 
          const actionName = docId.substring(11); // Estrae "reasoning" da "2026-09-09_reasoning"
          const countVal = getNum(docSnap.data() as Record<string, unknown>, 'count');
          
          liveRawUsage[actionName] = (liveRawUsage[actionName] || 0) + countVal;
        });

        // 5. Fusione del live sullo storico per il mese in corso
        if (daysSnap.size > 0 || !rawMonthsMap.has(currentMonthStr)) {
          const existingRaw = rawMonthsMap.get(currentMonthStr) || {};
          rawMonthsMap.set(currentMonthStr, mergeRawUsage(existingRaw, liveRawUsage));
        }

        // 6. Mappatura finale e calcolo
        const finalReports: MonthlyUsageReportData[] = [];
        rawMonthsMap.forEach((rawUsage, monthStr) => {
          const isCurrent = (monthStr === currentMonthStr);
          finalReports.push(calculateReportData(rawUsage, monthStr, isCurrent));
        });

        finalReports.sort((a, b) => b.mese.localeCompare(a.mese));
        
        if (isMounted) {
            setUsageList(finalReports);
            setError(null);
        }

      } catch (err: unknown) {
        console.error("Errore fetch usage data:", err);
        if (isMounted) setError("Impossibile caricare i dati di utilizzo al momento.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [uid]);

  return { usageList, limits, loading, error };
}

// --- UTILITY FORMATTAZIONE ---

export function formatMonthLabel(id: string): string {
  // Supporta dinamicamente sia il formato "2026-08" che "2026_08"
  const separator = id.includes("_") ? "_" : "-";
  const [year, month] = id.split(separator);
  
  if (!year || !month) return id;
  
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
}

export function formatTimeHero(totalMinutes: number): { value: string, unit: string } {
  if (totalMinutes === 0) return { value: "0", unit: "min" };
  
  if (totalMinutes < 60) {
    return { value: totalMinutes.toString(), unit: "min" };
  }
  
  const hours = totalMinutes / 60;
  if (hours < 24) {
    return { value: hours.toFixed(1).replace('.0', ''), unit: "ore" };
  }
  
  const days = hours / 24;
  if (days < 7) {
    return { value: days.toFixed(1).replace('.0', ''), unit: "giorni" };
  }
  
  const weeks = days / 7;
  return { value: weeks.toFixed(1).replace('.0', ''), unit: "settimane" };
}

export function formatTimeCompact(totalMinutes: number): string {
  if (totalMinutes === 0) return "0m";
  
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  const hours = totalMinutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1).replace('.0', '')}h`;
  }
  
  const days = hours / 24;
  if (days < 7) {
    return `${days.toFixed(1).replace('.0', '')}g`;
  }
  
  const weeks = days / 7;
  return `${weeks.toFixed(1).replace('.0', '')}sett`;
}