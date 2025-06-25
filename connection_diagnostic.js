// Script para diagnosticar problemas de streaming en Render
// Este script prueba el acceso a diferentes URLs de streaming con varias combinaciones de headers
// para identificar por qué están fallando las solicitudes en Render

const fetch = require('node-fetch');
const https = require('https');

// Configuración del agente HTTPS para ignorar problemas SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

// Lista de User-Agents para probar
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1'
];

// Lista de Referers para probar
const REFERERS = [
  'https://pelotalibrehdtv.com/',
  'https://www.pelotalibrehdtv.com/',
  'https://www.google.com/',
  'https://www.facebook.com/',
  'https://futbollibre.net/'
];

// Lista de endpoints a probar
const TEST_ENDPOINTS = [
  // URLs de stream directo
  {
    name: 'DirecTV Sports Stream',
    url: 'https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8?token=test123',
    type: 'stream'
  },
  {
    name: 'ESPN Stream',
    url: 'https://dglvz29s.fubohd.com/espn/mono.m3u8?token=test123',
    type: 'stream'
  },
  {
    name: 'ESPN Premium Stream',
    url: 'https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8?token=test123',
    type: 'stream'
  },
  // URLs de sitios web
  {
    name: 'PelotaLibre Homepage',
    url: 'https://pelotalibrehdtv.com',
    type: 'website'
  },
  {
    name: 'PelotaLibre ESPN4 Page',
    url: 'https://www.pelotalibrehdtv.com/pelota/espn-4/',
    type: 'website'
  },
  // URLs de control
  {
    name: 'Google (Control)',
    url: 'https://www.google.com',
    type: 'control'
  }
];

