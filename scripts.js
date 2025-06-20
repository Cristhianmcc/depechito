// Esta función ahora está definida al principio del archivo para evitar errores de referencia
function removeDashWarningMessage() {
  // Buscar cualquier mensaje de advertencia relacionado con DASH
  const allElements = document.querySelectorAll('div');
  allElements.forEach(el => {
    if (el.textContent && 
        (el.textContent.includes('formato DASH') || 
         el.textContent.includes('requiere un reproductor diferente') ||
         el.textContent.includes('DASH detectado'))) {
      console.log('Eliminando mensaje de advertencia DASH:', el.textContent);
      el.remove();
    }
  });
}

// Funciones de UI para mensajes y notificaciones
// Función para mostrar un mensaje de bienvenida
function showWelcomeMessage() {
  // Verificar si existe el elemento para el mensaje de bienvenida
  let welcomeMsg = document.getElementById('welcome-msg');
  if (!welcomeMsg) {
    welcomeMsg = document.createElement('div');
    welcomeMsg.id = 'welcome-msg';
    welcomeMsg.className = 'welcome-message';
    welcomeMsg.innerHTML = `
      <h3>¡Bienvenido al Reproductor de Canales!</h3>
      <p>Selecciona un canal desde la lista para comenzar a ver.</p>
      <p>Recomendamos empezar con los canales de <span class="highlight">NASA TV Public</span> o <span class="highlight">Red Bull TV</span> que suelen funcionar mejor.</p>
    `;
    
    // Añadir el mensaje al contenedor del reproductor
    const playerContainer = document.querySelector('.video-player');
    if (playerContainer) {
      playerContainer.appendChild(welcomeMsg);
    }
  }
  
  welcomeMsg.style.display = 'block';
}

// Función para mostrar mensaje de prueba de canales de demostración
function showTryDemoChannelsMessage() {
  // Verificar si existe el elemento para el mensaje
  let demoMsg = document.getElementById('try-demo-msg');
  if (!demoMsg) {
    demoMsg = document.createElement('div');
    demoMsg.id = 'try-demo-msg';
    demoMsg.className = 'demo-message';
    demoMsg.innerHTML = `
      <h3>Canal no disponible</h3>
      <p>Este canal no está disponible en este momento o requiere permisos especiales.</p>
      <p>Prueba con los canales de demostración como <span class="highlight">NASA TV Public</span> o <span class="highlight">Red Bull TV</span>.</p>
      <button id="try-demo-btn" class="action-button">Ver canal de demostración</button>
    `;
    
    // Añadir el mensaje al contenedor del reproductor
    const playerContainer = document.querySelector('.video-player');
    if (playerContainer) {
      playerContainer.appendChild(demoMsg);
    }
    
    // Agregar evento al botón
    setTimeout(() => {
      const tryDemoBtn = document.getElementById('try-demo-btn');
      if (tryDemoBtn) {
        tryDemoBtn.addEventListener('click', () => {
          const demoChannels = document.querySelectorAll('#channel-list li.demo-channel');
          if (demoChannels.length > 0) {
            demoChannels[0].click();
          }
        });
      }
    }, 100);
  }
  
  demoMsg.style.display = 'block';
}

// Función para mostrar un mensaje específico para streams bloqueados
function showBlockedStreamMessage(channelName) {
  // Verificar si existe el elemento para el mensaje
  let blockedMsg = document.getElementById('blocked-stream-msg');
  if (!blockedMsg) {
    blockedMsg = document.createElement('div');
    blockedMsg.id = 'blocked-stream-msg';
    blockedMsg.className = 'blocked-message';
    blockedMsg.innerHTML = `
      <h3>Canal con restricciones</h3>
      <p>El stream para <strong>${channelName}</strong> no está disponible debido a una de estas razones:</p>
      <ul>
        <li>El token de acceso ha expirado</li>
        <li>El servidor bloquea el acceso desde nuestra página</li>
        <li>Hay restricciones geográficas para este contenido</li>
      </ul>
      <p>Puedes intentar buscar en RojaDirecta o probar con un canal de demostración.</p>
      <div class="blocked-actions">
        <button id="try-rojadirecta-btn" class="action-button rojadirecta-button">Buscar en RojaDirecta</button>
        <button id="try-demo-blocked-btn" class="action-button">Ver canal de demostración</button>
      </div>
    `;
    
    // Añadir el mensaje al contenedor del reproductor
    const playerContainer = document.querySelector('.video-player');
    if (playerContainer) {
      playerContainer.appendChild(blockedMsg);
    }
    
    // Agregar eventos a los botones
    setTimeout(() => {
      const tryDemoBtn = document.getElementById('try-demo-blocked-btn');
      if (tryDemoBtn) {
        tryDemoBtn.addEventListener('click', () => {
          const demoChannels = document.querySelectorAll('#channel-list li.demo-channel');
          if (demoChannels.length > 0) {
            demoChannels[0].click();
          }
        });
      }
      
      const tryRojaBtn = document.getElementById('try-rojadirecta-btn');
      if (tryRojaBtn) {
        tryRojaBtn.addEventListener('click', async () => {
          tryRojaBtn.disabled = true;
          tryRojaBtn.textContent = 'Buscando...';
          
          try {
            showStatus(`Buscando ${channelName} en RojaDirecta...`);
            const url = await getFromRojaDirecta(channelName);
            
            if (url) {
              console.log(`Stream encontrado en RojaDirecta: ${url.substring(0, 50)}...`);
              blockedMsg.style.display = 'none';
              
              // Agregar la URL a la lista de fuentes del canal
              if (!CHANNELS[channelName]) CHANNELS[channelName] = [];
              CHANNELS[channelName].push(url);
              sourceIndex = CHANNELS[channelName].length - 1;
              
              // Reproducir el stream
              attachStream(url);
            } else {
              showStatus(`No se encontró stream en RojaDirecta para ${channelName}`);
              tryRojaBtn.disabled = false;
              tryRojaBtn.textContent = 'Intentar de nuevo';
            }
          } catch (error) {
            console.error(`Error buscando en RojaDirecta: ${error.message}`);
            showStatus(`Error buscando en RojaDirecta: ${error.message}`);
            tryRojaBtn.disabled = false;
            tryRojaBtn.textContent = 'Intentar de nuevo';
          }
        });
      }
    }, 100);
  } else {
    // Actualizar el nombre del canal en el mensaje existente
    const channelNameEl = blockedMsg.querySelector('strong');
    if (channelNameEl) {
      channelNameEl.textContent = channelName;
    }
  }
  
  blockedMsg.style.display = 'block';
}

// Función para mostrar un botón de "Intentar otro canal"
function showTryAnotherButton() {
  const playerContainer = document.querySelector('.video-player');
  if (!playerContainer) return;
  
  // Eliminar botones existentes
  const existingBtn = document.getElementById('try-another-btn');
  if (existingBtn) existingBtn.remove();
  
  const tryBtn = document.createElement('button');
  tryBtn.id = 'try-another-btn';
  tryBtn.className = 'action-button try-another';
  tryBtn.textContent = 'Intentar con otro canal';
  tryBtn.addEventListener('click', () => {
    const demoChannels = document.querySelectorAll('#channel-list li.demo-channel');
    if (demoChannels.length > 0) {
      demoChannels[0].click();
    }
  });
  
  playerContainer.appendChild(tryBtn);
}

// Función para añadir un botón de play cuando autoplay está bloqueado
function addPlayButton() {
  const playerContainer = document.querySelector('.video-player');
  if (!playerContainer) return;
  
  // Eliminar botones existentes
  const existingBtn = document.getElementById('manual-play-btn');
  if (existingBtn) existingBtn.remove();
  
  const playBtn = document.createElement('button');
  playBtn.id = 'manual-play-btn';
  playBtn.className = 'action-button play-button';
  playBtn.innerHTML = '▶️ Reproducir';
  playBtn.addEventListener('click', () => {
    const video = document.getElementById('player');
    if (video) {
      video.play().catch(err => {
        console.error('Error al intentar reproducir manualmente:', err);
      });
      playBtn.style.display = 'none';
    }
  });
  
  playerContainer.appendChild(playBtn);
}

// Funciones de caché de tokens para optimizar las solicitudes y reducir carga en el servidor
// -----------------------------
// Estas funciones manejan el almacenamiento y recuperación de tokens en localStorage
// para evitar solicitudes innecesarias al backend

