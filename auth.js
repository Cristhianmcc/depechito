/**
 * Sistema de autenticación para De Pechito TV
 * Permite controlar el acceso mediante códigos generados por el administrador
 * Versión 2.0: Usa API centralizada para la gestión de tokens
 */

// Contraseña maestra del administrador (cámbiala por una segura)
const ADMIN_PASSWORD = "micausagufy1";

// Usamos la misma API_BASE_URL que está definida en scripts.js
// En lugar de redefinirla, verificamos si ya existe, y si no, definimos una constante local
// para compatibilidad con ejecuciones independientes de auth.js
if (typeof window.API_BASE_URL === 'undefined') {
  console.log('API_BASE_URL no encontrada en window, usando valor por defecto en auth.js');
  window.API_BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? `http://${window.location.hostname}:4000` // Desarrollo local
    : ''; // En producción, usamos rutas relativas
}

// Clase para gestionar tokens de acceso
class AccessManager {
  constructor() {
    this.tokens = {}; // Almacenamiento local para caché
    this.isAdmin = false;
    
    // Inicializar estado (para el administrador)
    this.checkAdminStatus();
  }

  // Cargar tokens desde el servidor (solo admin)
  async loadTokensFromServer() {
    if (!this.isAdmin) {
      console.log('Solo el administrador puede cargar todos los tokens');
      return {};
    }
    
    try {
      console.log('Cargando tokens desde el servidor...');
      const response = await fetch(`${API_BASE_URL}/api/tokens?password=${ADMIN_PASSWORD}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const tokens = await response.json();
      console.log(`Tokens cargados desde el servidor: ${Object.keys(tokens).length} tokens`);
      this.tokens = tokens; // Actualizar caché local
      return tokens;
    } catch (error) {
      console.error('Error al cargar tokens desde el servidor:', error);
      return {};
    }
  }
  // Validar un token a través de la API
  async isValidToken(token) {
    console.log(`=== VALIDANDO TOKEN: ${token ? token.substring(0, 10) + '...' : 'Token vacío'} ===`);
    
    if (!token) {
      console.log('Token vacío, no es válido');
      return false;
    }
    
    // Limpiar el token de posibles espacios
    token = token.trim();
    
    try {
      console.log(`Validando token mediante API: ${token}`);
      
      // Asegurarnos de que la URL esté correctamente formada
      const url = `${API_BASE_URL}/api/tokens/validate/${encodeURIComponent(token)}`;
      console.log('URL de validación:', url);
      
      const response = await fetch(url);
      console.log('Respuesta del servidor:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('Datos de respuesta:', data);
      
      if (!response.ok || !data.valid) {
        console.log(`Token inválido o expirado: ${data.error || 'Error desconocido'}`);
        return false;
      }
      
      // El token es válido
      console.log(`Token válido - expira en ${data.remaining} (${new Date(data.expiresAt).toLocaleString()})`);
      console.log(`Nota del token: ${data.note || 'Sin nota'}`);
      console.log(`=== FIN VALIDACIÓN DE TOKEN ===`);
      
      return true;
    } catch (error) {
      console.error('Error al validar el token:', error);
      
      // Si hay un error de conexión, intentamos validar con localStorage como fallback
      console.log('Intentando validación fallback con localStorage...');
      return this.isValidTokenLocalFallback(token);
    }
  }

  // Método de fallback para validar token localmente si la API no está disponible
  isValidTokenLocalFallback(token) {
    console.log('Usando validación fallback con localStorage');
    
    try {
      // Intentar cargar tokens desde localStorage
      const storedTokens = localStorage.getItem('machetero_access_tokens');
      if (!storedTokens) {
        console.log('No hay tokens en localStorage para validación fallback');
        return false;
      }
      
      const tokens = JSON.parse(storedTokens);
      
      // Verificar si el token existe
      if (!tokens[token]) {
        console.log('Token no encontrado en localStorage');
        return false;
      }
      
      // Verificar si ha expirado
      const tokenData = tokens[token];
      const now = new Date().getTime();
      
      if (tokenData.expiresAt && now > tokenData.expiresAt) {
        console.log('Token expirado en validación fallback');
        return false;
      }
      
      console.log('Token válido en validación fallback');
      return true;
    } catch (error) {
      console.error('Error en validación fallback:', error);
      return false;
    }
  }

  // Generar un nuevo token de acceso a través de la API
  async generateToken(hours = 24, note = "") {
    if (!this.isAdmin) {
      console.error('Solo el administrador puede generar tokens');
      return null;
    }
    
    // Crear un token aleatorio con un formato más fácil de escribir
    // Usamos letras mayúsculas y números para mejor legibilidad
    const generateRandomPart = () => {
      return Math.random().toString(36).substring(2, 6).toUpperCase();
    };
    
    // Formato: XXXX-XXXX-XXXX (más fácil de leer y copiar)
    const token = `${generateRandomPart()}-${generateRandomPart()}-${generateRandomPart()}`;
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).getTime();
    
    try {
      console.log(`Guardando nuevo token en el servidor: ${token}`);
      const response = await fetch(`${API_BASE_URL}/api/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          expiresAt,
          note,
          hours,
          password: ADMIN_PASSWORD
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al guardar token: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Token guardado correctamente en el servidor');
      
      // Actualizar también en localStorage como fallback
      this.saveTokenLocalFallback(token, {
        createdAt: now.getTime(),
        expiresAt,
        note,
        hours
      });
      
      return { token, expiresAt };
    } catch (error) {
      console.error('Error al generar token en el servidor:', error);
      
      // Si hay un error de conexión, intentar guardar localmente como fallback
      console.log('Guardando token en localStorage como fallback');
      const tokenData = {
        createdAt: now.getTime(),
        expiresAt,
        note,
        hours
      };
      
      this.saveTokenLocalFallback(token, tokenData);
      return { token, expiresAt };
    }
  }

  // Guardar token en localStorage como fallback
  saveTokenLocalFallback(token, tokenData) {
    try {
      // Cargar tokens existentes
      let tokens = {};
      const storedTokens = localStorage.getItem('machetero_access_tokens');
      
      if (storedTokens) {
        tokens = JSON.parse(storedTokens);
      }
      
      // Agregar o actualizar el token
      tokens[token] = tokenData;
      
      // Guardar en localStorage
      localStorage.setItem('machetero_access_tokens', JSON.stringify(tokens));
      console.log('Token guardado en localStorage como fallback');
    } catch (error) {
      console.error('Error al guardar token en localStorage:', error);
    }
  }

  // Verificar credenciales de administrador
  verifyAdmin(password) {
    this.isAdmin = (password === ADMIN_PASSWORD);
    if (this.isAdmin) {
      // Almacenar estado de administrador en sessionStorage (se borra al cerrar pestaña)
      sessionStorage.setItem('machetero_admin', 'true');
      console.log('Acceso de administrador concedido');
      
      // Cargar tokens desde el servidor
      this.loadTokensFromServer();
    }
    
    return this.isAdmin;
  }

  // Comprobar si el usuario es administrador
  checkAdminStatus() {
    // Verificar si ya está autenticado como admin en esta sesión
    this.isAdmin = sessionStorage.getItem('machetero_admin') === 'true';
    
    if (this.isAdmin) {
      console.log('Estado de administrador verificado');
      // Si es administrador, cargar los tokens desde el servidor
      this.loadTokensFromServer();
    }
    
    return this.isAdmin;
  }
  
  // Revocar un token específico
  async revokeToken(token) {
    if (!this.isAdmin) {
      console.error('Solo el administrador puede revocar tokens');
      return false;
    }
    
    try {
      console.log(`Revocando token en el servidor: ${token}`);
      const response = await fetch(`${API_BASE_URL}/api/tokens/${token}?password=${ADMIN_PASSWORD}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al revocar token: ${errorData.error || response.statusText}`);
      }
      
      // Actualizar también en localStorage como fallback
      this.revokeTokenLocalFallback(token);
      
      console.log('Token revocado correctamente');
      return true;
    } catch (error) {
      console.error('Error al revocar token en el servidor:', error);
      
      // Si hay un error de conexión, intentar revocar localmente como fallback
      return this.revokeTokenLocalFallback(token);
    }
  }

