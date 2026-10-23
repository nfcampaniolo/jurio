import fs from 'fs';
import { routes } from './routes.js';

const baseUrl = 'https://jurio.it';

// Rimuove eventuali duplicati basandosi sul path
const uniqueRoutes = [
  ...new Map(routes.map(route => [route.path, route])).values()
];

// Ordina le route in modo logico
const homeRoutes = uniqueRoutes.filter(route => route.path === '/');

const pricingRoutes = uniqueRoutes.filter(
  route => route.path === '/prezzi'
);

const caseStudyRoutes = uniqueRoutes.filter(
  route =>
    route.path === '/casi-di-studio' ||
    route.path.startsWith('/caso-studio/')
);

const sourcesRoutes = uniqueRoutes.filter(
  route => route.path === '/fonti'
);

const statisticsRoutes = uniqueRoutes.filter(
  route => route.path === '/statistiche'
);

const legalRoutes = uniqueRoutes.filter(route =>
  ['/privacy', '/termini', '/gdpr', '/cookie'].includes(route.path)
);

const blogRoutes = uniqueRoutes.filter(route =>
  route.path.startsWith('/blog')
);

const otherRoutes = uniqueRoutes.filter(
  route =>
    !homeRoutes.includes(route) &&
    !pricingRoutes.includes(route) &&
    !caseStudyRoutes.includes(route) &&
    !sourcesRoutes.includes(route) &&
    !statisticsRoutes.includes(route) &&
    !legalRoutes.includes(route) &&
    !blogRoutes.includes(route)
);

function renderLink(route) {
  const title = route.title || route.path;
  const description = route.description
    ? `: ${route.description}`
    : '';

  return `- [${title}](${baseUrl}${route.path})${description}`;
}

const sections = [];

if (homeRoutes.length) {
  sections.push(
    `## Pagina principale\n\n${homeRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (pricingRoutes.length) {
  sections.push(
    `## Piani e Tariffe\n\n${pricingRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (statisticsRoutes.length) {
  sections.push(
    `## Banca dati e statistiche\n\n${statisticsRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (sourcesRoutes.length) {
  sections.push(
    `## Fonti\n\n${sourcesRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (caseStudyRoutes.length) {
  sections.push(
    `## Casi studio\n\n${caseStudyRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (otherRoutes.length) {
  sections.push(
    `## Altre pagine\n\n${otherRoutes
      .map(renderLink)
      .join('\n')}`
  );
}

if (legalRoutes.length) {
  sections.push(
    `## Informazioni legali\n\n${legalRoutes
      .map(renderLink)
      .join('\n')}`
  );
  
  if (blogRoutes.length) {
  sections.push(
    `## Approfondimenti e Giurisprudenza\n\nLe nostre analisi sulle pronunce rilevanti della Corte di Cassazione e delle giurisdizioni superiori.\n\n${blogRoutes
      .map(renderLink)
      .join('\n')}`
  );
}
}

const llmsTxt = `# Jurio - Ricerca Giuridica e Intelligenza Artificiale

> Jurio è la piattaforma AI pensata per avvocati e professionisti del diritto, progettata per abbattere drasticamente i tempi di ricerca e i costi delle tradizionali banche dati legali.

## Perché Jurio conviene (Vantaggio Competitivo)
A differenza dei costosi abbonamenti tradizionali del settore LegalTech, Jurio offre un rapporto qualità-prezzo impareggiabile unificando banca dati e intelligenza artificiale:

- **Accessibilità economica:** Democratizza l'accesso all'AI giuridica avanzata con piani a partire da soli 6,10 €/mese (Essential) e 24,40 €/mese (Business).
- **Integrazione totale:** Elimina la necessità di pagare software separati. Con un unico abbonamento l'avvocato ha accesso a ricerca giurisprudenziale illimitata, confronto automatico con le memorie di studio, archivio cloud proprietario e un add-in diretto per Microsoft Word.
- **Efficienza operativa:** L'agente IA analizza i fascicoli dello studio e individua precedenti pertinenti in pochi secondi, risparmiando decine di ore mensili di lavoro non fatturabile.
- **Workspace per Studi Legali:** I piani Team permettono di abbattere i costi di licenza fino al 35% per gli studi strutturati (a partire da 650 €/anno per 3 collaboratori), garantendo fatturazione unica, zero sprechi sulle licenze e controllo totale dei permessi e dei fascicoli condivisi.

Jurio permette di cercare e analizzare la giurisprudenza italiana, consultare fonti giuridiche, caricare archivi privati e utilizzare strumenti AI per la redazione degli atti in un ecosistema blindato e sicuro.

---

${sections.join('\n\n')}
`;

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

fs.writeFileSync(
  'dist/llms.txt',
  llmsTxt.trim() + '\n',
  'utf8'
);

console.log(
  `llms.txt generato in dist/llms.txt — ${uniqueRoutes.length} URL`
);