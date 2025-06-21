// Inicialización y disponibilidad global de funciones críticas
// Debemos asegurar que estas funciones estén disponibles para auth.js
(function initializeGlobalFunctions() {
  console.log('Inicializando funciones globales en scripts.js');
  
  // Detectar si es un dispositivo móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  window.isMobileDevice = isMobile;
  console.log(`Tipo de dispositivo detectado: ${isMobile ? 'Móvil' : 'Desktop'}`);
  
  // Verificar si hay un parámetro de forzado de actualización en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const forceRefresh = urlParams.get('force_refresh');
  
  if (forceRefresh === 'true') {
    console.log('Forzando actualización por parámetro URL');
    // Limpiar todo el localStorage para una actualización completa
    localStorage.clear();
    // Recargar sin el parámetro para evitar bucles
    window.location.href = window.location.pathname;
    return;
  }
  
  // Forzar limpieza de todos los tokens en caché
  // Esto asegura que se usen los tokens actualizados en KNOWN_TOKENS
  setTimeout(() => {
    if (typeof clearAllTokenCache === 'function') {
      console.log('Forzando limpieza de todos los tokens en caché debido a actualización masiva');
      clearAllTokenCache();
      localStorage.setItem('tokens_version', TOKENS_VERSION.toString());
      console.log(`Versión de tokens actualizada a: ${TOKENS_VERSION}`);
      
      // Limpieza adicional para dispositivos móviles
      if (isMobile) {
        console.log('Realizando limpieza adicional para dispositivo móvil');
        try {
          // Eliminar todas las claves relacionadas con tokens
          Object.keys(localStorage).forEach(key => {
            if (key.includes('token') || key.includes('Token')) {
              localStorage.removeItem(key);
            }
          });
          
          // Establecer marca de tiempo de última limpieza
          localStorage.setItem('last_mobile_cleanup', Date.now().toString());
          console.log('Limpieza para móvil completada');
        } catch (error) {
          console.error('Error durante limpieza para móvil:', error);
        }
      }
    }
  }, 500);
  
  // Preparar objeto global en caso de que aún no se hayan definido las funciones
  window.tvApp = window.tvApp || {};
  
  
  // Versión simplificada de loadChannel para asegurar que siempre hay algo disponible
  if (typeof window.loadChannel !== 'function') {
    window.loadChannel = function simplifiedLoadChannel(name) {
      console.log('Usando versión simplificada de loadChannel para:', name);
      const player = document.getElementById('player');
      const title = document.getElementById('channel-title');
      
      if (title) title.textContent = name;
      
      // Intentar reproducir canales de demo conocidos
      if (name === 'NASA TV Public') {
        if (player) {
          player.src = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8';
          player.load();
          player.play().catch(e => console.error('Error al reproducir NASA TV:', e));
        }
      } else if (name === 'Red Bull TV') {
        if (player) {
          player.src = 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8';
          player.load();
          player.play().catch(e => console.error('Error al reproducir Red Bull TV:', e));
        }
      } else {
        // Para otros canales, solo actualizar la interfaz
        const playerContainer = document.querySelector('.video-player');
        if (playerContainer) {
          // Mostrar mensaje
          const infoMsg = document.createElement('div');
          infoMsg.className = 'welcome-message';
          infoMsg.innerHTML = `
            <h3>Canal seleccionado: ${name}</h3>
            <p>Este canal requiere la versión completa del reproductor.</p>
          `;
          
          // Limpiar contenedor y añadir mensaje
          const existingMsgs = playerContainer.querySelectorAll('.welcome-message');
          existingMsgs.forEach(el => el.remove());
          playerContainer.appendChild(infoMsg);
        }
      }
      
      return true;
    };
    
    console.log('Versión simplificada de loadChannel instalada como fallback');
  }
})();

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
    
    // Contenido adaptado según si es móvil o desktop
    const mobileClass = window.isMobileDevice ? 'mobile-view' : '';
    welcomeMsg.innerHTML = `
      <h3>¡Bienvenido al Reproductor de Canales!</h3>
      <p>Selecciona un canal desde la lista para comenzar a ver.</p>
      <p class="${mobileClass}">Recomendamos empezar con los canales de <span class="highlight">NASA TV Public</span> o <span class="highlight">Red Bull TV</span> que suelen funcionar mejor.</p>
      <p class="update-note ${mobileClass}">Los tokens se actualizan automáticamente cada 6 horas (última vez: ${new Date().toLocaleString()}).</p>
      <div class="action-buttons">
        <button id="clear-cache-btn" class="action-button refresh-button">🔄 Actualizar Tokens Ahora</button>
        ${window.isMobileDevice ? '<p class="mobile-note">Usa este botón si los canales no funcionan correctamente</p>' : ''}
      </div>
    `;
    
    // Añadir el mensaje al contenedor del reproductor
    const playerContainer = document.querySelector('.video-player');
    if (playerContainer) {
      playerContainer.appendChild(welcomeMsg);
      
      // Agregar funcionalidad al botón de limpieza de caché
    document.getElementById('clear-cache-btn').addEventListener('click', function() {
        this.disabled = true;
        this.textContent = '⏳ Actualizando...';
        
        // Solicitar actualización de tokens al servidor
        requestTokensUpdate()
          .then(success => {
            if (success) {
              showStatus('✅ Tokens actualizados correctamente', 'success');
              this.textContent = '✅ Tokens Actualizados';
              
              // Actualizar la información de tokens si está visible
              if (document.getElementById('tokens-info-container') && 
                  document.getElementById('tokens-info-container').style.display !== 'none') {
                showTokensInfo();
              }
              
              // Re-habilitar el botón después de un tiempo
              setTimeout(() => {
                this.disabled = false;
                this.textContent = '🔄 Actualizar Tokens Ahora';
              }, 3000);
            } else {
              showStatus('⚠️ No se pudieron actualizar todos los tokens', 'warning');
              this.textContent = '⚠️ Error parcial';
              
              // Re-habilitar el botón después de un tiempo
              setTimeout(() => {
                this.disabled = false;
                this.textContent = '🔄 Actualizar Tokens Ahora';
              }, 3000);
            }
          })
          .catch(error => {
            console.error('Error al actualizar tokens:', error);
            
            // Si falla, usar el método antiguo
            clearAllTokenCache();
            StorageSystem.setItem('tokens_version', TOKENS_VERSION.toString());
            StorageSystem.setItem('last_mobile_cleanup', Date.now().toString());
            
            showStatus('Tokens actualizados localmente. Recargando página...', 'warning');
            
            // Retrasar la recarga para que el usuario vea el mensaje
            setTimeout(() => {
              window.location.href = window.location.pathname + '?force_refresh=true';
            }, 1500);
          });
      });
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

// Sistema avanzado de almacenamiento con respaldo
// Implementa múltiples mecanismos de almacenamiento para garantizar compatibilidad entre dispositivos
const StorageSystem = {
  // Verifica si localStorage está disponible y funciona correctamente
  isLocalStorageAvailable: function() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      const result = localStorage.getItem(test) === test;
      localStorage.removeItem(test);
      return result;
    } catch (e) {
      return false;
    }
  },
  
  // Verifica si sessionStorage está disponible
  isSessionStorageAvailable: function() {
    try {
      const test = '__storage_test__';
      sessionStorage.setItem(test, test);
      const result = sessionStorage.getItem(test) === test;
      sessionStorage.removeItem(test);
      return result;
    } catch (e) {
      return false;
    }
  },
  
  // Almacenamiento en memoria como último recurso
  memoryStorage: {},
  
  // Guarda un valor utilizando el mejor método disponible
  setItem: function(key, value) {
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(key, value);
        return true;
      } else if (this.isSessionStorageAvailable()) {
        console.warn('Usando sessionStorage como respaldo (se perderá al cerrar pestaña)');
        sessionStorage.setItem(key, value);
        return true;
      } else {
        console.warn('Usando almacenamiento en memoria (se perderá al recargar)');
        this.memoryStorage[key] = value;
        return true;
      }
    } catch (error) {
      console.error('Error al guardar datos:', error);
      // Último intento: guardar en memoria
      try {
        this.memoryStorage[key] = value;
        return true;
      } catch (e) {
        return false;
      }
    }
  },
  
  // Obtiene un valor utilizando el mejor método disponible
  getItem: function(key) {
    try {
      if (this.isLocalStorageAvailable() && localStorage.getItem(key) !== null) {
        return localStorage.getItem(key);
      } else if (this.isSessionStorageAvailable() && sessionStorage.getItem(key) !== null) {
        return sessionStorage.getItem(key);
      } else if (key in this.memoryStorage) {
        return this.memoryStorage[key];
      }
      return null;
    } catch (error) {
      console.error('Error al recuperar datos:', error);
      // Intento de respaldo en memoria
      if (key in this.memoryStorage) {
        return this.memoryStorage[key];
      }
      return null;
    }
  },
  
  // Elimina un valor de todos los almacenamientos
  removeItem: function(key) {
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.removeItem(key);
      }
      if (this.isSessionStorageAvailable()) {
        sessionStorage.removeItem(key);
      }
      delete this.memoryStorage[key];
      return true;
    } catch (error) {
      console.error('Error al eliminar datos:', error);
      return false;
    }
  },
  
  // Limpia todo el almacenamiento
  clear: function() {
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.clear();
      }
      if (this.isSessionStorageAvailable()) {
        sessionStorage.clear();
      }
      this.memoryStorage = {};
      return true;
    } catch (error) {
      console.error('Error al limpiar almacenamiento:', error);
      return false;
    }
  }
};

