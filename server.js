// Simple proxy scraper to obtain DirecTV Sports HLS URL from pelotalibrehdtv.com
// Run: npm install express node-fetch@2 cheerio cors
// Then: node server.js

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');
const https = require('https');
const path = require('path');

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());

// Agente HTTPS que ignora errores de certificado SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Servir archivos estáticos desde el directorio actual
app.use(express.static(__dirname));

// Helper to extract first m3u8 URL from HTML
function extractM3U8(html) {
  const regex = /https?:[^"'\s]+\.m3u8[^"'\s]*/i;
  const match = html.match(regex);
  return match ? match[0] : null;
}

// Endpoint para verificar el estado del servidor
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    host: req.get('host')
  });
});

app.get('/api/stream/:channel', async (req, res) => {
  console.log(`Solicitud de stream recibida para canal: ${req.params.channel} desde ${req.get('origin') || 'origen desconocido'}`);
  
  const mapping = {
    dsports: 'dsports',
    movistar: 'movistar',
    dsports2: 'dsports2',
    espnpremium: 'espnpremium',
    liga1max: 'liga1max',
    golperu: 'golperu',
    dsportsplus: 'dsportsplus',
    espn: 'espn',
    espn2: 'espn2',
    espn3: 'espn3',
    espn4: 'espn4',
  };
  const slug = mapping[req.params.channel.toLowerCase().replace(/\s+/g, '')];
  if (!slug) return res.status(400).json({ error: 'Channel not supported' });
  try {
    const candidateDomains = [
      'pelotalibrehdtv.com',
      'pelotalibre.me',
      'pelotalibre.live',
      'pelotalibre.net',
      'pelotalibre.one',
      'pelotalibre.xyz',
    ];
    let url = null;
    if (slug === 'espn2' || slug === 'espn3' || slug === 'espn4') {
      // Intentar con diferentes slugs específicos para ESPN2/ESPN3
      let specialSlugs;
      if (slug === 'espn2') specialSlugs = ['espn2', 'espn-2', 'espn2-hd'];
      else if (slug === 'espn3') specialSlugs = ['espn3', 'espn-3', 'espn3-hd'];
      else specialSlugs = ['espn4', 'espn-4', 'espn4-hd', 'espn4hd', 'espn 4', 'espn4-peru'];
      for (const s of specialSlugs) {
        for (const domain of candidateDomains) {
          try {
            const response = await fetch(`https://${domain}/canales.php?stream=${s}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              agent: httpsAgent, // Ignorar errores de certificado SSL
              timeout: 10000 // Timeout de 10 segundos
            });
            if (!response.ok) continue;
            const html = await response.text();
            const $ = cheerio.load(html);
            // Buscar variable playbackURL en scripts
            $('script').each((_, el) => {
              const content = $(el).html();
              if (content && content.includes('playbackURL')) {
                const tmp = extractM3U8(content);
                if (tmp) url = tmp;
              }
            });
            // Fallback regex global
            if (!url) url = extractM3U8(html);
            if (url) break; // encontramos
          } catch (e) {
            // intenta con siguiente dominio
            console.log(`Error scraping ${domain}: ${e.message}`);
          }
        }
        if (url) break;
      }
    } else if (slug === 'movistar') {
      // Manejo especial para Movistar Deportes
      const movistarSlugs = ['movistar', 'movistar-deportes', 'movistardeportes', 'mdep', 'm-deportes', 'mdeportes'];
      console.log(`Buscando stream para ${slug} con slugs: ${movistarSlugs.join(', ')}`);
      
      // Lista actualizada de dominios con mejores resultados para Movistar
      const movistarDomains = [
        'pelotalibrehdtv.com',
        'pelotalibre.me',
        'pelotalibre.net',
        'futbollibre.net', // Dominio adicional que puede tener enlaces de Movistar
        'televisionlibre.net' // Otro dominio alternativo
      ];
      
      for (const s of movistarSlugs) {
        for (const domain of movistarDomains) {
          try {
            console.log(`Intentando con ${domain} y slug ${s}...`);
            const response = await fetch(`https://${domain}/canales.php?stream=${s}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
              agent: httpsAgent, // Ignorar errores de certificado SSL
              timeout: 10000 // Timeout de 10 segundos
            });
            if (!response.ok) {
              console.log(`Respuesta no OK de ${domain}: ${response.status}`);
              continue;
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            // Buscar variable playbackURL en scripts
            $('script').each((_, el) => {
              const content = $(el).html();
              if (content && (content.includes('playbackURL') || content.includes('source:'))) {
                const tmp = extractM3U8(content);
                if (tmp) {
                  console.log(`Stream encontrado en ${domain} con slug ${s}`);
                  url = tmp;
                }
              }
            });
            // Fallback regex global
            if (!url) url = extractM3U8(html);
            if (url) break; // encontramos
          } catch (e) {
            console.log(`Error scraping ${domain}: ${e.message}`);
            // Continuar con el siguiente dominio
          }
        }
        if (url) break;
      }
    } else {
      // Lógica existente para otros canales
      for (const domain of candidateDomains) {
        try {
          const response = await fetch(`https://${domain}/canales.php?stream=${slug}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            agent: httpsAgent, // Ignorar errores de certificado SSL
            timeout: 10000 // Timeout de 10 segundos
          });
          if (!response.ok) continue;
          const html = await response.text();
          const $ = cheerio.load(html);
          // Buscar variable playbackURL en scripts
          $('script').each((_, el) => {
            const content = $(el).html();
            if (content && content.includes('playbackURL')) {
              const tmp = extractM3U8(content);
              if (tmp) url = tmp;
            }
          });
          // Fallback regex global
          if (!url) url = extractM3U8(html);
          if (url) break; // encontramos
        } catch (e) {
          // intenta con siguiente dominio
          console.log(`Error scraping ${domain}: ${e.message}`);
        }
      }
    }

    if (url) {
      res.json({ url });
    } else {
      res.status(404).json({ error: 'Stream URL not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

app.listen(PORT, () => console.log(`Scraper proxy running on http://localhost:${PORT}`));

// Ruta para la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