// Función para obtener un token válido desde la caché
function getValidCachedToken(channelName) {
  try {
    // Obtener el token almacenado para el canal
    const cacheKey = `token_${channelName.replace(/\s+/g, '_').toLowerCase()}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) {
      console.log(`No hay token en caché para ${channelName}`);
      return null;
    }
    
    const tokenData = JSON.parse(cachedData);
    
    // Verificar si el token ha expirado (considerando un margen de seguridad de 5 minutos)
    const now = Date.now();
    const safetyMargin = 5 * 60 * 1000; // 5 minutos en milisegundos
    
    if (tokenData.expiresAt && (tokenData.expiresAt - safetyMargin) > now) {
      console.log(`Usando token en caché para ${channelName} (válido por ${Math.floor((tokenData.expiresAt - now) / 60000)} minutos más)`);
      return tokenData.token;
    } else {
      console.log(`Token en caché para ${channelName} ha expirado o está por expirar`);
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener token en caché para ${channelName}:`, error);
    return null;
  }
}

// Función para guardar un token en caché
function cacheToken(channelName, token, ttlMinutes = 60) {
  try {
    // No almacenar tokens vacíos o inválidos
    if (!token || token.length < 10) {
      console.warn(`Token inválido para ${channelName}, no se guardará en caché`);
      return false;
    }
    
    const cacheKey = `token_${channelName.replace(/\s+/g, '_').toLowerCase()}`;
    const now = Date.now();
    const expiresAt = now + (ttlMinutes * 60 * 1000);
    
    const tokenData = {
      token: token,
      timestamp: now,
      expiresAt: expiresAt,
      channel: channelName
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(tokenData));
    console.log(`Token para ${channelName} guardado en caché (expira en ${ttlMinutes} minutos)`);
    
    return true;
  } catch (error) {
    console.error(`Error al guardar token en caché para ${channelName}:`, error);
    return false;
  }
}

// Función para extraer un token de una URL
function extractTokenFromUrl(url) {
  if (!url) return null;
  
  // Patrones comunes de tokens en URLs
  const patterns = [
    /token=([^&]+)/,  // Formato estándar: token=abc123
    /hdnts=([^&]+)/,  // Formato Akamai: hdnts=abc123
    /auth=([^&]+)/,   // Formato auth: auth=abc123
    /wmsAuthSign=([^&]+)/  // Formato wmsAuthSign: wmsAuthSign=abc123
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Función para estimar el tiempo de expiración de un token basado en su formato
function estimateTokenExpiration(token) {
  if (!token) return 60; // Valor predeterminado: 60 minutos
  
  // Buscar timestamps Unix en el token (10 dígitos)
  const timestampMatch = token.match(/\d{10}/);
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[0]) * 1000; // Convertir a milisegundos
    const now = Date.now();
    
    // Si el timestamp está en el futuro, probablemente sea una fecha de expiración
    if (timestamp > now) {
      const minutesUntilExpiration = Math.floor((timestamp - now) / 60000);
      // Limitar a un máximo razonable (3 horas)
      return Math.min(minutesUntilExpiration, 180);
    }
  }
  
  // Para tokens KNOWN_TOKENS, usar un tiempo de vida más largo (2 horas)
  // ya que normalmente son actualizados manualmente
  if (token.length > 40) {
    return 120;
  }
  
  // Valor predeterminado para otros formatos de token
  return 60;
}

// Constantes para la URL base de los diferentes canales
const CHANNEL_BASE_URLS = {
  "Liga 1 Max": "https://dglvz29s.fubohd.com/liga1max/mono.m3u8",
  "DIRECTV Sports HD": "https://am91cm5leQ.fubohd.com/dsports/mono.m3u8",
  "DIRECTV Sports 2 HD": "https://dglvz29s.fubohd.com/dsports2/mono.m3u8",
  "DirecTV Plus": "https://b2ZmaWNpYWw.fubohd.com/dsportsplus/mono.m3u8",
  "ESPN": "https://c2f2zq.fubohd.com/espn/mono.m3u8",
  "ESPN2": "https://bGFuZQ.fubohd.com/espn2/mono.m3u8",
  "ESPN3": "https://am91cm5leQ.fubohd.com/espn3/mono.m3u8",
  "ESPN4": "https://dglvz29s.fubohd.com/espn4/mono.m3u8",
  "ESPN5": "https://qzv4jmsc.fubohd.com/espn5/mono.m3u8",
  "ESPN6": "https://agvyby.fubohd.com/espn6/mono.m3u8",
  "ESPN7": "https://c2f2zq.fubohd.com/espn7/mono.m3u8",
  "ESPN Premium": "https://a2lja3m.fubohd.com/espnpremium/mono.m3u8"
};

// scripts.js mejorado
// -----------------------------
// Configuración de canales: llena manualmente arrays o déjalos vacíos y se intentará
// buscar la primera fuente disponible usando la base pública de iptv-org.
// URL de la lista M3U externa proporcionada por el usuario
// Se eliminan playlists externas; usamos backend para canales específicos
const PLAYLIST_URLS = []; // dejado vacío por si se quiere volver a usar

// URLs de demostración que funcionan en producción - Usar sólo para pruebas
const DEMO_STREAMS = {
  "Ejemplo 1": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", // Stream de prueba 1080p
  "NASA TV": "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8", // NASA TV pública
  "Red Bull TV": "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8", // Red Bull TV
  "Demo HLS": "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8", // Stream HLS con buena compatibilidad
  "Demo Bajo": "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8" // Stream de baja calidad que suele funcionar bien
};

// Tokens conocidos para canales específicos (se actualizan manualmente)
const KNOWN_TOKENS = {
  "Liga 1 Max": "f057ff2933c158c4d7fb2ec39c744773bb914657-96-1750403033-1750385033",
  "DIRECTV Sports HD": "5ce9d8f836c84d63b9e4f954a2e267042f666749-4-1750406360-1750388360",
  "DIRECTV Sports 2 HD": "31438de0305feebf6b7830afd1f4e83f2bca8bae-40-1750404198-1750386198",
  "DirecTV Plus": "48cb7b0db0848802ce359e5f96dd202ecb6de0df-e9-1750413780-1750395780",
  
  "ESPN": "d30f1c43672f40df77c0205172841bb77db0d4e2-1d-1750404333-1750386333",
  "ESPN2": "2c75a1d5187aac920acbd797c4adaaf26db13910-8b-1750404417-1750386417",
  "ESPN3": "653adc01a02992ff31e8d6331439531a8cf743e9-3f-1750404482-1750386482",
  "ESPN4": "7cfe9154e356e98d454868c29719cf8b657572d3-7b-1750413957-1750395957",
  "ESPN5": "e0a8c5b80905b8b4b0ecdd7de82387bc6e6767d9-38-1750414076-1750396076",
  "ESPN6": "127e6f8c667e81d3ae2d5bfe57324ddd98686f02-35-1750414140-1750396140",
  "ESPN7": "1f64cda85516f558ff18b92a258a4ff82d747ce6-46-1750414182-1750396182",
  "ESPN Premium": "4e472f822cf5e6278a434107b3ff97cc37aab0f6-36-1750404622-1750386622"
  // Movistar Deportes y Gol Perú serán añadidos cuando estén disponibles
};

// API base URL - cambia automáticamente entre desarrollo y producción
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' || 
                   window.location.hostname === '';

// Forzar la URL específica de Render en producción
const API_BASE_URL = isLocalhost 
  ? 'http://localhost:4000'
  : 'https://depechito.onrender.com';

console.log('==== CONFIGURACIÓN DE LA APLICACIÓN ====');
console.log('Host actual:', window.location.hostname);
console.log('Ambiente detectado:', isLocalhost ? 'Desarrollo local' : 'Producción');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('====================================');

// Mapas de logos (URLs actualizadas para evitar errores 404)
const LOGOS = {
  "DIRECTV Sports HD": "https://i.ibb.co/vXbTGnW/DIRECTV-Sports-HD.png",
  "DIRECTV Sports 2 HD": "https://i.ibb.co/pX3zv1J/DIRECTV-Sports-2-HD.png", 
  "Movistar Deportes": "https://i.ibb.co/d6gHyyH/MovistarDeportes.png",
  "ESPN Premium": "https://i.ibb.co/C77tcRP/ESPNPremium.png",
  "ESPN": "https://i.ibb.co/ZKpddZQ/ESPN.png",
  "ESPN2": "https://i.ibb.co/wpLwTXr/ESPN2.png",
  "ESPN3": "https://i.ibb.co/L5w0Rf9/ESPN3.png",
  "ESPN4": "https://i.ibb.co/C6YBkNB/ESPN4.png",
  "ESPN5": "https://i.ibb.co/ZKpddZQ/ESPN.png", // Usando logo de ESPN como base
  "ESPN6": "https://i.ibb.co/ZKpddZQ/ESPN.png", // Usando logo de ESPN como base
  "ESPN7": "https://i.ibb.co/ZKpddZQ/ESPN.png", // Usando logo de ESPN como base
  "Liga 1 Max": "https://i.ibb.co/xJ37DbW/Liga1Max.png",
  "Gol Perú": "https://i.ibb.co/FnhznGr/GolPeru.png",
  "DirecTV Plus": "https://i.ibb.co/Z1h95KP/DIRECTVPlus.png"
};