// Tokens dinámicos obtenidos del servidor
let DYNAMIC_TOKENS = {};

// Función para cargar los tokens más recientes del servidor
// Función para cargar los tokens más recientes del servidor
async function loadTokensFromServer() {
  try {
    console.log('Cargando tokens más recientes desde el servidor...');
    const response = await fetch(`${API_BASE_URL}/api/tokens/current`);
    
    if (!response.ok) {
      throw new Error(`Error al cargar tokens: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.tokens) {
      console.log(`Se cargaron ${Object.keys(data.tokens).length} tokens desde el servidor`);
      
      // Guardar los tokens anteriores para comparación
      const oldTokens = {...DYNAMIC_TOKENS};
      DYNAMIC_TOKENS = data.tokens;
      
      // Mostrar cambios en consola con formato
      console.group('🔄 Actualización de Tokens:');
      console.log('%c⚡ Tokens cargados del servidor:', 'color: #4CAF50; font-weight: bold');
      
      // Actualizar KNOWN_TOKENS con los tokens recibidos del servidor
      // Esto permite mantener los tokens actualizados incluso si se recarga la página
      for (const [channelName, token] of Object.entries(data.tokens)) {
        // Verificar si el canal ya existe en KNOWN_TOKENS
        if (KNOWN_TOKENS.hasOwnProperty(channelName)) {
          const oldToken = KNOWN_TOKENS[channelName];
          KNOWN_TOKENS[channelName] = token;
          
          // Destacar los cambios visualmente en la consola
          if (oldToken !== token) {
            console.log(`%c${channelName}: %cAnterior: ${oldToken.substring(0, 15)}... → %cNuevo: ${token.substring(0, 15)}...`, 
              'color: #2196F3; font-weight: bold', 'color: #FFA726', 'color: #4CAF50');
          } else {
            console.log(`%c${channelName}: %c${token.substring(0, 15)}... (sin cambios)`, 
              'color: #2196F3; font-weight: bold', 'color: #9E9E9E');
          }
        } else {
          // Si el canal no existe en KNOWN_TOKENS, añadirlo
          KNOWN_TOKENS[channelName] = token;
          console.log(`%c${channelName}: %cNuevo canal añadido: ${token.substring(0, 15)}...`, 
            'color: #2196F3; font-weight: bold', 'color: #4CAF50');
        }
        
        // Intentar actualizar la URL base para este canal
        updateChannelBaseUrl(channelName, token);
        
        // Guardar token en caché
        cacheToken(channelName, token);
      }
      
      // Buscar variantes de nombres para canales importantes
      // Esto asegura que todos los nombres alternativos de canales tengan el mismo token
      const channelAliases = [
        // DSports/DirecTV
        { primary: "DIRECTV Sports HD", aliases: ["DSports", "DSports HD"] },
        { primary: "DIRECTV Sports 2 HD", aliases: ["DSports 2", "DSports 2 HD"] },
        { primary: "DIRECTV Sports Plus HD", aliases: ["DSports Plus", "DSports+ HD"] },
        // ESPN
        { primary: "ESPN Premium", aliases: ["ESPN Premium HD", "Fox Sports Premium"] },
        { primary: "ESPN", aliases: ["ESPN HD", "ESPN Sur"] },
        { primary: "ESPN 2", aliases: ["ESPN2", "ESPN 2 HD", "ESPN2 HD"] },
        { primary: "ESPN 3", aliases: ["ESPN3", "ESPN 3 HD", "ESPN3 HD"] },
        // Fox Sports
        { primary: "FOX Sports", aliases: ["Fox Sports HD", "Fox Sports Sur"] },
        { primary: "FOX Sports 2", aliases: ["Fox Sports 2 HD", "Fox Sports 2"] },
        { primary: "FOX Sports 3", aliases: ["Fox Sports 3 HD", "Fox Sports 3"] },
        // Others
        { primary: "TyC Sports", aliases: ["TyC Sports HD", "TyC"] },
        { primary: "TNT Sports", aliases: ["TNT Sports HD"] }
      ];
      
      // Aplicar los tokens a todos los alias
      channelAliases.forEach(mapping => {
        const primaryToken = DYNAMIC_TOKENS[mapping.primary] || KNOWN_TOKENS[mapping.primary];
        if (primaryToken) {
          mapping.aliases.forEach(alias => {
            DYNAMIC_TOKENS[alias] = primaryToken;
            KNOWN_TOKENS[alias] = primaryToken;
            console.log(`%c${alias}: %cActualizado con token de ${mapping.primary}`, 
              'color: #2196F3; font-weight: bold', 'color: #9C27B0');
          });
        }
      });
      
      console.groupEnd();
      
      // Actualizar la versión de tokens en localStorage
      StorageSystem.setItem('tokens_last_updated', Date.now().toString());
      StorageSystem.setItem('tokens_version', TOKENS_VERSION.toString());
      
      // Mostrar un resumen de los cambios
      const changedCount = Object.entries(data.tokens).filter(([name, token]) => 
        KNOWN_TOKENS[name] && KNOWN_TOKENS[name] !== oldTokens[name]
      ).length;
      
      if (changedCount > 0) {
        console.log(`%c✅ Se actualizaron ${changedCount} tokens con éxito!`, 'color: #4CAF50; font-weight: bold');
        showStatus(`✅ Se actualizaron ${changedCount} tokens con éxito!`, 'success');
      } else {
        console.log(`%c📋 Tokens verificados. No se detectaron cambios.`, 'color: #9E9E9E');
        showStatus(`📋 Tokens verificados. No se detectaron cambios.`, 'info');
      }
      
      return true;
    } else {
      console.warn('No se encontraron tokens en la respuesta del servidor');
      return false;
    }
  } catch (error) {
    console.error('Error al cargar tokens desde el servidor:', error);
    return false;
  }
}

// Cargar tokens al iniciar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== INICIALIZACIÓN SCRIPTS.JS ===');
  console.log('DOM Cargado, inicializando scripts.js...');
  
  // Intentar cargar los tokens desde el servidor
  try {
    const loaded = await loadTokensFromServer();
    if (loaded) {
      console.log('Tokens cargados desde el servidor correctamente');
    } else {
      console.warn('No se pudieron cargar tokens desde el servidor');
    }
  } catch (error) {
    console.error('Error al cargar tokens iniciales:', error);
  }
  
  // Inicializar hls.js si está disponible
  // ...existing code...
});

// Función para obtener el token más reciente para un canal
function getLatestToken(channelName) {
  if (!channelName) {
    console.error('getLatestToken: Se requiere un nombre de canal');
    return null;
  }
  
  // Normalizar el nombre del canal (eliminar "HD", etc.) para mejorar la compatibilidad
  const normalizedName = normalizeChannelName(channelName);
  
  // MEJORA: Verificar si los tokens dinámicos están desactualizados
  // y forzar su actualización si es necesario
  const lastTokenUpdate = StorageSystem.getItem('tokens_last_updated');
  const tokenUpdateThreshold = 5 * 60 * 1000; // 5 minutos en milisegundos
  const tokensDesactualizados = !lastTokenUpdate || (Date.now() - parseInt(lastTokenUpdate)) > tokenUpdateThreshold;
  
  if (tokensDesactualizados) {
    console.log(`Tokens posiblemente desactualizados para ${channelName}, programando actualización...`);
    // Programar actualización de tokens en segundo plano
    setTimeout(() => loadTokensFromServer(), 100);
  }

  // Primero intentar obtener desde DYNAMIC_TOKENS con el nombre exacto
  if (DYNAMIC_TOKENS[channelName]) {
    console.log(`Usando token dinámico del servidor para ${channelName}`);
    return DYNAMIC_TOKENS[channelName];
  }
  
  // Si no se encuentra, intentar con el nombre normalizado
  if (normalizedName !== channelName && DYNAMIC_TOKENS[normalizedName]) {
    console.log(`Usando token dinámico del servidor para ${normalizedName} (normalizado de ${channelName})`);
    return DYNAMIC_TOKENS[normalizedName];
  }
  
  // Si no se encuentra en DYNAMIC_TOKENS, buscar en alias conocidos
  const alias = findChannelAlias(channelName);
  if (alias && DYNAMIC_TOKENS[alias]) {
    console.log(`Usando token dinámico del servidor para ${alias} (alias de ${channelName})`);
    return DYNAMIC_TOKENS[alias];
  }
  
  // Si no se encuentra, intentar obtener desde KNOWN_TOKENS (respaldo)
  if (KNOWN_TOKENS[channelName]) {
    console.log(`Usando token conocido (backup) para ${channelName}`);
    return KNOWN_TOKENS[channelName];
  }
  
  // Intentar con el nombre normalizado en KNOWN_TOKENS
  if (normalizedName !== channelName && KNOWN_TOKENS[normalizedName]) {
    console.log(`Usando token conocido (backup) para ${normalizedName} (normalizado de ${channelName})`);
    return KNOWN_TOKENS[normalizedName];
  }
  
  // Intentar con el alias en KNOWN_TOKENS
  if (alias && KNOWN_TOKENS[alias]) {
    console.log(`Usando token conocido (backup) para ${alias} (alias de ${channelName})`);
    return KNOWN_TOKENS[alias];
  }
  
  console.warn(`No se encontró token para ${channelName} en ninguna fuente`);
  return null;
}

// Función para normalizar el nombre de un canal (eliminar "HD", etc.)
function normalizeChannelName(channelName) {
  if (!channelName) return '';
  
  // Convertir a minúsculas y eliminar espacios adicionales
  let normalized = channelName.toLowerCase().trim();
  
  // Eliminar "HD", "SD", etc.
  normalized = normalized.replace(/\s+(hd|sd|fhd|uhd|4k)(\s+|$)/g, ' ');
  
  // Normalizar variantes comunes
  if (normalized.includes('dsports') || normalized.includes('directv sports')) {
    if (normalized.includes('2')) {
      return 'DIRECTV Sports 2 HD';
    } else if (normalized.includes('plus') || normalized.includes('+')) {
      return 'DIRECTV Sports Plus HD';
    } else {
      return 'DIRECTV Sports HD';
    }
  } else if (normalized.includes('espn')) {
    if (normalized.includes('premium')) {
      return 'ESPN Premium';
    } else if (normalized.includes('2')) {
      return 'ESPN 2';
    } else if (normalized.includes('3')) {
      return 'ESPN 3';
    } else if (normalized.includes('4')) {
      return 'ESPN 4';
    } else {
      return 'ESPN';
    }
  } else if (normalized.includes('fox') && normalized.includes('sports')) {
    if (normalized.includes('2')) {
      return 'FOX Sports 2';
    } else if (normalized.includes('3')) {
      return 'FOX Sports 3';
    } else {
      return 'FOX Sports';
    }
  } else if (normalized.includes('tyc')) {
    return 'TyC Sports';
  } else if (normalized.includes('tnt') && normalized.includes('sports')) {
    return 'TNT Sports';
  } else if (normalized.includes('liga') && normalized.includes('1') && normalized.includes('max')) {
    return 'Liga 1 Max';
  }
  
  // Si no se reconoce un patrón específico, devolver el nombre original
  return channelName;
}

// Función para encontrar un alias conocido para un canal
function findChannelAlias(channelName) {
  const channelAliases = [
    // DSports/DirecTV
    { primary: "DIRECTV Sports HD", aliases: ["DSports", "DSports HD", "DIRECTV Sports"] },
    { primary: "DIRECTV Sports 2 HD", aliases: ["DSports 2", "DSports 2 HD", "DIRECTV Sports 2"] },
    { primary: "DIRECTV Sports Plus HD", aliases: ["DSports Plus", "DSports+ HD", "DIRECTV Sports Plus"] },
    // ESPN
    { primary: "ESPN Premium", aliases: ["ESPN Premium HD", "Fox Sports Premium"] },
    { primary: "ESPN", aliases: ["ESPN HD", "ESPN Sur"] },
    { primary: "ESPN 2", aliases: ["ESPN2", "ESPN 2 HD", "ESPN2 HD"] },
    { primary: "ESPN 3", aliases: ["ESPN3", "ESPN 3 HD", "ESPN3 HD"] },
    // Fox Sports
    { primary: "FOX Sports", aliases: ["Fox Sports HD", "Fox Sports Sur"] },
    { primary: "FOX Sports 2", aliases: ["Fox Sports 2 HD", "Fox Sports 2"] },
    { primary: "FOX Sports 3", aliases: ["Fox Sports 3 HD", "Fox Sports 3"] },
    // Others
    { primary: "TyC Sports", aliases: ["TyC Sports HD", "TyC"] },
    { primary: "TNT Sports", aliases: ["TNT Sports HD"] }
  ];
  
  // Primero verificar si el canal es un nombre primario
  const isPrimary = channelAliases.find(mapping => mapping.primary === channelName);
  if (isPrimary) return channelName; // Es un nombre primario, usar como está
  
  // Buscar si el canal es un alias
  for (const mapping of channelAliases) {
    if (mapping.aliases.includes(channelName)) {
      return mapping.primary;
    }
  }
  
  return null; // No se encontró un alias
}

// Función para obtener un token válido desde la caché
function getValidCachedToken(channelName) {
  try {
    // Verificar versión del token
    const savedTokensVersion = StorageSystem.getItem('tokens_version');
    
    // Si la versión ha cambiado, invalidar todas las cachés de tokens
    if (!savedTokensVersion || parseInt(savedTokensVersion) < TOKENS_VERSION) {
      console.log(`Versión de tokens actualizada: ${savedTokensVersion || 'ninguna'} -> ${TOKENS_VERSION}. Limpiando caché de tokens.`);
      clearAllTokenCache();
      StorageSystem.setItem('tokens_version', TOKENS_VERSION.toString());
      return null;
    }
    
    // Dispositivos móviles: verificar si ha pasado más de 30 minutos desde la última limpieza
    if (window.isMobileDevice) {
      const lastCleanup = StorageSystem.getItem('last_mobile_cleanup');
      if (lastCleanup) {
        const elapsed = Date.now() - parseInt(lastCleanup);
        // 30 minutos = 1800000 ms
        if (elapsed > 1800000) {
          console.log('Han pasado más de 30 minutos desde la última limpieza en móvil. Renovando tokens...');
          clearAllTokenCache();
          StorageSystem.setItem('last_mobile_cleanup', Date.now().toString());
          return null;
        }
      }
    }
    
    // Obtener el token almacenado para el canal
    const cacheKey = `token_${channelName.replace(/\s+/g, '_').toLowerCase()}`;
    const cachedData = StorageSystem.getItem(cacheKey);
    
    if (!cachedData) {
      console.log(`No hay token en caché para ${channelName}`);
      return null;
    }
    
    const tokenData = JSON.parse(cachedData);
    
    // Verificar si el token ha expirado (considerando un margen de seguridad de 5 minutos)
    const now = Date.now();
    const safetyMargin = 5 * 60 * 1000; // 5 minutos en milisegundos
    
    // Para dispositivos móviles, usamos un margen de seguridad mayor (15 minutos)
    const mobileSafetyMargin = 15 * 60 * 1000;
    const actualMargin = window.isMobileDevice ? mobileSafetyMargin : safetyMargin;
    
    if (tokenData.expiresAt && (tokenData.expiresAt - actualMargin) > now) {
      console.log(`Usando token en caché para ${channelName} (válido por ${Math.floor((tokenData.expiresAt - now) / 60000)} minutos más)`);
      return tokenData.token;
    } else {
      console.log(`Token en caché para ${channelName} ha expirado o está por expirar`);
      StorageSystem.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener token en caché para ${channelName}:`, error);
    return null;
  }
}

// Función para limpiar token específico de la caché
function clearTokenCache(channelName) {
  try {
    const cacheKey = `token_${channelName.replace(/\s+/g, '_').toLowerCase()}`;
    StorageSystem.removeItem(cacheKey);
    console.log(`Token en caché para ${channelName} eliminado`);
    return true;
  } catch (error) {
    console.error(`Error al limpiar token en caché para ${channelName}:`, error);
    return false;
  }
}

// Función para limpiar todos los tokens en caché
function clearAllTokenCache() {
  try {
    // Buscar todas las claves que empiezan con token_ en localStorage
    if (StorageSystem.isLocalStorageAvailable()) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('token_')) {
          const channelName = key.replace('token_', '').replace(/_/g, ' ');
          console.log(`Eliminando token en caché para ${channelName}`);
          localStorage.removeItem(key);
        }
      }
    }
    
    // Buscar todas las claves que empiezan con token_ en sessionStorage
    if (StorageSystem.isSessionStorageAvailable()) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('token_')) {
          sessionStorage.removeItem(key);
        }
      }
    }
    
    // Limpiar memoria
    Object.keys(StorageSystem.memoryStorage).forEach(key => {
      if (key.startsWith('token_')) {
        delete StorageSystem.memoryStorage[key];
      }
    });
    
    console.log('Caché de tokens limpiada correctamente');
    return true;
  } catch (error) {
    console.error('Error al limpiar caché de tokens:', error);
    return false;
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
      channel: channelName,
      device: window.isMobileDevice ? 'mobile' : 'desktop'
    };
    
    StorageSystem.setItem(cacheKey, JSON.stringify(tokenData));
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
  "Liga 1 Max": "https://cgxheq.fubohd.com:443/liga1max/mono.m3u8",
  "DIRECTV Sports HD": "https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8",
  "DIRECTV Sports 2 HD": "https://b2ZmaWNpYWw.fubohd.com/dsports2/mono.m3u8",
  "DirecTV Plus": "https://x4bnd7lq.fubohd.com/dsportsplus/mono.m3u8",
  "ESPN": "https://bgvnzw5k.fubohd.com/espn/mono.m3u8",
  "ESPN2": "https://Y2FzdGxl.fubohd.com/espn2/mono.m3u8",
  "ESPN3": "https://c2nvdxq.fubohd.com/espn3/mono.m3u8",
  "ESPN4": "https://dmvudge.fubohd.com/espn4/mono.m3u8",
  "ESPN5": "https://qzv4jmsc.fubohd.com/espn5/mono.m3u8",
  "ESPN6": "https://x4bnd7lq.fubohd.com/espn6/mono.m3u8",
  "ESPN7": "https://cgxheq.fubohd.com/espn7/mono.m3u8",
  "ESPN Premium": "https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8"
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