  // Revocar token en localStorage como fallback
  revokeTokenLocalFallback(token) {
    try {
      // Cargar tokens existentes
      const storedTokens = localStorage.getItem('machetero_access_tokens');
      if (!storedTokens) return false;
      
      const tokens = JSON.parse(storedTokens);
      
      // Verificar si el token existe
      if (!tokens[token]) return false;
      
      // Eliminar el token
      delete tokens[token];
      
      // Guardar en localStorage
      localStorage.setItem('machetero_access_tokens', JSON.stringify(tokens));
      console.log('Token revocado en localStorage como fallback');
      return true;
    } catch (error) {
      console.error('Error al revocar token en localStorage:', error);
      return false;
    }
  }
  
  // Revocar todos los tokens
  async revokeAllTokens() {
    if (!this.isAdmin) {
      console.error('Solo el administrador puede revocar todos los tokens');
      return false;
    }
    
    try {
      console.log('Revocando todos los tokens en el servidor');
      const response = await fetch(`${API_BASE_URL}/api/tokens?password=${ADMIN_PASSWORD}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al revocar todos los tokens: ${errorData.error || response.statusText}`);
      }
      
      // Actualizar también en localStorage como fallback
      localStorage.setItem('machetero_access_tokens', '{}');
      
      console.log('Todos los tokens revocados correctamente');
      return true;
    } catch (error) {
      console.error('Error al revocar todos los tokens en el servidor:', error);
      
      // Si hay un error de conexión, intentar revocar localmente como fallback
      localStorage.setItem('machetero_access_tokens', '{}');
      console.log('Todos los tokens revocados en localStorage como fallback');
      return true;
    }
  }
  
  // Obtener todos los tokens activos (solo para admin)
  async getAllTokens() {
    if (!this.isAdmin) {
      console.error('Solo el administrador puede obtener todos los tokens');
      return null;
    }
    
    try {
      // Cargar tokens frescos desde el servidor
      const tokens = await this.loadTokensFromServer();
      return tokens;
    } catch (error) {
      console.error('Error al obtener todos los tokens:', error);
      return null;
    }
  }

  // Método de diagnóstico para depurar problemas con tokens
  async diagnosticTokens() {
    console.log('== DIAGNÓSTICO DE TOKENS ==');
    
    // 1. Verificar estado de administrador
    console.log('¿Es administrador?', this.isAdmin);
    
    // 2. Intentar conectar con el servidor
    try {
      console.log('Verificando conexión con el servidor...');
      const response = await fetch(`${API_BASE_URL}/ping`);
      if (response.ok) {
        console.log('Conexión exitosa con el servidor ✅');
      } else {
        console.error('Error al conectar con el servidor ❌');
      }
    } catch (error) {
      console.error('No se pudo conectar con el servidor ❌:', error);
    }
    
    // 3. Verificar tokens en localStorage (fallback)
    try {
      const storedData = localStorage.getItem('machetero_access_tokens');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          const tokenCount = Object.keys(parsedData).length;
          console.log('Tokens en localStorage (fallback):', tokenCount);
          
          if (tokenCount > 0) {
            console.log('Lista de tokens en localStorage:', Object.keys(parsedData));
            
            // Verificar tokens expirados
            const now = new Date().getTime();
            let expiredCount = 0;
            
            Object.keys(parsedData).forEach(token => {
              if (parsedData[token].expiresAt && now > parsedData[token].expiresAt) {
                expiredCount++;
              }
            });
            
            if (expiredCount > 0) {
              console.log(`Tokens expirados en localStorage: ${expiredCount}`);
            }
          }
        } catch (e) {
          console.error('Error al parsear datos de localStorage:', e);
        }
      } else {
        console.log('No hay tokens en localStorage');
      }
    } catch (error) {
      console.error('Error al acceder a localStorage:', error);
    }
    
    // 4. Si es administrador, verificar tokens en el servidor
    if (this.isAdmin) {
      try {
        console.log('Consultando tokens en el servidor...');
        const serverTokens = await this.loadTokensFromServer();
        console.log('Tokens en el servidor:', Object.keys(serverTokens).length);
        
        if (Object.keys(serverTokens).length > 0) {
          console.log('Lista de tokens en el servidor:', Object.keys(serverTokens));
        }
      } catch (error) {
        console.error('Error al consultar tokens en el servidor:', error);
      }
    }
    
    // 5. Verificar token de usuario actual
    const userToken = localStorage.getItem('machetero_user_token');
    if (userToken) {
      console.log('Token de usuario actual:', userToken);
      console.log('Validando token de usuario...');
      
      try {
        const isValid = await this.isValidToken(userToken);
        console.log('¿Token de usuario válido?', isValid ? '✅ Sí' : '❌ No');
      } catch (error) {
        console.error('Error al validar token de usuario:', error);
      }
    } else {
      console.log('No hay token de usuario almacenado');
    }
    
    console.log('== FIN DIAGNÓSTICO ==');
  }
}

