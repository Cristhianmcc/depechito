// Este archivo contiene un endpoint y funciones para diagnosticar problemas con la IP de Render
// Debe ser importado en server.js

const fetch = require('node-fetch');
const https = require('https');

// Configuración del agente HTTPS para ignorar problemas SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

// Sitios a probar para verificar bloqueos de IP
const sitesToTest = [
  { name: "PelotaLibre Principal", url: "https://pelotalibrehdtv.com" },
  { name: "PelotaLibre Mirror", url: "https://pelotalibre.me" },
  { name: "FutbolLibre", url: "https://futbollibre.net" },
  { name: "DirecTV Sports Stream", url: "https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8?token=test123" },
  { name: "ESPN Stream", url: "https://dglvz29s.fubohd.com/espn/mono.m3u8?token=test123" },
  { name: "ESPN Premium Stream", url: "https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8?token=test123" },
  { name: "PelotaLibre ESPN4 Page", url: "https://www.pelotalibrehdtv.com/pelota/espn-4/" },
  { name: "PelotaLibre ESPN Premium Page", url: "https://www.pelotalibrehdtv.com/pelota/espn-premium/" },
  { name: "Google (Control)", url: "https://www.google.com" },
  { name: "Cloudflare (Control)", url: "https://cloudflare.com" }
];

// Headers de navegador para evitar bloqueos básicos
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Lista de referers para probar
const REFERERS = [
  'https://pelotalibrehdtv.com/',
  'https://www.pelotalibrehdtv.com/',
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://futbollibre.net/'
];

// Función para obtener un User-Agent aleatorio
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Función para obtener un Referer aleatorio
function getRandomReferer() {
  return REFERERS[Math.floor(Math.random() * REFERERS.length)];
}

/**
 * Realiza diagnóstico completo del servidor y la conectividad
 */