const CHANNELS = {
  "DIRECTV Sports HD": [], // Dejamos vacío para que use el token actualizado desde KNOWN_TOKENS
  "DIRECTV Sports 2 HD": [],
  "DirecTV Plus": [],
  "Movistar Deportes": [],
  "ESPN Premium": [],
  "ESPN": [],
  "ESPN2": [],
  "ESPN3": [],
  "ESPN4": [],
  "ESPN5": [],
  "ESPN6": [],
  "ESPN7": [],
  "Liga 1 Max": [],
  "Gol Perú": [],
  // Agregar canales de demostración como canales regulares para fácil acceso
  "NASA TV Public": ["https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8"],
  "Red Bull TV": ["https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8"]
};

// ---- Utilidades para playlist M3U externa ----
async function fetchTextViaProxy(url) {
  const proxied = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
  const res = await fetch(proxied);
  return res.text();
}

function parseM3U(m3uText) {
  const lines = m3uText.split(/\r?\n/);
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF')) {
      const nameMatch = line.split(',').pop().trim();
      const urlLine = lines[i + 1] || '';
      if (urlLine && urlLine.startsWith('http')) {
        results.push({ name: nameMatch, url: urlLine.trim() });
      }
    }
  }
  return results;
}

function mergeExternalChannels(list) {
  list.forEach(({ name, url }) => {
    if (!url.endsWith('.m3u8') && !url.endsWith('.ts')) return; // sólo flujos útiles
    if (!CHANNELS[name]) {
      CHANNELS[name] = [url];
    } else if (!CHANNELS[name].includes(url)) {
      CHANNELS[name].push(url);
    }
  });
}

// Caché para catálogos iptv-org
const IPTV_CACHE = { channels: null, streams: null };

async function fetchCatalog(url, key) {
  if (IPTV_CACHE[key]) return IPTV_CACHE[key];
  const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
  const data = await res.json();
  IPTV_CACHE[key] = data;
  return data;
}

