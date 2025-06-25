# Script para probar si un sitio específico bloquea la IP de Render
# Este script es útil para diagnosticar problemas de acceso a sitios desde Render
# Ejecutar con: curl -s https://ipinfo.io | python3 render_ip_check.py

import sys
import json
import subprocess
import time
import random
import re

# Obtener la información de IP desde stdin (piped desde curl)
ip_info = json.load(sys.stdin)

print("=====================================================")
print("DIAGNÓSTICO DE BLOQUEO DE IP EN RENDER")
print("=====================================================")
print(f"IP: {ip_info.get('ip', 'Desconocida')}")
print(f"Ubicación: {ip_info.get('city', 'Desconocida')}, {ip_info.get('region', '')}, {ip_info.get('country', '')}")
print(f"Organización: {ip_info.get('org', 'Desconocida')}")
print("=====================================================\n")

# Lista de sitios a probar
sites = [
    "https://pelotalibrehdtv.com",
    "https://pelotalibre.me",
    "https://futbollibre.net",
    "https://Y2FzdGxl.fubohd.com/dsports/mono.m3u8?token=test123",
    "https://dglvz29s.fubohd.com/espn/mono.m3u8?token=test123",
    "https://aGl2ZQ.fubohd.com/espnpremium/mono.m3u8?token=test123",
    "https://www.pelotalibrehdtv.com/pelota/espn-4/", # Página específica para extracción de tokens
    "https://www.pelotalibrehdtv.com/pelota/espn-premium/", # Otra página importante
    "https://google.com",  # Control - debería funcionar siempre
    "https://cloudflare.com"  # Otro control
]

# Headers de navegador para evitar bloqueos básicos
user_agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

# Lista de referers para probar
referers = [
    "https://pelotalibrehdtv.com/",
    "https://www.pelotalibrehdtv.com/",
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://futbollibre.net/"
]

print("Probando acceso a sitios desde esta IP...\n")

for site in sites:
    print(f"Probando: {site}")
    
    success = False
    
    # Probar con diferentes User-Agents y Referers
    for i, user_agent in enumerate(user_agents[:3]):  # Limitamos a 3 intentos para no hacer demasiadas peticiones
        referer = random.choice(referers)
        print(f"  Intento {i+1} con User-Agent: {user_agent[:30]}... Referer: {referer}")
        
        # Primer intento - solicitud HEAD para comprobar accesibilidad
        cmd = [
            "curl", 
            "-s", 
            "-I",  # Solo cabeceras
            "-o", "/dev/null", 
            "-w", "%{http_code}", 
            "-H", f"User-Agent: {user_agent}", 
            "-H", "Accept: */*",
            "-H", f"Origin: {referer}",
            "-H", f"Referer: {referer}",
            "-m", "10",  # timeout de 10 segundos
            site
        ]
        
        try:
            start_time = time.time()
            status = subprocess.check_output(cmd).decode('utf-8').strip()
            elapsed = time.time() - start_time
            
            if status == "200":
                print(f"    ✅ ACCESIBLE (200 OK) - {elapsed:.2f}s")
                
                # Si es una URL que podría contener tokens, intentar extraer contenido
                if "pelotalibrehdtv.com/pelota/" in site:
                    print("    🔍 Comprobando contenido para extracción de token...")
                    get_cmd = [
                        "curl", 
                        "-s",
                        "-H", f"User-Agent: {user_agent}", 
                        "-H", "Accept: */*",
                        "-H", f"Origin: {referer}",
                        "-H", f"Referer: {referer}",
                        "-m", "20",
                        site
                    ]
                    
                    try:
                        content = subprocess.check_output(get_cmd).decode('utf-8', errors='ignore')
                        content_snippet = content[:200] + "..." if len(content) > 200 else content
                        
                        # Comprobar si el contenido contiene señales de bloqueo
                        if "Access denied" in content or "Forbidden" in content:
                            print(f"    ⛔ Contenido bloqueado: {content_snippet}")
                        elif "m3u8" in content and "token" in content:
                            print(f"    ✅ Token detectado en el contenido")
                            # Intenta extraer token y URL del stream
                            token_match = re.search(r'token=([^&"\']+)', content)
                            if token_match:
                                print(f"    💎 Token encontrado: {token_match.group(1)}")
                        else:
                            print(f"    ⚠️ No se encontró token en el contenido: {content_snippet}")
                    except Exception as e:
                        print(f"    ❌ Error al obtener contenido: {str(e)}")
                
                success = True
                break  # Si hay éxito, no probar más User-Agents
            elif status == "403":
                print(f"    ⛔ BLOQUEADO (403 Forbidden) - {elapsed:.2f}s")
            else:
                print(f"    ⚠️ RESPUESTA: {status} - {elapsed:.2f}s")
            
        except subprocess.CalledProcessError as e:
            print(f"    ❌ ERROR: {str(e)}")
        except Exception as e:
            print(f"    ❌ EXCEPCIÓN: {str(e)}")
    
    if not success:
        print("  ❌ Todos los intentos fallaron.")
    
    print("")

print("\n=====================================================")
print("DIAGNÓSTICO Y RECOMENDACIONES")
print("=====================================================")
print("1. Si los sitios de streaming (pelotalibre, fubohd) dan 403 pero Google funciona:")
print("   - La IP de Render probablemente está en lista negra de estos sitios")
print("   - Solución: Implementar un proxy externo o VPN para las peticiones")
print("")
print("2. Si todos los sitios dan error (incluso Google):")
print("   - Posible problema de red en el servidor de Render")
print("   - Revisar configuración de red y firewall en Render")
print("")
print("3. Errores JSON.parse detectados en cliente:")
print("   - Esto indica que el servidor no está devolviendo JSON válido")
print("   - Es posible que algún servicio esté devolviendo HTML de error en lugar de JSON")
print("   - Verificar que los endpoints de la API devuelvan el formato correcto")
print("   - Añadir try/catch en las respuestas de los endpoints para siempre devolver JSON")
print("")
print("4. Si se puede acceder a las páginas pero no se detectan tokens:")
print("   - La estructura de la página puede haber cambiado")
print("   - Los tokens pueden estar siendo generados de manera diferente")
print("   - Actualizar el código de scraping para adaptarse a los cambios")
print("")
print("5. Próximos pasos recomendados:")
print("   - Implementar un servicio de proxy para eludir restricciones IP")
print("   - Considerar servicios como BrightData, Oxylabs o proxy residenciales")
print("   - Para uso personal/educativo, un servicio como IPRoyal o Smartproxy puede ser más económico")
print("   - Actualizar a un plan de Render con IP dedicada si es posible")
print("   - Configurar respuestas CORS adecuadas para evitar problemas de origen cruzado")
print("")
print("6. Solución temporal:")
print("   - Ejecutar la aplicación en local para obtener tokens")
print("   - Transferir manualmente estos tokens a la base de datos en Render")
print("   - Configurar la app para usar estos tokens sin hacer scraping")
print("   - Crear un script que sincronice los tokens entre tu máquina local y Render")
print("")
print("7. Mejoras de resiliencia:")
print("   - Implementar un sistema de rotación de User-Agent y Referer en cada solicitud")
print("   - Añadir reintentos automáticos con diferentes headers para cada solicitud")
print("   - Mejorar el manejo de errores para capturar y registrar todos los problemas")
print("   - Considerar un sistema de caché para reducir solicitudes a los sitios de streaming")
print("=====================================================")
