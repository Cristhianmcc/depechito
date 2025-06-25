// Script para sincronizar tokens desde local a Render
// Este script extrae tokens de la base de datos local y los envía a Render

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const path = require('path');

// URL de la API en Render (modificar según tu URL de Render)
const RENDER_API_URL = 'https://tu-app.onrender.com';
// Puedes añadir una clave API para mayor seguridad
const API_KEY = 'tu-clave-secreta';

// Ruta a la base de datos local
const DB_FILE = path.join(__dirname, 'tokens.db');

// Configurar la conexión a la base de datos
const db = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    process.exit(1);
  }
  console.log('Conectado a la base de datos local de tokens');
});

// Función para obtener todos los tokens activos de la base de datos local
async function getActiveTokens() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT token, createdAt, expiresAt, note, hours
      FROM tokens
      WHERE expiresAt > ?
      ORDER BY createdAt DESC
    `;
    
    db.all(query, [Date.now()], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`Se encontraron ${rows.length} tokens activos en la base de datos local`);
      resolve(rows);
    });
  });
}

// Función para enviar un token a Render
async function sendTokenToRender(token) {
  try {
    // Endpoint para importar tokens (deberás crear este endpoint en tu servidor)
    const response = await fetch(`${RENDER_API_URL}/api/tokens/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(token)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al enviar token a Render: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error al enviar token ${token.token.substring(0, 10)}...`, error.message);
    return { success: false, error: error.message };
  }
}

// Función principal
async function syncTokens() {
  console.log('=== INICIANDO SINCRONIZACIÓN DE TOKENS A RENDER ===');
  console.log('Fecha y hora:', new Date().toISOString());
  
  try {
    // 1. Obtener tokens activos de la base de datos local
    const tokens = await getActiveTokens();
    
    if (tokens.length === 0) {
      console.log('No hay tokens activos para sincronizar');
      return;
    }
    
    console.log(`Sincronizando ${tokens.length} tokens a ${RENDER_API_URL}...`);
    
    // 2. Enviar cada token a Render
    let successCount = 0;
    let errorCount = 0;
    
    for (const token of tokens) {
      console.log(`Enviando token: ${token.token.substring(0, 15)}... (Nota: ${token.note || 'N/A'})`);
      
      const result = await sendTokenToRender(token);
      
      if (result.success) {
        successCount++;
        console.log(`✅ Token sincronizado correctamente`);
      } else {
        errorCount++;
        console.log(`❌ Error al sincronizar token: ${result.error || 'Desconocido'}`);
      }
      
      // Pequeña pausa entre peticiones
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 3. Mostrar resumen
    console.log('\n=== RESUMEN DE SINCRONIZACIÓN ===');
    console.log(`Total de tokens: ${tokens.length}`);
    console.log(`Tokens sincronizados: ${successCount}`);
    console.log(`Errores: ${errorCount}`);
    console.log(`Tasa de éxito: ${Math.round((successCount / tokens.length) * 100)}%`);
    
  } catch (error) {
    console.error('Error durante la sincronización:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    db.close();
    console.log('Conexión a la base de datos cerrada');
    console.log('=== FIN DE LA SINCRONIZACIÓN ===');
  }
}

// Ejecutar la sincronización
syncTokens().catch(error => {
  console.error('Error general:', error);
  process.exit(1);
});
