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

// Configuración del servidor
const PORT = process.env.PORT || 4000;
const APP_URL = process.env.APP_URL || 'https://depechito.onrender.com';
const app = express();

// Habilitar CORS para todas las rutas
app.use(cors());

// Permitir el procesamiento de JSON en el cuerpo de las peticiones
app.use(express.json());

// Agente HTTPS que ignora errores de certificado SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
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
  espn: "https://bgvnzw5k.fubohd.com:443/espn/mono.m3u8?token=c5a74b171e49b1022702479bc250dde57771e1eb-42-1750472834-1750454834",
  espn2: "https://Y2FzdGxl.fubohd.com:443/espn2/mono.m3u8?token=b6b732d221d005ff7a92e799553614008abf776c-cb-1750472837-1750454837",
  espn3: "https://c2nvdxq.fubohd.com:443/espn3/mono.m3u8?token=a744710486ee63a8d6290b265674bb262ad41877-84-1750472841-1750454841",
  espn4: "https://dmvudge.fubohd.com:443/espn4/mono.m3u8?token=e9c61bc73e1e3bce1b5902430548767eb83ab681-d3-1750472844-1750454844",
  espn5: "https://qzv4jmsc.fubohd.com:443/espn5/mono.m3u8?token=a41ddbe916dcff4af4578aa064fa56d6e97e99ef-2-1750472847-1750454847",
  espn6: "https://x4bnd7lq.fubohd.com:443/espn6/mono.m3u8?token=48ffe2fbf34e4bbb88f4ad406cebd3f4ad862b15-42-1750472850-1750454850",
  espn7: "https://cgxheq.fubohd.com:443/espn7/mono.m3u8?token=d9f0d7712302c3c0861a1fe869fafbb33696617d-ae-1750472853-1750454853",
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
    'directv sports plus': 'dsportsplus',
    'espn': 'espn',
    'espn2': 'espn2',
    'espn 2': 'espn2',
    'espn3': 'espn3',
    'espn 3': 'espn3',
    'espn4': 'espn4',
    'espn 4': 'espn4',
    'espn5': 'espn5',
    'espn 5': 'espn5',
    'espn6': 'espn6',
    'espn 6': 'espn6',
    'espn7': 'espn7',
    'espn 7': 'espn7',
    'espnpremium': 'espnpremium',
    'espn premium': 'espnpremium',
    'liga1max': 'liga1max',
    'liga 1 max': 'liga1max',
    'movistar deportes': 'movistar',
    'gol peru': 'golperu'
  };
  
  // Normalizar el nombre del canal
  const normalizedChannel = channel.toLowerCase().trim();
  const channelId = channelMap[normalizedChannel] || normalizedChannel;
  
  // URL de pelotalibrehdtv para el canal específico
  const url = `https://pelotalibrehdtv.com/canales.php?stream=${channelId}`;
  
  try {
    // Configurar los headers para parecer un navegador normal
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
      'Referer': 'https://pelotalibrehdtv.com/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    };
    
    // Hacer la petición con un timeout razonable
    console.log(`Realizando petición a: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers,
      agent: httpsAgent,
      timeout: 10000
    });
    
    if (!response.ok) {
      console.error(`Error al acceder a pelotalibrehdtv: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const pageContent = await response.text();
    
    // Buscar la URL del stream en el HTML usando una expresión regular
    // Buscamos específicamente la variable playbackURL en el script
    const playbackUrlMatch = pageContent.match(/var\s+playbackURL\s*=\s*"([^"]+)"/i);
    
    if (!playbackUrlMatch || !playbackUrlMatch[1]) {
      console.warn(`No se encontró la URL del stream para ${channel}`);
      return null;
    }
    
    const streamUrl = playbackUrlMatch[1];
    console.log(`Stream URL encontrado: ${streamUrl}`);
    
    // Extraer el token de la URL
    const tokenMatch = streamUrl.match(/token=([^&]+)/);
    if (!tokenMatch || !tokenMatch[1]) {
      console.warn(`No se pudo extraer el token para ${channel}`);
      return null;
    }
    
    const token = tokenMatch[1];
    
    // Extraer la URL base sin el token
    const baseUrlMatch = streamUrl.match(/(.*?)\?token=/);
    const baseUrl = baseUrlMatch ? baseUrlMatch[1] : null;
    
    // Preparar el resultado
    const result = {
      channel: channelId,
      originalChannel: channel,
      token: token,
      baseUrl: baseUrl,
      fullUrl: streamUrl,
      timestamp: Date.now()
    };
    
    console.log(`Token obtenido con éxito para ${channel}: ${token.substring(0, 15)}...`);
    
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
      DSPORTS_DIRECT_LINKS[channelId] = streamUrl;
      console.log(`Enlace directo actualizado para ${channelId}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error al obtener token para ${channel}:`, error);
    return null;
  }
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
  
  // Procesar canales en serie para no sobrecargar el servidor objetivo
  for (const channel of channels) {
    try {
      console.log(`Procesando canal: ${channel}`);
      // Pequeña pausa entre peticiones para no levantar sospechas
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      
      const result = await scrapePelotaLibreHDTV(channel);
      if (result) {
        results[channel] = result;
        successCount++;
      }
    } catch (error) {
      console.error(`Error al actualizar token para ${channel}:`, error);
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
  
  // Verificar si debemos usar un enlace directo de DirecTV Sports
  const shouldUseDirectLink = req.query.refresh !== 'true' && 
    DSPORTS_DIRECT_LINKS[slug] && 
    (slug === 'dsports' || slug === 'dsports2' || slug === 'dsportsplus');
  
  if (shouldUseDirectLink) {
    console.log(`Usando enlace directo para ${slug}`);
    return res.json({ url: DSPORTS_DIRECT_LINKS[slug] });
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

// Ruta específica para el proxy de streams para dispositivos móviles
app.get('/api/stream/proxy', async (req, res) => {
  const channel = req.query.channel;
  const isMobile = req.query.mobile === 'true';
  
  console.log(`Solicitud de proxy recibida para canal: ${channel} (Móvil: ${isMobile})`);
  
  if (!channel) {
    return res.status(400).json({ error: 'Se requiere parámetro de canal' });
  }
  
  // Normalizar el nombre del canal para buscar en mappings
  const normalizedChannel = channel.toLowerCase()
    .replace(/\s+/g, '')
    .replace('directv', 'dsports')
    .replace('liga1', 'liga1max');
  
  // Mapeo de nombres de canales a identificadores de ruta
  const mapping = {
    dsportshd: 'dsports',
    dsports: 'dsports',
    dsportshd: 'dsports',
    dsports2hd: 'dsports2',
    dsports2: 'dsports2',
    dsportsplus: 'dsportsplus',
    directvplus: 'dsportsplus',
    liga1max: 'liga1max',
    golperu: 'golperu',
    espn: 'espn',
    espn2: 'espn2',
    espn3: 'espn3',
    espn4: 'espn4',
    espnpremium: 'espnpremium',
    movistardeportes: 'movistar'
  };
  
  const slug = mapping[normalizedChannel] || normalizedChannel;
  
  try {
    let streamUrl = '';
    let token = '';
    
    // Primero intentamos usar un enlace directo si está disponible
    if (DSPORTS_DIRECT_LINKS[slug]) {
      console.log(`Usando enlace directo para ${slug}`);
      streamUrl = DSPORTS_DIRECT_LINKS[slug];
      
      // Extraer token del enlace directo
      const tokenMatch = streamUrl.match(/token=([^&]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
    } else {
      // Fallback: Intentar redirigir a la ruta específica
      return res.redirect(`/api/stream/${slug}?mobile=true`);
    }
    
    // Devolvemos la URL y el token
    return res.json({ 
      url: streamUrl, 
      token: token,
      channel: channel,
      isMobile: isMobile
    });
  } catch (error) {
    console.error(`Error obteniendo stream para ${channel}:`, error);
    return res.status(500).json({ 
      error: 'Error al obtener el stream', 
      message: error.message 
    });
  }
});

// Ruta específica para obtener enlaces de stream adaptados para móviles
app.get('/api/mobile/stream', async (req, res) => {
  const channelName = req.query.channel;
  const userAgent = req.query.device || req.headers['user-agent'];
  
  console.log(`[MÓVIL] Solicitud de stream para: ${channelName}`);
  console.log(`[MÓVIL] User-Agent: ${userAgent?.substring(0, 100) || 'no disponible'}`);
  
  if (!channelName) {
    return res.status(400).json({ error: 'Se requiere parámetro de canal' });
  }
  
  // Normalizar el nombre del canal
  const normalizedChannel = channelName.toLowerCase()
    .replace(/\s+/g, '')
    .replace('directv', 'dsports')
    .replace('liga1', 'liga1max');
  
  // Mapeo de nombres de canales a identificadores para móviles
  const mobileMapping = {
    // Canales de DirecTV Sports
    dsportshd: 'dsports_mobile',
    dsports: 'dsports_mobile',
    dsports2hd: 'dsports2_mobile',
    dsports2: 'dsports2_mobile',
    dsportsplus: 'dsportsplus_mobile',
    directvplus: 'dsportsplus_mobile',
    // Otros canales
    liga1max: 'liga1max_mobile',
    golperu: 'golperu_mobile',
    espn: 'espn_mobile',
    espn2: 'espn2_mobile',
    espn3: 'espn3_mobile',
    espn4: 'espn4_mobile',
    espnpremium: 'espnpremium_mobile',
    movistardeportes: 'movistar_mobile'
  };
  
  const slug = mobileMapping[normalizedChannel] || normalizedChannel;
  
  try {
    let streamUrl = '';
    let token = '';
    
    // Primero intentamos usar un enlace directo si está disponible
    if (DSPORTS_DIRECT_LINKS[slug]) {
      console.log(`Usando enlace directo para ${slug}`);
      streamUrl = DSPORTS_DIRECT_LINKS[slug];
      
      // Extraer token del enlace directo
      const tokenMatch = streamUrl.match(/token=([^&]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
    } else {
      // Fallback: Intentar redirigir a la ruta específica
      return res.redirect(`/api/stream/${slug}?mobile=true`);
    }
    
    // Devolvemos la URL y el token
    return res.json({ 
      url: streamUrl, 
      token: token,
      channel: channelName,
      isMobile: true
    });
  } catch (error) {
    console.error(`Error obteniendo stream para ${channelName}:`, error);
    return res.status(500).json({ 
      error: 'Error al obtener el stream', 
      message: error.message 
    });
  }
});

// Endpoint para obtener todos los tokens disponibles actualmente para el frontend
// No requiere contraseña ya que solo devuelve tokens, no información sensible
app.get('/api/tokens/current', (req, res) => {
  db.all('SELECT token, note FROM tokens WHERE expiresAt > ? ORDER BY expiresAt DESC', [Date.now()], (err, rows) => {
    if (err) {
      console.error('Error al obtener tokens actuales:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    // Creamos un objeto con los tokens actuales en el formato channel: token
    const currentTokens = {};
    rows.forEach(row => {
      // El campo note contiene el nombre del canal
      if (row.note && row.token) {
        // Convertimos nombres como 'dsports' a 'DIRECTV Sports HD' para coincidencia
        let channelName = row.note;
        
        // Mapeo de nombres de canales entre la base de datos y el frontend
        const channelMapping = {
          'dsports': 'DIRECTV Sports HD',
          'dsports2': 'DIRECTV Sports 2 HD',
          'dsportsplus': 'DirecTV Plus',
          'espnpremium': 'ESPN Premium',
          'liga1max': 'Liga 1 Max'
        };
        
        // Si hay un mapeo, usarlo
        if (channelMapping[channelName]) {
          channelName = channelMapping[channelName];
        }
        
        currentTokens[channelName] = row.token;
      }
    });
    
    res.json({
      success: true,
      tokens: currentTokens,
      count: Object.keys(currentTokens).length,
      timestamp: Date.now()
    });
  });
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
