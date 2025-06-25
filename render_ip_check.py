# Script para probar si un sitio específico bloquea la IP de Render
# Este script es útil para diagnosticar problemas de acceso a sitios desde Render
# Ejecutar con: curl -s https://ipinfo.io | python3 render_ip_check.py

import sys
import json
import subprocess
import time

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
    "https://google.com"  # Control - debería funcionar siempre
]

# Headers de navegador para evitar bloqueos básicos
user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"

print("Probando acceso a sitios desde esta IP...\n")

for site in sites:
    print(f"Probando: {site}")
    
    # Primer intento - con User-Agent normal
    cmd = [
        "curl", 
        "-s", 
        "-o", "/dev/null", 
        "-w", "%{http_code}", 
        "-H", f"User-Agent: {user_agent}", 
        "-m", "10",  # timeout de 10 segundos
        site
    ]
    
    try:
        start_time = time.time()
        status = subprocess.check_output(cmd).decode('utf-8').strip()
        elapsed = time.time() - start_time
        
        if status == "200":
            print(f"  ✅ ACCESIBLE (200 OK) - {elapsed:.2f}s")
        elif status == "403":
            print(f"  ⛔ BLOQUEADO (403 Forbidden) - {elapsed:.2f}s")
        else:
            print(f"  ⚠️ RESPUESTA: {status} - {elapsed:.2f}s")
        
    except subprocess.CalledProcessError as e:
        print(f"  ❌ ERROR: {str(e)}")
    except Exception as e:
        print(f"  ❌ EXCEPCIÓN: {str(e)}")
    
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
print("3. Próximos pasos:")
print("   - Implementar un servicio de proxy para eludir restricciones IP")
print("   - Considerar servicios como BrightData, Oxylabs o proxy residenciales")
print("   - Actualizar a un plan de Render con IP dedicada si es posible")
print("=====================================================")
