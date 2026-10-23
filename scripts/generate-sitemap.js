import fs from 'fs';
import { routes } from './routes.js';

const baseUrl = 'https://jurio.it';

// Rimuove eventuali duplicati basandosi sul path, mantenendo la configurazione più specifica
const uniqueRoutesMap = new Map();
routes.forEach(route => {
  if (!uniqueRoutesMap.has(route.path)) {
    uniqueRoutesMap.set(route.path, route);
  }
});

const uniqueRoutes = Array.from(uniqueRoutesMap.values());

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueRoutes.map(({ path, changefreq = 'weekly', priority = '0.8' }) => `  <url>
    <loc>${baseUrl}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>`;

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

fs.writeFileSync('dist/sitemap.xml', sitemap.trim());

console.log(
  `Sitemap generata in dist/sitemap.xml — ${uniqueRoutes.length} URL`
);