async function runFullDiagnostic() {
  console.log('Ejecutando diagnóstico completo del servidor...');
  
  try {
    // Paso 1: Obtener información sobre la IP pública
    const ipInfo = await getPublicIpInfo();
    
    // Paso 2: Probar conexión a sitios importantes
    const connectionTests = await testConnections();
    
    // Paso 3: Probar obtención de tokens
    const tokenTests = await testTokenExtraction();
    
    // Paso 4: Análisis y recomendaciones
    const recommendations = generateRecommendations(ipInfo, connectionTests, tokenTests);
    
    return {
      timestamp: new Date().toISOString(),
      ipInfo,
      connectionTests,
      tokenTests,
      recommendations
    };
  } catch (error) {
    console.error('Error durante el diagnóstico:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Obtiene información sobre la IP pública del servidor
 */
async function getPublicIpInfo() {
  try {
    const response = await fetch('https://ipinfo.io/json', {
      agent: httpsAgent,
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener información de IP: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al obtener información de IP:', error);
    return { error: error.message };
  }
}

/**
 * Prueba la conexión a diferentes sitios
 */
async function testConnections() {
  const results = [];
  
  for (const site of sitesToTest) {
    console.log(`Probando conexión a ${site.name}: ${site.url}`);
    
    const siteResult = {
      name: site.name,
      url: site.url,
      tests: []
    };
    
    let overallSuccess = false;
    
    // Probar con diferentes User-Agents y Referers
    for (let i = 0; i < 2; i++) { // Limitar a 2 intentos para no sobrecargar
      const userAgent = USER_AGENTS[i % USER_AGENTS.length];
      const referer = REFERERS[i % REFERERS.length];
      
      try {
        const startTime = Date.now();
        const response = await fetch(site.url, {
          agent: httpsAgent,
          headers: {
            'User-Agent': userAgent,
            'Referer': referer,
            'Origin': new URL(referer).origin,
            'Accept': '*/*'
          },
          timeout: 10000,
          method: 'HEAD' // Solo obtener headers para verificar accesibilidad
        });
        
        const elapsedTime = Date.now() - startTime;
        
        siteResult.tests.push({
          userAgent: userAgent.substring(0, 30) + '...',
          referer,
          status: response.status,
          statusText: response.statusText,
          elapsedTime,
          success: response.ok
        });
        
        if (response.ok) {
          overallSuccess = true;
          break; // Si hay éxito, no hacer más pruebas
        }
      } catch (error) {
        siteResult.tests.push({
          userAgent: userAgent.substring(0, 30) + '...',
          referer,
          error: error.message
        });
      }
    }
    
    siteResult.success = overallSuccess;
    results.push(siteResult);
  }
  
  return results;
}

/**
 * Prueba la extracción de tokens de páginas específicas
 */
async function testTokenExtraction() {
  const results = [];
  const testPages = sitesToTest.filter(site => 
    site.url.includes('pelotalibrehdtv.com/pelota/') || 
    site.url.includes('futbollibre.net')
  );
  
  for (const page of testPages) {
    console.log(`Probando extracción de token desde ${page.name}: ${page.url}`);
    
    const pageResult = {
      name: page.name,
      url: page.url,
      tokenFound: false,
      content: null
    };
    
    try {
      // Usar un User-Agent aleatorio y Referer
      const userAgent = getRandomUserAgent();
      const referer = getRandomReferer();
      
      const response = await fetch(page.url, {
        agent: httpsAgent,
        headers: {
          'User-Agent': userAgent,
          'Referer': referer,
          'Origin': new URL(referer).origin,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 15000
      });
      
      if (!response.ok) {
        pageResult.error = `Error ${response.status}: ${response.statusText}`;
        results.push(pageResult);
        continue;
      }
      
      const html = await response.text();
      pageResult.contentLength = html.length;
      
      // Extractos relevantes para debugging
      pageResult.snippet = html.substring(0, 200) + '...';
      
      // Buscar tokens en el HTML
      const tokenMatch = html.match(/[?&]token=([^&"']+)/);
      if (tokenMatch) {
        pageResult.tokenFound = true;
        pageResult.token = tokenMatch[1];
      }
      
      // Buscar URLs de streams
      const m3u8Match = html.match(/https?:[^"'\s]+\.m3u8[^"'\s]*/i);
      if (m3u8Match) {
        pageResult.streamUrl = m3u8Match[0];
      }
      
      // Verificar si hay mensajes de bloqueo
      pageResult.possiblyBlocked = html.includes('Access denied') || 
                                  html.includes('Forbidden') || 
                                  html.includes('Cloudflare') ||
                                  html.includes('captcha');
    } catch (error) {
      pageResult.error = error.message;
    }
    
    results.push(pageResult);
  }
  
  return results;
}

/**
 * Genera recomendaciones basadas en los resultados
 */
function generateRecommendations(ipInfo, connectionTests, tokenTests) {
  const recommendations = [];
  
  // Verificar si los sitios de control funcionan
  const controlSites = connectionTests.filter(test => test.name.includes('Control'));
  const controlsWorking = controlSites.some(site => site.success);
  
  // Verificar si los sitios de streaming funcionan
  const streamingSites = connectionTests.filter(test => 
    test.url.includes('fubohd.com') || 
    test.url.includes('.m3u8')
  );
  const streamingsWorking = streamingSites.some(site => site.success);
  
  // Verificar si las páginas web funcionan
  const webSites = connectionTests.filter(test => 
    (test.url.includes('pelotalibrehdtv.com') || test.url.includes('futbollibre.net')) && 
    !test.url.includes('.m3u8')
  );
  const websitesWorking = webSites.some(site => site.success);
  
  // Verificar si se encontraron tokens
  const tokensFound = tokenTests.some(test => test.tokenFound);
  
  // Generar recomendaciones basadas en los resultados
  if (!controlsWorking) {
    recommendations.push({
      severity: 'critical',
      issue: 'Conectividad general',
      description: 'No se puede acceder a sitios de control (Google, Cloudflare)',
      recommendation: 'Verificar la conectividad de red general en Render, puede haber un problema con DNS o firewall.'
    });
  } else if (!websitesWorking) {
    recommendations.push({
      severity: 'high',
      issue: 'Acceso bloqueado a sitios web',
      description: 'Los sitios web de streaming están bloqueando el acceso desde la IP de Render',
      recommendation: 'Implementar un proxy residencial para todas las solicitudes a estos sitios.'
    });
  } else if (websitesWorking && !streamingsWorking) {
    recommendations.push({
      severity: 'high',
      issue: 'Acceso bloqueado solo a streams',
      description: 'Se puede acceder a los sitios web pero no a los archivos de stream directamente',
      recommendation: 'Implementar proxy solo para solicitudes a archivos .m3u8 y considerar cambiar los dominios de los proxies.'
    });
  }
  
  if (websitesWorking && !tokensFound) {
    recommendations.push({
      severity: 'medium',
      issue: 'No se pueden extraer tokens',
      description: 'Se puede acceder a los sitios pero no se detectan tokens en el contenido',
      recommendation: 'Es posible que la estructura de las páginas haya cambiado. Actualizar el código de scraping.'
    });
  }
  
  // Recomendación basada en la organización de la IP
  if (ipInfo && ipInfo.org && (
      ipInfo.org.toLowerCase().includes('amazon') || 
      ipInfo.org.toLowerCase().includes('render') || 
      ipInfo.org.toLowerCase().includes('cloud')
  )) {
    recommendations.push({
      severity: 'medium',
      issue: 'IP de centro de datos detectada',
      description: `La IP pertenece a: ${ipInfo.org}`,
      recommendation: 'Los sitios de streaming suelen bloquear IPs de proveedores cloud. Considere usar proxies residenciales.'
    });
  }
  
  // Añadir recomendaciones específicas según los resultados
  if (recommendations.length === 0 && streamingsWorking) {
    recommendations.push({
      severity: 'low',
      issue: 'No se detectaron problemas graves',
      description: 'La mayoría de los recursos parecen estar accesibles',
      recommendation: 'Los errores podrían ser temporales o específicos de algunas URLs. Monitorear y ajustar según sea necesario.'
    });
  } else if (recommendations.length === 0) {
    recommendations.push({
      severity: 'medium',
      issue: 'Resultados mixtos',
      description: 'No se identificó un patrón claro de error',
      recommendation: 'Revisar logs del servidor y errores específicos en la consola del navegador para diagnosticar mejor.'
    });
  }
  
  return recommendations;
}

// Exportar funciones para usar en server.js
module.exports = {
  runFullDiagnostic,
  getPublicIpInfo,
  testConnections,
  testTokenExtraction
};
