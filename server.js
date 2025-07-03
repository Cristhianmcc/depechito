// Simple proxy scraper to obtain DirecTV Sports HLS URL from pelotalibrehdtv.com
// Run: npm install express node-fetch@2 cheerio cors
// Then: node server.js

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const serverDiagnostic = require('./server_diagnostic');

// Configuración del servidor
const PORT = process.env.PORT || 4000;
const APP_URL = process.env.APP_URL || 'http://31.97.247.127:4000';
const app = express();

// Habilitar CORS para todas las rutas con opciones extendidas
app.use(cors({
  origin: '*',  // Permitir cualquier origen (en producción, limitar según necesidades)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept', 'Referer', 'User-Agent'],
  credentials: true,
  maxAge: 86400
}));

// Middleware adicional para asegurar que las cabeceras CORS se establecen correctamente
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Lista de User-Agents para rotación y evitar bloqueos
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1'
];

// Función para obtener un User-Agent aleatorio
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Permitir el procesamiento de JSON en el cuerpo de las peticiones
app.use(express.json());

// Agente HTTPS que ignora errores de certificado SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true, // Mantener conexiones abiertas
  timeout: 30000 // Timeout más largo para conexiones difíciles
});

// Configuración para la base de datos SQLite
const DB_FILE = path.join(__dirname, 'tokens.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conexión exitosa a la base de datos SQLite');
    // Crear la tabla de tokens si no existe
    db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        note TEXT,
        hours INTEGER
      )
    `, (err) => {
      if (err) {
        console.error('Error al crear la tabla de tokens:', err.message);
      } else {
        console.log('Tabla de tokens verificada/creada correctamente');
        // Migrar tokens existentes desde el archivo JSON si existe
        migrateTokensFromJson();
      }
    });
  }
});

// Función para migrar tokens existentes desde JSON a SQLite (solo se ejecuta una vez)
function migrateTokensFromJson() {
  const TOKEN_FILE = path.join(__dirname, 'tokens.json');
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      const tokens = JSON.parse(data);
      
      // Iniciar una transacción para insertar todos los tokens
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare('INSERT OR REPLACE INTO tokens (token, createdAt, expiresAt, note, hours) VALUES (?, ?, ?, ?, ?)');
        
        Object.entries(tokens).forEach(([token, data]) => {
          stmt.run(token, data.createdAt, data.expiresAt, data.note || '', data.hours || 24);
        });
        
        stmt.finalize();
        db.run('COMMIT', [], (err) => {
          if (err) {
            console.error('Error al migrar tokens desde JSON:', err.message);
          } else {
            console.log(`Migrados ${Object.keys(tokens).length} tokens desde JSON a SQLite`);
            // Opcional: renombrar el archivo JSON original como backup
            fs.renameSync(TOKEN_FILE, `${TOKEN_FILE}.bak`);
            console.log('Archivo JSON renombrado como backup');
          }
        });
      });
    } catch (error) {
      console.error('Error al leer el archivo de tokens:', error);
    }
  } else {
    console.log('No se encontró archivo JSON de tokens para migrar');
  }
}

// URL directa de canales deportivos (actualizada manualmente el 20 de junio de 2025)
const DSPORTS_DIRECT_LINKS = {
  // DirecTV Sports
  dsports: "https://Y2FzdGxl.fubohd.com:443/dsports/mono.m3u8?token=956e33a590747b8cd1b1325b8d9c07d7b2d8bb00-c7-1750472825-1750454825",
  dsports2: "https://b2ZmaWNpYWw.fubohd.com:443/dsports2/mono.m3u8?token=08fe0524dec1f097b74b9531ee00b6ce81a54408-61-1750472828-1750454828",
  dsportsplus: "https://x4bnd7lq.fubohd.com:443/dsportsplus/mono.m3u8?token=031f9c309af6ccd639fe06f97a903f58cac11c7c-8d-1750472831-1750454831",
  // ESPN
  espn: "https://dglvz29s.fubohd.com:443/espn/mono.m3u8?token=d1ada30d5e96fb31420079d8bb2-1750585779-1750567779",
  espn2: "https://Y2FzdGxl.fubohd.com:443/espn2/mono.m3u8?token=b6b732d221d005ff7a92e799553614008abf776c-cb-1750472837-1750454837",
  espn3: "https://c2nvdxq.fubohd.com:443/espn3/mono.m3u8?token=a744710486ee63a8d6290b265674bb262ad41877-84-1750472841-1750454841",  
  // URLs específicas para los siguientes canales con sus propios subdominios
  espn4: "https://xzc2tdf3.fubohd.com:443/espn4/mono.m3u8?token=f8bc4039e549b0ba3c49f3e39e0c9e93e99d6402-c3-1750472844-1750454844",
  espn5: "https://r4nd0m.fubohd.com:443/espn5/mono.m3u8?token=84bbce613ca0f6c513f9a3cad8eaed913db98290f-2f-1750472860-1750454860",
  espn6: "https://esp6d0m.fubohd.com:443/espn6/mono.m3u8?token=ee0254fc9e97a79a57a9f5dc8fc9141c03d72e5e-a5-1750472860-1750454860",
  espn7: "https://mzxncvb.fubohd.com:443/espn7/mono.m3u8?token=b2301b0c84a70afbcb8bbc328a9ee2a03e1fc99a-42-1750472860-1750454860",
  espnpremium: "https://aGl2ZQ.fubohd.com:443/espnpremium/mono.m3u8?token=83a85799163c43376ed43d8d7910fcf3109cac2f-fc-1750472857-1750454857",
  
  // Otros canales
  liga1max: "https://bmv3.fubohd.com:443/liga1max/mono.m3u8?token=a681268fe6dfa0f513f9bcd8eafed913db98290f-2f-1750472860-1750454860"
};

// Servir archivos estáticos desde el directorio actual
app.use(express.static(__dirname));

// Helper to extract first m3u8 URL from HTML
function extractM3U8(html) {
  const regex = /https?:[^"'\s]+\.m3u8[^"'\s]*/i;
  const match = html.match(regex);
  return match ? match[0] : null;
}

// Helper para extraer URLs MPD (para DASH)
function extractMPD(html) {
  const regex = /https?:[^"'\s]+\.mpd[^"'\s]*/i;
  const match = html.match(regex);
  return match ? match[0] : null;
}

// Función para extraer tokens y URLs de streams desde RojaDirecta
async function extractFromRojaDirecta(eventNameOrChannel) {
  console.log(`Intentando extraer stream para ${eventNameOrChannel} desde RojaDirecta...`);
  
  // URLs de RojaDirecta y sus variantes
  const rojaSites = [
    'https://rojadirecta.watch',
    'https://rojadirectaenvivo.com',
    'https://rojadirectatv.tv',
    'https://rojadirectaenvivo.net',
    'https://rojadirecta.unblockit.kim'
  ];
  
  const results = [];
  
  // Para cada dominio de Rojadirecta, intentamos buscar el evento/canal
  for (const site of rojaSites) {
    try {
      console.log(`Buscando en ${site}...`);
      
      // 1. Primero accedemos a la página principal para buscar el evento/canal
      const mainResponse = await fetch(site, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        agent: httpsAgent,
        timeout: 10000
      });
      
      if (!mainResponse.ok) {
        console.log(`Error accediendo a ${site}: ${mainResponse.status}`);
        continue;
      }
      
      const mainHtml = await mainResponse.text();
      const $ = cheerio.load(mainHtml);
      
      // 2. Buscar enlaces que contengan el nombre del evento o canal
      const eventLinks = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        
        // Si el texto del enlace contiene el nombre del canal/evento, lo guardamos
        if (text && href && 
            (text.includes(eventNameOrChannel.toLowerCase()) || 
             eventNameOrChannel.toLowerCase().includes(text))) {
          if (href.startsWith('/')) {
            eventLinks.push(site + href);
          } else if (href.startsWith('http')) {
            eventLinks.push(href);
          }
        }
      });
      
      console.log(`Encontrados ${eventLinks.length} posibles enlaces para ${eventNameOrChannel}`);
      
      // 3. Para cada enlace de evento encontrado, accedemos y buscamos los streamers
      for (const eventLink of eventLinks.slice(0, 3)) { // Limitamos a 3 para no hacer demasiadas peticiones
        try {
          console.log(`Accediendo a evento: ${eventLink}`);
          const eventResponse = await fetch(eventLink, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            agent: httpsAgent,
            timeout: 10000
          });
          
          if (!eventResponse.ok) continue;
          
          const eventHtml = await eventResponse.text();
          const $event = cheerio.load(eventHtml);
          
          // 4. Buscar enlaces de streamers (suelen estar en tablas o listas específicas)
          const streamerLinks = [];
          
          // Buscar en enlaces con clases específicas de RojaDirecta
          $event('a.link, span.url, td.event a, a[target="_blank"]').each((_, el) => {
            const href = $event(el).attr('href');
            if (href && (href.includes('embed') || href.includes('player') || href.includes('stream'))) {
              streamerLinks.push(href);
            }
          });
          
          console.log(`Encontrados ${streamerLinks.length} enlaces de streamers`);
          
          // 5. Para cada streamer, accedemos y buscamos el token
          for (const streamerLink of streamerLinks.slice(0, 5)) { // Limitamos a 5
            try {
              // No todos los enlaces tienen protocolos
              const fullLink = streamerLink.startsWith('http') ? 
                               streamerLink : 
                               (streamerLink.startsWith('/') ? site + streamerLink : `https://${streamerLink}`);
              
              console.log(`Accediendo a streamer: ${fullLink}`);
              
              const streamerResponse = await fetch(fullLink, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Referer': eventLink
                },
                agent: httpsAgent,
                timeout: 15000
              });
              
              if (!streamerResponse.ok) continue;
              
              const streamerHtml = await streamerResponse.text();
              
              // 6. Buscar URLs de stream y tokens
              // Primero buscamos M3U8 URLs
              const m3u8Url = extractM3U8(streamerHtml);
              if (m3u8Url) {
                console.log(`¡Encontrado stream M3U8!: ${m3u8Url}`);
                
                // Extraer token si existe
                let token = null;
                if (m3u8Url.includes('token=')) {
                  const tokenMatch = m3u8Url.match(/token=([^&]+)/);
                  token = tokenMatch ? tokenMatch[1] : null;
                }
                
                results.push({
                  url: m3u8Url,
                  token,
                  source: fullLink
                });
              }
              
              // También buscar en scripts JavaScript
              const $streamer = cheerio.load(streamerHtml);
              $streamer('script').each((_, el) => {
                const scriptContent = $streamer(el).html();
                if (!scriptContent) return;
                
                // Buscar patrones comunes de tokens en JavaScript
                if (scriptContent.includes('token') || scriptContent.includes('source')) {
                  // Buscar definiciones de token
                  const tokenMatch = scriptContent.match(/token\s*[:=]\s*['"]([^'"]+)['"]/);
                  if (tokenMatch && tokenMatch[1]) {
                    console.log(`¡Encontrado token en JavaScript!: ${tokenMatch[1]}`);
                    
                    // Buscar la URL del stream
                    const streamMatch = scriptContent.match(/source\s*[:=]\s*['"]([^'"]+)['"]/);
                    const streamUrl = streamMatch ? streamMatch[1] : extractM3U8(scriptContent);
                    
                    if (streamUrl) {
                      results.push({
                        url: streamUrl,
                        token: tokenMatch[1],
                        source: fullLink
                      });
                    }
                  } else {
                    // Buscar URLs con token incluido
                    const m3u8WithToken = extractM3U8(scriptContent);
                    if (m3u8WithToken && m3u8WithToken.includes('token=')) {
                      const tokenInUrlMatch = m3u8WithToken.match(/token=([^&]+)/);
                      if (tokenInUrlMatch && tokenInUrlMatch[1]) {
                        console.log(`¡Encontrado token en URL!: ${tokenInUrlMatch[1]}`);
                        results.push({
                          url: m3u8WithToken,
                          token: tokenInUrlMatch[1],
                          source: fullLink
                        });
                      }
                    }
                  }
                }
              });
              
              // Si ya encontramos suficientes resultados, podemos parar
              if (results.length >= 3) break;
              
            } catch (e) {
              console.log(`Error accediendo a streamer ${streamerLink}: ${e.message}`);
            }
          }
          
          // Si ya encontramos suficientes resultados, podemos parar
          if (results.length >= 3) break;
          
        } catch (e) {
          console.log(`Error accediendo a evento ${eventLink}: ${e.message}`);
        }
      }
      
      // Si encontramos al menos un resultado, podemos terminar la búsqueda
      if (results.length > 0) break;
      
    } catch (e) {
      console.log(`Error general con ${site}: ${e.message}`);
    }
  }
  
  console.log(`Resultados para ${eventNameOrChannel}: ${results.length} streams encontrados`);
  return results;
}