async function fetchNewLink(channelName) {
  // Log para depuración en producción
  console.log(`Intentando obtener enlace para: ${channelName} desde ${API_BASE_URL}`);
  
  // Verificar si tenemos un token en caché para el canal
  const cachedToken = getValidCachedToken(channelName);
  const lower = channelName.toLowerCase();
  
  // Si tenemos un token en caché, construir la URL correspondiente
  if (cachedToken && CHANNEL_BASE_URLS[channelName]) {
    console.log(`Usando token en caché para ${channelName}: ${cachedToken.substring(0, 10)}...`);
    return `${CHANNEL_BASE_URLS[channelName]}?token=${cachedToken}`;
  }
  
  // Usar los tokens conocidos en KNOWN_TOKENS cuando estén disponibles
  if (KNOWN_TOKENS[channelName]) {
    const token = KNOWN_TOKENS[channelName];
    console.log(`Usando token fijo para ${channelName}: ${token.substring(0, 10)}...`);
    
    // Estimar la duración del token y guardarlo en caché
    const ttl = estimateTokenExpiration(token);
    cacheToken(channelName, token, ttl);
    
    // URLs específicas según el canal
    if (lower.includes('liga 1 max')) {
      return `https://dglvz29s.fubohd.com/liga1max/mono.m3u8?token=${token}`;
    } else if (lower.includes('directv sports 2') || lower.includes('dsports2')) {
      return `https://dglvz29s.fubohd.com/dsports2/mono.m3u8?token=${token}`;
    } else if (lower.includes('directv sports') && !lower.includes('2') && !lower.includes('plus')) {
      return `https://am91cm5leQ.fubohd.com/dsports/mono.m3u8?token=${token}`;
    } else if (lower.includes('espn premium')) {
      return `https://a2lja3m.fubohd.com/espnpremium/mono.m3u8?token=${token}`;
    } else if (lower.includes('espn3') || lower.includes('espn 3')) {
      return `https://am91cm5leQ.fubohd.com/espn3/mono.m3u8?token=${token}`;
    } else if (lower.includes('espn2') || lower.includes('espn 2')) {
      return `https://bGFuZQ.fubohd.com/espn2/mono.m3u8?token=${token}`;
    } else if (lower.includes('espn') && !lower.includes('premium') && !lower.includes('2') && !lower.includes('3')) {
      return `https://c2f2zq.fubohd.com/espn/mono.m3u8?token=${token}`;
    }
  }
  
  // Intentar buscar en RojaDirecta si está habilitado
  try {
    const rojaUrl = await getFromRojaDirecta(channelName);
    if (rojaUrl) {
      console.log(`Usando stream de RojaDirecta para ${channelName}`);
      
      // Extraer y guardar el token si está disponible
      const extractedToken = extractTokenFromUrl(rojaUrl);
      if (extractedToken) {
        cacheToken(channelName, extractedToken);
      }
      
      return rojaUrl;
    }
  } catch (error) {
    console.warn(`Error buscando en RojaDirecta: ${error.message}`);
  }
  
  // Caso especial DirecTV Sports via scraper backend
  if (lower.includes('directv sports 2') || lower.includes('dsports2')) {
    if (KNOWN_TOKENS["DIRECTV Sports 2 HD"]) {
      const dsports2Token = KNOWN_TOKENS["DIRECTV Sports 2 HD"];
      // Guardar token en caché
      cacheToken("DIRECTV Sports 2 HD", dsports2Token);
      return `https://dglvz29s.fubohd.com/dsports2/mono.m3u8?token=${dsports2Token}`;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/dsports2`);
      const data = await res.json();
      
      // Extraer y guardar el token si está disponible
      if (data.url) {
        const extractedToken = extractTokenFromUrl(data.url);
        if (extractedToken) {
          cacheToken("DIRECTV Sports 2 HD", extractedToken);
        }
      }
      
      return data.url;
    } catch (e) {
      console.warn('Proxy dsports2 failed', e);
    }    } else if (lower.includes('espn premium')) {
      if (KNOWN_TOKENS["ESPN Premium"]) {
        const espnPremiumToken = KNOWN_TOKENS["ESPN Premium"];
        // Guardar token en caché
        cacheToken("ESPN Premium", espnPremiumToken);
        return `https://a2lja3m.fubohd.com/espnpremium/mono.m3u8?token=${espnPremiumToken}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espnpremium`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN Premium", extractedToken);
          }
        }
        
        return data.url;
      } catch (e) {
        console.warn('Proxy espnpremium failed', e);
      }} else if (lower.includes('espn4') || lower.includes('espn 4')) {
      if (KNOWN_TOKENS["ESPN4"]) {
        const espn4Token = KNOWN_TOKENS["ESPN4"];
        // Guardar token en caché
        cacheToken("ESPN4", espn4Token);
        return `https://dglvz29s.fubohd.com/espn4/mono.m3u8?token=${espn4Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn4`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN4", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN4:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn4 failed', e);
      }    } else if (lower.includes('espn5') || lower.includes('espn 5')) {
      if (KNOWN_TOKENS["ESPN5"]) {
        const espn5Token = KNOWN_TOKENS["ESPN5"];
        // Guardar token en caché
        cacheToken("ESPN5", espn5Token);
        return `https://qzv4jmsc.fubohd.com/espn5/mono.m3u8?token=${espn5Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn5`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN5", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN5:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn5 failed', e);
      }    } else if (lower.includes('espn6') || lower.includes('espn 6')) {
      if (KNOWN_TOKENS["ESPN6"]) {
        const espn6Token = KNOWN_TOKENS["ESPN6"];
        // Guardar token en caché
        cacheToken("ESPN6", espn6Token);
        return `https://agvyby.fubohd.com/espn6/mono.m3u8?token=${espn6Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn6`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN6", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN6:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn6 failed', e);
      }    } else if (lower.includes('espn7') || lower.includes('espn 7')) {
      if (KNOWN_TOKENS["ESPN7"]) {
        const espn7Token = KNOWN_TOKENS["ESPN7"];
        // Guardar token en caché
        cacheToken("ESPN7", espn7Token);
        return `https://c2f2zq.fubohd.com/espn7/mono.m3u8?token=${espn7Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn7`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN7", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN7:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn7 failed', e);
      }    } else if (lower.includes('espn3') || lower.includes('espn 3')) {
      if (KNOWN_TOKENS["ESPN3"]) {
        const espn3Token = KNOWN_TOKENS["ESPN3"];
        // Guardar token en caché
        cacheToken("ESPN3", espn3Token);
        return `https://am91cm5leQ.fubohd.com/espn3/mono.m3u8?token=${espn3Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn3`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN3", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN3:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn3 failed', e);
      }    } else if (lower.includes('espn2') || lower.includes('espn 2')) {
      if (KNOWN_TOKENS["ESPN2"]) {
        const espn2Token = KNOWN_TOKENS["ESPN2"];
        // Guardar token en caché
        cacheToken("ESPN2", espn2Token);
        return `https://bGFuZQ.fubohd.com/espn2/mono.m3u8?token=${espn2Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn2`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN2", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN2:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy espn2 failed', e);
      }    } else if (lower.includes('espn') && 
        !lower.includes('espn2') && !lower.includes('espn 2') && 
        !lower.includes('espn3') && !lower.includes('espn 3') && 
        !lower.includes('espn4') && !lower.includes('espn 4') &&
        !lower.includes('espn5') && !lower.includes('espn 5') &&
        !lower.includes('espn6') && !lower.includes('espn 6') &&
        !lower.includes('espn7') && !lower.includes('espn 7')) {
      if (KNOWN_TOKENS["ESPN"]) {
        const espnToken = KNOWN_TOKENS["ESPN"];
        // Guardar token en caché
        cacheToken("ESPN", espnToken);
        return `https://c2f2zq.fubohd.com/espn/mono.m3u8?token=${espnToken}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/espn`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("ESPN", extractedToken);
          }
        }
        
        console.log('Using URL for ESPN:', data.url);
        return data.url;
        return data.url;
      } catch (e) {
        console.warn('Proxy espn failed', e);
      }    } else if (lower.includes('directv sports') && !lower.includes('plus')) {
      if (KNOWN_TOKENS["DIRECTV Sports HD"]) {
        const dsportsToken = KNOWN_TOKENS["DIRECTV Sports HD"];
        // Guardar token en caché
        cacheToken("DIRECTV Sports HD", dsportsToken);
        return `https://aw1wcm92zq.fubohd.com/dsports/mono.m3u8?token=${dsportsToken}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/dsports`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("DIRECTV Sports HD", extractedToken);
          }
        }
        
        console.log('Using URL for DirecTV Sports:', data.url);
        return data.url;
      } catch (e) {
        console.warn('Proxy dsports failed', e);
      }
  } else if (lower.includes('gol peru') || lower.includes('golperu') || lower.includes('gol perú')) {
    // Verificar si tenemos token en caché
    const cachedToken = getValidCachedToken("Gol Perú");
    if (cachedToken && CHANNEL_BASE_URLS["Gol Perú"]) {
      console.log(`Usando token en caché para Gol Perú: ${cachedToken.substring(0, 10)}...`);
      return `${CHANNEL_BASE_URLS["Gol Perú"]}?token=${cachedToken}`;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/golperu`);
      const data = await res.json();
      
      // Extraer y guardar el token si está disponible
      if (data.url) {
        const extractedToken = extractTokenFromUrl(data.url);
        if (extractedToken) {
          cacheToken("Gol Perú", extractedToken);
        }
      }
      
      return data.url;
    } catch (e) {
      console.warn('Proxy golperu failed', e);
    }    } else if (lower.includes('liga 1 max')) {
      if (KNOWN_TOKENS["Liga 1 Max"]) {
        const liga1Token = KNOWN_TOKENS["Liga 1 Max"];
        // Guardar token en caché
        cacheToken("Liga 1 Max", liga1Token);
        return `https://dglvz29s.fubohd.com/liga1max/mono.m3u8?token=${liga1Token}`;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/liga1max`);
        const data = await res.json();
        
        // Extraer y guardar el token si está disponible
        if (data.url) {
          const extractedToken = extractTokenFromUrl(data.url);
          if (extractedToken) {
            cacheToken("Liga 1 Max", extractedToken);
          }
        }
        
        return data.url;
      } catch (e) {
        console.warn('Proxy liga1max failed', e);
      }
  } else if (lower.includes('movistar')) {
    // Verificar si tenemos token en caché
    const cachedToken = getValidCachedToken("Movistar Deportes");
    if (cachedToken && CHANNEL_BASE_URLS["Movistar Deportes"]) {
      console.log(`Usando token en caché para Movistar Deportes: ${cachedToken.substring(0, 10)}...`);
      return `${CHANNEL_BASE_URLS["Movistar Deportes"]}?token=${cachedToken}`;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/movistar`);
      const data = await res.json();
      
      // Extraer y guardar el token si está disponible
      if (data.url) {
        const extractedToken = extractTokenFromUrl(data.url);
        if (extractedToken) {
          cacheToken("Movistar Deportes", extractedToken);
        }
      }
      
      console.log('Using URL for Movistar:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy movistar failed', e);
    }
  } else if (lower.includes('directv plus')) {
    if (KNOWN_TOKENS["DirecTV Plus"]) {
      const dsportsPlusToken = KNOWN_TOKENS["DirecTV Plus"];
      // Guardar token en caché
      cacheToken("DirecTV Plus", dsportsPlusToken);
      return `https://b2ZmaWNpYWw.fubohd.com/dsportsplus/mono.m3u8?token=${dsportsPlusToken}`;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/dsportsplus`);
      const data = await res.json();
      
      // Extraer y guardar el token si está disponible
      if (data.url) {
        const extractedToken = extractTokenFromUrl(data.url);
        if (extractedToken) {
          cacheToken("DirecTV Plus", extractedToken);
        }
      }
      
      console.log('Using URL for DirecTV Plus:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy dsportsplus failed', e);
    }
  } 
  try {
    const channels = await fetchCatalog('https://iptv-org.github.io/api/channels.json', 'channels');
    const ch = channels.find(c => (c.name || '').toLowerCase().includes(channelName.toLowerCase()));
    if (!ch) return null;
    const streams = await fetchCatalog('https://iptv-org.github.io/api/streams.json', 'streams');
    const match = streams.find(s => s.channel === ch.id && s.url && s.url.endsWith('.m3u8'));
    return match ? match.url : null;
  } catch (e) {
    console.error('fetchNewLink error', e);
    return null;
  }
}

//--------------------------------------
// UI helpers
//--------------------------------------
function showStatus(msg) {
  let statusEl = document.getElementById('status-msg');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status-msg';
    statusEl.className = 'status';
    statusEl.style.padding = '10px';
    statusEl.style.margin = '10px 0';
    statusEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
    statusEl.style.color = 'white';
    statusEl.style.borderRadius = '4px';
    statusEl.style.textAlign = 'center';
    const playerContainer = document.querySelector('.video-player');
    playerContainer.appendChild(statusEl);
  }
  console.log(`Status: ${msg}`); // Log en consola para depuración
  statusEl.textContent = msg;
}

//--------------------------------------
// Reproductor
//--------------------------------------
let currentChannel = null;
let sourceIndex = 0;
let hls = null;
const video = document.getElementById('player');

// Reproductor DASH
let dashPlayer = null;

// Función para limpiar el reproductor DASH
function cleanupDashPlayer() {
  if (dashPlayer) {
    try {
      dashPlayer.destroy();
      dashPlayer = null;
      console.log('Reproductor DASH limpiado correctamente');
    } catch (error) {
      console.error('Error al limpiar el reproductor DASH:', error);
    }
  }
}

