// scripts.js mejorado
// -----------------------------
// Configuración de canales: llena manualmente arrays o déjalos vacíos y se intentará
// buscar la primera fuente disponible usando la base pública de iptv-org.
// URL de la lista M3U externa proporcionada por el usuario
// Se eliminan playlists externas; usamos backend para canales específicos
const PLAYLIST_URLS = []; // dejado vacío por si se quiere volver a usar

// API base URL - cambia automáticamente entre desarrollo y producción
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:4000'
  : window.location.origin;

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
    const playerContainer = document.querySelector('.video-player');
    playerContainer.appendChild(statusEl);
  }
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
  if (Hls.isSupported()) {
    hls = new Hls({ maxBufferSize: 60 * 1000 * 1000 });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play();
      showStatus(`Reproduciendo ${currentChannel}`);
    });
    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const qBadge = document.getElementById('quality-badge');
      if (qBadge && data && data.details) {
        qBadge.textContent = data.details.height + 'p';
      }
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) handleStreamError();
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      video.play();
      showStatus(`Reproduciendo ${currentChannel}`);
    }, { once: true });
    video.addEventListener('error', handleStreamError, { once: true });
  } else {
    showStatus('Tu navegador no soporta HLS.');
  }
}

function handleStreamError() {
  const list = CHANNELS[currentChannel];
  if (sourceIndex + 1 < list.length) {
    sourceIndex += 1;
    attachStream(list[sourceIndex]);
  } else {
    showStatus('Buscando nueva fuente...');
    fetchNewLink(currentChannel).then(url => {
      if (url) {
        CHANNELS[currentChannel].push(url);
        sourceIndex = CHANNELS[currentChannel].length - 1;
        attachStream(url);
      } else {
        showStatus('No se encontró ninguna fuente disponible.');
      }
    });
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

//--------------------------------------
// Inicializar lista de canales y eventos
//--------------------------------------
(async function init() {
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