// Versión de tokens - incrementar cuando se actualicen tokens importantes
const TOKENS_VERSION = 7; // Actualizado el 20 de junio de 2025 con corrección de función saveToken

// Tokens conocidos para canales específicos (se actualizan manualmente)
const KNOWN_TOKENS = {
  "Liga 1 Max": "1bd288c2fb92eae28638bcacea55493c5d5f2bda-a3-1750496787-1750478787",
  "DIRECTV Sports HD": "956e33a590747b8cd1b1325b8d9c07d7b2d8bb00-c7-1750472825-1750454825",
  "DIRECTV Sports 2 HD": "08fe0524dec1f097b74b9531ee00b6ce81a54408-61-1750472828-1750454828",
  "DirecTV Plus": "031f9c309af6ccd639fe06f97a903f58cac11c7c-8d-1750472831-1750454831",
  
  "ESPN": "c5a74b171e49b1022702479bc250dde57771e1eb-42-1750472834-1750454841",
  "ESPN2": "b6b732d221d005ff7a92e799553614008abf776c-cb-1750472837-1750454837",
  "ESPN3": "a744710486ee63a8d6290b265674bb262ad41877-84-1750472841-1750454841",
  "ESPN4": "e9c61bc73e1e3bce1b5902430548767eb83ab681-d3-1750472844-1750454844",
  "ESPN5": "a41ddbe916dcff4af4578aa064fa56d6e97e99ef-2-1750472847-1750454847",
  "ESPN6": "48ffe2fbf34e4bbb88f4ad406cebd3f4ad862b15-42-1750472850-1750454850",
  "ESPN7": "d9f0d7712302c3c0861a1fe869fafbb33696617d-ae-1750472853-1750454853",
  "ESPN Premium": "83a85799163c43376ed43d8d7910fcf3109cac2f-fc-1750472857-1750454857"
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
  
  const lower = channelName.toLowerCase();
  
  // MEJORA: Siempre intentar obtener los tokens más recientes del servidor primero
  // para asegurar que estamos usando la información más actualizada
  let forceTokenUpdate = false;
  
  // Verificar cuándo fue la última actualización de tokens
  const lastTokenUpdate = StorageSystem.getItem('tokens_last_updated');
  const tokenUpdateThreshold = 5 * 60 * 1000; // 5 minutos en milisegundos (reducido de 10)
  
  // Si no hay actualización reciente o nunca se han actualizado los tokens,
  // intentar obtener los tokens más recientes del servidor primero
  const shouldRefreshTokens = !lastTokenUpdate || (Date.now() - parseInt(lastTokenUpdate)) > tokenUpdateThreshold;
    if (shouldRefreshTokens) {
    console.log('Tokens posiblemente desactualizados, intentando cargar desde el servidor antes de continuar...');
    try {
      // Forzar actualización desde el servidor y esperar respuesta
      showStatus('Actualizando tokens desde el servidor...', 'update');
      await loadTokensFromServer();
      // Esperar un momento para que el sistema procese los tokens
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn('Error al actualizar tokens desde el servidor:', error);
    }
  }
  
  // MEJORA: Después de actualizar tokens, verificar DYNAMIC_TOKENS primero
  // que contiene los tokens más recientes del servidor
  const serverToken = DYNAMIC_TOKENS[channelName];
  if (serverToken) {
    console.log(`Usando token actualizado del servidor para ${channelName}: ${serverToken.substring(0, 10)}...`);
    
    // Actualizar también KNOWN_TOKENS para mantener sincronizado
    if (KNOWN_TOKENS[channelName] !== serverToken) {
      console.log(`Actualizando KNOWN_TOKENS[${channelName}] con el token del servidor`);
      KNOWN_TOKENS[channelName] = serverToken;
    }
    
    // Estimar la duración del token y guardarlo en caché
    const ttl = estimateTokenExpiration(serverToken);
    cacheToken(channelName, serverToken, ttl);
    
    // Usar siempre las URLs base actualizadas de CHANNEL_BASE_URLS
    if (CHANNEL_BASE_URLS[channelName]) {
      return `${CHANNEL_BASE_URLS[channelName]}?token=${serverToken}`; // Corregido: usar serverToken en lugar de latestToken
    }
    
    // URLs de respaldo específicas según el canal por si no está en CHANNEL_BASE_URLS
    if (lower.includes('liga 1 max')) {
      return `https://bgvnzw5k.fubohd.com/liga1max/mono.m3u8?token=${serverToken}`;
    } else if (lower.includes('directv sports 2') || lower.includes('dsports2')) {
      return `https://ym9yzq.fubohd.com/dsports2/mono.m3u8?token=${serverToken}`;
    } else if (lower.includes('directv sports') && !lower.includes('2') && !lower.includes('plus')) {
      return `https://a2vlca.fubohd.com/dsports/mono.m3u8?token=${serverToken}`;
    } else if (lower.includes('directv plus') || lower.includes('dsports plus')) {
      return `https://c2f2zq.fubohd.com/dsportsplus/mono.m3u8?token=${serverToken}`;
    } else if (lower.includes('espn premium')) {
      return `https://agvyby.fubohd.com/espnpremium/mono.m3u8?token=${serverToken}`;
    }
    // Más casos específicos para otros canales si fuera necesario
  }
  
  // Verificar si tenemos un token en caché como respaldo
  const cachedToken = getValidCachedToken(channelName);
  if (cachedToken && CHANNEL_BASE_URLS[channelName]) {
    console.log(`Usando token en caché para ${channelName}: ${cachedToken.substring(0, 10)}...`);
    return `${CHANNEL_BASE_URLS[channelName]}?token=${cachedToken}`;
  }
  
  // Intentar obtener el stream directamente desde el backend usando un enfoque generalizado
  // para todos los canales importantes, no solo para algunos específicos
  try {
    // Determinar el endpoint API correcto según el canal
    let endpointKey = '';
    
    // Mapeo generalizado de canales a endpoints
    if (lower.includes('espn premium')) {
      endpointKey = 'espnpremium';
    } else if (lower.includes('directv sports 2') || lower.includes('dsports 2') || lower.includes('dsports2')) {
      endpointKey = 'dsports2';
    } else if ((lower.includes('directv sports') || lower.includes('dsports')) && !lower.includes('2') && !lower.includes('plus')) {
      endpointKey = 'dsports';
    } else if (lower.includes('directv plus') || lower.includes('dsports plus') || lower.includes('dsportsplus')) {
      endpointKey = 'dsportsplus';
    } else if (lower.includes('espn') && lower.includes('2')) {
      endpointKey = 'espn2';
    } else if (lower.includes('espn') && lower.includes('3')) {
      endpointKey = 'espn3';
    } else if (lower.includes('espn') && !lower.includes('premium') && !lower.includes('2') && !lower.includes('3')) {
      endpointKey = 'espn';
    } else if (lower.includes('fox sports') && lower.includes('2')) {
      endpointKey = 'foxsports2';
    } else if (lower.includes('fox sports') && lower.includes('3')) {
      endpointKey = 'foxsports3';
    } else if (lower.includes('fox sports') && !lower.includes('2') && !lower.includes('3')) {
      endpointKey = 'foxsports';
    } else if (lower.includes('tnt sports')) {
      endpointKey = 'tntsports';
    } else if (lower.includes('tyc sports')) {
      endpointKey = 'tycsports';
    } else if (lower.includes('liga 1 max')) {
      endpointKey = 'liga1max';
    }
    
    // Si se identificó un endpoint válido, intentar obtener el stream
    if (endpointKey) {
      console.log(`Intentando obtener stream actualizado de ${endpointKey} desde el backend...`);
      const res = await fetch(`${API_BASE_URL}/api/stream/${endpointKey}`);
      const data = await res.json();
      
      // Extraer y guardar el token si está disponible
      if (data.url) {
        const extractedToken = extractTokenFromUrl(data.url);
        if (extractedToken) {
          console.log(`Token obtenido para ${channelName}:`, extractedToken.substring(0, 15) + '...');
          
          // Actualizar el token en memoria
          DYNAMIC_TOKENS[channelName] = extractedToken;
          KNOWN_TOKENS[channelName] = extractedToken;
          
          // Guardar en caché
          cacheToken(channelName, extractedToken);
        }
        
        // Actualizar la URL base si es necesario
        updateBaseUrlFromFullLink(channelName, data.url);
        
        return data.url;
      }
    }
  } catch (e) {
    console.warn(`Proxy para ${channelName} falló:`, e);
  }
  
  // Si no se pudo obtener del backend, intentar buscar en RojaDirecta
  try {
    const rojaUrl = await getFromRojaDirecta(channelName);
    if (rojaUrl) {
      console.log(`Usando stream de RojaDirecta para ${channelName}`);
      
      // Extraer y guardar el token si está disponible
      const extractedToken = extractTokenFromUrl(rojaUrl);          
      if (extractedToken) {
        // Actualizar también KNOWN_TOKENS para que persista entre sesiones
        console.log(`Actualizando token de ${channelName} en KNOWN_TOKENS`);
        KNOWN_TOKENS[channelName] = extractedToken;
        DYNAMIC_TOKENS[channelName] = extractedToken; // También actualizar DYNAMIC_TOKENS
        
        cacheToken(channelName, extractedToken);
      }
      
      // Actualizar la URL base desde la respuesta
      updateBaseUrlFromFullLink(channelName, rojaUrl);
      
      return rojaUrl;
    }
  } catch (error) {
    console.warn(`Error buscando en RojaDirecta: ${error.message}`);
  }
    // Si todo lo anterior falla, intentar buscar en catálogos públicos
  try {
    const channels = await fetchCatalog('https://iptv-org.github.io/api/channels.json', 'channels');
    const ch = channels.find(c => (c.name || '').toLowerCase().includes(channelName.toLowerCase()));
    if (!ch) return null;
    
    const streams = await fetchCatalog('https://iptv-org.github.io/api/streams.json', 'streams');
    const match = streams.find(s => s.channel === ch.id && s.url && s.url.endsWith('.m3u8'));
    
    // Si encontramos un stream, actualizar la base de datos local
    if (match && match.url) {
      // Intentar extraer token si existe
      const extractedToken = extractTokenFromUrl(match.url);
      if (extractedToken) {
        console.log(`Token extraído de catálogo público para ${channelName}:`, extractedToken.substring(0, 15) + '...');
        
        // Actualizar tokens
        DYNAMIC_TOKENS[channelName] = extractedToken;
        KNOWN_TOKENS[channelName] = extractedToken;
        
        // Guardar en caché
        cacheToken(channelName, extractedToken);
      }
      
      // Actualizar URL base
      updateBaseUrlFromFullLink(channelName, match.url);
    }
    
    return match ? match.url : null;
  } catch (e) {
    console.error('fetchNewLink error', e);
    return null;
  }
}