// Función para extraer tokens y URLs desde pelotalibrehdtv.com
async function scrapePelotaLibreHDTV(channel) {
  console.log(`Buscando token para canal ${channel} en pelotalibrehdtv.com...`);
  
  // Lista de User-Agents para rotación y evitar bloqueos
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1'
  ];
  
  // Obtener un User-Agent aleatorio
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  // Dominios comunes de referencia para evitar bloqueos
  const refererDomains = [
    'https://www.google.com/',
    'https://facebook.com/',
    'https://twitter.com/',
    'https://instagram.com/',
    'https://youtube.com/'
  ];
  
  // Obtener un referer aleatorio
  const randomReferer = refererDomains[Math.floor(Math.random() * refererDomains.length)];
  
  // Mapeo de nombres de canales a los identificadores en pelotalibrehdtv
  const channelMap = {
    'dsports': 'dsports',
    'directv': 'dsports',
    'directv sports': 'dsports',
    'directv sports hd': 'dsports',
    'dsports2': 'dsports2',
    'directv sports 2': 'dsports2',
    'directv sports 2 hd': 'dsports2',
    'dsportsplus': 'dsportsplus',
    'directv plus': 'dsportsplus',
    'directv sports plus': 'dsportsplus',    'espn': 'espn',
    'espn2': 'espn2',
    'espn 2': 'espn2',
    'espn3': 'espn3',
    'espn 3': 'espn3',
    'espn4': 'espn4',
    'espn 4': 'espn4',
    'espn4-ar': 'espn4',
    'espn4-pe': 'espn4',
    'espn5': 'espn5',
    'espn 5': 'espn5',
    'espn5-ar': 'espn5',
    'espn5-pe': 'espn5',
    'espn6': 'espn6',
    'espn 6': 'espn6',
    'espn6-ar': 'espn6',
    'espn6-pe': 'espn6',
    'espn7': 'espn7',
    'espn 7': 'espn7',
    'espn7-ar': 'espn7',
    'espn7-pe': 'espn7',
    'espnpremium': 'espnpremium',
    'espn premium': 'espnpremium',
    'liga1max': 'liga1max',
    'liga 1 max': 'liga1max',
    'movistar deportes': 'movistar',
    'gol peru': 'golperu'
  };
    // Normalizar el nombre del canal
  const normalizedChannel = channel.toLowerCase().trim();
  let channelId = channelMap[normalizedChannel] || normalizedChannel;
  
  // Corrección adicional para canales ESPN específicos
  if (channelId === 'espn4' || channelId === 'espn 4') {
    channelId = 'espn4';
  } else if (channelId === 'espn5' || channelId === 'espn 5') {
    channelId = 'espn5';
  } else if (channelId === 'espn6' || channelId === 'espn 6') {
    channelId = 'espn6';
  } else if (channelId === 'espn7' || channelId === 'espn 7') {
    channelId = 'espn7';
  }
    // Dominios alternativos para intentar
  const domains = [
    'pelotalibrehdtv.com',
    'pelotalibre.me',
    'pelotalibre.net',
    'pelotalibre.live',
    'pelotalibre.one',
    'pelotalibre.pro',
    'futbollibre.net',
    'futbollibre.online'
  ];
  
  // Información para debug
  console.log(`Canal normalizado: "${normalizedChannel}" → ID en pelotalibrehdtv: "${channelId}"`);
  console.log(`User-Agent: ${randomUserAgent}`);
  console.log(`Referer: ${randomReferer}`);
  
  // Intentar con cada dominio hasta encontrar uno que funcione
  for (const domain of domains) {
    const url = `https://${domain}/canales.php?stream=${channelId}`;
    console.log(`Intentando con dominio: ${domain} (URL: ${url})`);
    
    try {
      // Configurar los headers para parecer un navegador normal
      const headers = {
        'User-Agent': randomUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Referer': randomReferer,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      };
      
      // Hacer la petición con un timeout razonable
      console.log(`Realizando petición a: ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers,
        agent: httpsAgent,
        timeout: 20000 // Aumentamos el timeout a 20 segundos
      });
      
      if (!response.ok) {
        console.error(`Error al acceder a ${domain}: ${response.status} ${response.statusText}`);
        console.log(`Response headers: ${JSON.stringify(Object.fromEntries([...response.headers]))}`);
        continue; // Intentar con el siguiente dominio
      }
      
      const pageContent = await response.text();
      console.log(`Contenido recibido de ${domain} (longitud: ${pageContent.length} bytes)`);
      
      // Buscar la URL del stream en el HTML usando diferentes patrones
      let streamUrl = null;
      
      // 1. Patrón original: buscar playbackURL en scripts
      const playbackUrlMatch = pageContent.match(/var\s+playbackURL\s*=\s*"([^"]+)"/i);
      if (playbackUrlMatch && playbackUrlMatch[1]) {
        streamUrl = playbackUrlMatch[1];
        console.log(`Stream URL encontrado con patrón playbackURL: ${streamUrl}`);
      }
      
      // 2. Buscar directamente en atributos data- que pueden contener la URL
      if (!streamUrl) {
        const dataUrlMatch = pageContent.match(/data-stream\s*=\s*["']([^"']+)["']/i);
        if (dataUrlMatch && dataUrlMatch[1]) {
          streamUrl = dataUrlMatch[1];
          console.log(`Stream URL encontrado en atributo data-stream: ${streamUrl}`);
        }
      }
      
      // 3. Buscar iframe con src que contenga m3u8
      if (!streamUrl) {
        const iframeSrcMatch = pageContent.match(/iframe[^>]+src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (iframeSrcMatch && iframeSrcMatch[1]) {
          streamUrl = iframeSrcMatch[1];
          console.log(`Stream URL encontrado en iframe src: ${streamUrl}`);
        }
      }
      
      // 4. Última opción: buscar cualquier URL de m3u8 en la página
      if (!streamUrl) {
        streamUrl = extractM3U8(pageContent);
        if (streamUrl) {
          console.log(`Stream URL encontrado con regex general: ${streamUrl}`);
        }
      }
      
      // Si no encontramos ninguna URL, continuar con el siguiente dominio
      if (!streamUrl) {
        console.warn(`No se encontró ninguna URL de stream en ${domain} para ${channel}`);
        continue;
      }
      
      // Extraer el token de la URL
      const tokenMatch = streamUrl.match(/token=([^&]+)/);
      if (!tokenMatch || !tokenMatch[1]) {
        console.warn(`No se pudo extraer el token para ${channel} de la URL: ${streamUrl}`);
        continue;
      }
      
      const token = tokenMatch[1];
      
      // Extraer la URL base sin el token
      const baseUrlMatch = streamUrl.match(/(.*?)\?token=/);
      const baseUrl = baseUrlMatch ? baseUrlMatch[1] : null;
      
      if (!baseUrl) {
        console.warn(`No se pudo extraer la URL base para ${channel}`);
        continue;
      }
        // Validar que la URL parece ser de fubohd.com (patrón común para los streams)
      if (!baseUrl.includes('fubohd.com')) {
        console.warn(`La URL base no es de fubohd.com: ${baseUrl}`);
        // Continuamos igualmente, podría ser otro proveedor válido
      }
      
      // Preparar el resultado
      const result = {
        channel: channelId,
        originalChannel: channel,
        token: token,
        baseUrl: baseUrl,
        fullUrl: streamUrl,
        timestamp: Date.now(),
        source: domain
      };
      
      console.log(`Token obtenido con éxito para ${channel}: ${token.substring(0, 15)}... (desde ${domain})`);
      
      // Guardar el token en la base de datos usando la función saveToken
      saveToken(token, {
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        note: `Auto-scraped for ${channel}`,
        hours: 24
      }, (success) => {
        if (success) {
          console.log(`Token para ${channel} guardado correctamente en la base de datos`);
        } else {
          console.error(`Error al guardar token para ${channel} en la base de datos`);
        }
      });
      
      // Actualizar el objeto de enlaces directos
      if (baseUrl && token && channelId) {
        // Asegurarse de que estamos utilizando el nombre correcto para el canal
        const finalChannelId = channelId.toLowerCase().replace(/\s+/g, '');
        
        // Asegurarse de que usamos las URLs base correctas para los canales ESPN
        let updatedStreamUrl = streamUrl;
        
        if (finalChannelId === 'espn4') {
          // Usar la URL base específica para ESPN4
          const espn4BaseUrl = 'https://xzc2tdf3.fubohd.com/espn4/mono.m3u8';
          updatedStreamUrl = `${espn4BaseUrl}?token=${token}`;
          console.log(`Usando URL base específica para ESPN4: ${espn4BaseUrl}`);
        } else if (finalChannelId === 'espn5') {
          // Usar la URL base específica para ESPN5
          const espn5BaseUrl = 'https://r4nd0m.fubohd.com/espn5/mono.m3u8';
          updatedStreamUrl = `${espn5BaseUrl}?token=${token}`;
          console.log(`Usando URL base específica para ESPN5: ${espn5BaseUrl}`);
        } else if (finalChannelId === 'espn6') {
          // Usar la URL base específica para ESPN6
          const espn6BaseUrl = 'https://esp6d0m.fubohd.com/espn6/mono.m3u8';
          updatedStreamUrl = `${espn6BaseUrl}?token=${token}`;
          console.log(`Usando URL base específica para ESPN6: ${espn6BaseUrl}`);
        } else if (finalChannelId === 'espn7') {
          // Usar la URL base específica para ESPN7
          const espn7BaseUrl = 'https://mzxncvb.fubohd.com/espn7/mono.m3u8';
          updatedStreamUrl = `${espn7BaseUrl}?token=${token}`;
          console.log(`Usando URL base específica para ESPN7: ${espn7BaseUrl}`);
        }
        
        // Actualizar el enlace directo
        DSPORTS_DIRECT_LINKS[finalChannelId] = updatedStreamUrl;
        console.log(`Enlace directo actualizado para ${finalChannelId} (original: ${channelId})`);
        
        // Log detallado para depuración
        console.log(`Token: ${token.substring(0, 15)}...`);
        console.log(`URL Base original: ${baseUrl}`);
        console.log(`URL Completa actualizada: ${updatedStreamUrl}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error al obtener token para ${channel} desde ${domain}:`, error);
      // Continuar con el siguiente dominio
    }
  }
  
  // Si llegamos aquí, ningún dominio funcionó
  console.error(`No se pudo obtener token para ${channel} en ningún dominio`);
  return null;
}

// Función para buscar y actualizar todos los tokens de canales conocidos
async function updateAllTokens() {
  console.log('Iniciando actualización automática de todos los tokens...');
  
  // Lista de canales para los que queremos obtener tokens
  const channels = [
    'dsports',
    'dsports2',
    'dsportsplus',
    'espn',
    'espn2',
    'espn3',
    'espn4',
    'espn5',
    'espn6',
    'espn7',
    'espnpremium',
    'liga1max'
  ];
  
  const results = {};
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`Actualizando tokens para ${channels.length} canales...`);
  
  // Procesar canales en serie para no sobrecargar el servidor objetivo
  for (const channel of channels) {
    try {
      console.log(`\n===== Procesando canal: ${channel} =====`);
      
      // Pequeña pausa entre peticiones para no levantar sospechas
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      
      const result = await scrapePelotaLibreHDTV(channel);
      
      if (result) {
        results[channel] = result;
        successCount++;
        console.log(`✅ Token actualizado correctamente para ${channel}`);
      } else {
        failureCount++;
        console.error(`❌ No se pudo obtener token para ${channel}`);
      }
    } catch (error) {
      failureCount++;
      console.error(`❌ Error al actualizar token para ${channel}:`, error);
    }
  }
  
  // Generar reporte de la actualización
  console.log("\n========= REPORTE DE ACTUALIZACIÓN DE TOKENS =========");
  console.log(`Canales totales: ${channels.length}`);
  console.log(`Actualizados correctamente: ${successCount}`);
  console.log(`Fallidos: ${failureCount}`);
  console.log(`Tasa de éxito: ${Math.round((successCount / channels.length) * 100)}%`);
  console.log("====================================================\n");
  
  // Si no se actualizó ningún token, podría haber un problema de red o bloqueo
  if (successCount === 0) {
    console.error("ADVERTENCIA: No se pudo actualizar ningún token. Posible bloqueo o problema de red.");
    
    // Intentar enviar una solicitud a un sitio conocido para verificar la conectividad
    try {
      const testResponse = await fetch('https://www.google.com', { 
        agent: httpsAgent,
        timeout: 5000
      });
      if (testResponse.ok) {
        console.log("✅ La conexión a Internet parece estar funcionando.");
        console.error("❌ Es posible que pelotalibrehdtv.com esté bloqueando las solicitudes del servidor.");
      } else {
        console.error(`❌ Problema de conectividad. Status: ${testResponse.status}`);
      }
    } catch (testError) {
      console.error("❌ Error de conectividad general:", testError.message);
    }
  }
  
  console.log(`Actualización de tokens completada. ${successCount}/${channels.length} tokens actualizados.`);
  return results;
}

// Endpoint para actualizar manualmente todos los tokens
app.get('/api/tokens/update-all', async (req, res) => {
  try {
    // Verificar si hay una contraseña en la configuración (opcional)
    const adminKey = req.query.key;
    if (!adminKey) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    
    // Lista de canales para actualizar
    const channels = [
      'dsports',
      'dsports2',
      'dsportsplus',
      'espn',
      'espn2',
      'espn3',
      'espn4',
      'espn5',
      'espn6',
      'espn7',
      'espnpremium',
      'liga1max'
    ];
    
    // Iniciar la actualización en segundo plano
    updateAllTokens().then(results => {
      console.log('Actualización de tokens completada en segundo plano');
    }).catch(error => {
      console.error('Error en actualización de tokens en segundo plano:', error);
    });
    
    // Responder inmediatamente
    res.json({ 
      success: true, 
      message: 'Actualización de tokens iniciada en segundo plano',
      estimatedTime: `${channels.length * 3} segundos`
    });
  } catch (error) {
    console.error('Error al iniciar actualización de tokens:', error);
    res.status(500).json({ error: 'Error al actualizar tokens' });
  }
});

// Endpoint para obtener el token actualizado de un canal específico
app.get('/api/tokens/update/:channel', async (req, res) => {
  try {
    const channel = req.params.channel;
    
    if (!channel) {
      return res.status(400).json({ error: 'Se requiere especificar un canal' });
    }
    
    console.log(`Solicitada actualización de token para canal: ${channel}`);
    const result = await scrapePelotaLibreHDTV(channel);
    
    if (!result) {
      return res.status(404).json({ error: `No se pudo obtener el token para ${channel}` });
    }
    
    res.json({
      success: true,
      channel: result.channel,
      token: result.token,
      url: result.fullUrl
    });
  } catch (error) {
    console.error(`Error al actualizar token para ${req.params.channel}:`, error);
    res.status(500).json({ error: 'Error al actualizar el token' });
  }
});

// Servidor Express

// Nueva ruta para diagnóstico de IP y conectividad directamente desde el navegador
app.get('/ip-check', async (req, res) => {
  try {
    // Devolvemos una página HTML con los resultados para poder verla directamente en el navegador
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diagnóstico de IP - Render</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
          h1 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .card { border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 15px 0; background: #f9f9f9; }
          .success { color: green; }
          .error { color: red; }
          .warning { color: orange; }
          button { background: #4CAF50; color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 4px; }
          button:hover { background: #45a049; }
          pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
          .loading { display: none; margin: 20px 0; }
          .recommendation { padding: 10px; margin: 10px 0; border-left: 4px solid #2196F3; background: #e3f2fd; }
          .critical { border-left-color: #f44336; background: #ffebee; }
          .high { border-left-color: #ff9800; background: #fff3e0; }
          .medium { border-left-color: #ffeb3b; background: #fffde7; }
          .low { border-left-color: #4CAF50; background: #e8f5e9; }
        </style>
      </head>
      <body>
        <h1>Diagnóstico de IP y Conectividad en Render</h1>
        
        <div class="card">
          <h2>Instrucciones</h2>
          <p>Esta herramienta realizará un diagnóstico completo para determinar si la IP de Render está bloqueada por los sitios de streaming.</p>
          <button id="runDiagnostic">Ejecutar Diagnóstico Completo</button>
          <div id="loading" class="loading">Ejecutando diagnóstico... Esto puede tardar hasta 30 segundos...</div>
        </div>
        
        <div id="results"></div>
        
        <script>
          document.getElementById('runDiagnostic').addEventListener('click', async function() {
            const loadingDiv = document.getElementById('loading');
            const resultsDiv = document.getElementById('results');
            
            loadingDiv.style.display = 'block';
            resultsDiv.innerHTML = '';
            
            try {
              const response = await fetch('/api/ip-diagnostic');
              if (!response.ok) throw new Error('Error en la respuesta del servidor');
              
              const data = await response.json();
              
              // Mostrar la información de la IP
              let ipHtml = '<div class="card">';
              ipHtml += '<h2>Información de IP</h2>';
              
              if (data.ipInfo.error) {
                ipHtml += \`<p class="error">Error al obtener información de IP: \${data.ipInfo.error}</p>\`;
              } else {
                ipHtml += \`<p><strong>Dirección IP:</strong> \${data.ipInfo.ip || 'No disponible'}</p>\`;
                ipHtml += \`<p><strong>Ubicación:</strong> \${data.ipInfo.city || ''}, \${data.ipInfo.region || ''}, \${data.ipInfo.country || ''}</p>\`;
                ipHtml += \`<p><strong>Organización:</strong> \${data.ipInfo.org || 'No disponible'}</p>\`;
                ipHtml += \`<p><strong>Host:</strong> \${data.ipInfo.hostname || 'No disponible'}</p>\`;
              }
              ipHtml += '</div>';
              
              // Mostrar resultado de pruebas de conexión
              let connectionsHtml = '<div class="card">';
              connectionsHtml += '<h2>Pruebas de Conexión</h2>';
              
              data.connectionTests.forEach(site => {
                connectionsHtml += \`<h3>\${site.name}</h3>\`;
                connectionsHtml += \`<p><strong>URL:</strong> \${site.url}</p>\`;
                
                if (site.success) {
                  connectionsHtml += \`<p class="success">✅ ACCESIBLE</p>\`;
                } else {
                  connectionsHtml += \`<p class="error">❌ BLOQUEADO o INACCESIBLE</p>\`;
                }
                
                connectionsHtml += '<p><strong>Intentos:</strong></p>';
                connectionsHtml += '<ul>';
                site.tests.forEach(test => {
                  if (test.success) {
                    connectionsHtml += \`<li class="success">✅ Éxito: Estado \${test.status} (\${test.elapsedTime}ms) - User-Agent: \${test.userAgent}</li>\`;
                  } else if (test.error) {
                    connectionsHtml += \`<li class="error">❌ Error: \${test.error} - User-Agent: \${test.userAgent}</li>\`;
                  } else {
                    connectionsHtml += \`<li class="warning">⚠️ Estado: \${test.status} - User-Agent: \${test.userAgent}</li>\`;
                  }
                });
                connectionsHtml += '</ul>';
              });
              connectionsHtml += '</div>';
              
              // Mostrar resultado de extracción de tokens
              let tokensHtml = '<div class="card">';
              tokensHtml += '<h2>Extracción de Tokens</h2>';
              
              if (data.tokenTests.length === 0) {
                tokensHtml += '<p class="warning">⚠️ No se realizaron pruebas de extracción de tokens</p>';
              } else {
                data.tokenTests.forEach(test => {
                  tokensHtml += \`<h3>\${test.name}</h3>\`;
                  tokensHtml += \`<p><strong>URL:</strong> \${test.url}</p>\`;
                  
                  if (test.error) {
                    tokensHtml += \`<p class="error">❌ ERROR: \${test.error}</p>\`;
                  } else if (test.tokenFound) {
                    tokensHtml += \`<p class="success">✅ TOKEN ENCONTRADO: \${test.token.substring(0, 15)}...</p>\`;
                    if (test.streamUrl) {
                      tokensHtml += \`<p><strong>Stream URL:</strong> \${test.streamUrl}</p>\`;
                    }
                  } else {
                    tokensHtml += \`<p class="warning">⚠️ No se encontró token. Longitud del contenido: \${test.contentLength || 'N/A'}</p>\`;
                    if (test.snippet) {
                      tokensHtml += \`<p><strong>Fragmento:</strong> \${test.snippet}</p>\`;
                    }
                    if (test.possiblyBlocked) {
                      tokensHtml += \`<p class="error">⛔ Contenido posiblemente bloqueado (detectado Access denied/Forbidden/Captcha)</p>\`;
                    }
                  }
                });
              }
              tokensHtml += '</div>';
              
              // Mostrar recomendaciones
              let recommendationsHtml = '<div class="card">';
              recommendationsHtml += '<h2>Diagnóstico y Recomendaciones</h2>';
              
              if (data.recommendations.length === 0) {
                recommendationsHtml += '<p>No hay recomendaciones disponibles</p>';
              } else {
                data.recommendations.forEach(rec => {
                  recommendationsHtml += \`<div class="recommendation \${rec.severity}">\`;
                  recommendationsHtml += \`<h3>\${rec.issue}</h3>\`;
                  recommendationsHtml += \`<p><strong>Problema:</strong> \${rec.description}</p>\`;
                  recommendationsHtml += \`<p><strong>Recomendación:</strong> \${rec.recommendation}</p>\`;
                  recommendationsHtml += '</div>';
                });
              }
              recommendationsHtml += '</div>';
              
              // Añadir todo a la página
              resultsDiv.innerHTML = ipHtml + connectionsHtml + tokensHtml + recommendationsHtml;
              
              // Añadir datos completos para debug
              let debugHtml = '<div class="card">';
              debugHtml += '<h2>Datos completos (para desarrolladores)</h2>';
              debugHtml += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
              debugHtml += '</div>';
              resultsDiv.innerHTML += debugHtml;
              
            } catch (error) {
              resultsDiv.innerHTML = \`<div class="card"><h2 class="error">Error</h2><p>\${error.message}</p></div>\`;
            } finally {
              loadingDiv.style.display = 'none';
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Endpoint de API para diagnóstico de IP
app.get('/api/ip-diagnostic', async (req, res) => {
  try {
    const diagnosticResults = await serverDiagnostic.runFullDiagnostic();
    res.json(diagnosticResults);
  } catch (error) {
    console.error('Error al ejecutar diagnóstico de IP:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Endpoint para diagnóstico detallado de problemas en Render
app.get('/api/render-diagnostic', async (req, res) => {
  try {
    console.log('Ejecutando diagnóstico de problemas en Render...');
    
    // 1. Recopilar información del entorno
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      serverHost: req.get('host'),
      clientIP: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };
    
    // 2. Comprobar conectividad básica a Internet
    let connectivityResults = [];
    const testSites = [
      { name: 'Google', url: 'https://www.google.com' },
      { name: 'Cloudflare', url: 'https://1.1.1.1' },
      { name: 'PelotaLibre', url: 'https://pelotalibrehdtv.com' },
      { name: 'FuboHD', url: 'https://fubohd.com' }
    ];
    
    for (const site of testSites) {
      try {
        const startTime = Date.now();
        const response = await fetch(site.url, { 
          agent: httpsAgent,
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const responseTime = Date.now() - startTime;
        
        connectivityResults.push({
          site: site.name,
          url: site.url,
          status: response.status,
          responseTime: `${responseTime}ms`,
          ok: response.ok,
          headers: Object.fromEntries([...response.headers])
        });
      } catch (error) {
        connectivityResults.push({
          site: site.name,
          url: site.url,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    // 3. Probar scrapeo específico para un canal popular
    let scrapingResults = [];
    const testChannels = ['espn', 'dsports'];
    
    for (const channel of testChannels) {
      try {
        const startTime = Date.now();
        const result = await scrapePelotaLibreHDTV(channel);
        const elapsedTime = Date.now() - startTime;
        
        if (result) {
          scrapingResults.push({
            channel,
            success: true,
            tokenFound: !!result.token,
            baseUrl: result.baseUrl,
            tokenLength: result.token?.length || 0,
            source: result.source,
            elapsedTime: `${elapsedTime}ms`
          });
        } else {
          scrapingResults.push({
            channel,
            success: false,
            elapsedTime: `${elapsedTime}ms`,
            error: 'No se pudo obtener token'
          });
        }
      } catch (error) {
        scrapingResults.push({
          channel,
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    // 4. Probar acceso directo a streams conocidos con distintos User-Agents
    let streamAccessResults = [];
    const streamUrls = [
      'https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8',
      'https://dglvz29s.fubohd.com/espn/mono.m3u8'
    ];
    
    // Lista de User-Agents para probar
    const testUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1'
    ];
    
    for (const streamUrl of streamUrls) {
      for (const userAgent of testUserAgents) {
        try {
          const startTime = Date.now();
          const response = await fetch(`${streamUrl}?token=test123456789`, {
            headers: {
              'User-Agent': userAgent,
              'Referer': 'https://pelotalibrehdtv.com/'
            },
            agent: httpsAgent,
            timeout: 10000
          });
          const responseTime = Date.now() - startTime;
          
          streamAccessResults.push({
            url: streamUrl,
            userAgent: userAgent.substring(0, 20) + '...',
            status: response.status,
            responseTime: `${responseTime}ms`,
            headers: Object.fromEntries([...response.headers])
          });
        } catch (error) {
          streamAccessResults.push({
            url: streamUrl,
            userAgent: userAgent.substring(0, 20) + '...',
            error: error.message
          });
        }
      }
    }
    
    // 5. Verificar tokens activos en la base de datos
    let dbTokensResults = {};
    
    try {
      await new Promise((resolve) => {
        db.all('SELECT COUNT(*) as count FROM tokens WHERE expiresAt > ?', [Date.now()], (err, rows) => {
          if (err) {
            dbTokensResults.error = err.message;
          } else {
            dbTokensResults.activeTokens = rows[0]?.count || 0;
          }
          resolve();
        });
      });
      
      await new Promise((resolve) => {
        db.all('SELECT note, COUNT(*) as count FROM tokens WHERE expiresAt > ? GROUP BY note', [Date.now()], (err, rows) => {
          if (err) {
            dbTokensResults.error = err.message;
          } else {
            dbTokensResults.tokensByChannel = rows;
          }
          resolve();
        });
      });
    } catch (dbError) {
      dbTokensResults.error = dbError.message;
      dbTokensResults.stack = dbError.stack;
    }
    
    // 6. Comprobar enlaces directos actuales
    const directLinksStatus = Object.entries(DSPORTS_DIRECT_LINKS).map(([channel, url]) => {
      return {
        channel,
        hasToken: url && url.includes('token='),
        urlLength: url?.length || 0,
        urlPrefix: url?.substring(0, 30) + '...' || 'N/A'
      };
    });
    
    // 7. Recomendaciones basadas en los resultados
    let recommendations = [];
    
    // Revisar conectividad
    if (connectivityResults.some(r => !r.ok && r.site !== 'FuboHD')) {
      recommendations.push('Problemas de conectividad general detectados. Verificar red de Render.');
    }
    
    // Revisar acceso a FuboHD
    const fuboAccess = connectivityResults.find(r => r.site === 'FuboHD');
    if (fuboAccess && !fuboAccess.ok) {
      recommendations.push('FuboHD está bloqueando el acceso desde los servidores de Render. Considerar usar un proxy externo.');
    }
    
    // Revisar acceso a PelotaLibre
    const pelotaLibreAccess = connectivityResults.find(r => r.site === 'PelotaLibre');
    if (pelotaLibreAccess && !pelotaLibreAccess.ok) {
      recommendations.push('PelotaLibreHDTV está bloqueando el acceso desde los servidores de Render. Considerar implementar un bypasser de bloqueos IP.');
    }
    
    // Revisar resultado de scraping
    if (scrapingResults.every(r => !r.success)) {
      recommendations.push('El scraping está fallando para todos los canales. Es probable que Render esté en una lista negra de estos sitios.');
    }
    
    // Revisar acceso a streams
    if (streamAccessResults.every(r => r.status !== 200)) {
      recommendations.push('No se puede acceder a ningún stream directamente. Considerar implementar proxy intermedio.');
    }
    
    // Si hay muy pocos tokens activos
    if (dbTokensResults.activeTokens < 3) {
      recommendations.push('Hay muy pocos tokens activos en la base de datos. Considerar obtenerlos manualmente y cargarlos.');
    }
    
    // Resultado final
    const diagnosticResult = {
      timestamp: new Date().toISOString(),
      environment,
      connectivity: connectivityResults,
      scraping: scrapingResults,
      streamAccess: streamAccessResults,
      database: dbTokensResults,
      directLinks: directLinksStatus,
      recommendations,
      renderSpecific: {
        note: "Render bloquea IP compartidas en algunos de sus planes. Si es posible, considera actualizar a un plan con IP dedicada."
      }
    };
    
    // Enviar respuesta
    res.json(diagnosticResult);
  } catch (error) {
    console.error('Error en diagnóstico de Render:', error);
    res.status(500).json({
      error: 'Error ejecutando diagnóstico',
      message: error.message,
      stack: error.stack
    });
  }
});

app.get('/api/stream/:channel', async (req, res) => {
  console.log(`Solicitud de stream recibida para canal: ${req.params.channel} desde ${req.get('origin') || 'origen desconocido'}`);
  
  // Mapeo más completo con variantes
  const mapping = {
    dsports: 'dsports',
    'directv sports': 'dsports',
    'directv sports hd': 'dsports',
    'directvsports': 'dsports',
    'directvsportshd': 'dsports',
    
    dsports2: 'dsports2',
    'directv sports 2': 'dsports2',
    'directv sports 2 hd': 'dsports2',
    'directvsports2': 'dsports2',
    'directvsports2hd': 'dsports2',
    
    dsportsplus: 'dsportsplus',
    'directv sports plus': 'dsportsplus',
    'directv sports+': 'dsportsplus',
    'directvplus': 'dsportsplus',
    'directvsportsplus': 'dsportsplus',
    
    movistar: 'movistar',
    'movistar deportes': 'movistar',
    
    espnpremium: 'espnpremium',
    'espn premium': 'espnpremium',
    'espn premium hd': 'espnpremium',
    
    liga1max: 'liga1max',
    'liga 1 max': 'liga1max',
    
    golperu: 'golperu',
    'gol peru': 'golperu',
    
    espn: 'espn',
    'espnhd': 'espn',
    'espn hd': 'espn',
    
    espn2: 'espn2',
    'espn 2': 'espn2',
    'espn2hd': 'espn2',
    'espn 2 hd': 'espn2',
    
    espn3: 'espn3',
    'espn 3': 'espn3',
    'espn3hd': 'espn3',
    'espn 3 hd': 'espn3',
    
    espn4: 'espn4',
    'espn 4': 'espn4',
    'espn4hd': 'espn4',
    'espn 4 hd': 'espn4',
    
    espn5: 'espn5',
    'espn 5': 'espn5',
    
    espn6: 'espn6',
    'espn 6': 'espn6',
    
    espn7: 'espn7',
    'espn 7': 'espn7'
  };
  
  // Normalizar el canal y encontrar el slug correspondiente
  const normalizedChannel = req.params.channel.toLowerCase().replace(/\s+/g, '');
  const slug = mapping[normalizedChannel] || mapping[req.params.channel.toLowerCase()];
  
  if (!slug) {
    console.error(`Canal no soportado: ${req.params.channel}`);
    return res.status(400).json({ 
      error: 'Canal no soportado',
      message: `No se encontró mapeo para el canal: ${req.params.channel}`,
      availableChannels: Object.keys(mapping).filter(k => !k.includes(' ')).sort()
    });
  }
  
  // Forzar actualización si se especifica en la solicitud
  const forceUpdate = req.query.refresh === 'true';
  
  // Verificar si debemos usar un enlace directo para acelerar la respuesta
  const shouldUseDirectLink = !forceUpdate && 
    DSPORTS_DIRECT_LINKS[slug] && 
    DSPORTS_DIRECT_LINKS[slug].indexOf('token=') > -1;
  
  if (shouldUseDirectLink) {
    console.log(`Usando enlace directo para ${slug}: ${DSPORTS_DIRECT_LINKS[slug].substring(0, 50)}...`);
    
    // Verificar si el token parecería ser válido (basado en longitud estándar)
    const tokenMatch = DSPORTS_DIRECT_LINKS[slug].match(/token=([^&]+)/);
    if (tokenMatch && tokenMatch[1].length > 20) {
      return res.json({ 
        url: DSPORTS_DIRECT_LINKS[slug],
        channel: slug,
        proxyUrl: `${req.protocol}://${req.get('host')}/proxy-stream?url=${encodeURIComponent(DSPORTS_DIRECT_LINKS[slug])}`
      });
    } else {
      console.log(`Token en enlace directo para ${slug} parece inválido, forzando actualización`);
      // Continuar con la actualización del token
    }
  }
  
  try {
    const candidateDomains = [
      'pelotalibrehdtv.com',
      'pelotalibre.me',
      'pelotalibre.live',
      'pelotalibre.net',
      'pelotalibre.one',
      'pelotalibre.xyz',
    ];
    let url = null;    if (slug === 'espn2' || slug === 'espn3' || slug === 'espn4' || slug === 'espn5' || slug === 'espn6' || slug === 'espn7') {
      // Intentar con diferentes slugs específicos para ESPN channels
      let specialSlugs;
      if (slug === 'espn2') {
        specialSlugs = ['espn2', 'espn-2', 'espn2-hd'];
      } else if (slug === 'espn3') {
        specialSlugs = ['espn3', 'espn-3', 'espn3-hd'];
      } else if (slug === 'espn4') {
        specialSlugs = ['espn4', 'espn-4', 'espn4-hd', 'espn4hd', 'espn 4', 'espn4-peru'];
      } else if (slug === 'espn5') {
        specialSlugs = ['espn5', 'espn-5', 'espn5-hd', 'espn5hd', 'espn 5'];
      } else if (slug === 'espn6') {
        specialSlugs = ['espn6', 'espn-6', 'espn6-hd', 'espn6hd', 'espn 6'];
      } else if (slug === 'espn7') {
        specialSlugs = ['espn7', 'espn-7', 'espn7-hd', 'espn7hd', 'espn 7'];
      }
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

// Endpoint para generar URLs de DirecTV Sports con token actualizado
app.get('/api/stream/directv-dash', async (req, res) => {
  try {
    // Base URL para DirecTV Sports sin token
    const baseUrl = "https://dtv-latam-jbc.akamaized.net/dash/live/2028183/dtv-latam-jbc/master.mpd";
    
    // Si se proporciona un token como parámetro, actualizar el almacenado
    if (req.query.token) {
      console.log('Actualizando token para DirecTV Sports');
      DSPORTS_DIRECT_LINKS.dsports = baseUrl + "?hdnts=" + req.query.token;
    }
    
    // Si tenemos un enlace directo con token actualizado, lo usamos
    if (DSPORTS_DIRECT_LINKS.dsports && DSPORTS_DIRECT_LINKS.dsports.includes('hdnts=')) {
      console.log('Devolviendo enlace directo de DirecTV Sports con token existente');
      return res.json({ url: DSPORTS_DIRECT_LINKS.dsports });
    }
    
    // Si se solicita un token actualizado, intentar obtenerlo de la URL proporcionada
    if (req.query.updateToken === 'true' && req.query.tokenUrl) {
      try {
        console.log('Intentando obtener token desde URL externa');
        // Aquí podríamos implementar lógica para obtener el token desde una fuente externa
      } catch (tokenError) {
        console.error('Error actualizando token:', tokenError);
      }
    }
    
    // Si llegamos aquí y tenemos alguna URL configurada, usamos esa
    if (DSPORTS_DIRECT_LINKS.dsports) {
      console.log('Devolviendo la URL configurada para DirecTV Sports');
      return res.json({ 
        url: DSPORTS_DIRECT_LINKS.dsports,
        message: "Usando URL configurada" 
      });
    }
    
    // Si no hay un token válido, devolvemos un mensaje
    console.log('Devolviendo URL sin token para DirecTV Sports');
    return res.json({ 
      url: baseUrl,
      message: "Se requiere un token actualizado para reproducir DirecTV Sports" 
    });
  } catch (error) {
    console.error('Error obteniendo URL de DirecTV Sports:', error);
    res.status(500).json({ error: 'Error obteniendo URL de DirecTV Sports' });
  }
});

// Ruta para la página principal - debe estar antes de app.listen
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para verificar la conexión
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'El servidor está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para obtener la información del servidor
app.get('/api/config', (req, res) => {
  res.json({
    apiUrl: APP_URL,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ==================== API DE TOKENS ====================

// Función para cargar tokens desde la base de datos SQLite
function loadTokens(callback) {
  db.all('SELECT * FROM tokens', [], (err, rows) => {
    if (err) {
      console.error('Error al cargar tokens desde la base de datos:', err.message);
      callback({});
      return;
    }
    
    // Convertir filas a formato de objeto
    const tokens = {};
    rows.forEach(row => {
      tokens[row.token] = {
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        note: row.note || '',
        hours: row.hours || 24
      };
    });
    
    callback(tokens);
  });
}

// Función para guardar un token en la base de datos
function saveToken(token, data, callback) {
  const { createdAt, expiresAt, note, hours } = data;
  
  db.run(
    'INSERT OR REPLACE INTO tokens (token, createdAt, expiresAt, note, hours) VALUES (?, ?, ?, ?, ?)',
    [token, createdAt, expiresAt, note || '', hours || 24],
    function(err) {
      if (err) {
        console.error('Error al guardar token en la base de datos:', err.message);
        callback(false);
        return;
      }
      
      console.log(`Token guardado en la base de datos: ${token}`);
      callback(true);
    }
  );
}

// Función para eliminar un token de la base de datos
function deleteToken(token, callback) {
  db.run('DELETE FROM tokens WHERE token = ?', [token], function(err) {
    if (err) {
      console.error('Error al eliminar token de la base de datos:', err.message);
      callback(false);
      return;
    }
    
    console.log(`Token eliminado de la base de datos: ${token}`);
    callback(this.changes > 0);
  });
}

// Función para eliminar todos los tokens de la base de datos
function deleteAllTokens(callback) {
  db.run('DELETE FROM tokens', function(err) {
    if (err) {
      console.error('Error al eliminar todos los tokens de la base de datos:', err.message);
      callback(false);
      return;
    }
    
    console.log(`Eliminados ${this.changes} tokens de la base de datos`);
    callback(true);
  });
}

// Función para limpiar tokens expirados
function cleanExpiredTokens(callback) {
  const now = new Date().getTime();
  
  db.run('DELETE FROM tokens WHERE expiresAt < ?', [now], function(err) {
    if (err) {
      console.error('Error al limpiar tokens expirados:', err.message);
      callback && callback({});
      return;
    }
    
    const deletedCount = this.changes;
    if (deletedCount > 0) {
      console.log(`Se eliminaron ${deletedCount} tokens expirados`);
    }
    
    // Cargar los tokens restantes después de la limpieza
    loadTokens(tokens => {
      callback && callback(tokens);
    });
  });
}

// Función para obtener un token específico de la base de datos
function getToken(token, callback) {
  db.get('SELECT * FROM tokens WHERE token = ?', [token], (err, row) => {
    if (err) {
      console.error('Error al obtener token de la base de datos:', err.message);
      callback(null);
      return;
    }
    
    if (!row) {
      callback(null);
      return;
    }
    
    // Convertir a formato de objeto
    const tokenData = {
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      note: row.note || '',
      hours: row.hours || 24
    };
    
    callback(tokenData);
  });
}

// Endpoint para guardar un nuevo token
app.post('/api/tokens', (req, res) => {
  const { token, expiresAt, note, hours, password } = req.body;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  if (!token) {
    return res.status(400).json({ error: 'Token no proporcionado' });
  }
  
  // Crear datos del token
  const tokenData = {
    createdAt: new Date().getTime(),
    expiresAt: expiresAt || (new Date().getTime() + (hours || 24) * 60 * 60 * 1000),
    note: note || "",
    hours: hours || 24
  };
  
  // Guardar el token en la base de datos
  saveToken(token, tokenData, (success) => {
    if (success) {
      console.log(`Nuevo token guardado en el servidor: ${token}`);
      res.status(201).json({ success: true, token, expiresAt: tokenData.expiresAt });
    } else {
      res.status(500).json({ error: 'Error al guardar el token' });
    }
  });
});

// Endpoint para validar un token
app.get('/api/tokens/validate/:token', (req, res) => {
  const token = req.params.token;
  
  console.log(`Solicitud de validación de token: ${token}`);
  
  if (!token) {
    console.log('Token no proporcionado en la solicitud');
    return res.status(400).json({ valid: false, error: 'Token no proporcionado' });
  }
  
  // Limpiar tokens expirados y luego verificar el token solicitado
  cleanExpiredTokens((tokens) => {
    console.log(`Total de tokens en el servidor: ${Object.keys(tokens).length}`);
    console.log(`Tokens disponibles: ${Object.keys(tokens).join(', ')}`);
    
    // Verificar si el token existe
    if (!tokens[token]) {
      console.log(`Token no encontrado: ${token}`);
      return res.status(404).json({ valid: false, error: 'Token no encontrado' });
    }
    
    // Verificar si el token ha expirado
    const tokenData = tokens[token];
    const now = new Date().getTime();
    
    if (tokenData.expiresAt && now > tokenData.expiresAt) {
      console.log(`Token expirado: ${token}`);
      
      // Eliminar el token expirado
      deleteToken(token, () => {});
      
      return res.status(401).json({ valid: false, error: 'Token expirado' });
    }
    
    // Calcular tiempo restante
    const hoursRemaining = Math.floor((tokenData.expiresAt - now) / (60 * 60 * 1000));
    const minutesRemaining = Math.floor(((tokenData.expiresAt - now) % (60 * 60 * 1000)) / (60 * 1000));
    
    console.log(`Token válido: ${token} - expira en ${hoursRemaining}h ${minutesRemaining}m`);
    
    // El token es válido
    res.json({
      valid: true,
      token,
      expiresAt: tokenData.expiresAt,
      remaining: `${hoursRemaining}h ${minutesRemaining}m`,
      note: tokenData.note || ""
    });
  });
});

// Endpoint para obtener todos los tokens (solo admin)
app.get('/api/tokens', (req, res) => {
  const { password } = req.query;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  // Limpiar tokens expirados y obtener los vigentes
  cleanExpiredTokens((tokens) => {
    const now = new Date().getTime();
    
    // Preparar respuesta con información adicional
    const result = {};
    Object.keys(tokens).forEach(token => {
      const tokenData = tokens[token];
      const remainingMs = tokenData.expiresAt - now;
      const remainingHours = Math.max(0, Math.floor(remainingMs / (60 * 60 * 1000)));
      const remainingMinutes = Math.max(0, Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000)));
      
      result[token] = {
        ...tokenData,
        remaining: `${remainingHours}h ${remainingMinutes}m`,
        isExpired: now > tokenData.expiresAt,
        createdAtFormatted: new Date(tokenData.createdAt).toLocaleString(),
        expiresAtFormatted: new Date(tokenData.expiresAt).toLocaleString()
      };
    });
    
    res.json(result);
  });
});

// Endpoint para revocar un token
app.delete('/api/tokens/:token', (req, res) => {
  const { password } = req.query;
  const token = req.params.token;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  if (!token) {
    return res.status(400).json({ error: 'Token no proporcionado' });
  }
  
  // Eliminar el token de la base de datos
  deleteToken(token, (success) => {
    if (success) {
      console.log(`Token revocado: ${token}`);
      res.json({ success: true, message: 'Token revocado correctamente' });
    } else {
      res.status(404).json({ error: 'Token no encontrado o error al revocar' });
    }
  });
});

// Endpoint para revocar todos los tokens
app.delete('/api/tokens', (req, res) => {
  const { password } = req.query;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  // Eliminar todos los tokens de la base de datos
  deleteAllTokens((success) => {
    if (success) {
      console.log('Todos los tokens han sido revocados');
      res.json({ success: true, message: 'Todos los tokens han sido revocados' });
    } else {
      res.status(500).json({ error: 'Error al revocar todos los tokens' });
    }
  });
});

// Nuevo endpoint para buscar específicamente en RojaDirecta
app.get('/api/rojadirecta/:query', async (req, res) => {
  try {
    const query = req.params.query;
    console.log(`Búsqueda en RojaDirecta para: ${query}`);
    
    const results = await extractFromRojaDirecta(query);
    
    if (results.length > 0) {
      res.json({ success: true, results });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'No se encontraron streams en RojaDirecta para esta búsqueda' 
      });
    }
  } catch (error) {
    console.error('Error en búsqueda de RojaDirecta:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Función para validar las URLs de streaming
function isValidStreamingUrl(url) {
  try {
    const parsedUrl = new URL(url);
    // Solo permitir dominios específicos para el proxy
    const allowedDomains = [
      'fubohd.com',
      'pelotalibrehdtv.com',
      'pelotalibre.me',
      'akamaized.net',
      'mux.dev',
      'cloudfront.net'
    ];
    
    return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

// Endpoint proxy para M3U8 y TS para evitar problemas de CORS
app.get('/proxy-stream', async (req, res) => {
  const url = req.query.url;
  
  if (!url || !isValidStreamingUrl(url)) {
    return res.status(400).send('URL inválida o no permitida');
  }
  
  console.log(`Proxy solicitado para: ${url.substring(0, 100)}...`);
  
  try {
    // Rotación de User-Agents para evitar bloqueos
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0'
    ];
    
    // Obtener un User-Agent aleatorio
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Posibles referers
    const possibleReferers = [
      'https://pelotalibrehdtv.com/',
      'https://pelotalibre.me/',
      'https://pelotalibre.net/',
      'https://futbollibre.net/',
      'https://www.google.com/'
    ];
    
    // Seleccionar un referer aleatorio
    const randomReferer = possibleReferers[Math.floor(Math.random() * possibleReferers.length)];
    
    // Extraer el dominio de la URL para usar como Origin
    let origin;
    try {
      const urlObj = new URL(url);
      origin = urlObj.origin;
    } catch (e) {
      origin = 'https://fubohd.com';
    }
    
    // Configuración avanzada de headers para evitar bloqueos
    const headers = {
      'User-Agent': randomUserAgent,
      'Referer': randomReferer,
      'Origin': origin,
      'Accept': '*/*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'TE': 'trailers'
    };
    
    console.log(`Proxy usando User-Agent: ${randomUserAgent}`);
    console.log(`Proxy usando Referer: ${randomReferer}`);
    
    const streamResponse = await fetch(url, {
      headers,
      agent: httpsAgent,
      timeout: 20000
    });
    
    if (!streamResponse.ok) {
      console.error(`Error al obtener stream: ${streamResponse.status} ${streamResponse.statusText}`);
      console.log(`Response headers: ${JSON.stringify(Object.fromEntries([...streamResponse.headers]))}`);
      
      // Si el error es 403 (Forbidden), intentar con diferentes headers
      if (streamResponse.status === 403) {
        console.log("Detectado error 403, intentando nuevamente con diferentes headers...");
        
        // Segunda oportunidad con headers diferentes
        const secondAttemptHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://pelotalibrehdtv.com',
          'Referer': 'https://pelotalibrehdtv.com/',
          'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
        };
        
        try {
          const secondAttemptResponse = await fetch(url, {
            headers: secondAttemptHeaders,
            agent: httpsAgent,
            timeout: 20000
          });
          
          if (secondAttemptResponse.ok) {
            // Segundo intento exitoso
            console.log("Segundo intento exitoso con diferentes headers");
            
            // Copiar headers relevantes
            const contentType = secondAttemptResponse.headers.get('content-type');
            if (contentType) {
              res.setHeader('Content-Type', contentType);
            }
            
            // Establecer headers CORS explícitos
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            
            // Para archivos M3U8, necesitamos modificar las URLs para que pasen por nuestro proxy
            if (url.endsWith('.m3u8') || contentType?.includes('application/vnd.apple.mpegurl')) {
              const body = await secondAttemptResponse.text();
              
              // Modificar URLs en el archivo M3U8 para que apunten a nuestro proxy
              const baseUrl = new URL(url);
              baseUrl.search = ''; // Eliminar parámetros de búsqueda
              baseUrl.hash = '';   // Eliminar fragmento
              const baseUrlString = baseUrl.href.substring(0, baseUrl.href.lastIndexOf('/') + 1);
              
              const modifiedBody = body.replace(
                /(\.ts|\.m3u8)(\?|$)/g,
                (match, extension, query) => {
                  return `${extension}${query ? query : ''}`;
                }
              );
              
              return res.send(modifiedBody);
            } else {
              // Para otros tipos de archivos, simplemente transmitir la respuesta
              secondAttemptResponse.body.pipe(res);
              return;
            }
          } else {
            console.error(`Segundo intento también falló: ${secondAttemptResponse.status}`);
            // Continuar con el manejo de error original
          }
        } catch (secondError) {
          console.error("Error en el segundo intento:", secondError);
          // Continuar con el manejo de error original
        }
      }
      
      return res.status(streamResponse.status).send(`Error al obtener stream: ${streamResponse.statusText}`);
    }
    
    // Copiar headers relevantes
    const contentType = streamResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Establecer headers CORS explícitos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Para archivos M3U8, necesitamos modificar las URLs para que pasen por nuestro proxy
    if (url.endsWith('.m3u8') || contentType?.includes('application/vnd.apple.mpegurl')) {
      const body = await streamResponse.text();
      
      // Modificar URLs en el archivo M3U8 para que apunten a nuestro proxy
      const baseUrl = new URL(url);
      baseUrl.search = ''; // Eliminar parámetros de búsqueda
      baseUrl.hash = '';   // Eliminar fragmento
      const baseUrlString = baseUrl.href.substring(0, baseUrl.href.lastIndexOf('/') + 1);
      
      const modifiedBody = body.replace(
        /(\.ts|\.m3u8)(\?|$)/g,
        (match, extension, query) => {
          return `${extension}${query ? query : ''}`;
        }
      );
      
      return res.send(modifiedBody);
    } else {
      // Para otros tipos de archivos, simplemente transmitir la respuesta
      streamResponse.body.pipe(res);
    }
  } catch (error) {
    console.error('Error en proxy de streaming:', error);
    res.status(500).send('Error en proxy de streaming: ' + error.message);
  }
});

// Endpoint para diagnosticar problemas con los tokens
app.get('/api/diagnostic', async (req, res) => {
  try {
    // Obtener todos los tokens activos
    db.all('SELECT token, note, createdAt, expiresAt FROM tokens WHERE expiresAt > ? ORDER BY expiresAt DESC', [Date.now()], async (err, rows) => {
      if (err) {
        console.error('Error al obtener tokens para diagnóstico:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      const diagnosticResults = [];
      let tokenCount = 0;
      let validTokens = 0;
      let invalidTokens = 0;
      
      // Para cada token, realizar un test
      for (const row of rows) {
        tokenCount++;
        const { token, note } = row;
        
        try {
          // Detectar el canal para este token
          let channel = note;
          if (note && note.toLowerCase().includes('auto-scraped for ')) {
            channel = note.toLowerCase().split('auto-scraped for ')[1];
          }          // Encontrar una URL base adecuada para probar el token
          let baseUrl = null;
          if (channel === 'dsports' || channel === 'directv sports hd') {
            baseUrl = 'https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8';
          } else if (channel === 'espnpremium') {
            baseUrl = 'https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8';
          } else if (channel === 'espn') {
            baseUrl = 'https://dglvz29s.fubohd.com/espn/mono.m3u8';
          } else if (channel === 'espn2') {
            baseUrl = 'https://Y2FzdGxl.fubohd.com/espn2/mono.m3u8';
          } else if (channel === 'espn3') {
            baseUrl = 'https://c2nvdxq.fubohd.com/espn3/mono.m3u8';
          } else if (channel === 'espn4') {
            baseUrl = 'https://xzc2tdf3.fubohd.com/espn4/mono.m3u8';
          } else if (channel === 'espn5') {
            baseUrl = 'https://r4nd0m.fubohd.com/espn5/mono.m3u8';
          } else if (channel === 'espn6') {
            baseUrl = 'https://esp6d0m.fubohd.com/espn6/mono.m3u8';
          } else if (channel === 'espn7') {
            baseUrl = 'https://mzxncvb.fubohd.com/espn7/mono.m3u8';
          } else if (channel === 'liga1max') {
            baseUrl = 'https://bmv3.fubohd.com/liga1max/mono.m3u8';
          }
          
          // Si tenemos una URL base, prueba el token
          if (baseUrl) {
            const testUrl = `${baseUrl}?token=${token}`;
            const testResponse = await fetch(testUrl, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              },
              agent: httpsAgent,
              timeout: 5000
            });
            
            const statusCode = testResponse.status;
            const isValid = statusCode === 200;
      if (isValid) {
              validTokens++;
              
              // Actualizar también los enlaces directos cuando encontramos tokens válidos
              if (channel === 'espn4') {
                console.log(`Actualizando enlace directo para ESPN4 con token válido`);
                DSPORTS_DIRECT_LINKS['espn4'] = testUrl;
              } else if (channel === 'espn5') {
                console.log(`Actualizando enlace directo para ESPN5 con token válido`);
                DSPORTS_DIRECT_LINKS['espn5'] = testUrl;
              } else if (channel === 'espn6') {
                console.log(`Actualizando enlace directo para ESPN6 con token válido`);
                DSPORTS_DIRECT_LINKS['espn6'] = testUrl;
              } else if (channel === 'espn7') {
                console.log(`Actualizando enlace directo para ESPN7 con token válido`);
                DSPORTS_DIRECT_LINKS['espn7'] = testUrl;
              }
            }
            
            diagnosticResults.push({
              channel,
              note,
              token: token.substring(0, 15) + '...',
              createdAt: new Date(row.createdAt).toLocaleString(),
              expiresAt: new Date(row.expiresAt).toLocaleString(),
              testUrl: testUrl.substring(0, 30) + '...',
              status: statusCode,
              valid: isValid
            });
          } else {
            diagnosticResults.push({
              channel,
              note,
              token: token.substring(0, 15) + '...',
              createdAt: new Date(row.createdAt).toLocaleString(),
              expiresAt: new Date(row.expiresAt).toLocaleString(),
              status: 'no-test',
              message: 'No se pudo determinar URL base'
            });
          }
        } catch (testError) {
          console.warn(`Error al probar token para ${note}:`, testError);
          diagnosticResults.push({
            note,
            token: token.substring(0, 15) + '...',
            createdAt: new Date(row.createdAt).toLocaleString(),
            expiresAt: new Date(row.expiresAt).toLocaleString(),
            status: 'error',
            error: testError.message
          });
        }
      }
      
      res.json({
        totalTokens: tokenCount,
        validTokens,
        invalidTokens,
        notTested: tokenCount - validTokens - invalidTokens,
        results: diagnosticResults,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Error en diagnóstico:', error);
    res.status(500).json({ error: 'Error durante el diagnóstico' });
  }
});

// Endpoint para obtener los tokens más recientes para los clientes
app.get('/api/tokens/current', async (req, res) => {
  try {
    console.log(`Solicitando tokens actuales para el cliente desde ${req.get('origin') || 'origen desconocido'}`);
    
    // Limpiar tokens expirados antes de devolver resultados
    cleanExpiredTokens(async () => {
      // Consultar tokens desde la base de datos
      db.all('SELECT token, note, createdAt, expiresAt FROM tokens WHERE expiresAt > ? ORDER BY createdAt DESC', [Date.now()], (err, rows) => {
        if (err) {
          console.error('Error al consultar tokens actuales:', err.message);
          return res.status(500).json({ success: false, error: 'Error interno al obtener tokens' });
        }
        
        console.log(`Se encontraron ${rows.length} tokens activos`);
        
        // Objeto para almacenar tokens por canal
        const tokensByChannel = {};
        
        // Canales principales que queremos mapear
        const channelNamesMap = {
          'dsports': 'DIRECTV Sports HD',
          'directv sports': 'DIRECTV Sports HD', 
          'directv sports hd': 'DIRECTV Sports HD',
          'dsports2': 'DIRECTV Sports 2 HD',
          'directv sports 2': 'DIRECTV Sports 2 HD',
          'directv sports 2 hd': 'DIRECTV Sports 2 HD',
          'dsportsplus': 'DIRECTV Sports Plus HD',
          'directv sports plus': 'DIRECTV Sports Plus HD',
          'directv sports+': 'DIRECTV Sports Plus HD',
          'espn': 'ESPN',
          'espn hd': 'ESPN',
          'espn2': 'ESPN 2',
          'espn 2': 'ESPN 2',
          'espn3': 'ESPN 3',
          'espn 3': 'ESPN 3',
          'espn4': 'ESPN 4',
          'espn 4': 'ESPN 4',
          'espn5': 'ESPN 5',
          'espn 5': 'ESPN 5',
          'espn6': 'ESPN 6',
          'espn 6': 'ESPN 6',
          'espn7': 'ESPN 7',
          'espn 7': 'ESPN 7',
          'espnpremium': 'ESPN Premium',
          'espn premium': 'ESPN Premium',
          'liga1max': 'Liga 1 MAX',
          'liga 1 max': 'Liga 1 MAX',
          'movistar deportes': 'Movistar Deportes',
          'gol peru': 'GOL Peru'
        };
        
        // Debug: Mostrar todos los tokens encontrados
        console.log('--- Tokens encontrados en la base de datos ---');
        rows.forEach((row, index) => {
          console.log(`[${index+1}/${rows.length}] Token: ${row.token.substring(0, 10)}... | Note: "${row.note}" | Creado: ${new Date(row.createdAt).toLocaleString()} | Expira: ${new Date(row.expiresAt).toLocaleString()}`);
        });
        console.log('-------------------------------------------');
        
        // Procesar cada token y asociarlo con su canal
        rows.forEach(row => {
          const { token, note } = row;
          
          // Extraer nombre de canal del note para los tokens auto-scrapeados
          let channelName = null;
          
          if (note && note.toLowerCase().includes('auto-scraped for ')) {
            // Extraer el nombre del canal después de "auto-scraped for "
            const extractedChannel = note.substring(note.toLowerCase().indexOf('auto-scraped for ') + 'auto-scraped for '.length).trim().toLowerCase();
            
            // Mapear el nombre extraído a un nombre estándar si existe
            channelName = channelNamesMap[extractedChannel];
            
            // Si no hay mapeo directo, intentar encontrar una coincidencia parcial
            if (!channelName) {
              // Buscar en el mapa de nombres por coincidencia parcial
              for (const [key, value] of Object.entries(channelNamesMap)) {
                if (extractedChannel.includes(key) || key.includes(extractedChannel)) {
                  channelName = value;
                  console.log(`Coincidencia parcial para "${extractedChannel}" con clave "${key}" → "${value}"`);
                  break;
                }
              }
              
              // Si aún no hay coincidencia, usar el nombre extraído tal cual
              if (!channelName) {
                channelName = extractedChannel.toUpperCase();
                console.log(`No se encontró mapeo para "${extractedChannel}", usando nombre original`);
              }
            } else {
              console.log(`Mapeo directo encontrado para "${extractedChannel}" → "${channelName}"`);
            }
          } else if (note) {
            // Para tokens no auto-scrapeados, usar el note como nombre de canal
            // También intentar mapear si corresponde
            const normalizedNote = note.toLowerCase().trim();
            channelName = channelNamesMap[normalizedNote] || note;
            
            console.log(`Token con note genérico: "${note}" → ${channelName === note ? 'sin mapeo' : `mapeado a "${channelName}"`}`);
          } else {
            // Sin note, probablemente un token manual
            console.log(`Token sin note (${token.substring(0, 10)}...), ignorando`);
          }
          
          // Si se identificó un canal, guardar el token
          if (channelName) {
            // Si ya existe un token para este canal, solo sobrescribir si es más reciente
            if (!tokensByChannel[channelName] || row.createdAt > tokensByChannel[channelName].createdAt) {
              tokensByChannel[channelName] = {
                token: token,
                createdAt: row.createdAt,
                expiresAt: row.expiresAt,
                originalNote: note
              };
              console.log(`Asignando token para canal "${channelName}": ${token.substring(0, 15)}...`);
            } else {
              console.log(`Ya existe un token más reciente para "${channelName}", ignorando este token`);
            }
          }
        });
        
        // Convertir a formato esperado por el cliente (solo los tokens)
        const simplifiedTokens = {};
        for (const [channel, data] of Object.entries(tokensByChannel)) {
          simplifiedTokens[channel] = data.token;
        }
        
        // Debug: Mostrar tokens mapeados
        console.log('--- Tokens mapeados por canal ---');
        Object.entries(simplifiedTokens).forEach(([channel, token]) => {
          console.log(`${channel}: ${token.substring(0, 15)}...`);
        });        console.log('--------------------------------');        
        // Incluir base URLs para los canales        
        const baseUrls = {          
          'DIRECTV Sports HD': 'https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8',
          'DIRECTV Sports 2 HD': 'https://b2ZmaWNpYWw.fubohd.com/dsports2/mono.m3u8',
          'DIRECTV Sports Plus HD': 'https://x4bnd7lq.fubohd.com/dsportsplus/mono.m3u8',
          'ESPN': 'https://dglvz29s.fubohd.com/espn/mono.m3u8',
          'ESPN 2': 'https://Y2FzdGxl.fubohd.com/espn2/mono.m3u8',          
          'ESPN 3': 'https://c2nvdxq.fubohd.com/espn3/mono.m3u8',          
          'ESPN 4': 'https://xzc2tdf3.fubohd.com/espn4/mono.m3u8',
          'ESPN 5': 'https://r4nd0m.fubohd.com/espn5/mono.m3u8',
          'ESPN 6': 'https://esp6d0m.fubohd.com/espn6/mono.m3u8',
          'ESPN 7': 'https://mzxncvb.fubohd.com/espn7/mono.m3u8',
          'ESPN Premium': 'https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8',
          'Liga 1 MAX': 'https://bmv3.fubohd.com/liga1max/mono.m3u8'
        };
        
        // Si hay muy pocos tokens, intentar forzar una actualización automática
        if (Object.keys(simplifiedTokens).length < 5) {
          console.warn('Se encontraron muy pocos tokens válidos, iniciando actualización automática...');
          // Iniciar actualización en segundo plano
          updateAllTokens().catch(err => console.error('Error en actualización automática:', err));
        }
        
        // Responder al cliente con los tokens encontrados
        res.json({
          success: true,
          tokens: simplifiedTokens,
          baseUrls: baseUrls,
          count: Object.keys(simplifiedTokens).length,
          timestamp: Date.now(),
          message: Object.keys(simplifiedTokens).length < 5 ? 
                  'Pocos tokens disponibles, se ha iniciado una actualización automática' : 
                  'Tokens cargados correctamente'
        });
      });
    });
  } catch (error) {
    console.error('Error al obtener tokens actuales:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Configurar tarea programada para actualizar tokens cada 6 horas
setInterval(async () => {
  console.log('Ejecutando actualización programada de tokens...');
  try {
    await updateAllTokens();
    console.log('Actualización programada de tokens completada con éxito');
  } catch (error) {
    console.error('Error en actualización programada de tokens:', error);
  }
}, 6 * 60 * 60 * 1000); // 6 horas en milisegundos

// Ejecutar una actualización inicial al iniciar el servidor (con un pequeño retraso)
setTimeout(async () => {
  console.log('Ejecutando actualización inicial de tokens...');
  try {
    await updateAllTokens();
    console.log('Actualización inicial de tokens completada con éxito');
  } catch (error) {
    console.error('Error en actualización inicial de tokens:', error);
  }
}, 10000); // 10 segundos de retraso para permitir que el servidor se inicie completamente

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Endpoint para diagnosticar problemas de scraping
app.get('/api/scraping-diagnostic', async (req, res) => {
  try {
    console.log('Ejecutando diagnóstico de scraping...');
    
    // Lista reducida de canales para probar (solo 3 para no sobrecargar)
    const testChannels = ['dsports', 'espn', 'espnpremium'];
    const diagnosticResults = [];
    let successCount = 0;
    
    // Probar cada dominio con cada canal
    const domains = [
      'pelotalibrehdtv.com',
      'pelotalibre.me',
      'pelotalibre.net', 
      'pelotalibre.live',
      'futbollibre.net'
    ];
    
    for (const domain of domains) {
      console.log(`\n==== Probando dominio: ${domain} ====`,);
      const domainResults = [];
      
      for (const channel of testChannels) {
        try {
          // URL específica para este dominio y canal
          const url = `https://${domain}/canales.php?stream=${channel}`;
          console.log(`Probando ${url}...`);
          
          // Hacer petición con timeout amplio para pruebas
          const startTime = Date.now();
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            agent: httpsAgent,
            timeout: 20000
          });
          
          const responseTime = Date.now() - startTime;
          
          if (response.ok) {
            const html = await response.text();
            
            // Buscar token en el HTML
            let streamUrl = null;
            let token = null;
            
            // Usar diferentes patrones para encontrar la URL
            const playbackUrlMatch = html.match(/var\s+playbackURL\s*=\s*"([^"]+)"/i);
            if (playbackUrlMatch && playbackUrlMatch[1]) {
              streamUrl = playbackUrlMatch[1];
            }
            
            // Si no, probar con regex general
            if (!streamUrl) {
              streamUrl = extractM3U8(html);
            }
            
            // Extraer token si encontramos URL
            if (streamUrl && streamUrl.includes('token=')) {
              const tokenMatch = streamUrl.match(/token=([^&]+)/);
              if (tokenMatch) token = tokenMatch[1];
            }
            
            // Registrar resultado
            const result = {
              domain,
              channel,
              status: response.status,
              responseTime: `${responseTime}ms`,
              htmlLength: html.length,
              streamFound: !!streamUrl,
              tokenFound: !!token,
              streamUrl: streamUrl ? streamUrl.substring(0, 50) + '...' : null,
              token: token ? token.substring(0, 15) + '...' : null
            };
            
            domainResults.push(result);
            
            if (token) {
              successCount++;
              console.log(`✅ Token encontrado para ${channel} en ${domain}`);
            } else {
              console.log(`❌ No se encontró token para ${channel} en ${domain}`);
            }
          } else {
            domainResults.push({
              domain,
              channel,
              status: response.status,
              responseTime: `${responseTime}ms`,
              error: `HTTP ${response.status}: ${response.statusText}`
            });
            console.log(`❌ Error HTTP ${response.status} para ${channel} en ${domain}`);
          }
        } catch (error) {
          domainResults.push({
            domain,
            channel,
            error: error.message || 'Error desconocido',
            stack: error.stack
          });
          console.log(`❌ Error para ${channel} en ${domain}: ${error.message}`);
        }
        
        // Pequeña pausa entre pruebas
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      diagnosticResults.push({
        domain,
        results: domainResults,
        successRate: `${Math.round((domainResults.filter(r => r.tokenFound).length / testChannels.length) * 100)}%`
      });
    }
    
    // Información de entorno y red
    const networkInfo = {
      host: req.get('host'),
      userAgent: req.get('user-agent'),
      remoteAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version
    };
    
    res.json({
      success: true,
      summary: {
        totalTests: domains.length * testChannels.length,
        successfulTokens: successCount,
        successRate: `${Math.round((successCount / (domains.length * testChannels.length)) * 100)}%`,
        bestDomain: diagnosticResults.sort((a, b) => {
          const aSuccess = a.results.filter(r => r.tokenFound).length;
          const bSuccess = b.results.filter(r => r.tokenFound).length;
          return bSuccess - aSuccess;
        })[0]?.domain || 'Ninguno',
      },
      networkInfo,
      domains: diagnosticResults,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error en diagnóstico de scraping:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error desconocido',
      stack: error.stack
    });
  }
});
