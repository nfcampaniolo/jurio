import fs from 'fs';
import { routes } from './routes.js';

const baseUrl = 'https://jurio.it';

// Rimuove eventuali duplicati basandosi sul path
const uniqueRoutes = [
  ...new Map(routes.map(route => [route.path, route])).values()
];

// Ordina le route in modo logico
const homeRoutes = uniqueRoutes.filter(route => route.path === '/');

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

const otherRoutes = uniqueRoutes.filter(
  route =>
    !homeRoutes.includes(route) &&
    !caseStudyRoutes.includes(route) &&
    !sourcesRoutes.includes(route) &&
    !statisticsRoutes.includes(route) &&
    !legalRoutes.includes(route)
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
}

const llmsTxt = `# Jurio

> Jurio è la piattaforma di ricerca giuridica con intelligenza artificiale pensata per avvocati e professionisti del diritto.

Jurio permette di cercare e analizzare la giurisprudenza italiana, consultare fonti giuridiche, analizzare documenti e utilizzare strumenti di intelligenza artificiale per supportare il lavoro legale.

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