//--------------------------------------
// UI helpers
//--------------------------------------
function showStatus(msg, type = 'info') {
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
    statusEl.style.transition = 'all 0.3s ease-in-out';
    const playerContainer = document.querySelector('.video-player');
    playerContainer.appendChild(statusEl);
  }
  
  // Limpiar el estilo anterior
  statusEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
  statusEl.style.color = 'white';
  statusEl.style.border = 'none';
  
  // Aplicar estilo según el tipo de mensaje
  switch (type) {
    case 'success':
      statusEl.style.backgroundColor = 'rgba(46, 125, 50, 0.9)';
      statusEl.style.borderLeft = '4px solid #2E7D32';
      break;
    case 'error':
      statusEl.style.backgroundColor = 'rgba(198, 40, 40, 0.9)';
      statusEl.style.borderLeft = '4px solid #C62828';
      break;
    case 'warning':
      statusEl.style.backgroundColor = 'rgba(237, 108, 2, 0.9)';
      statusEl.style.borderLeft = '4px solid #ED6C02';
      break;
    case 'update':
      statusEl.style.backgroundColor = 'rgba(25, 118, 210, 0.9)';
      statusEl.style.borderLeft = '4px solid #1976D2';
      break;
    default: // info
      statusEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      statusEl.style.borderLeft = '4px solid #757575';
  }
  
  console.log(`Status: ${msg}`); // Log en consola para depuración
  statusEl.textContent = msg;
  
  // Mostrar el elemento si tiene contenido, ocultarlo si está vacío
  statusEl.style.display = msg ? 'block' : 'none';
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
  if (!channelList) {
    console.error('No se pudo encontrar el elemento #channel-list');
    return;
  }
  
  console.log('Configurando lista de canales...');
  
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

