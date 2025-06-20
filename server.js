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

// Configuración para la gestión de tokens
const TOKEN_FILE = path.join(__dirname, 'tokens.json');

// Función para cargar los tokens desde el archivo
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error al cargar tokens desde el archivo:', error);
    return {};
  }
}

// Función para guardar los tokens en el archivo
function saveTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar tokens en el archivo:', error);
    return false;
  }
}

// Función para limpiar tokens expirados
function cleanExpiredTokens() {
  const tokens = loadTokens();
  const now = new Date().getTime();
  let changed = false;
  
  Object.keys(tokens).forEach(token => {
    if (tokens[token].expiresAt && now > tokens[token].expiresAt) {
      delete tokens[token];
      changed = true;
    }
  });
  
  if (changed) {
    saveTokens(tokens);
  }
  
  return tokens;
}

// URL directa de DirecTV Sports (actualizada manualmente cuando sea necesario)
const DSPORTS_DIRECT_LINKS = {
  // Token actualizado para DirecTV Sports HD (con token de prueba)
  dsports: "https://dtv-latam-jbc.akamaized.net/dash/live/2028183/dtv-latam-jbc/master.mpd?hdnts=exp=1750395976~acl=/*~id=978c878f-c352-49d9-9ab4-5fcdfad3012f~data=hdntl~hmac=46c73f02b17e365af62b7d63cecd880a6242e065",
  dsports2: "https://ag9wzq.fubohd.com:443/dsports2/mono.m3u8?token=46c73f02b17e365af62b7d63cecd880a6242e065-90-1750395976-1750377976",
  dsportsplus: "https://eWVz.fubohd.com:443/dsportsplus/mono.m3u8?token=46c73f02b17e365af62b7d63cecd880a6242e065-90-1750395976-1750377976"
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
  
  // Cargar tokens actuales, limpiar expirados
  const tokens = cleanExpiredTokens();
  
  // Agregar el nuevo token
  tokens[token] = {
    createdAt: new Date().getTime(),
    expiresAt: expiresAt || (new Date().getTime() + (hours || 24) * 60 * 60 * 1000),
    note: note || "",
    hours: hours || 24
  };
  
  // Guardar tokens
  if (saveTokens(tokens)) {
    console.log(`Nuevo token guardado en el servidor: ${token}`);
    res.status(201).json({ success: true, token, expiresAt: tokens[token].expiresAt });
  } else {
    res.status(500).json({ error: 'Error al guardar el token' });
  }
});

// Endpoint para validar un token
app.get('/api/tokens/validate/:token', (req, res) => {
  const token = req.params.token;
  
  console.log(`Solicitud de validación de token: ${token}`);
  
  if (!token) {
    console.log('Token no proporcionado en la solicitud');
    return res.status(400).json({ valid: false, error: 'Token no proporcionado' });
  }
  
  // Cargar tokens actuales, limpiar expirados
  const tokens = cleanExpiredTokens();
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
    delete tokens[token];
    saveTokens(tokens);
    
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

// Endpoint para obtener todos los tokens (solo admin)
app.get('/api/tokens', (req, res) => {
  const { password } = req.query;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  // Cargar y limpiar tokens expirados
  const tokens = cleanExpiredTokens();
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
  
  // Cargar tokens
  const tokens = loadTokens();
  
  // Verificar si el token existe
  if (!tokens[token]) {
    return res.status(404).json({ error: 'Token no encontrado' });
  }
  
  // Eliminar el token
  delete tokens[token];
  
  // Guardar tokens
  if (saveTokens(tokens)) {
    console.log(`Token revocado: ${token}`);
    res.json({ success: true, message: 'Token revocado correctamente' });
  } else {
    res.status(500).json({ error: 'Error al revocar el token' });
  }
});

// Endpoint para revocar todos los tokens
app.delete('/api/tokens', (req, res) => {
  const { password } = req.query;
  
  // Verificar autenticación (contraseña de administrador)
  if (password !== "micausagufy1") {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  // Guardar un objeto vacío como tokens
  if (saveTokens({})) {
    console.log('Todos los tokens han sido revocados');
    res.json({ success: true, message: 'Todos los tokens han sido revocados' });
  } else {
    res.status(500).json({ error: 'Error al revocar todos los tokens' });
  }
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

app.listen(PORT, () => console.log(`Scraper proxy running on http://localhost:${PORT}`));
