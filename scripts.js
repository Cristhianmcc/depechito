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

// Mapas de logos (se pueden sustituir por archivos locales en /logos)
const LOGOS = {
  "DIRECTV Sports HD": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/d/DIRECTVSportsHD.png",
  "DIRECTV Sports 2 HD": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/d/DIRECTVSports2HD.png",
  "Movistar Deportes": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/m/MovistarDeportes.png",
  "ESPN Premium": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/e/ESPNPremium.png",
  "ESPN": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/e/ESPN.png",
  "ESPN2": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/e/ESPN2.png",
  "ESPN3": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/e/ESPN3.png",
  "ESPN4": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/e/ESPN4.png",
  "Liga 1 Max": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/l/Liga1Max.png",
  "Gol Perú": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/g/GolPeru.png",
  "DirecTV Plus": "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/d/DIRECTVPlus.png"
};

const CHANNELS = {
  "DIRECTV Sports HD": ["https://dtv-latam-jbc.akamaized.net/dash/live/2028183/dtv-latam-jbc/master.mpd"], // Enlace de DirecTV Sports sin token para que el servidor pueda agregar un token actualizado
  "DIRECTV Sports 2 HD": [],
  "DirecTV Plus": [],
  "Movistar Deportes": [],
  "ESPN Premium": [],
  "ESPN": [],
  "ESPN2": [],
  "ESPN3": [],
  "ESPN4": [],
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
  
  // Caso especial DirecTV Sports via scraper backend
  const lower = channelName.toLowerCase();
  if (lower.includes('directv sports 2') || lower.includes('dsports2')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/dsports2`);
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.warn('Proxy dsports2 failed', e);
    }
  } else if (lower.includes('espn premium')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/espnpremium`);
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.warn('Proxy espnpremium failed', e);
    }
  } else if (lower.includes('espn4') || lower.includes('espn 4')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/espn4`);
      const data = await res.json();
      console.log('Using URL for ESPN4:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy espn4 failed', e);
    }
  } else if (lower.includes('espn3') || lower.includes('espn 3')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/espn3`);
      const data = await res.json();
      console.log('Using URL for ESPN3:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy espn3 failed', e);
    }
  } else if (lower.includes('espn2') || lower.includes('espn 2')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/espn2`);
      const data = await res.json();
      console.log('Using URL for ESPN2:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy espn2 failed', e);
    }
  } else if (lower.includes('espn') && !lower.includes('espn2') && !lower.includes('espn 2') && !lower.includes('espn3') && !lower.includes('espn 3') && !lower.includes('espn4') && !lower.includes('espn 4')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/espn`);
      const data = await res.json();
      console.log('Using URL for ESPN:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy espn failed', e);
    }
  } else if (lower.includes('directv sports') && !lower.includes('plus')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/dsports`);
      const data = await res.json();
      console.log('Using URL for DirecTV Sports:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy dsports failed', e);
    }
  } else if (lower.includes('gol peru') || lower.includes('golperu') || lower.includes('gol perú')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/golperu`);
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.warn('Proxy golperu failed', e);
    }
  } else if (lower.includes('liga 1 max')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/liga1max`);
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.warn('Proxy liga1max failed', e);
    }
  } else if (lower.includes('movistar')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/movistar`);
      const data = await res.json();
      console.log('Using URL for Movistar:', data.url);
      return data.url;
    } catch (e) {
      console.warn('Proxy movistar failed', e);
    }
  } else if (lower.includes('directv plus')) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/dsportsplus`);
      const data = await res.json();
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

// Función para obtener la URL con token actualizado para DIRECTV Sports HD
async function getDirecTVSportsURL() {
  try {
    console.log('Obteniendo URL actualizada para DirecTV Sports...');
    const response = await fetch(`${API_BASE_URL}/api/stream/directv-dash`);
    const data = await response.json();
    
    // Eliminar cualquier mensaje de advertencia DASH
    removeDashWarningMessage();
    
    if (data.url) {
      console.log('URL de DirecTV Sports obtenida correctamente');
      
      // Si la URL no tiene token, pero tenemos uno almacenado de una sesión anterior, usar ese
      const tokenParam = sessionStorage.getItem('directv_sports_token');
      if (tokenParam && !data.url.includes('hdnts=') && data.url.includes('master.mpd')) {
        console.log('Usando token almacenado de sesión anterior');
        return `${data.url}?hdnts=${tokenParam}`;
      }
      
      return data.url;
    } else {
      console.error('No se pudo obtener URL de DirecTV Sports:', data.message || 'Error desconocido');
      
      // Intentar usar la URL base con el token almacenado si tenemos uno
      const baseUrl = "https://dtv-latam-jbc.akamaized.net/dash/live/2028183/dtv-latam-jbc/master.mpd";
      const tokenParam = sessionStorage.getItem('directv_sports_token');
      
      if (tokenParam) {
        console.log('Intentando con token almacenado');
        return `${baseUrl}?hdnts=${tokenParam}`;
      }
      
      return CHANNELS["DIRECTV Sports HD"][0];
    }
  } catch (error) {
    console.error('Error obteniendo URL de DirecTV Sports:', error);
    
    // En caso de error, devolver la URL que tenemos almacenada
    return CHANNELS["DIRECTV Sports HD"][0];
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
        showStatus('Haz clic en PLAY ▶️ para comenzar la reproducción');
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
    return;
  }
  
  // Verificar si el stream es de formato MPD (DASH)
  if (url.endsWith('.mpd') || url.includes('.mpd?')) {
    console.log('Detectado stream en formato DASH (MPD)');
    showStatus('Iniciando reproductor DASH para DirecTV Sports...');
    
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
  
  // Verificar si el stream es de formato MPD (DASH)
  if (url.endsWith('.mpd') || url.includes('.mpd?')) {
    console.log('Detectado stream en formato DASH (MPD)');
    showStatus('Iniciando reproductor DASH para DirecTV Sports...');
    
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
          showStatus('Haz clic en PLAY ▶️ para comenzar la reproducción');
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
      
      // Si el error es fatal, intentamos otra fuente
      if (data.fatal) {
        console.log('Error fatal detectado, intentando recuperar...');
        handleStreamError();
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
          showStatus('Haz clic en PLAY ▶️ para comenzar la reproducción');
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
      showTryDemoChannelsMessage();
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
  
  // Caso especial para DirecTV Sports HD usando DASH
  if (name === "DIRECTV Sports HD") {
    console.log("Obteniendo URL especial para DirecTV Sports HD");
    getDirecTVSportsURL().then(url => {
      if (url) {
        console.log(`URL obtenida para DirecTV Sports HD: ${url.substring(0, 50)}...`);
        attachStream(url);
      } else {
        showStatus("No se pudo obtener la URL para DirecTV Sports HD");
        showBlockedStreamMessage(name);
      }
    }).catch(error => {
      console.error("Error obteniendo URL para DirecTV Sports HD:", error);
      showStatus(`Error: ${error.message}`);
      showBlockedStreamMessage(name);
    });
    return;
  }
  
  // Para otros canales, intentar usar las URLs conocidas o buscar una nueva
  if (CHANNELS[name] && CHANNELS[name].length > 0) {
    sourceIndex = 0;
    attachStream(CHANNELS[name][sourceIndex]);
  } else {
    console.log(`No hay URL conocida para ${name}, buscando una...`);
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
  
  // Si es un error 403 específico, mostramos un mensaje claro y no intentamos más
  if (is403Error) {
    console.log(`Error 403 detectado para ${currentChannel}. El proveedor bloquea la reproducción.`);
    showStatus(`⛔ El proveedor de ${currentChannel} bloquea activamente la reproducción.`);
    showBlockedStreamMessage(currentChannel);
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
        showTryDemoChannelsMessage();
      }
    }).catch(err => {
      console.error('Error al buscar fuente en proxy:', err);
      showStatus(`Error al intentar acceder a ${currentChannel}. Los canales deportivos pueden tener restricciones geográficas o de IP.`);
      showTryDemoChannelsMessage();
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
        
        // Mostrar botón para intentar otro canal
        showTryAnotherButton();
      }
    }).catch(err => {
      console.error('Error al buscar fuente:', err);
      showStatus(`Error al buscar fuente: ${err.message || 'Error desconocido'}. Intenta con otro canal.`);
      
      // Mostrar botón para intentar otro canal
      showTryAnotherButton();
    });
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
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
        li.textContent === "NASA TV" || li.textContent === "Red Bull TV" || li.textContent === "Ejemplo 1"
      );
      
      if (demoChannel) {
        demoChannel.click();
      } else {
        // Si no hay un canal de demostración, simplemente seleccionamos el primero
        channelList.firstElementChild.click();
      }
    }
  }, 500);
});