// Exponer las funciones en el ámbito global para que auth.js pueda acceder a ellas
window.setupChannelList = setupChannelList;
window.showWelcomeMessage = showWelcomeMessage;
window.setupSearchFilter = setupSearchFilter;
window.loadChannel = loadChannel; // También exportamos loadChannel para uso directo

// Exponer el objeto LOGOS y CHANNELS para que auth.js pueda acceder a la lista completa de canales
window.LOGOS = LOGOS;
window.CHANNELS = CHANNELS;

// Notificar que las funciones están disponibles
console.log('Funciones de scripts.js expuestas globalmente');
console.log('- setupChannelList:', typeof window.setupChannelList === 'function');
console.log('- showWelcomeMessage:', typeof window.showWelcomeMessage === 'function');
console.log('- setupSearchFilter:', typeof window.setupSearchFilter === 'function');
console.log('- loadChannel:', typeof window.loadChannel === 'function');


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
    
    // Limpiar el token en caché para este canal
    if (typeof clearTokenCache === 'function') {
      console.log(`Limpiando token en caché para ${currentChannel} debido a error 403`);
      clearTokenCache(currentChannel);
      
      // Mostrar mensaje y botón para reintentar
      const playerContainer = document.querySelector('.video-player');
      if (playerContainer) {
        const tokenErrorMsg = document.createElement('div');
        tokenErrorMsg.id = 'token-error-msg';
        tokenErrorMsg.className = 'token-error-message';
        
        // Personalizar mensaje según el dispositivo
        if (window.isMobileDevice) {
          tokenErrorMsg.innerHTML = `
            <p><strong>Error 403:</strong> El token para ${currentChannel} ha expirado o es inválido.</p>
            <p>Se ha detectado que estás usando un dispositivo móvil. En algunos casos, esto puede causar problemas con los tokens.</p>
            <button id="retry-channel-btn" class="action-button">Reintentar</button>
            <button id="force-refresh-btn" class="action-button refresh-button">🔄 Forzar Actualización Completa</button>
          `;
        } else {
          tokenErrorMsg.innerHTML = `
            <p><strong>Error 403:</strong> El token para ${currentChannel} ha expirado o es inválido.</p>
            <p>Se ha limpiado la caché del token. Intente nuevamente.</p>
            <button id="retry-channel-btn" class="action-button">Reintentar</button>
          `;
        }
        
        // Eliminar mensajes existentes
        const existingMsgs = playerContainer.querySelectorAll('#token-error-msg');
        existingMsgs.forEach(el => el.remove());
        
        playerContainer.appendChild(tokenErrorMsg);
        
        // Agregar función al botón de reintentar
        document.getElementById('retry-channel-btn').addEventListener('click', () => {
          tokenErrorMsg.remove();
          loadChannel(currentChannel);
        });
        
        // Agregar función al botón de actualización completa (solo en móvil)
        if (window.isMobileDevice) {
          document.getElementById('force-refresh-btn').addEventListener('click', () => {
            clearAllTokenCache();
            StorageSystem.clear(); // Limpieza completa
            showStatus('Realizando actualización completa...');
            setTimeout(() => {
              window.location.href = window.location.pathname + '?force_refresh=true';
            }, 1000);
          });
        }
      }
    }
    
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
// Crear botón flotante para limpiar caché (especialmente útil en dispositivos móviles)
function createFloatingCacheButton() {
  // Solo crear para dispositivos móviles
  if (!window.isMobileDevice) return;
  
  const existingButton = document.getElementById('floating-cache-btn');
  if (existingButton) return;
  
  const floatingButton = document.createElement('button');
  floatingButton.id = 'floating-cache-btn';
  floatingButton.className = 'floating-button refresh-button';
  floatingButton.innerHTML = '🔄';
  floatingButton.title = 'Actualizar Tokens';
  
  // Estilo para el botón flotante
  floatingButton.style.position = 'fixed';
  floatingButton.style.bottom = '20px';
  floatingButton.style.right = '20px';
  floatingButton.style.zIndex = '1000';
  floatingButton.style.width = '50px';
  floatingButton.style.height = '50px';
  floatingButton.style.borderRadius = '50%';
  floatingButton.style.fontSize = '24px';
  floatingButton.style.backgroundColor = '#2e7d32';
  floatingButton.style.color = 'white';
  floatingButton.style.border = 'none';
  floatingButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  
  // Agregar funcionalidad al botón
  floatingButton.addEventListener('click', function() {
    this.disabled = true;
    this.textContent = '⏳';
    
    // Limpiar todos los tokens y recargar
    clearAllTokenCache();
    StorageSystem.setItem('tokens_version', TOKENS_VERSION.toString());
    StorageSystem.setItem('last_mobile_cleanup', Date.now().toString());
    
    showStatus('Tokens actualizados. Recargando página...');
    
    // Retrasar la recarga para que el usuario vea el mensaje
    setTimeout(() => {
      window.location.href = window.location.pathname + '?force_refresh=true';
    }, 1000);
  });
  
  document.body.appendChild(floatingButton);
}