// Función para configurar el reproductor DASH
function setupDashPlayer(url) {
  try {
    const video = document.getElementById('player');
    
    // Verificar si la biblioteca DASH.js está cargada
    if (typeof dashjs === 'undefined') {
      console.error('Error: DASH.js no está cargado. No se puede reproducir este contenido.');
      showStatus('❌ Error: No se puede reproducir este contenido DASH. Biblioteca DASH.js no está cargada.');
      return;
    }
    
    // Limpiamos cualquier instancia previa de Dash.js
    cleanupDashPlayer();
    
    // Inicializamos el reproductor DASH
    dashPlayer = dashjs.MediaPlayer().create();
    dashPlayer.initialize(video, url, true);
    dashPlayer.updateSettings({
      'streaming': {
        'lowLatencyEnabled': false,
        'abr': {
          'autoSwitchBitrate': {
            'video': true
          }
        },
        'buffer': {
          'stableBufferTime': 20,
          'bufferTimeAtTopQuality': 10,
          'bufferTimeAtTopQualityLongForm': 10
        }
      }
    });
    
    // Manejadores de eventos
    dashPlayer.on(dashjs.MediaPlayer.events.ERROR, function(e) {
      console.error('Error en DASH player:', e);
      if (e.error === 'download' || e.error === 'manifestError') {
        showStatus(`❌ Error al cargar el stream: ${currentChannel}. El enlace podría haber expirado o estar protegido.`);
        handleStreamError(true);
      }
    });
    
    dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function(e) {
      const qBadge = document.getElementById('quality-badge');
      if (qBadge && dashPlayer.getBitrateInfoListFor("video") && dashPlayer.getBitrateInfoListFor("video")[e.newQuality]) {
        const height = dashPlayer.getBitrateInfoListFor("video")[e.newQuality].height || '';
        qBadge.textContent = height ? height + 'p' : '';
      }
    });
    
    showStatus(`Reproduciendo ${currentChannel}`);
    
    // Intentamos reproducir con manejo de errores para la política de autoplay
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Autoplay prevented:', error);
        showStatus('Haz clic en PLAY ▶️ para comenzar a ver el canal');
        addPlayButton();
      });
    }
    
  } catch (error) {
    console.error('Error al configurar el reproductor DASH:', error);
    showStatus('❌ Error al configurar el reproductor DASH. Intenta con otro canal.');
  }
}

// Función para inicializar el reproductor DASH
function initDashPlayer(url) {
  // Verificar si la biblioteca DASH.js está disponible
  if (typeof dashjs === 'undefined') {
    console.log('La biblioteca DASH.js no está cargada. Cargando desde CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.dashjs.org/latest/dash.all.min.js';
    script.onload = () => {
      console.log('Biblioteca DASH.js cargada correctamente');
      setupDashPlayer(url);
    };
    script.onerror = () => {
      console.error('Error al cargar DASH.js');
      showStatus('❌ No se pudo cargar la biblioteca DASH.js para reproducir este canal.');
    };
    document.head.appendChild(script);
  } else {
    setupDashPlayer(url);
  }
}

// Funciones auxiliares para reproducción
function extractStreamToken(url) {
  if (!url) return null;
  
  // Extraer token en varios formatos
  if (url.includes('token=')) {
    const tokenMatch = url.match(/token=([^&]+)/);
    return tokenMatch ? tokenMatch[1] : null;
  } else if (url.includes('hdnts=')) {
    const tokenMatch = url.match(/hdnts=([^&]+)/);
    return tokenMatch ? tokenMatch[1] : null;
  }
  
  return null;
}

function isTokenProbablyExpired(token) {
  // Tokens de 32 caracteres o más suelen incluir timestamps
  if (!token || token.length < 32) return false;
  
  // Tokens con fechas unix (10 dígitos) suelen expirar
  const hasUnixTimestamp = /\d{10}/.test(token);
  
  // Si es un token largo (más de 40 caracteres) y contiene números, es probable que esté basado en tiempo
  return (token.length > 40 && /\d+/.test(token)) || hasUnixTimestamp;
}

function tryCorsBypassProxy(url) {
  // Intentar con diversos servicios de proxy CORS
  if (!url) return url;
  
  // Solo aplicar a URLs específicas que sabemos que pueden tener problemas
  if (url.includes('akamaized.net') || url.includes('mux.dev')) {
    return `https://cors.consumet.stream/${url}`;
  }
  return url;
}

function needsProxyAccess(url) {
  // Dominios conocidos que suelen requerir proxy por bloqueos CORS o restricciones
  const restrictedDomains = [
    'akamaized.net', 
    'fubo', 
    'espn',
    'mux.dev',
    'directv',
    'dsports'
  ];
  
  return restrictedDomains.some(domain => url.toLowerCase().includes(domain));
}

function checkHlsSupport() {
  const result = {
    hlsJs: typeof Hls !== 'undefined' && Hls.isSupported(),
    native: false
  };
  
  const videoTest = document.createElement('video');
  if (videoTest.canPlayType('application/vnd.apple.mpegurl') || 
      videoTest.canPlayType('application/x-mpegURL')) {
    result.native = true;
  }
  
  return result;
}

// Función para adjuntar y reproducir el stream
function attachStream(url) {
  // Limpiar reproductor HLS si existe
  if (hls) {
    hls.destroy();
    hls = null;
  }
  
  // Limpiar reproductor DASH si existe
  cleanupDashPlayer();
  
  showStatus(`Intentando conectar a ${currentChannel}...`);
  console.log(`Intentando conectar a stream: ${url}`);
  
  // Verificar si es un stream HTTPS cuando estamos en un sitio HTTPS
  if (window.location.protocol === 'https:' && url.startsWith('http:')) {
    console.warn('Intentando cargar un stream HTTP desde una página HTTPS, esto puede ser bloqueado por el navegador');
    showStatus('⚠️ Este stream usa HTTP inseguro y puede ser bloqueado. Intentando cargar...');
  }
  
  // Verificar si la URL contiene un token y si podría haber expirado
  const token = extractStreamToken(url);
  if (token) {
    console.log('URL con token detectada:', token.substring(0, 10) + '...');
    
    // Guardar el token en la caché
    if (currentChannel) {
      const ttl = estimateTokenExpiration(token);
      cacheToken(currentChannel, token, ttl);
      console.log(`Token guardado en caché para ${currentChannel} (TTL: ${ttl} minutos)`);
    }
    
    if (isTokenProbablyExpired(token)) {
      console.warn('El token del stream podría haber expirado, intentando obtener uno nuevo...');
      showStatus('⚠️ El enlace podría haber expirado. Intentando obtener uno nuevo...');
    }
  }
  
  // Revisa si el stream es de los proveedores conocidos que podrían tener restricciones CORS
  const knownRestrictedDomains = ['akamaized.net', 'mux.com', 'cdn.com', 'fubohd.com', 'dsports', 'espn'];
  const hasCorsRestrictions = knownRestrictedDomains.some(domain => url.includes(domain));
  
  if (hasCorsRestrictions) {
    console.warn('Este stream puede tener restricciones CORS que impidan su reproducción directa');
  }
  
  // Verificar si necesitamos usar proxy para este dominio
  const requiresProxy = needsProxyAccess(url);
  if (requiresProxy) {
    console.log(`Este stream de ${currentChannel} puede requerir proxy. Se intentará cargar a través del servidor.`);
    
    // Si es un canal deportivo, es mejor advertir al usuario
    if (currentChannel.includes('DIRECTV') || 
        currentChannel.includes('ESPN') || 
        currentChannel.includes('Movistar') || 
        currentChannel.includes('Gol') ||
        currentChannel.includes('Liga 1')) {
      showStatus(`⚠️ Los canales deportivos pueden requerir permisos especiales. Intentando reproducir ${currentChannel}...`);
    }
  }
  
  // Verificar la compatibilidad del navegador con HLS
  const hlsSupport = checkHlsSupport();
  
  if (!hlsSupport.hlsJs && !hlsSupport.native) {
    showStatus('⚠️ Tu navegador no soporta la reproducción de HLS. Prueba con Chrome, Safari o Firefox actualizado.');
    console.error('Este navegador no es compatible con HLS');
    
    // Mostrar un mensaje más claro al usuario
    let hlsErrorMsg = document.getElementById('hls-error-msg');
    if (!hlsErrorMsg) {
      hlsErrorMsg = document.createElement('div');
      hlsErrorMsg.id = 'hls-error-msg';
      hlsErrorMsg.className = 'error-message';
      hlsErrorMsg.innerHTML = `
        <h3>Tu navegador no soporta HLS</h3>
        <p>Este reproductor requiere un navegador compatible con el formato HLS (HTTP Live Streaming).</p>
        <p>Te recomendamos usar Chrome, Safari o Firefox actualizado.</p>
        <p>También puedes probar con un canal en formato DASH como DirecTV Sports.</p>
      `;
      
      const playerContainer = document.querySelector('.video-player');
      if (playerContainer) {
        playerContainer.appendChild(hlsErrorMsg);
      }
    }
    hlsErrorMsg.style.display = 'block';
    setTimeout(() => showTryDemoChannelsMessage(), 2000);
    return;
  }
  
  // Verificar si el stream es de formato MPD (DASH)
  if (url.endsWith('.mpd') || url.includes('.mpd?')) {
    console.log('Detectado stream en formato DASH (MPD)');
    showStatus('Iniciando reproductor DASH...');
    
    // Eliminar cualquier mensaje de advertencia DASH
    removeDashWarningMessage();
    
    // Guardar el token si existe para futuras reproducciones
    if (url.includes('hdnts=')) {
      const tokenMatch = url.match(/hdnts=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        console.log('Token encontrado y almacenado para futura referencia');
        sessionStorage.setItem('directv_sports_token', tokenMatch[1]);
      }
    }
    
    // Llamar a la función de configuración DASH directamente
    setupDashPlayer(url);
    return;
  }
  
  if (Hls.isSupported()) {
    // Configuración optimizada para streams de fubohd.com y proveedores deportivos
    const isFubohdStream = url.includes('fubohd.com');
    const isAkamaiStream = url.includes('akamaized.net');
    const isSpecialStream = isFubohdStream || url.includes('dsports') || url.includes('directv') || isAkamaiStream;
    
    // Guardar el token si existe para futuras reproducciones (para cualquier canal)
    if (url.includes('token=')) {
      const tokenMatch = url.match(/token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        console.log('Token encontrado y almacenado para futura referencia: ' + currentChannel);
        // Guardar en sessionStorage para compatibilidad con código existente
        sessionStorage.setItem(`${currentChannel.replace(/\s+/g, '_').toLowerCase()}_token`, tokenMatch[1]);
        
        // También guardar en nuestra caché más inteligente
        const ttl = estimateTokenExpiration(tokenMatch[1]);
        cacheToken(currentChannel, tokenMatch[1], ttl);
      }
    }
    
    // Si es un stream de Liga 1 Max con fuboHD, verificar si tenemos un token almacenado
    if (currentChannel.includes('Liga 1') && isFubohdStream && !url.includes('token=')) {
      // Primero intentar con nuestra caché avanzada
      const cachedToken = getValidCachedToken("Liga 1 Max");
      if (cachedToken) {
        // Extraer la base URL sin token
        const baseUrl = url.split('?')[0];
        url = `${baseUrl}?token=${cachedToken}`;
        console.log('Usando token almacenado en caché para Liga 1 Max');
      } else {
        // Si no hay en caché avanzada, intentar con sessionStorage como fallback
        const storedToken = sessionStorage.getItem('liga1max_token');
        if (storedToken) {
          // Extraer la base URL sin token
          const baseUrl = url.split('?')[0];
          url = `${baseUrl}?token=${storedToken}`;
          console.log('Usando token almacenado para Liga 1 Max');
        }
      }
    }
    
    const hlsConfig = { 
      maxBufferSize: 60 * 1000 * 1000,
      maxMaxBufferLength: 30,     // Aumentar para manejar mejor las interrupciones
      maxBufferHole: 0.5,         // Reducir para mejorar el manejo de huecos
      maxStarvationDelay: 4,      // Aumentar para dar más tiempo antes de abandonar
      maxLoadingDelay: 4,         // Aumentar tiempo de carga
      lowLatencyMode: false,      // Desactivar modo de baja latencia para mejorar estabilidad
      // Configuraciones específicas para streams deportivos
      abrEwmaDefaultEstimate: 500000, // Aumentar el ancho de banda estimado inicial
      abrBandWidthFactor: 0.95,   // Conservador para evitar cambios frecuentes
      abrBandWidthUpFactor: 0.7,  // Más conservador para subidas de calidad
      startLevel: -1,             // Automático, que elija la mejor calidad inicial
      xhrSetup: function(xhr) {
        // Configuramos cabeceras permitidas
        xhr.withCredentials = false; // Desactivar credenciales para reducir problemas CORS
      }
    };
    
    // Si es un stream de fubohd, personalizar aún más la configuración
    if (isFubohdStream) {
      console.log('Configuración optimizada para stream de fubohd.com');
      hlsConfig.fragLoadingTimeOut = 20000;    // Más tiempo para cargar fragmentos
      hlsConfig.manifestLoadingTimeOut = 15000; // Más tiempo para cargar el manifiesto
      hlsConfig.levelLoadingTimeOut = 15000;    // Más tiempo para cargar niveles
    }
    
    hls = new Hls(hlsConfig);
    
    hls.loadSource(url);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Intenta reproducir con manejo de errores para la política de autoplay
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          showStatus(`Reproduciendo ${currentChannel}`);
        }).catch(error => {
          console.log('Autoplay prevented:', error);
          showStatus('Haz clic en PLAY ▶️ para comenzar a ver el canal');
          // Añadir un botón de play visible para ayudar al usuario
          addPlayButton();
        });
      }
    });
    
    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const qBadge = document.getElementById('quality-badge');
      if (qBadge && data && data.details) {
        qBadge.textContent = data.details.height + 'p';
      }
    });
    
    hls.on(Hls.Events.ERROR, (_, data) => {
      // Registramos el error en consola para depuración
      console.error('HLS Error:', data.type, data.details, data);
      
      // Detectar específicamente errores 403
      let is403Error = false;
      if (data.response && data.response.code === 403) {
        is403Error = true;
        console.warn('Error 403 detectado: El token ha expirado o el acceso está bloqueado');
      }
      
      // Si el error es fatal, intentamos otra fuente
      if (data.fatal) {
        console.log('Error fatal detectado, intentando recuperar...');
        handleStreamError(false, is403Error);
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL')) {
    // Fallback para Safari y iOS que soportan HLS nativamente
    console.log('Usando soporte nativo de HLS para este navegador');
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          showStatus(`Reproduciendo ${currentChannel}`);
        }).catch(error => {
          console.log('Autoplay prevented:', error);
          showStatus('Haz clic en PLAY ▶️ para comenzar a ver el canal');
          addPlayButton();
        });
      }
    }, { once: true });
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      if (e.target.error && e.target.error.code === 4) {
        showStatus(`⚠️ Error de formato: Este video no puede reproducirse en tu navegador. Intenta con Chrome.`);
      } else {
        handleStreamError();
      }
    }, { once: true });
  } else {
    // No hay soporte para HLS
    showStatus('⚠️ Tu navegador no soporta la reproducción de videos HLS. Intenta con Chrome o Safari actualizado.');
    console.error('Este navegador no es compatible con la reproducción HLS');
    setTimeout(() => {
      try {
        showTryDemoChannelsMessage();
        // Intentar cargar un canal DASH automáticamente como alternativa
        const dashChannels = document.querySelectorAll('#channel-list li');
        const directvChannel = Array.from(dashChannels).find(li => 
          li.textContent.includes("DIRECTV Sports HD")
        );
        if (directvChannel) {
          directvChannel.click();
        }
      } catch(e) {
        console.error('Error mostrando mensaje de demo:', e);
      }
    }, 3000);
  }
}

