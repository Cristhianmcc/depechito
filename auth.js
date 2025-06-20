/**
 * Sistema de autenticación para De Pechito TV
 * Permite controlar el acceso mediante códigos generados por el administrador
 */

// Contraseña maestra del administrador (cámbiala por una segura)
const ADMIN_PASSWORD = "micausagufy1";

// Clase para gestionar tokens de acceso
class AccessManager {
  constructor() {
    this.tokens = this.loadTokens();
    this.isAdmin = false;
    
    // Limpiar tokens expirados al iniciar
    this.cleanExpiredTokens();
  }
  
  // Cargar tokens almacenados
  loadTokens() {
    const storedTokens = localStorage.getItem('depechito_access_tokens');
    return storedTokens ? JSON.parse(storedTokens) : {};
  }
  
  // Guardar tokens en localStorage
  saveTokens() {
    localStorage.setItem('depechito_access_tokens', JSON.stringify(this.tokens));
  }
  
  // Verificar si un token es válido
  isValidToken(token) {
    if (!token || !this.tokens[token]) return false;
    
    const tokenData = this.tokens[token];
    const now = new Date().getTime();
    
    // Verificar si el token ha expirado
    if (tokenData.expiresAt && now > tokenData.expiresAt) {
      // Token expirado, eliminarlo
      delete this.tokens[token];
      this.saveTokens();
      return false;
    }
    
    return true;
  }
  
  // Generar un nuevo token de acceso
  generateToken(hours = 24, note = "") {
    // Crear un token aleatorio
    const token = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).getTime();
    
    // Guardar el token con su fecha de expiración y nota
    this.tokens[token] = {
      createdAt: now.getTime(),
      expiresAt: expiresAt,
      note: note,
      hours: hours
    };
    
