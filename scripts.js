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
  "Ejemplo 2": "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8", // Stream de prueba más estable
  "NASA TV": "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8", // NASA TV pública
  "Red Bull TV": "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8" // Red Bull TV
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
  "DIRECTV Sports HD": [],
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

function attachStream(url) {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  
  showStatus(`Intentando conectar a ${currentChannel}...`);
  console.log(`Intentando conectar a stream: ${url}`);
  
  // Verificar si es un stream HTTPS cuando estamos en un sitio HTTPS
  if (window.location.protocol === 'https:' && url.startsWith('http:')) {
    console.warn('Intentando cargar un stream HTTP desde una página HTTPS, esto puede ser bloqueado por el navegador');
    showStatus('⚠️ Este stream usa HTTP inseguro y puede ser bloqueado. Intentando cargar...');
  }
  
  // Revisa si el stream es de los proveedores conocidos que podrían tener restricciones CORS
  const knownRestrictedDomains = ['akamaized.net', 'mux.com', 'cdn.com'];
  const hasCorsRestrictions = knownRestrictedDomains.some(domain => url.includes(domain));
  
  if (hasCorsRestrictions) {
    console.warn('Este stream puede tener restricciones CORS que impidan su reproducción directa');
  }
  
  if (Hls.isSupported()) {
    hls = new Hls({ 
      maxBufferSize: 60 * 1000 * 1000,
      // Eliminamos la configuración de xhrSetup que causa los errores de cabeceras
      xhrSetup: function(xhr) {
        // No intentamos modificar cabeceras que el navegador bloquea
        // xhr.withCredentials = false;
        // xhr.setRequestHeader('Referer', 'https://pelotalibre.com/');
        // xhr.setRequestHeader('Origin', 'https://pelotalibre.com');
      }
    });
    
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
      } else if (data.details === 'levelLoadError') {
        // Intentamos reconectar con la misma fuente después de un breve retraso
        // Esto puede ayudar con errores temporales de red
        console.log('Error de carga de nivel, reintentando...');
        setTimeout(() => {
          hls.startLoad();
        }, 1000);
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
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
      handleStreamError();
    }, { once: true });
  } else {
    showStatus('Tu navegador no soporta HLS.');
  }
}