//--------------------------------------
// Inicialización de la aplicación
//--------------------------------------

// Función para configurar el filtro de búsqueda
function setupSearchFilter() {
  const searchInput = document.getElementById('search');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('#channel-list li');
    
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  });
}

// Función para cargar la lista de canales en la UI
function setupChannelList() {
  const channelList = document.getElementById('channel-list');
  if (!channelList) return;
  
  // Limpiar lista existente
  channelList.innerHTML = '';
  
  // Primero agregamos los canales de deportes y TV normal
  Object.keys(CHANNELS).forEach(name => {
    const item = document.createElement('li');
    item.textContent = name;
    
    // Agregar clase especial para canales de demostración para destacarlos
    if (name === 'NASA TV Public' || name === 'Red Bull TV') {
      item.classList.add('demo-channel');
    }
    
    // Agregar logo si está disponible
    if (LOGOS[name]) {
      const logo = document.createElement('img');
      logo.src = LOGOS[name];
      logo.alt = name;
      logo.className = 'channel-logo-small';
      item.prepend(logo);
    }
    
    item.addEventListener('click', () => {
      // Marcar como activo
      document.querySelectorAll('#channel-list li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      
      // Cargar canal
      loadChannel(name);
    });
    
    channelList.appendChild(item);
  });
  
  // Luego agregamos los canales de demostración explícitamente como parte de la lista
  Object.keys(DEMO_STREAMS).forEach(name => {
    // Sólo agregar si no existe ya en CHANNELS
    if (!CHANNELS[name]) {
      const item = document.createElement('li');
      item.textContent = name;
      item.classList.add('demo-channel'); // Clase especial para destacarlos
      
      item.addEventListener('click', () => {
        // Marcar como activo
        document.querySelectorAll('#channel-list li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');
        
        // Cargar canal
        loadChannel(name);
      });
      
      channelList.appendChild(item);
    }
  });
  
  console.log(`Configurados ${channelList.children.length} canales en la UI`);
}

// Función para cargar un canal seleccionado
function loadChannel(name, directUrl = null) {
  currentChannel = name;
  sourceIndex = 0;
  
  // Ocultar mensajes anteriores
  const elements = document.querySelectorAll('.status, #welcome-msg, #try-demo-msg, #blocked-stream-msg, #fubo-token-msg');
  elements.forEach(el => {
    if (el) el.style.display = 'none';
  });
  
  // Mostrar logo y título
  const logo = document.getElementById('channel-logo');
  if (logo) {
    logo.src = LOGOS[name] || '';
    logo.style.display = LOGOS[name] ? 'block' : 'none';
  }
  
  const title = document.getElementById('channel-title');
  if (title) {
    title.textContent = name;
  }
  
  showStatus(`Cargando ${name}...`);
  
  // Si es un canal de demostración, usar la URL directamente
  if (DEMO_STREAMS[name]) {
    console.log(`Usando URL de demostración para ${name}`);
    attachStream(DEMO_STREAMS[name]);
    return;
  }
  
  // Para todos los canales, intentar usar las URLs conocidas o buscar una nueva
  if (CHANNELS[name] && CHANNELS[name].length > 0) {
    sourceIndex = 0;
    attachStream(CHANNELS[name][sourceIndex]);
  } else {
    console.log(`No hay URL conocida para ${name}, buscando una...`);
    
    // Verificar primero si tenemos un token en caché
    const cachedToken = getValidCachedToken(name);
    if (cachedToken && CHANNEL_BASE_URLS[name]) {
      console.log(`Usando token en caché para ${name}: ${cachedToken.substring(0, 10)}...`);
      const url = `${CHANNEL_BASE_URLS[name]}?token=${cachedToken}`;
      
      if (!CHANNELS[name]) CHANNELS[name] = [];
      CHANNELS[name].push(url);
      sourceIndex = CHANNELS[name].length - 1;
      attachStream(url);
      return;
    }
    
    // Si no hay token en caché, intentar obtener uno nuevo
    fetchNewLink(name).then(url => {
      if (url) {
        console.log(`URL encontrada para ${name}: ${url.substring(0, 50)}...`);
        if (!CHANNELS[name]) CHANNELS[name] = [];
        CHANNELS[name].push(url);
        sourceIndex = CHANNELS[name].length - 1;
        attachStream(url);
      } else {
        showStatus(`No se encontró ningún enlace para ${name}`);
        
        // Para canales deportivos, mostrar mensaje específico
        if (name.includes('DIRECTV') || 
            name.includes('ESPN') || 
            name.includes('Movistar') || 
            name.includes('Gol') ||
            name.includes('Liga 1')) {
          
          showBlockedStreamMessage(name);
        } else {
          // Para otros canales, mostrar mensaje genérico
          showTryDemoChannelsMessage();
        }
      }
    }).catch(err => {
      console.error(`Error buscando enlace para ${name}:`, err);
      showStatus(`Error buscando enlace: ${err.message}`);
      showTryDemoChannelsMessage();
    });
  }
}

// Función para manejar errores de reproducción
function handleStreamError(isAccessError = false, is403Error = false, isFubohdError = false) {
  // Limpiar reproductor DASH si existe
  cleanupDashPlayer();

  const list = CHANNELS[currentChannel] || [];
  
  // Detectar si es un error 403 basado en la respuesta
  if (is403Error || (currentChannel.toLowerCase().includes('liga 1') && 
                     hls && hls.url && hls.url.includes('fubohd.com'))) {
    console.log(`Error 403 detectado para ${currentChannel}. El proveedor bloquea la reproducción.`);
    showStatus(`⛔ El proveedor de ${currentChannel} requiere un token actualizado.`);
    showBlockedStreamMessage(currentChannel);
    
    // Añadir botón de búsqueda en RojaDirecta
    addRojaDirectaSearchButton(currentChannel);
    
    return; // No intentamos más con este canal si hay un bloqueo activo
  }
  
  // Si es un error de acceso específico para canales deportivos, intentamos usar el proxy directamente
  if (isAccessError && (
      currentChannel.includes('DIRECTV') || 
      currentChannel.includes('ESPN') || 
      currentChannel.includes('Movistar') || 
      currentChannel.includes('Gol') ||
      currentChannel.includes('Liga 1'))) {
    
    showStatus(`Intentando obtener ${currentChannel} a través del servidor...`);
    
    // Buscamos una nueva URL específicamente a través de nuestro proxy
    fetchNewLink(currentChannel).then(url => {
      if (url) {
        console.log(`Nueva URL obtenida a través del proxy para ${currentChannel}`);
        // Agregamos la nueva URL a la lista si no existe
        if (!CHANNELS[currentChannel]) CHANNELS[currentChannel] = [];
        if (!CHANNELS[currentChannel].includes(url)) {
          CHANNELS[currentChannel].push(url);
        }
        sourceIndex = CHANNELS[currentChannel].indexOf(url);
        attachStream(url);
      } else {
        showStatus(`No fue posible obtener una fuente para ${currentChannel}. Los servidores pueden estar bloqueando el acceso o el canal no está disponible.`);
        showBlockedStreamMessage(currentChannel);
        
        // Añadir botón de búsqueda en RojaDirecta como alternativa
        addRojaDirectaSearchButton(currentChannel);
      }
    }).catch(err => {
      console.error('Error al buscar fuente en proxy:', err);
      showStatus(`Error al intentar acceder a ${currentChannel}. Los canales deportivos pueden tener restricciones geográficas o de IP.`);
      showBlockedStreamMessage(currentChannel);
      
      // Añadir botón de búsqueda en RojaDirecta como alternativa
      addRojaDirectaSearchButton(currentChannel);
    });
    
    return;
  }
  
  // Si hay fuentes alternativas disponibles
  if (sourceIndex + 1 < list.length) {
    sourceIndex += 1;
    showStatus(`Probando fuente alternativa ${sourceIndex+1}/${list.length}...`);
    console.log(`Cambiando a fuente alternativa ${sourceIndex+1} para ${currentChannel}`);
    attachStream(list[sourceIndex]);
  } else {
    // Si no hay más fuentes en la lista, buscamos nuevas
    showStatus('Buscando nueva fuente...');
    
    // Para los canales de demostración, intentamos un proxy CORS como último recurso
    if (DEMO_STREAMS[currentChannel]) {
      const originalUrl = DEMO_STREAMS[currentChannel];
      const proxiedUrl = tryCorsBypassProxy(originalUrl);
      
      if (proxiedUrl !== originalUrl) {
        console.log('Intentando reproducir el canal de demostración a través de proxy CORS');
        showStatus('Intentando reproducir a través de un proxy alternativo...');
        
        // Agregar la URL con proxy a la lista
        if (!CHANNELS[currentChannel]) CHANNELS[currentChannel] = [];
        CHANNELS[currentChannel].push(proxiedUrl);
        sourceIndex = CHANNELS[currentChannel].length - 1;
        attachStream(proxiedUrl);
        return;
      } else {
        showStatus('Error al reproducir el stream de demostración. Puede haber restricciones por región o el proveedor ha bloqueado el acceso.');
        showTryAnotherButton();
        return;
      }
    }
    
    // Intentar primero con RojaDirecta para canales deportivos
    if (currentChannel.includes('DIRECTV') || 
        currentChannel.includes('ESPN') || 
        currentChannel.includes('Movistar') || 
        currentChannel.includes('Gol') ||
        currentChannel.includes('Liga 1')) {
      
      showStatus(`Intentando buscar ${currentChannel} en RojaDirecta...`);
      
      getFromRojaDirecta(currentChannel).then(url => {
        if (url) {
          console.log(`Stream encontrado en RojaDirecta para ${currentChannel}`);
          if (!CHANNELS[currentChannel]) CHANNELS[currentChannel] = [];
          CHANNELS[currentChannel].push(url);
          sourceIndex = CHANNELS[currentChannel].length - 1;
          attachStream(url);
          return;
        }
        
        // Si RojaDirecta falla, intentamos con el método tradicional
        continueWithTraditionalSearch();
      }).catch(err => {
        console.error('Error al buscar en RojaDirecta:', err);
        continueWithTraditionalSearch();
      });
    } else {
      continueWithTraditionalSearch();
    }
    
    function continueWithTraditionalSearch() {
      fetchNewLink(currentChannel).then(url => {
        if (url) {
          console.log(`Nueva URL encontrada para ${currentChannel}: ${url.substring(0, 50)}...`);
          if (!CHANNELS[currentChannel]) CHANNELS[currentChannel] = [];
          CHANNELS[currentChannel].push(url);
          sourceIndex = CHANNELS[currentChannel].length - 1;
          attachStream(url);
        } else {
          showStatus('No se encontró ninguna fuente disponible. Intenta con otro canal.');
          console.error(`No se pudo encontrar enlace para ${currentChannel}`);
          
          // Mostrar mensaje y botón para RojaDirecta
          showBlockedStreamMessage(currentChannel);
        }
      }).catch(err => {
        console.error('Error al buscar fuente:', err);
        showStatus(`Error al buscar fuente: ${err.message || 'Error desconocido'}. Intenta con otro canal.`);
        
        // Mostrar mensaje y botón para RojaDirecta
        showBlockedStreamMessage(currentChannel);
      });
    }
  }
}

// Función para obtener streams de RojaDirecta para un canal específico
async function getFromRojaDirecta(channelName) {
  try {
    console.log(`Buscando ${channelName} en RojaDirecta...`);
    
    // Realiza una solicitud al endpoint de backend que acabamos de crear
    const res = await fetch(`${API_BASE_URL}/api/rojadirecta/${encodeURIComponent(channelName)}`);
    
    if (!res.ok) {
      console.warn(`RojaDirecta búsqueda para ${channelName} falló con estado ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    
    if (data.success && data.results && data.results.length > 0) {
      console.log(`Encontrados ${data.results.length} streams en RojaDirecta`);
      
      // Obtener la primera URL válida
      const stream = data.results[0];
      
      // Si hay un token en el resultado, guardarlo para futuras referencias
      if (stream.token && stream.url.includes('token=')) {
        console.log(`Token extraído de RojaDirecta para ${channelName}: ${stream.token.substring(0, 15)}...`);
        
        // Opcional: actualizar los tokens conocidos
        // Esta parte es delicada y depende de si quieres mantener los tokens actualizados automáticamente
        /*
        if (channelName in KNOWN_TOKENS) {
          console.log(`Actualizando token para ${channelName} desde RojaDirecta`);
          KNOWN_TOKENS[channelName] = stream.token;
        }
        */
      }
      
      return stream.url;
    }
    
    console.log(`No se encontraron streams en RojaDirecta para ${channelName}`);
    return null;
  } catch (error) {
    console.error(`Error buscando en RojaDirecta: ${error.message}`);
    return null;
  }
}

// Función para añadir botón de búsqueda en RojaDirecta
function addRojaDirectaSearchButton(channelName) {
  const playerContainer = document.querySelector('.video-player');
  if (!playerContainer) return;
  
  // Eliminar botones existentes
  const existingBtn = document.getElementById('rojadirecta-search-btn');
  if (existingBtn) existingBtn.remove();
  
  const searchBtn = document.createElement('button');
  searchBtn.id = 'rojadirecta-search-btn';
  searchBtn.className = 'action-button rojadirecta-button';
  searchBtn.innerHTML = '🔎 Buscar en RojaDirecta';
  searchBtn.addEventListener('click', async () => {
    // Mostrar indicador de carga
    showStatus(`Buscando ${channelName} en RojaDirecta...`);
    searchBtn.disabled = true;
    searchBtn.textContent = 'Buscando...';
    
    try {
      // Intentar obtener stream de RojaDirecta
      const url = await getFromRojaDirecta(channelName);
      
      if (url) {
        console.log(`Stream encontrado en RojaDirecta: ${url.substring(0, 50)}...`);
        showStatus(`Stream encontrado en RojaDirecta. Reproduciendo...`);
        
        // Agregar la URL a la lista de fuentes del canal
        if (!CHANNELS[channelName]) CHANNELS[channelName] = [];
        CHANNELS[channelName].push(url);
        sourceIndex = CHANNELS[channelName].length - 1;
        
        // Reproducir el stream
        attachStream(url);
      } else {
        console.log(`No se encontró stream en RojaDirecta para ${channelName}`);
        showStatus(`No se encontró stream en RojaDirecta para ${channelName}`);
      }
    } catch (error) {
      console.error(`Error buscando en RojaDirecta: ${error.message}`);
      showStatus(`Error buscando en RojaDirecta: ${error.message}`);
    } finally {
      // Restaurar el botón
      searchBtn.disabled = false;
      searchBtn.innerHTML = '🔎 Buscar en RojaDirecta';
    }
  });
  
  playerContainer.appendChild(searchBtn);
}

// Función para limpiar periódicamente los tokens expirados de la caché
function cleanupExpiredTokens() {
  try {
    console.log('Limpiando tokens expirados del caché...');
    const now = Date.now();
    let removedCount = 0;
    
    // Recorrer todas las claves en localStorage que correspondan a tokens
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('token_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.expiresAt && data.expiresAt < now) {
            localStorage.removeItem(key);
            removedCount++;
            console.log(`Token expirado eliminado: ${data.channel}`);
          }
        } catch (e) {
          // Si hay un error al parsear, eliminar la entrada corrupta
          localStorage.removeItem(key);
          console.warn(`Eliminada entrada corrupta de caché: ${key}`);
        }
      }
    });
    
    console.log(`Limpieza completada: ${removedCount} tokens expirados eliminados`);
  } catch (error) {
    console.error('Error al limpiar tokens expirados:', error);
  }
}

// Programar limpieza periódica (cada 30 minutos)
setInterval(cleanupExpiredTokens, 30 * 60 * 1000);

// También ejecutar al iniciar la aplicación
document.addEventListener('DOMContentLoaded', () => {
  // Ejecutar limpieza al inicio (después de 10 segundos para no interferir con la carga)
  setTimeout(cleanupExpiredTokens, 10000);
  
  console.log('Inicializando aplicación...');
  
  // Verificar si la biblioteca dash.js está disponible
  if (typeof dashjs === 'undefined') {
    console.log('La biblioteca DASH.js no está cargada. Cargando desde CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.dashjs.org/latest/dash.all.min.js';
    script.onload = () => {
      console.log('Biblioteca DASH.js cargada correctamente');
    };
    script.onerror = () => {
      console.error('Error al cargar DASH.js');
      showStatus('❌ No se pudo cargar la biblioteca DASH.js. Los canales que usan DASH podrían no funcionar correctamente.');
    };
    document.head.appendChild(script);
  }
  
  // Configurar la lista de canales
  setupChannelList();
  
  // Configurar el filtro de búsqueda
  setupSearchFilter();
  
  // Mostrar mensaje de bienvenida
  showWelcomeMessage();
  
  // Si hay URLs externas, cargarlas
  if (PLAYLIST_URLS.length > 0) {
    const promises = PLAYLIST_URLS.map(url => fetchTextViaProxy(url).then(parseM3U));
    Promise.allSettled(promises).then(results => {
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          mergeExternalChannels(result.value);
        }
      });
      setupChannelList(); // Actualizar la lista con los nuevos canales
    });
  }
  
  // Pre-cargar el primer canal, empezando por un canal de demostración para confiabilidad
  setTimeout(() => {
    const channelList = document.getElementById('channel-list');
    if (channelList && channelList.children.length > 0) {
      // Intentar encontrar un canal de demostración primero
      const demoChannel = Array.from(channelList.children).find(li => 
        li.textContent.includes("DIRECTV Sports HD")
      );
      
      if (demoChannel) {
        demoChannel.click();
      } else {
        // Si no hay un canal de demostración, simplemente seleccionamos el primero
        channelList.firstElementChild.click();
      }
    }
    
    // Mostrar información sobre cómo proporcionar tokens para canales deportivos
    console.log('%c📌 INFORMACIÓN IMPORTANTE:', 'font-weight: bold; font-size: 14px; color: #e74c3c;');
    console.log('Para que los canales deportivos funcionen correctamente, necesitas proporcionar tokens actualizados.');
    console.log('Ya se ha configurado el token para Liga 1 Max que proporcionaste.');
    console.log('Para otros canales, necesitarás actualizar el archivo server.js con tokens nuevos.');
  }, 500);
});

// Dominios conocidos de agregadores de streams deportivos
const STREAM_PROVIDERS = {
  // Fuentes principales
  fubohd: [
    'fubohd.com',
    'fubo.tv',
    'fubo.me'
  ],
  pelotalibre: [
    'pelotalibrehdtv.com',
    'pelotalibre.me',
    'pelotalibre.live',
    'pelotalibre.net',
    'pelotalibre.one',
    'pelotalibre.xyz',
  ],
  rojadirecta: [
    'rojadirecta.watch',
    'rojadirectaenvivo.com',
    'rojadirectatv.tv',
    'rojadirectaenvivo.net',
    'rojadirecta.unblockit.kim'
  ],
  futbolLibre: [
    'futbollibre.net',
    'futbol-libre.net',
    'futbollibrehd.com'
  ],
  tvLibre: [
    'televisionlibre.net',
    'televisionhd.net',
    'tvlibre.me'
  ],
  // Fuentes secundarias
  otros: [
    'tarjetarojatvenvivo.com',
    'apurogol.net',
    'librefutbol.com',
    'televisiongratis.tv',
    'pirlotvhd.com'
  ]
};