// Función para probar un endpoint con diferentes combinaciones de headers
async function testEndpoint(endpoint) {
  console.log(`\n===== PROBANDO ${endpoint.name} =====`);
  console.log(`URL: ${endpoint.url}`);
  console.log(`Tipo: ${endpoint.type}\n`);
  
  // Resultados
  const results = [];
  
  // Primera prueba - Sin headers especiales
  try {
    console.log('Prueba 1: Sin headers especiales');
    const startTime = Date.now();
    const response = await fetch(endpoint.url, {
      agent: httpsAgent,
      timeout: 15000
    });
    const elapsedTime = Date.now() - startTime;
    
    console.log(`Respuesta: ${response.status} ${response.statusText}`);
    console.log(`Tiempo: ${elapsedTime}ms`);
    
    const headers = Object.fromEntries([...response.headers]);
    console.log(`Headers de respuesta: ${JSON.stringify(headers, null, 2)}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      console.log(`Tipo de contenido: ${contentType}`);
      
      // Para respuestas JSON, mostrar el contenido
      if (contentType && contentType.includes('application/json')) {
        try {
          const data = await response.json();
          console.log('Contenido JSON:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('Error al parsear JSON:', e.message);
        }
      }
      // Para respuestas de texto, mostrar fragmento
      else if (contentType && contentType.includes('text')) {
        const text = await response.text();
        console.log(`Contenido (primeros 200 caracteres): ${text.substring(0, 200)}...`);
      }
      // Para streams, solo mostrar que se recibieron datos
      else {
        console.log('Recibido contenido binario o stream');
      }
    }
    
    results.push({
      test: 'Sin headers especiales',
      success: response.ok,
      status: response.status,
      time: elapsedTime
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    results.push({
      test: 'Sin headers especiales',
      success: false,
      error: error.message
    });
  }
  
  // Segunda prueba - Con User-Agent específico
  for (let i = 0; i < 3; i++) { // Probar con 3 User-Agents diferentes
    const userAgent = USER_AGENTS[i];
    try {
      console.log(`\nPrueba ${i+2}: Con User-Agent (${userAgent.substring(0, 20)}...)`);
      const startTime = Date.now();
      const response = await fetch(endpoint.url, {
        headers: {
          'User-Agent': userAgent
        },
        agent: httpsAgent,
        timeout: 15000
      });
      const elapsedTime = Date.now() - startTime;
      
      console.log(`Respuesta: ${response.status} ${response.statusText}`);
      console.log(`Tiempo: ${elapsedTime}ms`);
      
      results.push({
        test: `User-Agent: ${userAgent.substring(0, 20)}...`,
        success: response.ok,
        status: response.status,
        time: elapsedTime
      });
    } catch (error) {
      console.log(`Error: ${error.message}`);
      results.push({
        test: `User-Agent: ${userAgent.substring(0, 20)}...`,
        success: false,
        error: error.message
      });
    }
  }
  
  // Tercera prueba - Con User-Agent y Referer
  for (let i = 0; i < 2; i++) { // Probar con 2 combinaciones diferentes
    const userAgent = USER_AGENTS[i];
    const referer = REFERERS[i];
    try {
      console.log(`\nPrueba ${i+5}: Con User-Agent y Referer`);
      console.log(`User-Agent: ${userAgent.substring(0, 20)}...`);
      console.log(`Referer: ${referer}`);
      
      const startTime = Date.now();
      const response = await fetch(endpoint.url, {
        headers: {
          'User-Agent': userAgent,
          'Referer': referer,
          'Origin': new URL(referer).origin
        },
        agent: httpsAgent,
        timeout: 15000
      });
      const elapsedTime = Date.now() - startTime;
      
      console.log(`Respuesta: ${response.status} ${response.statusText}`);
      console.log(`Tiempo: ${elapsedTime}ms`);
      
      results.push({
        test: `User-Agent + Referer (${referer})`,
        success: response.ok,
        status: response.status,
        time: elapsedTime
      });
    } catch (error) {
      console.log(`Error: ${error.message}`);
      results.push({
        test: `User-Agent + Referer (${referer})`,
        success: false,
        error: error.message
      });
    }
  }
  
  // Cuarta prueba - Con todos los headers de navegador
  try {
    console.log(`\nPrueba 7: Con todos los headers de navegador`);
    const userAgent = USER_AGENTS[0];
    const referer = REFERERS[0];
    
    const startTime = Date.now();
    const response = await fetch(endpoint.url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Referer': referer,
        'Origin': new URL(referer).origin,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      agent: httpsAgent,
      timeout: 15000
    });
    const elapsedTime = Date.now() - startTime;
    
    console.log(`Respuesta: ${response.status} ${response.statusText}`);
    console.log(`Tiempo: ${elapsedTime}ms`);
    
    const headers = Object.fromEntries([...response.headers]);
    console.log(`Headers de respuesta: ${JSON.stringify(headers, null, 2)}`);
    
    results.push({
      test: 'Todos los headers de navegador',
      success: response.ok,
      status: response.status,
      time: elapsedTime
    });
    
    // Para respuestas exitosas, intentar obtener información del contenido
    if (response.ok) {
      if (endpoint.type === 'stream') {
        // Para streams, no descargar todo el contenido
        const chunk = await readStream(response.body, 1024);
        console.log(`Primeros bytes del stream: ${chunk.length} bytes recibidos`);
        if (chunk.includes('#EXTM3U') || chunk.includes('HLS')) {
          console.log('Parece ser un stream HLS válido');
        }
      } else {
        // Para páginas web, verificar si contiene texto esperado
        const text = await response.text();
        const snippet = text.substring(0, 200);
        console.log(`Contenido (primeros 200 caracteres): ${snippet}...`);
        
        if (endpoint.type === 'website' && (snippet.includes('<html') || snippet.includes('<!DOCTYPE'))) {
          console.log('Parece ser una página HTML válida');
        }
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    results.push({
      test: 'Todos los headers de navegador',
      success: false,
      error: error.message
    });
  }
  
  // Resumen de resultados
  console.log('\n----- RESUMEN DE RESULTADOS -----');
  let successCount = 0;
  results.forEach(result => {
    if (result.success) successCount++;
    console.log(`${result.success ? '✅' : '❌'} ${result.test}: ${result.success ? 'Éxito' : 'Fallo'} ${result.status || ''} ${result.error || ''}`);
  });
  
  console.log(`\nTasa de éxito: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
  
  if (successCount === 0) {
    console.log('\n❌ DIAGNÓSTICO: Todas las pruebas fallaron. Posible bloqueo completo.');
    if (endpoint.type === 'stream') {
      console.log('   - La IP podría estar bloqueada por el proveedor de streams.');
      console.log('   - Considerar usar un proxy residencial para las solicitudes.');
    }
  } else if (successCount < results.length / 2) {
    console.log('\n⚠️ DIAGNÓSTICO: La mayoría de las pruebas fallaron. Bloqueo parcial posible.');
    console.log('   - Algunas combinaciones de headers funcionan mejor que otras.');
    if (results.some(r => r.test.includes('Referer') && r.success)) {
      console.log('   - El uso de headers Referer parece mejorar las tasas de éxito.');
    }
  } else {
    console.log('\n✅ DIAGNÓSTICO: La mayoría de las pruebas fueron exitosas.');
    console.log('   - El endpoint parece accesible con las headers adecuadas.');
  }
  
  return {
    endpoint: endpoint.name,
    url: endpoint.url,
    successRate: `${successCount}/${results.length}`,
    results
  };
}

// Función auxiliar para leer parte de un stream
async function readStream(stream, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= maxBytes) {
        stream.destroy();
        resolve(Buffer.concat(chunks).toString('utf8', 0, maxBytes));
      }
    });
    
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

