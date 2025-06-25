# Pasos de diagnóstico para resolver el error 403 en Render

## Problema
La aplicación de streaming deportivo funciona perfectamente en local pero muestra error 403 en Render para todos los canales.

## Causas comunes
1. **IP bloqueada**: Los proveedores de streaming como fubohd.com bloquean IPs de centros de datos y proveedores cloud como Render.
2. **Headers incorrectos**: Los headers de las peticiones pueden no parecer de un navegador real.
3. **Problemas de CORS**: Configuración incorrecta de CORS en las peticiones.
4. **Geobloqueo**: Restricciones por localización geográfica de la IP de Render.

## Soluciones implementadas
1. **Mejora de headers**: Se han implementado headers más realistas y rotación de User-Agent.
2. **Proxy mejorado**: Se ha implementado un proxy más robusto con múltiples intentos.
3. **Diagnóstico detallado**: Se ha añadido un endpoint `/api/render-diagnostic` para diagnosticar problemas específicamente en Render.
4. **Scripts de prueba**: Se han añadido scripts para probar conexiones y detectar bloqueos de IP.

## Próximos pasos recomendados
1. **Ejecutar diagnóstico**: Acceder a `https://tu-app.onrender.com/api/render-diagnostic` para obtener un informe detallado.
2. **Verificar IP**: Ejecutar en Render: `curl -s https://ipinfo.io | python3 render_ip_check.py`
3. **Probar conexión**: Ejecutar `node test_connection.js` tanto en local como en Render para comparar resultados.

## Soluciones si se confirma bloqueo de IP
1. **Proxy externo**: Utilizar un servicio de proxy externo (BrightData, Oxylabs) para hacer las peticiones desde IPs residenciales.
2. **VPN**: Configurar una VPN en el servidor Render (más complejo).
3. **IP dedicada**: Actualizar a un plan de Render con IP dedicada.
4. **Servicio alternativo**: Migrar a otro proveedor de hosting como AWS, DigitalOcean, etc. donde es más fácil obtener nuevas IPs.

## Configuración temporal
Si identificas que el problema es la IP de Render, puedes configurar la aplicación para:
1. Obtener tokens en tu máquina local
2. Subirlos manualmente a la base de datos en Render
3. Configurar la app para usar estos tokens sin intentar scrapear directamente

Esto te permitirá mantener el servicio funcionando mientras implementas una solución definitiva.