// Inicializar el gestor de acceso
const accessManager = new AccessManager();

// Crear UI para login
function createLoginUI() {
  console.log('Creando interfaz de login');
  
  // Eliminar cualquier login overlay existente
  const existingOverlay = document.querySelector('.login-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Contenedor principal con overlay
  const loginOverlay = document.createElement('div');
  loginOverlay.className = 'login-overlay';
  loginOverlay.style.position = 'fixed';
  loginOverlay.style.top = '0';
  loginOverlay.style.left = '0';
  loginOverlay.style.width = '100%';
  loginOverlay.style.height = '100%';
  loginOverlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
  loginOverlay.style.zIndex = '9999';
  loginOverlay.style.display = 'flex';
  loginOverlay.style.justifyContent = 'center';
  loginOverlay.style.alignItems = 'center';
  
  // Contenedor del formulario
  const loginContainer = document.createElement('div');
  loginContainer.className = 'login-container';
  
  // Logo y título
  loginContainer.innerHTML = `
    <div class="login-header">
      <i class="fas fa-futbol ball-icon"></i>
      <h2>Machetero TV</h2>
    </div>
    <div class="login-form">
      <div class="login-tabs">
        <button class="tab-btn active" data-tab="token">Código de acceso</button>
        <button class="tab-btn" data-tab="admin">Administrador</button>
      </div>
      
      <div class="tab-content active" id="token-tab">
        <p>Ingresa el código de acceso que te proporcionaron:</p>
        <input type="text" id="access-token" placeholder="Código de acceso" />
        <button id="validate-token" class="login-btn">Acceder</button>
        <div id="token-message" class="message"></div>
      </div>
      
      <div class="tab-content" id="admin-tab">
        <p>Acceso de administrador:</p>
        <input type="password" id="admin-password" placeholder="Contraseña" />
        <button id="admin-login" class="login-btn">Ingresar</button>
        <div id="admin-message" class="message"></div>
      </div>
    </div>
  `;
  
  // Añadir al overlay
  loginOverlay.appendChild(loginContainer);
  
  // Añadir al body
  document.body.appendChild(loginOverlay);
  
  // Verificar que se añadió correctamente
  console.log('Overlay de login añadido:', document.querySelector('.login-overlay') !== null);
  
  // Configurar eventos para las pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Desactivar todas las pestañas
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Activar la pestaña seleccionada
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });// Evento para validar token
  document.getElementById('validate-token').addEventListener('click', async () => {
    const token = document.getElementById('access-token').value.trim();
    const messageEl = document.getElementById('token-message');
    
    if (!token) {
      messageEl.textContent = 'Por favor ingresa un código de acceso.';
      messageEl.className = 'message error';
      return;
    }
    
    console.log(`Intentando validar token: ${token}`);
    messageEl.textContent = 'Validando código...';
    messageEl.className = 'message';
    
    try {
      // Validar el token con el servidor
      const isValid = await accessManager.isValidToken(token);
      
      if (isValid) {
        // Token válido, guardar en localStorage y recargar
        localStorage.setItem('machetero_user_token', token);
        
        messageEl.textContent = 'Código válido. Accediendo...';
        messageEl.className = 'message success';
        
        console.log('Acceso concedido con token válido');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        console.log('Token inválido o expirado');
        messageEl.textContent = 'Código inválido o expirado. Por favor verifica e intenta nuevamente.';
        messageEl.className = 'message error';
        
        // Ejecutar diagnóstico
        accessManager.diagnosticTokens();
      }
    } catch (error) {
      console.error('Error al validar token:', error);
      messageEl.textContent = 'Error al validar código. Por favor intenta nuevamente.';
      messageEl.className = 'message error';
    }
  });
  
  // Enter para enviar en el campo de token
  document.getElementById('access-token').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('validate-token').click();
    }
  });
  
  // Evento para login de administrador
  document.getElementById('admin-login').addEventListener('click', () => {
    const password = document.getElementById('admin-password').value;
    const messageEl = document.getElementById('admin-message');
    
    if (accessManager.verifyAdmin(password)) {
      messageEl.textContent = 'Acceso correcto. Ingresando...';
      messageEl.className = 'message success';
      setTimeout(() => window.location.reload(), 1000);
    } else {
      messageEl.textContent = 'Contraseña incorrecta.';
      messageEl.className = 'message error';
    }
  });
  
  // Enter para enviar en el campo de contraseña
  document.getElementById('admin-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('admin-login').click();
    }
  });
}