// Función principal para ejecutar las pruebas
async function runTests() {
  console.log('===================================================');
  console.log('DIAGNÓSTICO DE PROBLEMAS DE STREAMING EN RENDER');
  console.log('===================================================');
  console.log(`Fecha y hora: ${new Date().toISOString()}`);
  
  // Comprobar la IP pública
  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json', {
      agent: httpsAgent,
      timeout: 5000
    });
    if (ipResponse.ok) {
      const ipData = await ipResponse.json();
      console.log(`IP pública: ${ipData.ip}`);
    }
  } catch (error) {
    console.log('No se pudo determinar la IP pública');
  }
  
  console.log('\nIniciando pruebas de acceso a endpoints...\n');
  
  const allResults = [];
  
  // Ejecutar pruebas secuencialmente
  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    allResults.push(result);
    
    // Pequeña pausa entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Reporte final
  console.log('\n===================================================');
  console.log('REPORTE FINAL');
  console.log('===================================================');
  
  let overallSuccess = 0;
  let overallTests = 0;
  
  allResults.forEach(result => {
    const [success, total] = result.successRate.split('/').map(Number);
    overallSuccess += success;
    overallTests += total;
    console.log(`${result.endpoint}: ${result.successRate} pruebas exitosas`);
  });
  
  console.log(`\nTasa de éxito global: ${overallSuccess}/${overallTests} (${Math.round(overallSuccess/overallTests*100)}%)`);
  
  // Análisis y recomendaciones
  console.log('\n===================================================');
  console.log('ANÁLISIS Y RECOMENDACIONES');
  console.log('===================================================');
  
  // Revisar sitios de control
  const controlResults = allResults.filter(r => r.endpoint.includes('Control'));
  const streamResults = allResults.filter(r => r.endpoint.includes('Stream'));
  const websiteResults = allResults.filter(r => !r.endpoint.includes('Control') && !r.endpoint.includes('Stream'));
  
  const controlSuccess = controlResults.some(r => {
    const [success, total] = r.successRate.split('/').map(Number);
    return success > 0;
  });
  
  const streamSuccess = streamResults.some(r => {
    const [success, total] = r.successRate.split('/').map(Number);
    return success > 0;
  });
  
  const websiteSuccess = websiteResults.some(r => {
    const [success, total] = r.successRate.split('/').map(Number);
    return success > 0;
  });
  
  if (!controlSuccess) {
    console.log('❌ CRÍTICO: No se puede acceder a sitios de control (Google).');
    console.log('   - Hay un problema grave de conectividad en el servidor.');
    console.log('   - Verificar configuración de red, DNS y firewall en Render.');
  } else if (!streamSuccess && !websiteSuccess) {
    console.log('❌ CRÍTICO: Se puede acceder a sitios de control pero no a streams ni sitios de deportes.');
    console.log('   - La IP de Render probablemente está bloqueada por los proveedores de streaming.');
    console.log('   - Recomendación: Implementar un proxy residencial para las solicitudes a estos servicios.');
    console.log('   - Servicios recomendados: BrightData, IPRoyal, Smartproxy, o similares.');
  } else if (!streamSuccess && websiteSuccess) {
    console.log('⚠️ PROBLEMA: Se puede acceder a sitios web deportivos pero no a streams.');
    console.log('   - Los proveedores de streams están bloqueando específicamente el acceso a los archivos m3u8.');
    console.log('   - Recomendación: Usar un proxy específico solo para las solicitudes de streams.');
    console.log('   - Considerar modificar el endpoint /proxy-stream para usar diferentes headers o IP.');
  } else if (streamSuccess && controlSuccess) {
    console.log('✅ BUENO: Se puede acceder tanto a sitios de control como a streams.');
    console.log('   - Si aún hay problemas intermitentes, considerar:');
    console.log('     1. Implementar reintentos automáticos con diferentes headers');
    console.log('     2. Añadir caché para reducir solicitudes a los proveedores');
    console.log('     3. Rotar User-Agents y Referers en cada solicitud');
  }
  
  // Recomendaciones específicas basadas en patrones de error
  if (allResults.some(r => r.results.some(test => test.error && test.error.includes('ECONNRESET')))) {
    console.log('\n⚠️ Se detectaron errores ECONNRESET:');
    console.log('   - El servidor remoto está cerrando activamente las conexiones.');
    console.log('   - Esto suele indicar bloqueo activo por comportamiento sospechoso.');
    console.log('   - Recomendación: Espaciar las solicitudes y usar diferentes IPs.');
  }
  
  if (allResults.some(r => r.results.some(test => test.status === 403))) {
    console.log('\n⚠️ Se detectaron errores 403 Forbidden:');
    console.log('   - Esto confirma que los servidores están bloqueando activamente las solicitudes.');
    console.log('   - El bloqueo podría estar basado en IP, User-Agent, o falta de Referer correcto.');
    console.log('   - Solución más efectiva: Usar un proxy residencial para todas las solicitudes.');
  }
  
  console.log('\n===================================================');
  console.log('PRÓXIMOS PASOS RECOMENDADOS');
  console.log('===================================================');
  console.log('1. Ejecutar este script tanto localmente como en Render para comparar resultados');
  console.log('2. Si Render muestra problemas pero la ejecución local funciona:');
  console.log('   - Implementar un proxy residencial para las solicitudes desde Render');
  console.log('   - Actualizar /proxy-stream para usar el proxy con las solicitudes de stream');
  console.log('3. Como solución temporal:');
  console.log('   - Crear un script que obtenga tokens localmente y los sincronice con Render');
  console.log('   - Modificar la aplicación para usar tokens pregenerados sin hacer scraping en Render');
  console.log('===================================================');
}

// Ejecutar el diagnóstico
runTests().catch(error => {
  console.error('Error en el diagnóstico:', error);
});