// Función para añadir un botón de reproducción visible
function addPlayButton() {
  let playBtn = document.getElementById('manual-play-btn');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.id = 'manual-play-btn';
    playBtn.textContent = '▶️ Reproducir';
    playBtn.style.padding = '10px 20px';
    playBtn.style.fontSize = '16px';
    playBtn.style.margin = '10px auto';
    playBtn.style.display = 'block';
    playBtn.style.backgroundColor = '#3498db';
    playBtn.style.color = 'white';
    playBtn.style.border = 'none';
    playBtn.style.borderRadius = '5px';
    playBtn.style.cursor = 'pointer';
    
    playBtn.addEventListener('click', () => {
      video.play().then(() => {
        showStatus(`Reproduciendo ${currentChannel}`);
        playBtn.style.display = 'none';
      }).catch(err => {
        console.error('Error al intentar reproducir:', err);
        showStatus('No se pudo iniciar la reproducción. Intenta en otra pestaña o navegador.');
      });
    });
    
    const playerContainer = document.querySelector('.video-player');
    playerContainer.insertBefore(playBtn, document.getElementById('status-msg'));
  } else {
    playBtn.style.display = 'block';
  }
}
// esto es para manejar errores de reproducción , si no se puede reproducir la fuente actual , se intenta con la siguiente 
function handleStreamError() {
  const list = CHANNELS[currentChannel];
  
  // Si hay fuentes alternativas disponibles
  if (sourceIndex + 1 < list.length) {
    sourceIndex += 1;
    showStatus(`Probando fuente alternativa ${sourceIndex+1}/${list.length}...`);
    console.log(`Cambiando a fuente alternativa ${sourceIndex+1} para ${currentChannel}`);
    attachStream(list[sourceIndex]);
  } else {
    // Si no hay más fuentes en la lista, buscamos nuevas
    showStatus('Buscando nueva fuente...');
    
    // Para los canales de demostración, mostramos un mensaje más útil
    if (DEMO_STREAMS[currentChannel]) {
      showStatus('Error al reproducir el stream de demostración. Puede haber restricciones por región o el proveedor ha bloqueado el acceso.');
      
      // Mostrar botón para intentar otro canal
      showTryAnotherButton();
      return;
    }
    
    fetchNewLink(currentChannel).then(url => {
      if (url) {
        console.log(`Nueva URL encontrada para ${currentChannel}: ${url.substring(0, 50)}...`);
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

// Función para mostrar un botón que permita al usuario intentar otro canal fácilmente
function showTryAnotherButton() {
  let tryBtn = document.getElementById('try-another-btn');
  if (!tryBtn) {
    tryBtn = document.createElement('button');
    tryBtn.id = 'try-another-btn';
    tryBtn.textContent = '🔄 Probar otro canal';
    tryBtn.style.padding = '10px 20px';
    tryBtn.style.fontSize = '16px';
    tryBtn.style.margin = '10px auto';
    tryBtn.style.display = 'block';
    tryBtn.style.backgroundColor = '#e74c3c';
    tryBtn.style.color = 'white';
    tryBtn.style.border = 'none';
    tryBtn.style.borderRadius = '5px';
    tryBtn.style.cursor = 'pointer';
    
    // Al hacer clic, volvemos a la lista de canales y resaltamos esa opción
    tryBtn.addEventListener('click', () => {
      const channelList = document.getElementById('channel-list');
      const firstDemoChannel = Array.from(channelList.children).find(li => 
        li.textContent === "Ejemplo 1" || li.textContent === "NASA TV" || li.textContent === "Red Bull TV"
      );
      
      if (firstDemoChannel) {
        firstDemoChannel.click();
      } else if (channelList.firstElementChild) {
        // Si no hay un canal de demostración, simplemente seleccionamos el primero
        channelList.firstElementChild.click();
      }
      
      tryBtn.style.display = 'none';
    });
    
    const playerContainer = document.querySelector('.video-player');
    const statusMsg = document.getElementById('status-msg');
    if (playerContainer && statusMsg) {
      playerContainer.insertBefore(tryBtn, statusMsg.nextSibling);
    } else if (playerContainer) {
      playerContainer.appendChild(tryBtn);
    }
  } else {
    tryBtn.style.display = 'block';
  }
}

function loadChannel(name) {
  // UI: actualizar logo, título y reset de badge
  const logoEl = document.getElementById('channel-logo');
  if (logoEl) logoEl.src = LOGOS[name] || 'https://via.placeholder.com/80x45?text=Logo';
  const titleEl = document.getElementById('channel-title');
  if (titleEl) titleEl.textContent = name;
  const qBadge = document.getElementById('quality-badge');
  if (qBadge) qBadge.textContent = '';

  currentChannel = name;
  sourceIndex = 0;
  const list = CHANNELS[name];
  showStatus(`Cargando ${name}...`);
  if (!list || list.length === 0) {
    fetchNewLink(name).then(url => {
      if (url) {
        CHANNELS[name] = [url];
        attachStream(url);
      } else {
        showStatus('No se encontró ninguna fuente disponible.');
      }
    });
  } else {
    attachStream(list[0]);
  }
}

// Función para verificar si la API está accesible y funcionando
async function checkApiStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/status`);
    if (res.ok) {
      const data = await res.json();
      console.log('✅ API funcionando correctamente:', data);
      return true;
    } else {
      console.error('❌ API respondió con error:', res.status);
      return false;
    }
  } catch (e) {
    console.error('❌ No se pudo conectar con la API:', e);
    return false;
  }
}

//--------------------------------------
// Inicializar lista de canales y eventos
//--------------------------------------
(async function init() {
  // Verificar conexión a la API
  const apiStatus = await checkApiStatus();
  if (!apiStatus && !isLocalhost) {
    console.warn('⚠️ API no disponible, se cargarán solo canales de demostración');
  }
  
  // 1) Cargar y fusionar todas las playlists externas antes de construir la UI
  for (const url of PLAYLIST_URLS) {
    try {
      const m3uText = await fetchTextViaProxy(url);
      const list = parseM3U(m3uText);
      mergeExternalChannels(list);
    } catch (e) {
      console.warn('No se pudo cargar la playlist', url, e);
    }
  }

  // Añadir streams de demostración que funcionan en producción
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('Añadiendo canales de demostración para entorno de producción');
    
    // Crear un nuevo objeto CHANNELS con los canales de demo primero
    const demoChannels = {};
    
    // Añadir primero los canales de demostración
    Object.keys(DEMO_STREAMS).forEach(name => {
      demoChannels[name] = [DEMO_STREAMS[name]];
    });
    
    // Luego añadir los canales regulares
    Object.keys(CHANNELS).forEach(name => {
      demoChannels[name] = CHANNELS[name];
    });
    
    // Reemplazar el objeto CHANNELS
    Object.assign(CHANNELS, demoChannels);
  }

  const listContainer = document.getElementById('channel-list');
  Object.keys(CHANNELS).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', () => {
      Array.from(listContainer.children).forEach(elem => elem.classList.remove('active'));
      li.classList.add('active');
      loadChannel(name);
    });
    listContainer.appendChild(li);
  });
  // Auto-seleccionar primer canal
  if (listContainer.firstElementChild) listContainer.firstElementChild.click();

  // Mostrar un mensaje informativo en producción
  if (!isLocalhost) {
    setTimeout(() => {
      const infoMsg = document.createElement('div');
      infoMsg.style.padding = '10px';
      infoMsg.style.margin = '15px 0';
      infoMsg.style.backgroundColor = 'rgba(52, 152, 219, 0.7)';
      infoMsg.style.color = 'white';
      infoMsg.style.borderRadius = '4px';
      infoMsg.style.textAlign = 'center';
      infoMsg.innerHTML = `
        <p><strong>👋 ¡Bienvenido a Depechito TV!</strong></p>
        <p>Prueba los canales "Ejemplo 1", "NASA TV" o "Red Bull TV" que funcionan correctamente en esta versión web.</p>
        <p>Los canales deportivos pueden requerir más intentos para funcionar debido a restricciones de los proveedores.</p>
      `;
      
      const playerContainer = document.querySelector('.video-player');
      if (playerContainer) {
        playerContainer.appendChild(infoMsg);
        
        // Botón para cerrar el mensaje
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.position = 'absolute';
        closeBtn.style.right = '10px';
        closeBtn.style.top = '10px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => infoMsg.style.display = 'none';
        infoMsg.appendChild(closeBtn);
      }
    }, 2000);
  }

  // Buscador
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      Array.from(listContainer.children).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
})();