// Crear panel de administrador
function createAdminPanel() {
  const adminPanel = document.createElement('div');
  adminPanel.className = 'admin-panel';
  adminPanel.innerHTML = `
    <div class="admin-header">
      <h3><i class="fas fa-user-shield"></i> Panel de Administrador</h3>
      <button id="close-admin" class="close-btn"><i class="fas fa-times"></i></button>
    </div>
    <div class="admin-content">
      <div class="admin-section">
        <h4>Generar nuevo código de acceso</h4>
        <div class="form-group">
          <label for="token-hours">Duración (horas):</label>
          <input type="number" id="token-hours" min="1" max="720" value="24" />
        </div>
        <div class="form-group">
          <label for="token-note">Nota (opcional):</label>
          <input type="text" id="token-note" placeholder="Ej: Para Juan" />
        </div>
        <button id="generate-token" class="admin-btn">Generar código</button>
        
        <div id="new-token-container" class="token-result hidden">
          <h5>Código generado:</h5>
          <div class="token-display">
            <span id="new-token"></span>
            <button id="copy-token" class="copy-btn"><i class="fas fa-copy"></i></button>
          </div>
          <p>Expira: <span id="token-expires"></span></p>
          <button id="share-token" class="admin-btn share-btn">
            <i class="fas fa-share-alt"></i> Compartir
          </button>
        </div>
      </div>
      
      <div class="admin-section">
        <h4>Códigos activos</h4>
        <button id="refresh-tokens" class="admin-btn small"><i class="fas fa-sync-alt"></i> Actualizar</button>
        <div id="tokens-list" class="tokens-list">
          <p>No hay códigos activos.</p>
        </div>
        <button id="revoke-all" class="admin-btn danger">Revocar todos los códigos</button>
      </div>
        <div class="admin-section">
        <h4>Acciones</h4>
        <button id="admin-logout" class="admin-btn">Cerrar sesión de administrador</button>
        <button id="run-diagnostic" class="admin-btn small">Ejecutar diagnóstico</button>
      </div>
    </div>
  `;
  
  // Añadir al body
  document.body.appendChild(adminPanel);
  
  // Botón para abrir panel de administrador
  const adminBtn = document.createElement('button');
  adminBtn.id = 'admin-panel-btn';
  adminBtn.className = 'floating-btn';
  adminBtn.innerHTML = '<i class="fas fa-user-shield"></i>';
  adminBtn.title = 'Panel de Administrador';
  document.body.appendChild(adminBtn);
  // Evento para abrir panel
  adminBtn.addEventListener('click', () => {
    adminPanel.classList.add('open');
    
    // Recargar los tokens desde el servidor antes de mostrar la lista
    accessManager.loadTokensFromServer().then(() => {
      // Actualizar la lista de tokens
      refreshTokensList();
    });
  });
  
  // Evento para cerrar panel
  document.getElementById('close-admin').addEventListener('click', () => {
    adminPanel.classList.remove('open');
  });  // Generar token
  document.getElementById('generate-token').addEventListener('click', async () => {
    const hours = parseInt(document.getElementById('token-hours').value) || 24;
    const note = document.getElementById('token-note').value.trim();
    
    // Mostrar estado de carga
    const generateBtn = document.getElementById('generate-token');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generando...';
    generateBtn.disabled = true;
    
    try {
      // Usar la versión asíncrona para generar token
      const result = await accessManager.generateToken(hours, note);
      
      if (!result) {
        throw new Error('Error al generar el token');
      }
      
      const { token, expiresAt } = result;
      
      // Mostrar el token generado
      document.getElementById('new-token').textContent = token;
      document.getElementById('token-expires').textContent = new Date(expiresAt).toLocaleString();
      document.getElementById('new-token-container').classList.remove('hidden');
      
      // Actualizar lista de tokens
      refreshTokensList();
      
      // Mostrar confirmación
      generateBtn.textContent = '✓ Código generado';
      generateBtn.classList.add('success');
    } catch (error) {
      console.error('Error al generar token:', error);
      
      // Mostrar error
      generateBtn.textContent = '❌ Error al generar';
      generateBtn.classList.add('error');
      
      // Alerta de error
      alert('Error al generar el código. Por favor intenta nuevamente.');
    } finally {
      // Restaurar estado del botón después de un tiempo
      setTimeout(() => {
        generateBtn.textContent = originalText;
        generateBtn.classList.remove('success', 'error');
        generateBtn.disabled = false;
      }, 2000);
    }
  });
  
  // Copiar token
  document.getElementById('copy-token').addEventListener('click', () => {
    const tokenText = document.getElementById('new-token').textContent;
    navigator.clipboard.writeText(tokenText).then(() => {
      // Mostrar mensaje de copiado
      const copyBtn = document.getElementById('copy-token');
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i>';
      
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
      }, 1500);
    });
  });
    // Compartir token
  document.getElementById('share-token').addEventListener('click', () => {    
    const token = document.getElementById('new-token').textContent;
    const expiresText = document.getElementById('token-expires').textContent;
    const note = document.getElementById('token-note').value.trim();
    
    const shareText = `📺 Código de acceso para Machetero TV: ${token}\n` +
                     `🕒 Expira: ${expiresText}\n` +
                     (note ? `📝 Nota: ${note}\n` : '') +
                     `🔗 Accede en: ${window.location.href}\n\n` +
                     `⚠️ IMPORTANTE: Escribe el código EXACTAMENTE como aparece, respetando mayúsculas y guiones.`;
    
    // Intentar usar la API Web Share si está disponible
    if (navigator.share) {
      navigator.share({
        title: 'Machetero TV - Código de acceso',
        text: shareText
      }).catch(error => {
        console.log('Error al compartir:', error);
        // Fallback - copiar al portapapeles
        navigator.clipboard.writeText(shareText);
        alert('Texto copiado al portapapeles para compartir. Asegúrate de que quien reciba el código lo escriba EXACTAMENTE como aparece, respetando mayúsculas y guiones.');
      });
    } else {
      // Fallback - copiar al portapapeles
      navigator.clipboard.writeText(shareText);
      alert('Texto copiado al portapapeles para compartir. Asegúrate de que quien reciba el código lo escriba EXACTAMENTE como aparece, respetando mayúsculas y guiones.');
    }
  });
  
  // Refrescar lista de tokens
  document.getElementById('refresh-tokens').addEventListener('click', refreshTokensList);
    // Revocar todos los tokens
  document.getElementById('revoke-all').addEventListener('click', async () => {
    if (confirm('¿Estás seguro de que quieres revocar todos los códigos de acceso?')) {
      try {
        // Mostrar estado de carga
        const revokeBtn = document.getElementById('revoke-all');
        const originalText = revokeBtn.textContent;
        revokeBtn.textContent = 'Revocando...';
        revokeBtn.disabled = true;
        
        // Usar la versión asíncrona
        const success = await accessManager.revokeAllTokens();
        
        if (success) {
          refreshTokensList();
          alert('Todos los códigos han sido revocados.');
        } else {
          throw new Error('Error al revocar tokens');
        }
      } catch (error) {
        console.error('Error al revocar todos los tokens:', error);
        alert('Error al revocar los códigos. Por favor intenta nuevamente.');
      } finally {
        // Restaurar estado del botón
        const revokeBtn = document.getElementById('revoke-all');
        revokeBtn.textContent = 'Revocar todos los códigos';
        revokeBtn.disabled = false;
      }
    }
  });  // Cerrar sesión de administrador
  document.getElementById('admin-logout').addEventListener('click', () => {
    // Quitar estado de administrador
    sessionStorage.removeItem('machetero_admin');
    
    alert('Has cerrado sesión como administrador.');
    
    // Recargar la página
    window.location.reload();
  });  // Función para actualizar la lista de tokens
  async function refreshTokensList() {
    const tokensList = document.getElementById('tokens-list');
    
    // Mostrar indicador de carga
    tokensList.innerHTML = '<p>Cargando códigos...</p>';
    
    try {
      // Obtener tokens actualizados desde el servidor
      const tokens = await accessManager.getAllTokens();
      
      if (!tokens || Object.keys(tokens).length === 0) {
        tokensList.innerHTML = '<p>No hay códigos activos.</p>';
        return;
      }
      
      let html = '';
      Object.keys(tokens).forEach(token => {
        const data = tokens[token];
        html += `
          <div class="token-item">
            <div class="token-info">
              <div class="token-code">${token}</div>
              <div class="token-details">
                ${data.note ? `<span class="token-note">${data.note}</span>` : ''}
                <span class="token-time">Expira: ${data.remaining} (${data.expiresAtFormatted})</span>
              </div>
            </div>
            <button class="revoke-btn" data-token="${token}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      });
      
      tokensList.innerHTML = html;
      
      // Añadir eventos para revocar tokens individuales
      document.querySelectorAll('.revoke-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const token = btn.dataset.token;
          if (confirm('¿Revocar este código de acceso?')) {
            try {
              // Desactivar botón y mostrar estado
              btn.disabled = true;
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              
              // Usar la versión asíncrona
              const success = await accessManager.revokeToken(token);
              
              if (success) {
                // Actualizar la lista de tokens
                refreshTokensList();
              } else {
                throw new Error('Error al revocar token');
              }
            } catch (error) {
              console.error('Error al revocar token:', error);
              alert('Error al revocar el código. Por favor intenta nuevamente.');
              
              // Restaurar botón
              btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-trash"></i>';
            }
          }
        });
      });
      
      // Mostrar mensaje de actualización
      const refreshBtn = document.getElementById('refresh-tokens');
      const originalHTML = refreshBtn.innerHTML;
      refreshBtn.innerHTML = '<i class="fas fa-check"></i> Actualizado';
      setTimeout(() => {
        refreshBtn.innerHTML = originalHTML;
      }, 1500);
    } catch (error) {
      console.error('Error al cargar tokens:', error);
      tokensList.innerHTML = '<p>Error al cargar códigos. <button id="retry-load">Reintentar</button></p>';
      
      // Añadir evento para reintentar
      document.getElementById('retry-load')?.addEventListener('click', refreshTokensList);
    }
  }
}

// Función para permitir acceso al contenido
function showMainContent() {
  console.log('=== MOSTRANDO CONTENIDO PRINCIPAL ===');
  
  // Asegurar que todos los elementos principales sean visibles
  const header = document.querySelector('header');
  const container = document.querySelector('.container');
  const footer = document.querySelector('footer');
  
  if (header) {
    header.style.display = 'block';
    console.log('Header visible');
  }
  
  if (container) {
    container.style.display = 'flex'; // Importante: container debe ser flex para el layout
    console.log('Container visible (flex)');
  }
  
  if (footer) {
    footer.style.display = 'block';
    console.log('Footer visible');
  }
  
  // Implementación directa para cargar los canales básicos (sin depender de scripts.js)
  console.log('Implementando carga directa de canales');
    // Función auxiliar para mostrar mensaje de error de canal (definida antes para evitar problemas de referencia)
  function mostrarMensajeErrorCanal(nombreCanal) {
    const playerContainer = document.querySelector('.video-player');
    if (playerContainer) {
      // Limpiar contenedor
      const existingMessages = playerContainer.querySelectorAll('.welcome-message, .demo-message');
      existingMessages.forEach(el => el.remove());
      
      // Añadir mensaje
      const welcomeMsg = document.createElement('div');
      welcomeMsg.className = 'welcome-message';
      welcomeMsg.innerHTML = `
        <h3>Canal seleccionado: ${nombreCanal}</h3>
        <p>La función de reproducción no está disponible en este momento.</p>
        <p>Intenta recargar la página o selecciona otro canal.</p>
      `;
      playerContainer.appendChild(welcomeMsg);
    }
  }
  
  // Referencia directa al contenedor de canales
  const channelList = document.getElementById('channel-list');
    if (channelList) {
    // Obtener todos los canales disponibles desde LOGOS en scripts.js
    let allChannels = [];
    
    // Intentar obtener los canales desde el objeto LOGOS en window
    if (typeof window.LOGOS !== 'undefined') {
      console.log('Usando canales desde window.LOGOS');
      allChannels = Object.keys(window.LOGOS);
    }
    
    // Si no hay canales disponibles en window.LOGOS, usar lista completa directamente
    if (allChannels.length === 0) {
      console.log('Usando lista completa de canales definida localmente');
      allChannels = [
        "DIRECTV Sports HD",
        "DIRECTV Sports 2 HD", 
        "Movistar Deportes",
        "ESPN Premium",
        "ESPN",
        "ESPN2",
        "ESPN3",
        "ESPN4",
        "ESPN5",
        "ESPN6",
        "ESPN7",
        "Liga 1 Max",
        "Gol Perú",
        "DirecTV Plus",
        "FOX Sports",
        "TyC Sports",
        "NASA TV Public",
        "Red Bull TV"
      ];
    }
      console.log('Cargando lista completa de canales:', allChannels.length, 'canales');
    
    // Limpiar lista existente
    channelList.innerHTML = '';
    
    // Asegurar que la lista de canales sea visible
    channelList.style.display = 'block';
      // Agregar todos los canales disponibles
    allChannels.forEach(name => {
      const item = document.createElement('li');
      
      // Crear contenido más visual para cada canal
      item.innerHTML = `
        <img src="img/channel-icon.png" alt="${name}" class="channel-logo-small" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%22.9em%22 font-size=%2224%22>📺</text></svg>'">
        <span>${name}</span>
      `;
      
      // Agregar clase especial para canales de demostración
      if (name === 'NASA TV Public' || name === 'Red Bull TV') {
        item.classList.add('demo-channel');
      }
      
      // Añadir evento de clic (simplificado)
      item.addEventListener('click', () => {
        // Marcar como activo
        document.querySelectorAll('#channel-list li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');
        
        console.log('Canal seleccionado:', name);
        document.getElementById('channel-title').textContent = name;
          // Intentar cargar canal usando la función de scripts.js si está disponible
        if (typeof window.loadChannel === 'function') {
          try {
            window.loadChannel(name);
            console.log('Canal cargado usando función loadChannel de scripts.js');
          } catch (error) {
            console.error('Error al cargar canal con scripts.js:', error);
            mostrarMensajeErrorCanal(name);
          }
        } else {
          console.log('Función loadChannel no disponible, mostrando mensaje alternativo');
          mostrarMensajeErrorCanal(name);
        }
      });
      
      channelList.appendChild(item);
    });
      console.log('Lista básica de canales cargada con éxito');
    
    // Configurar el filtro de búsqueda simple
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const items = document.querySelectorAll('#channel-list li');
        
        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
      console.log('Filtro de búsqueda configurado');
    }
    
    // Seleccionar un canal automáticamente
    setTimeout(() => {
      if (channelList.children.length > 0) {
        console.log('Seleccionando canal inicial...');
        // Intentar encontrar un canal de demostración
        const demoChannel = Array.from(channelList.children).find(li => 
          li.textContent.includes("NASA TV Public") || li.textContent.includes("Red Bull TV")
        );
        
        if (demoChannel) {
          console.log('Canal de demostración encontrado, seleccionando:', demoChannel.textContent.trim());
          demoChannel.click();
        } else if (channelList.firstElementChild) {
          console.log('Seleccionando primer canal disponible');
          channelList.firstElementChild.click();
        }
      }
    }, 500);
  } else {
    console.error('No se encontró el elemento #channel-list en el DOM');
  }
  
  console.log('Contenido principal mostrado - acceso autorizado');
}

// Verificar acceso cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== VERIFICACIÓN DE ACCESO ===');
  
  // IMPORTANTE: Ocultar SIEMPRE el contenido principal al inicio, sin excepciones
  const header = document.querySelector('header');
  const container = document.querySelector('.container');
  const footer = document.querySelector('footer');
  
  if (header) header.style.display = 'none';
  if (container) container.style.display = 'none';
  if (footer) footer.style.display = 'none';
  
  console.log('Contenido principal oculto hasta verificar acceso');
  
  try {
    // Comprobar primero si el usuario es administrador
    const isAdmin = accessManager.checkAdminStatus();
    console.log('¿Es administrador?', isAdmin);
    
    if (isAdmin) {
      console.log('Acceso como administrador - creando panel de administrador');
      createAdminPanel();
      
      // Mostrar el contenido principal para el administrador
      showMainContent();
      
      return; // El admin siempre tiene acceso
    }
    
    // Verificar si hay un token de usuario almacenado
    let userToken = localStorage.getItem('machetero_user_token');
    console.log('Token de usuario:', userToken ? `${userToken.substring(0, 10)}...` : 'No existe');
    
    let isValidToken = false;
    
    if (userToken) {
      try {
        // Validar el token con el servidor
        console.log('Validando token con el servidor...');
        isValidToken = await accessManager.isValidToken(userToken);
        console.log('¿Token válido?', isValidToken);
        
        if (!isValidToken) {
          console.log('Token inválido o expirado - eliminando del localStorage');
          localStorage.removeItem('machetero_user_token');
        }
      } catch (error) {
        console.error('Error al validar token:', error);
        localStorage.removeItem('machetero_user_token');
        isValidToken = false;
      }
    }
    
    if (isValidToken) {
      // Token válido, permitir acceso
      console.log('Acceso concedido con token válido');
      
      // Mostrar el contenido principal
      showMainContent();
    } else {
      // Sin token válido, mostrar pantalla de login
      console.log('No hay token válido - mostrando pantalla de login');
      createLoginUI();
      
      // El contenido principal permanece oculto
      console.log('Contenido principal mantenido oculto - se requiere autenticación');
      
      // Ejecutar diagnóstico para depurar problemas
      await accessManager.diagnosticTokens();
    }
  } catch (error) {
    console.error('Error en verificación de acceso:', error);
    
    // En caso de error, mostrar pantalla de login por seguridad
    createLoginUI();
    
    // Mantener el contenido principal oculto
    if (header) header.style.display = 'none';
    if (container) container.style.display = 'none';
    if (footer) footer.style.display = 'none';
    
    console.log('Error en la verificación - mostrando login por seguridad');
  }
  
  console.log('=== FIN VERIFICACIÓN DE ACCESO ===');
});

// Ejecutar diagnóstico al hacer clic en el botón
document.addEventListener('click', async function(event) {
  if (event.target.id === 'run-diagnostic' || event.target.closest('#run-diagnostic')) {
    try {
      // Mostrar que estamos ejecutando el diagnóstico
      const diagnosticBtn = document.getElementById('run-diagnostic');
      if (!diagnosticBtn) return;
      
      const originalText = diagnosticBtn.textContent;
      diagnosticBtn.textContent = 'Ejecutando diagnóstico...';
      diagnosticBtn.disabled = true;
      
      // Ejecutar diagnóstico completo
      await accessManager.diagnosticTokens();
      
      // Crear un token de prueba para probar entre dispositivos
      const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const testToken = `TEST-${randomCode}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).getTime();
      
      console.log('Creando token de prueba para diagnóstico:', testToken);
      
      // Guardar el token de prueba en el servidor
      await accessManager.generateToken(24, 'Token de prueba - Diagnóstico');
      
      // Verificar conexión con el servidor
      let serverStatus = 'Desconocido';
      try {
        const response = await fetch(`${API_BASE_URL}/ping`);
        serverStatus = response.ok ? 'Conectado ✅' : 'Error de conexión ❌';
      } catch (error) {
        serverStatus = 'No se pudo conectar ❌';
      }
      
      // Validar el token recién creado
      let tokenValid = false;
      try {
        tokenValid = await accessManager.isValidToken(testToken);
      } catch (error) {
        console.error('Error al validar token de prueba:', error);
      }
      
      // Mostrar resultados del diagnóstico
      alert(`Diagnóstico completado:
  
  Servidor: ${serverStatus}
  Estado de admin: ${accessManager.isAdmin ? 'Sí ✅' : 'No ❌'}
  
  ===== PRUEBA ENTRE DISPOSITIVOS =====
  Se ha creado un token de prueba: ${testToken}
  Este token expira en: ${new Date(expiresAt).toLocaleString()}
  
  INSTRUCCIONES:
  1. Copia este código: ${testToken}
  2. Intenta acceder desde otro dispositivo o navegador
  3. Si funciona, el sistema está correcto
  4. Si no funciona, revisa la consola para más detalles
  
  Ver consola para información detallada.`);
      
      // Actualizar la lista de tokens tras el diagnóstico
      if (typeof refreshTokensList === 'function') {
        refreshTokensList();
      } else {
        // Si no está disponible la función, recargar la página
        console.log('Función refreshTokensList no disponible, recargando página...');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      alert('Error al ejecutar diagnóstico. Por favor revisa la consola para más detalles.');
    } finally {
      // Restaurar estado del botón
      const diagnosticBtn = document.getElementById('run-diagnostic');
      if (diagnosticBtn) {
        diagnosticBtn.textContent = 'Ejecutar diagnóstico';
        diagnosticBtn.disabled = false;
      }
    }
  }
});
