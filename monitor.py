import asyncio
import json
from datetime import datetime

try:
    import websockets
except ImportError:
    print("Instalando websockets...")
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

WS_URL = "wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/1"

async def escuchar_telemetria():
    print("=" * 65)
    print("🛰️  MONITOR DE TELEMETRÍA EN TIEMPO REAL · VEHÍCULO IoT")
    print(f"🔗 Conectando a: {WS_URL}")
    print("=" * 65)

    async with websockets.connect(WS_URL) as ws:
        print("✅ Conexión establecida con éxito. Esperando órdenes...\n")
        
        while True:
            try:
                mensaje_raw = await ws.recv()
                evento = json.loads(mensaje_raw)
                hora = datetime.now().strftime("%H:%M:%S")

                tipo = evento.get("tipo", "DESCONOCIDO")

                if tipo == "MOVIMIENTO_INDIVIDUAL":
                    comando = evento.get("codigo_comando")
                    id_cmd = evento.get("id_comando")
                    origen = evento.get("origen", "REMOTO")
                    print(f"[{hora}] 🎮 MOVIMIENTO RECIBIDO:")
                    print(f"       -> Comando:  {comando} (ID: {id_cmd})")
                    print(f"       -> Origen:   {origen}")
                    print("-" * 50)

                elif tipo == "DEMO_INICIO":
                    print(f"[{hora}] 🚀 DEMO INICIADA: ID {evento.get('id_demo')} ({evento.get('total_movimientos')} pasos)")
                    print("-" * 50)

                elif tipo == "DEMO_MOVIMIENTO":
                    paso = evento.get("orden")
                    total = evento.get("total")
                    cmd = evento.get("comando")
                    dur = evento.get("duracion_ms")
                    print(f"[{hora}] 🤖 [DEMO Paso {paso}/{total}]: {cmd} por {dur}ms")

                elif tipo == "DEMO_FIN":
                    print(f"[{hora}] 🏁 DEMO COMPLETADA EXITOSAMENTE")
                    print("-" * 50)

                elif tipo == "DEMO_CANCELADA":
                    print(f"[{hora}] 🛑 DEMO CANCELADA POR EL OPERADOR")
                    print("-" * 50)

                elif tipo == "CONEXION_ESTABLECIDA":
                    print(f"[{hora}] ⚡ Sesión sincronizada con vehículo #{evento.get('id_vehiculo')}")
                    print("-" * 50)

            except websockets.ConnectionClosed:
                print("\n⚠️ Conexión cerrada con el servidor. Reintentando en 3s...")
                await asyncio.sleep(3)
                break
            except Exception as e:
                print(f"Error procesando evento: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(escuchar_telemetria())
    except KeyboardInterrupt:
        print("\nMonitor detenido por el usuario.")
