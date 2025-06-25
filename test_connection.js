/**
 * Script para probar la conexión a fubohd.com con diferentes headers
 * Ejecutar con: node test_connection.js
 */

const fetch = require('node-fetch');
const https = require('https');

// Agente HTTPS que ignora errores de certificado SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

// Lista de User-Agents para rotación y evitar bloqueos
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1'
];

// Dominios comunes de referencia para evitar bloqueos
const REFERER_DOMAINS = [
  'https://www.google.com/',
  'https://pelotalibrehdtv.com/',
  'https://pelotalibre.me/',
  'https://futbollibre.net/',
  'https://facebook.com/',
  'https://twitter.com/',
  'https://instagram.com/',
  'https://youtube.com/'
];

// URLs a probar
const TEST_URLS = [
  'https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8?token=test12345',
  'https://dglvz29s.fubohd.com/espn/mono.m3u8?token=test12345',
  'https://pelotalibrehdtv.com',
  'https://pelotalibre.me',
  'https://futbollibre.net'
];

// Función principal
async function testConnections() {
  console.log('========================================');
  console.log('PRUEBA DE CONEXIÓN A SERVIDORES DE STREAMING');
  console.log('========================================\n');
  
  // Prueba cada URL
  for (const url of TEST_URLS) {
    console.log(`\n> PROBANDO URL: ${url}`);
    
    // Probar con diferentes user agents
    for (let i = 0; i < USER_AGENTS.length; i++) {
      const userAgent = USER_AGENTS[i];
      const referer = REFERER_DOMAINS[i % REFERER_DOMAINS.length];
      
      console.log(`\n  - Intento con User-Agent: ${userAgent.substring(0, 20)}...`);
      console.log(`    Referer: ${referer}`);
      
      try {
        const startTime = Date.now();
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': userAgent,
            'Referer': referer,
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          },
          agent: httpsAgent,
          timeout: 20000
        });
        
        const responseTime = Date.now() - startTime;
        
        console.log(`    Resultado: ${response.status} ${response.statusText}`);
        console.log(`    Tiempo de respuesta: ${responseTime}ms`);
        
        // Mostrar headers relevantes
        console.log('    Headers de respuesta relevantes:');
        ['content-type', 'content-length', 'server', 'access-control-allow-origin'].forEach(header => {
          if (response.headers.has(header)) {
            console.log(`      - ${header}: ${response.headers.get(header)}`);
          }
        });
        
        // Si hay error 403, mostrar mensaje especial
        if (response.status === 403) {
          console.log('    ⚠️ BLOQUEADO: El servidor ha rechazado la conexión (403 Forbidden)');
        } else if (response.ok) {
          console.log('    ✅ ÉXITO: Conexión establecida correctamente');
        }
      } catch (error) {
        console.log(`    ❌ ERROR: ${error.message}`);
        if (error.code) {
          console.log(`    Código de error: ${error.code}`);
        }
      }
    }
  }
  
  console.log('\n========================================');
  console.log('RECOMENDACIONES');
  console.log('========================================');
  console.log('1. Si todos los intentos dan error 403, probablemente la IP está bloqueada.');
  console.log('2. Si algunos User-Agents funcionan y otros no, usa los que funcionan.');
  console.log('3. Si funciona en local pero no en Render, considera usar un proxy externo.');
  console.log('4. Verifica la configuración de CORS y los headers en el servidor.');
  console.log('5. Prueba con diferentes Referers, especialmente de origen similar al sitio.');
}

// Ejecutar el test
testConnections().catch(error => {
  console.error('Error ejecutando prueba:', error);
});