document.addEventListener('DOMContentLoaded', () => {
  // Ejecutar limpieza al inicio (después de 10 segundos para no interferir con la carga)
  setTimeout(cleanupExpiredTokens, 10000);
  
  // Crear botón flotante para dispositivos móviles
  setTimeout(createFloatingCacheButton, 2000);
  
  // Agregar botón de información de tokens
  setTimeout(addTokensInfoButton, 2000);
  
  // Forzar carga de tokens desde el servidor al inicio
  setTimeout(async () => {
    try {
      console.log('Cargando tokens actualizados al inicio...');
      await loadTokensFromServer();
    } catch (error) {
      console.error('Error al cargar tokens iniciales:', error);
    }
  }, 1000);
  
  console.log('=== SCRIPTS.JS INICIALIZADO ===');
  console.log('Esperando autorización de acceso...');
  
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
  
  // Verificar que las funciones estén en el ámbito global
  const functionsAvailable = 
    typeof window.setupChannelList === 'function' && 
    typeof window.showWelcomeMessage === 'function' && 
    typeof window.setupSearchFilter === 'function';
  
  console.log('¿Funciones disponibles globalmente?', functionsAvailable ? 'Sí ✅' : 'No ❌');
  
  if (!functionsAvailable) {
    console.log('Re-exponiendo funciones al ámbito global...');
    window.setupChannelList = setupChannelList;
    window.showWelcomeMessage = showWelcomeMessage;
    window.setupSearchFilter = setupSearchFilter;
    window.loadChannel = loadChannel;
  }
  
  // Marcar como listo para que auth.js pueda inicializar
  window.scriptsJsReady = true;
  
  // Disparar un evento que auth.js pueda escuchar
  document.dispatchEvent(new CustomEvent('scripts-js-loaded'));
  
  console.log('Scripts.js marcado como listo para inicialización desde auth.js');
  console.log('=== FIN INICIALIZACIÓN SCRIPTS.JS ===');
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

// Función para solicitar la actualización de todos los tokens
async function requestTokensUpdate() {
  // Muestra un estado visual más prominente
  showStatus('🔄 Solicitando actualización de tokens desde el servidor...', 'update');
  
  try {
    // Primero solicitamos la actualización en el servidor
    const response = await fetch(`${API_BASE_URL}/api/tokens/update-all?key=update`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Limpiar tokens locales
        clearAllTokenCache();
        
        // Esperar un momento para que el servidor tenga tiempo de actualizar los tokens
        showStatus('⏳ Tokens en proceso de actualización. Esperando a que estén disponibles...', 'update');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Cargar los tokens actualizados desde el servidor
        try {
          const loaded = await loadTokensFromServer();
          if (loaded) {
            // Verificar si se actualizaron tokens
            const changedCount = Object.entries(DYNAMIC_TOKENS).filter(([name, token]) => 
              KNOWN_TOKENS[name] && KNOWN_TOKENS[name] !== token
            ).length;
            
            if (changedCount > 0) {
              showStatus(`✅ ${changedCount} tokens actualizados correctamente.`, 'success');
              
              // Mostrar los tokens actualizados en la consola
              console.group('🔄 Tokens actualizados:');
              Object.entries(KNOWN_TOKENS).forEach(([channelName, token]) => {
                console.log(`${channelName}: ${token.substring(0, 25)}...`);
              });
              console.groupEnd();
            } else {
              showStatus('✓ Tokens verificados. Todos están actualizados', 'info');
            }
            
            // No es necesario recargar la página completa, simplemente limpiamos la caché
            // y actualizamos las marcas de tiempo
            StorageSystem.setItem('tokens_version', TOKENS_VERSION.toString());
            StorageSystem.setItem('last_mobile_cleanup', Date.now().toString());
            
            // Ocultar el mensaje después de un tiempo
            setTimeout(() => {
              showStatus('');
            }, 5000);
            
            return true;
          } else {
            showStatus('⚠️ Los tokens fueron actualizados en el servidor pero no se pudieron cargar.', 'warning');
            setTimeout(() => {
              showStatus('');
            }, 5000);
          }
        } catch (loadError) {
          console.error('Error al cargar los tokens actualizados:', loadError);
          showStatus('❌ Error al cargar los tokens actualizados.', 'error');
          setTimeout(() => {
            showStatus('');
          }, 5000);
        }
        
        return true;
      }
    }
    
    showStatus('❌ Error al solicitar actualización de tokens', 'error');
    setTimeout(() => {
      showStatus('');
    }, 5000);
    return false;
  } catch (error) {
    console.error('Error al solicitar actualización de tokens:', error);
    showStatus('❌ Error al conectar con el servidor de actualización', 'error');
    setTimeout(() => {
      showStatus('');
    }, 5000);
    return false;
  }
}

// Función para actualizar las URLs base para un canal específico
function updateChannelBaseUrl(channelName, newToken) {
  // Si no hay un token válido, no hacemos nada
  if (!newToken || newToken.length < 10) return false;
  
  // Determinar el tipo de canal para saber qué formato de URL buscar
  const normalizedName = normalizeChannelName(channelName);
  const isDirectvChannel = normalizedName.includes('DIRECTV') || normalizedName.includes('DSports');
  const isEspnChannel = normalizedName.includes('ESPN');
  const isFoxChannel = normalizedName.includes('FOX Sports');
  const isTycChannel = normalizedName.includes('TyC');
  const isTntChannel = normalizedName.includes('TNT');
  const isLiga1Channel = normalizedName.includes('Liga 1');
  
  // Consultar al servidor para obtener la URL base actualizada
  fetch(`${API_BASE_URL}/api/tokens/get-base-url?channel=${encodeURIComponent(channelName)}`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.baseUrl) {
        // Si la URL base es diferente de la actual, actualizarla
        if (CHANNEL_BASE_URLS[channelName] !== data.baseUrl) {
          console.log(`Actualizando URL base para ${channelName}: ${CHANNEL_BASE_URLS[channelName]} -> ${data.baseUrl}`);
          CHANNEL_BASE_URLS[channelName] = data.baseUrl;
          
          // También actualizar para los alias conocidos
          const alias = findChannelAlias(channelName);
          if (alias && alias !== channelName) {
            CHANNEL_BASE_URLS[alias] = data.baseUrl;
            console.log(`Actualizando URL base para alias ${alias}`);
          }
          
          return true;
        }
      }
    })
    .catch(error => {
      console.warn('Error al obtener URL base desde el servidor:', error);
      // Continuar con el método alternativo de búsqueda
    });
  
  // Asignar URLs predeterminadas según el tipo de canal si no existe
  if (!CHANNEL_BASE_URLS[channelName]) {
    let defaultBaseUrl = null;
    
    if (isDirectvChannel) {
      if (normalizedName.includes('2')) {
        defaultBaseUrl = 'https://ym9yzq.fubohd.com/dsports2/mono.m3u8';
      } else if (normalizedName.includes('Plus')) {
        defaultBaseUrl = 'https://c2f2zq.fubohd.com/dsportsplus/mono.m3u8';
      } else {
        defaultBaseUrl = 'https://a2vlca.fubohd.com/dsports/mono.m3u8';
      }
    } else if (isEspnChannel) {
      if (normalizedName.includes('Premium')) {
        defaultBaseUrl = 'https://agvyby.fubohd.com/espnpremium/mono.m3u8';
      } else if (normalizedName.includes('2')) {
        defaultBaseUrl = 'https://bgdfty.fubohd.com/espn2/mono.m3u8';
      } else if (normalizedName.includes('3')) {
        defaultBaseUrl = 'https://abcdty.fubohd.com/espn3/mono.m3u8';
      } else {
        defaultBaseUrl = 'https://csdfre.fubohd.com/espn/mono.m3u8';
      }
    } else if (isFoxChannel) {
      if (normalizedName.includes('2')) {
        defaultBaseUrl = 'https://drvtyu.fubohd.com/foxsports2/mono.m3u8';
      } else if (normalizedName.includes('3')) {
        defaultBaseUrl = 'https://bvcder.fubohd.com/foxsports3/mono.m3u8';
      } else {
        defaultBaseUrl = 'https://iujklm.fubohd.com/foxsports/mono.m3u8';
      }
    } else if (isTycChannel) {
      defaultBaseUrl = 'https://opqrst.fubohd.com/tycsports/mono.m3u8';
    } else if (isTntChannel) {
      defaultBaseUrl = 'https://mnbvcx.fubohd.com/tntsports/mono.m3u8';
    } else if (isLiga1Channel) {
      defaultBaseUrl = 'https://bgvnzw5k.fubohd.com/liga1max/mono.m3u8';
    }
    
    if (defaultBaseUrl) {
      console.log(`Asignando URL base predeterminada para ${channelName}: ${defaultBaseUrl}`);
      CHANNEL_BASE_URLS[channelName] = defaultBaseUrl;
      return true;
    }
  }
  
  // Buscar en URLs de solicitudes recientes
  try {
    // Verificar si hay entradas en el historial de red para este canal
    const entries = performance.getEntriesByType('resource');
    
    // Patrones para buscar según el tipo de canal
    let urlPatterns = [];
    
    if (isDirectvChannel) {
      if (normalizedName.includes('2')) {
        urlPatterns.push('/dsports2');
      } else if (normalizedName.includes('Plus')) {
        urlPatterns.push('/dsportsplus');
      } else {
        urlPatterns.push('/dsports');
      }
    } else if (isEspnChannel) {
      if (normalizedName.includes('Premium')) {
        urlPatterns.push('/espnpremium');
      } else if (normalizedName.includes('2')) {
        urlPatterns.push('/espn2');
      } else if (normalizedName.includes('3')) {
        urlPatterns.push('/espn3');
      } else {
        urlPatterns.push('/espn');
      }
    } else if (isFoxChannel) {
      if (normalizedName.includes('2')) {
        urlPatterns.push('/foxsports2');
      } else if (normalizedName.includes('3')) {
        urlPatterns.push('/foxsports3');
      } else {
        urlPatterns.push('/foxsports');
      }
    } else if (isTycChannel) {
      urlPatterns.push('/tycsports');
    } else if (isTntChannel) {
      urlPatterns.push('/tntsports');
    } else if (isLiga1Channel) {
      urlPatterns.push('/liga1max');
    } else {
      // Para canales desconocidos, usar un enfoque genérico
      urlPatterns.push('/sports');
      urlPatterns.push('/futbol');
      urlPatterns.push('/football');
      urlPatterns.push('/soccer');
    }
    
    // Buscar cualquiera de los patrones en las entradas de red
    for (const entry of entries) {
      for (const pattern of urlPatterns) {
        if (entry.name && entry.name.includes(pattern) && entry.name.includes('token=')) {
          // Extraer la URL base
          const url = new URL(entry.name);
          const baseUrl = `${url.protocol}//${url.hostname}${url.pathname}`.split('?')[0];
          
          // Si la URL base es diferente de la actual, actualizarla
          if (CHANNEL_BASE_URLS[channelName] !== baseUrl) {
            console.log(`Actualizando URL base para ${channelName} desde recurso de red: ${CHANNEL_BASE_URLS[channelName]} -> ${baseUrl}`);
            CHANNEL_BASE_URLS[channelName] = baseUrl;
            return true;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error al buscar URLs en el historial de red:', error);
  }
  
  return false;
}

// Función para extraer y actualizar la URL base de un enlace completo
function updateBaseUrlFromFullLink(channelName, fullUrl) {
  if (!fullUrl || !channelName) return false;
  
  try {
    // Intentar extraer la parte base de la URL
    const url = new URL(fullUrl);
    // Obtener sólo el dominio y la ruta, sin parámetros
    const baseUrl = `${url.protocol}//${url.hostname}${url.pathname}`.split('?')[0];
    
    // Si la URL base actual es diferente, actualizarla
    if (CHANNEL_BASE_URLS[channelName] !== baseUrl) {
      console.log(`Actualizando URL base para ${channelName}: ${CHANNEL_BASE_URLS[channelName]} -> ${baseUrl}`);
      CHANNEL_BASE_URLS[channelName] = baseUrl;
      
      // También actualizar para los alias conocidos
      const alias = findChannelAlias(channelName);
      if (alias && alias !== channelName) {
        CHANNEL_BASE_URLS[alias] = baseUrl;
        console.log(`Actualizando URL base para alias ${alias}`);
      }
      
      // Normalizar nombre y actualizar esa variante también
      const normalizedName = normalizeChannelName(channelName);
      if (normalizedName !== channelName) {
        CHANNEL_BASE_URLS[normalizedName] = baseUrl;
        console.log(`Actualizando URL base para nombre normalizado ${normalizedName}`);
      }
      
      return true;
    }
  } catch (error) {
    console.error(`Error al actualizar URL base para ${channelName}:`, error);
  }
  
  return false;
}

// Función para mostrar información de tokens en la UI
function showTokensInfo() {
  console.log('Mostrando información de tokens en la UI...');
  
  // Crear o actualizar el contenedor de información
  let infoContainer = document.getElementById('tokens-info-container');
  if (!infoContainer) {
    infoContainer = document.createElement('div');
    infoContainer.id = 'tokens-info-container';
    infoContainer.style.position = 'fixed';
    infoContainer.style.top = '10px';
    infoContainer.style.right = '10px';
    infoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    infoContainer.style.color = 'white';
    infoContainer.style.padding = '10px';
    infoContainer.style.borderRadius = '5px';
    infoContainer.style.maxWidth = '350px';
    infoContainer.style.maxHeight = '80vh';
    infoContainer.style.overflowY = 'auto';
    infoContainer.style.zIndex = '9999';
    infoContainer.style.fontSize = '12px';
    infoContainer.style.fontFamily = 'monospace';
    document.body.appendChild(infoContainer);
    
    // Agregar botón para cerrar
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '5px';
    closeBtn.style.right = '5px';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
      infoContainer.style.display = 'none';
    };
    infoContainer.appendChild(closeBtn);
  }
  
  infoContainer.style.display = 'block';
  
  // Limpiar el contenido actual
  while (infoContainer.firstChild) {
    infoContainer.removeChild(infoContainer.firstChild);
  }
  
  // Crear título
  const title = document.createElement('h3');
  title.textContent = 'Estado de Tokens';
  title.style.margin = '0 0 10px 0';
  title.style.borderBottom = '1px solid #666';
  title.style.paddingBottom = '5px';
  infoContainer.appendChild(title);
  
  // Botón para cerrar
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '5px';
  closeBtn.style.right = '5px';
  closeBtn.style.backgroundColor = 'transparent';
  closeBtn.style.color = 'white';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => {
    infoContainer.style.display = 'none';
  };
  infoContainer.appendChild(closeBtn);
  
  // Mostrar hora de última actualización
  const lastUpdate = StorageSystem.getItem('tokens_last_updated');
  const lastUpdateTime = lastUpdate ? new Date(parseInt(lastUpdate)).toLocaleString() : 'Nunca';
  
  const updateInfo = document.createElement('p');
  updateInfo.innerHTML = `<strong>Última actualización:</strong> ${lastUpdateTime}`;
  updateInfo.style.margin = '5px 0';
  infoContainer.appendChild(updateInfo);
  
  // Botón para forzar actualización
  const updateBtn = document.createElement('button');
  updateBtn.textContent = 'Actualizar Tokens Ahora';
  updateBtn.style.backgroundColor = '#4CAF50';
  updateBtn.style.color = 'white';
  updateBtn.style.border = 'none';
  updateBtn.style.padding = '5px 10px';
  updateBtn.style.borderRadius = '3px';
  updateBtn.style.cursor = 'pointer';
  updateBtn.style.marginBottom = '10px';
  updateBtn.style.width = '100%';
  updateBtn.onclick = async () => {
    updateBtn.disabled = true;
    updateBtn.textContent = 'Actualizando...';
    
    try {
      await requestTokensUpdate();
      updateBtn.textContent = 'Tokens Actualizados';
      setTimeout(() => {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Actualizar Tokens Ahora';
        showTokensInfo(); // Actualizar la información mostrada
      }, 2000);
    } catch (error) {
      updateBtn.textContent = 'Error al Actualizar';
      setTimeout(() => {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Intentar Nuevamente';
      }, 2000);
    }
  };
  infoContainer.appendChild(updateBtn);
  
  // Crear tabla de tokens
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '10px';
  
  // Crear encabezado
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Canal', 'Origen', 'Token (primeros 10 chars)'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.textAlign = 'left';
    th.style.borderBottom = '1px solid #666';
    th.style.padding = '5px';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Crear cuerpo de la tabla
  const tbody = document.createElement('tbody');
  
  // Combinar todos los canales de DYNAMIC_TOKENS y KNOWN_TOKENS
  const allChannels = new Set([
    ...Object.keys(DYNAMIC_TOKENS),
    ...Object.keys(KNOWN_TOKENS)
  ]);
  
  // Ordenar canales alfabéticamente
  const sortedChannels = Array.from(allChannels).sort();
  
  sortedChannels.forEach(channel => {
    const row = document.createElement('tr');
    
    // Celda del nombre del canal
    const nameCell = document.createElement('td');
    nameCell.textContent = channel;
    nameCell.style.padding = '5px';
    nameCell.style.borderBottom = '1px solid #444';
    row.appendChild(nameCell);
    
    // Celda del origen del token
    const sourceCell = document.createElement('td');
    if (DYNAMIC_TOKENS[channel]) {
      sourceCell.textContent = 'Servidor';
      sourceCell.style.color = '#4CAF50';
    } else if (KNOWN_TOKENS[channel]) {
      sourceCell.textContent = 'KNOWN_TOKENS';
      sourceCell.style.color = '#FFC107';
    } else {
      sourceCell.textContent = 'No disponible';
      sourceCell.style.color = '#F44336';
    }
    sourceCell.style.padding = '5px';
    sourceCell.style.borderBottom = '1px solid #444';
    row.appendChild(sourceCell);
    
    // Celda del token
    const tokenCell = document.createElement('td');
    const token = DYNAMIC_TOKENS[channel] || KNOWN_TOKENS[channel] || '';
    tokenCell.textContent = token ? token.substring(0, 10) + '...' : 'No disponible';
    tokenCell.style.padding = '5px';
    tokenCell.style.borderBottom = '1px solid #444';
    tokenCell.style.fontFamily = 'monospace';
    row.appendChild(tokenCell);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  infoContainer.appendChild(table);
  
  // Botón para mostrar URLs base
  const toggleUrlsBtn = document.createElement('button');
  toggleUrlsBtn.textContent = 'Mostrar URLs Base';
  toggleUrlsBtn.style.backgroundColor = '#2196F3';
  toggleUrlsBtn.style.color = 'white';
  toggleUrlsBtn.style.border = 'none';
  toggleUrlsBtn.style.padding = '5px 10px';
  toggleUrlsBtn.style.borderRadius = '3px';
  toggleUrlsBtn.style.cursor = 'pointer';
  toggleUrlsBtn.style.marginTop = '10px';
  toggleUrlsBtn.style.width = '100%';
  
  const urlsContainer = document.createElement('div');
  urlsContainer.style.display = 'none';
  urlsContainer.style.marginTop = '10px';
  
  toggleUrlsBtn.onclick = () => {
    if (urlsContainer.style.display === 'none') {
      urlsContainer.style.display = 'block';
      toggleUrlsBtn.textContent = 'Ocultar URLs Base';
      
      // Limpiar contenedor
      urlsContainer.innerHTML = '';
      
      // Crear tabla de URLs
      const urlTable = document.createElement('table');
      urlTable.style.width = '100%';
      urlTable.style.borderCollapse = 'collapse';
      
      // Crear encabezado
      const urlThead = document.createElement('thead');
      const urlHeaderRow = document.createElement('tr');
      ['Canal', 'URL Base'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.textAlign = 'left';
        th.style.borderBottom = '1px solid #666';
        th.style.padding = '5px';
        urlHeaderRow.appendChild(th);
      });
      urlThead.appendChild(urlHeaderRow);
      urlTable.appendChild(urlThead);
      
      // Crear cuerpo de la tabla
      const urlTbody = document.createElement('tbody');
      
      Object.entries(CHANNEL_BASE_URLS).forEach(([channel, url]) => {
        const row = document.createElement('tr');
        
        // Celda del nombre del canal
        const nameCell = document.createElement('td');
        nameCell.textContent = channel;
        nameCell.style.padding = '5px';
        nameCell.style.borderBottom = '1px solid #444';
        row.appendChild(nameCell);
        
        // Celda de la URL
        const urlCell = document.createElement('td');
        urlCell.textContent = url;
        urlCell.style.padding = '5px';
        urlCell.style.borderBottom = '1px solid #444';
        urlCell.style.fontFamily = 'monospace';
        urlCell.style.fontSize = '10px';
        urlCell.style.wordBreak = 'break-all';
        row.appendChild(urlCell);
        
        urlTbody.appendChild(row);
      });
      
      urlTable.appendChild(urlTbody);
      urlsContainer.appendChild(urlTable);
      
    } else {
      urlsContainer.style.display = 'none';
      toggleUrlsBtn.textContent = 'Mostrar URLs Base';
    }
  };
  
  infoContainer.appendChild(toggleUrlsBtn);
  infoContainer.appendChild(urlsContainer);
}

// Agregar un botón flotante para mostrar información de tokens
function addTokensInfoButton() {
  const existingButton = document.getElementById('tokens-info-btn');
  if (existingButton) return;
  
  const infoButton = document.createElement('button');
  infoButton.id = 'tokens-info-btn';
  infoButton.className = 'floating-button info-button';
  infoButton.innerHTML = 'ℹ️';
  infoButton.title = 'Ver Estado de Tokens';
  
  // Estilo para el botón flotante
  infoButton.style.position = 'fixed';
  infoButton.style.bottom = '80px';
  infoButton.style.right = '20px';
  infoButton.style.zIndex = '1000';
  infoButton.style.width = '50px';
  infoButton.style.height = '50px';
  infoButton.style.borderRadius = '50%';
  infoButton.style.fontSize = '24px';
  infoButton.style.backgroundColor = '#2196F3';
  infoButton.style.color = 'white';
  infoButton.style.border = 'none';
  infoButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  infoButton.style.cursor = 'pointer';
  
  // Agregar funcionalidad al botón
  infoButton.addEventListener('click', function() {
    showTokensInfo();
  });
  
  document.body.appendChild(infoButton);
}