    this.saveTokens();
    return { token, expiresAt };
  }
  
  // Verificar credenciales de administrador
  verifyAdmin(password) {
    this.isAdmin = (password === ADMIN_PASSWORD);
    
    if (this.isAdmin) {
      // Almacenar estado de administrador en sessionStorage (se borra al cerrar pestaña)
      sessionStorage.setItem('depechito_admin', 'true');
    }
    
    return this.isAdmin;
  }
  
  // Comprobar si el usuario es administrador
  checkAdminStatus() {
    // Verificar si ya está autenticado como admin en esta sesión
    this.isAdmin = sessionStorage.getItem('depechito_admin') === 'true';
    return this.isAdmin;
  }
  
  // Revocar un token específico
  revokeToken(token) {
    if (this.tokens[token]) {
      delete this.tokens[token];
      this.saveTokens();
      return true;
    }
    return false;
  }
  
  // Revocar todos los tokens
  revokeAllTokens() {
    this.tokens = {};
    this.saveTokens();
  }
  
  // Limpiar tokens expirados
  cleanExpiredTokens() {
    const now = new Date().getTime();
    let changed = false;
    
    Object.keys(this.tokens).forEach(token => {
      if (this.tokens[token].expiresAt && now > this.tokens[token].expiresAt) {
        delete this.tokens[token];
        changed = true;
      }
    });
    
    if (changed) {
      this.saveTokens();
    }
  }
  
  // Obtener todos los tokens activos (solo para admin)
  getAllTokens() {
    if (!this.isAdmin) return null;
    
    // Limpiar tokens expirados primero
    this.cleanExpiredTokens();
    
    const result = {};
    const now = new Date().getTime();
    
    Object.keys(this.tokens).forEach(token => {
      const tokenData = this.tokens[token];
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
    
    return result;
  }
}

// Inicializar el gestor de acceso
const accessManager = new AccessManager();

// Crear UI para login
function createLoginUI() {
  // Contenedor principal con overlay
  const loginOverlay = document.createElement('div');
  loginOverlay.className = 'login-overlay';
  
  // Contenedor del formulario
  const loginContainer = document.createElement('div');
  loginContainer.className = 'login-container';
  
  // Logo y título
  loginContainer.innerHTML = `
    <div class="login-header">
      <i class="fas fa-futbol ball-icon"></i>
      <h2>De Pechito TV</h2>
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
  });
  
  // Evento para validar token
  document.getElementById('validate-token').addEventListener('click', () => {
    const token = document.getElementById('access-token').value.trim();
    const messageEl = document.getElementById('token-message');
    
    if (!token) {
      messageEl.textContent = 'Por favor ingresa un código de acceso.';
      messageEl.className = 'message error';
      return;
    }
    
    if (accessManager.isValidToken(token)) {
      // Token válido, guardar en localStorage y recargar
      localStorage.setItem('depechito_user_token', token);
      messageEl.textContent = 'Código válido. Accediendo...';
      messageEl.className = 'message success';
      setTimeout(() => window.location.reload(), 1000);
    } else {
      messageEl.textContent = 'Código inválido o expirado.';
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
    refreshTokensList();
  });
  
  // Evento para cerrar panel
  document.getElementById('close-admin').addEventListener('click', () => {
    adminPanel.classList.remove('open');
  });
  
  // Generar token
  document.getElementById('generate-token').addEventListener('click', () => {
    const hours = parseInt(document.getElementById('token-hours').value) || 24;
    const note = document.getElementById('token-note').value.trim();
    
    const { token, expiresAt } = accessManager.generateToken(hours, note);
    
    // Mostrar el token generado
    document.getElementById('new-token').textContent = token;
    document.getElementById('token-expires').textContent = new Date(expiresAt).toLocaleString();
    document.getElementById('new-token-container').classList.remove('hidden');
    
    // Actualizar lista de tokens
    refreshTokensList();
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
    
    const shareText = `📺 Código de acceso para De Pechito TV: ${token}\n` +
                     `🕒 Expira: ${expiresText}\n` +
                     (note ? `📝 Nota: ${note}\n` : '') +
                     `🔗 Accede en: ${window.location.href}`;
    
    // Intentar usar la API Web Share si está disponible
    if (navigator.share) {
      navigator.share({
        title: 'De Pechito TV - Código de acceso',
        text: shareText
      }).catch(error => {
        console.log('Error al compartir:', error);
        // Fallback - copiar al portapapeles
        navigator.clipboard.writeText(shareText);
        alert('Texto copiado al portapapeles para compartir');
      });
    } else {
      // Fallback - copiar al portapapeles
      navigator.clipboard.writeText(shareText);
      alert('Texto copiado al portapapeles para compartir');
    }
  });
  
  // Refrescar lista de tokens
  document.getElementById('refresh-tokens').addEventListener('click', refreshTokensList);
  
  // Revocar todos los tokens
  document.getElementById('revoke-all').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres revocar todos los códigos de acceso?')) {
      accessManager.revokeAllTokens();
      refreshTokensList();
      alert('Todos los códigos han sido revocados.');
    }
  });
  
  // Cerrar sesión de administrador
  document.getElementById('admin-logout').addEventListener('click', () => {
    sessionStorage.removeItem('depechito_admin');
    window.location.reload();
  });
  
  // Función para actualizar la lista de tokens
  function refreshTokensList() {
    const tokensList = document.getElementById('tokens-list');
    const tokens = accessManager.getAllTokens();
    
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
      btn.addEventListener('click', () => {
        const token = btn.dataset.token;
        if (confirm('¿Revocar este código de acceso?')) {
          accessManager.revokeToken(token);
          refreshTokensList();
        }
      });
    });
  }
}

// Verificar acceso cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  // Comprobar primero si el usuario es administrador
  if (accessManager.checkAdminStatus()) {
    console.log('Acceso como administrador');
    createAdminPanel();
    return; // El admin siempre tiene acceso
  }
  
  // Verificar si hay un token de usuario almacenado
  const userToken = localStorage.getItem('depechito_user_token');
  if (userToken && accessManager.isValidToken(userToken)) {
    console.log('Acceso con token válido');
    return; // Token válido, permitir acceso
  }
  
  // Si no hay token válido o es administrador, mostrar pantalla de login
  createLoginUI();
  
  // Ocultar el contenido principal
  document.querySelector('header').style.display = 'none';
  document.querySelector('.container').style.display = 'none';
  document.querySelector('footer').style.display = 'none';
});
