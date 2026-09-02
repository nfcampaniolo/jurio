// src/services/plans.ts
import { collection, getDocs, query } from "firebase/firestore";
import { getDb } from "@/services/db";
import { type PlanName } from "@/interfaces/interfaces";

export type PlanDocId = "personale" | "team" | "business" ;

export type PlanFromDb = {
  name: PlanName;
  price: number;
  initial_price?: number;
  durationDays: number;
  currency?: string;
  features: {
    name: string;
    included: boolean;
    description: string;
  }[];
  cta: string;
  highlighted?: boolean;
};

export type PlanUI = PlanFromDb & {
  id: PlanDocId;
  priceLabel: string;
};

const PRELOADED_PLANS: PlanUI[] = [
  {
    id: "personale",
    name: "Personale",
    price: 6.1,
    initial_price: 12.2,
    durationDays: 30,
    cta: "Registrati",
    highlighted: false,
    features: [
      {
        name: "Consultazione Illimitata e Analisi Strutturale del Nomofilattico",
        included: true,
        description: "",
      },
      {
        name: "Ricerca Semantica Multilivello e Analisi del Corpus",
        included: true,
        description: "",
      },
      {
        name: "Analisi di Coerenza tra Atti di Studio e Giurisprudenza",
        included: false,
        description: "",
      },
      {
        name: "Ricerca Integrata su Fonti Interne, Esterne e Web",
        included: false,
        description: "",
      },
      {
        name: "Archivio Cloud Riservato con Acquisizione Intelligente dei Documenti",
        included: false,
        description: "",
      },
      {
        name: "Analisi dei Fascicoli e Supporto alla Redazione",
        included: false,
        description: "",
      },
      {
        name: "Tool di Supporto alla Navigazione",
        included: true,
        description: "",
      },
      {
        name: "Supporto Tecnico Prioritario e Assistenza Dedicata",
        included: false,
        description: "",
      },
    ],
    priceLabel: formatPriceEUR(6.1),
  },
  {
    id: "business",
    name: "Business",
    price: 24.4,
    initial_price: 48.8,
    durationDays: 30,
    cta: "Registrati",
    highlighted: true,
    features: [
      {
        name: "Consultazione Illimitata e Analisi Strutturale del Nomofilattico",
        included: true,
        description: "",
      },
      {
        name: "Ricerca Semantica Multilivello e Analisi del Corpus",
        included: true,
        description: "",
      },
      {
        name: "Analisi di Coerenza tra Atti di Studio e Giurisprudenza",
        included: true,
        description: "",
      },
      {
        name: "Ricerca Integrata su Fonti Interne, Esterne e Web",
        included: true,
        description: "",
      },
      {
        name: "Archivio Cloud Riservato con Acquisizione Intelligente dei Documenti",
        included: true,
        description: "",
      },
      {
        name: "Analisi dei Fascicoli e Supporto alla Redazione",
        included: true,
        description: "",
      },
      {
        name: "Tool di Supporto alla Navigazione",
        included: true,
        description: "",
      },
      {
        name: "Supporto Tecnico Prioritario e Assistenza Dedicata",
        included: true,
        description: "",
      },
    ],
    priceLabel: formatPriceEUR(24.4),
  },
];

const ORDER: Record<PlanDocId, number> = { personale: 0, team: 1, business: 2 };

export function formatPriceEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}


export async function fetchPlansFromDb(): Promise<PlanUI[]> {
  const db = await getDb();
  const snap = await getDocs(query(collection(db, "plans")));

  const list = snap.docs.map((d) => {
    const id = d.id as PlanDocId;
    const data = d.data() as PlanFromDb;

    return {
      id,
      ...data,
      priceLabel: formatPriceEUR(data.price),
    };
  });

  list.sort((a, b) => (ORDER[a.id] ?? 999) - (ORDER[b.id] ?? 999));

  return list;
}

export function getPreloadedPlans(): PlanUI[] {
  return PRELOADED_PLANS;
}