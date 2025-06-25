# Diagnóstico de Problemas en Render

## Problemas Detectados

1. **Errores 403 en solicitudes de streams**
   - Los proveedores de streaming están bloqueando las solicitudes desde la IP de Render
   - Esto afecta a todas las URLs de stream (m3u8) incluso cuando los tokens son válidos

2. **Errores de JSON.parse con "unexpected character"**
   - El backend está devolviendo HTML en lugar de JSON en algunos casos
   - Esto ocurre cuando los sitios de origen devuelven páginas de error en HTML

3. **Problemas con CORS**
   - Algunas solicitudes están siendo bloqueadas por restricciones de CORS
   - Los proveedores de streaming están verificando Origin y Referer

4. **Fallos en la carga de recursos de medios**
   - Los reproductores de video no pueden cargar los streams
   - Esto ocurre incluso cuando la aplicación funciona perfectamente en local

## Causas Probables

La causa principal es que **la IP de Render está en listas negras** de los proveedores de streaming. Estos sitios utilizan sistemas de detección para bloquear:
- Servidores en la nube
- Solicitudes automatizadas
- IPs con comportamiento sospechoso (demasiadas solicitudes)
- Solicitudes sin headers de navegador adecuados

## Pruebas de Diagnóstico

Para confirmar estas hipótesis, ejecuta las siguientes pruebas en Render:

1. **Comprobar IP y estado**
   ```bash
   curl -s https://ipinfo.io | python3 render_ip_check.py
   ```

2. **Probar conexiones con diferentes headers**
   ```bash
   node connection_diagnostic.js
   ```

3. **Verificar diagnóstico interno del servidor**
   - Visita: `https://tu-app-render.onrender.com/api/render-diagnostic`

## Soluciones Recomendadas

### Opción 1: Usar un Proxy Residencial (Recomendado)
- Implementar un servicio de proxy residencial para todas las solicitudes a sitios de streaming
- Opciones: BrightData, IPRoyal, Smartproxy, Oxylabs
- Ventajas: Solución definitiva al problema, funcionará a largo plazo
- Desventajas: Costo adicional (desde $10-15/mes para uso personal)

Ejemplo de implementación con un proxy residencial:
```javascript
const proxyUrl = 'http://usuario:contraseña@proxy.proveedor.com:puerto';
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// Usar el proxy solo para solicitudes a sitios de streaming
const response = await fetch(streamUrl, {
  agent: url.includes('fubohd.com') ? proxyAgent : httpsAgent,
  headers: {/*...*/}
});
```

### Opción 2: Sincronización de Tokens Local-Render
1. Ejecutar la aplicación localmente para extraer tokens
2. Transferir estos tokens a la base de datos en Render
3. Configurar la app para usar estos tokens sin hacer scraping

Ejemplo de script de sincronización:
```javascript
// Script para transferir tokens desde local a Render
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');

// Exportar tokens desde la base de datos local
const db = new sqlite3.Database('./tokens.db');
db.all('SELECT * FROM tokens WHERE expiresAt > ?', [Date.now()], async (err, rows) => {
  if (err) throw err;
  
  // Enviar tokens a Render
  for (const row of rows) {
    await fetch('https://tu-app-render.onrender.com/api/tokens/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
  }
});
```
