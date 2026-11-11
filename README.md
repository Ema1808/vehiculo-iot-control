# Aplicación Web de Control IoT · Excavadora (Mobile First)

Frontend modular e interactivo diseñado para el control en tiempo real de un vehículo robótico IoT, consumiendo servicios REST y WebSockets seguros (WSS) desplegados en Amazon EC2 y persistidos en Amazon RDS for MySQL.

## Características Técnicas
* **Arquitectura:** HTML5 semántico, CSS3, Bootstrap 5 y JavaScript modular nativo (ES6+).
* **Diseño Mobile-First:** Totalmente responsivo para smartphones (vertical/horizontal), tablets y escritorios.
* **Control Direccional:** Joystick circular táctil con Pointer Events, zona muerta y retorno automático al centro.
* **Parada de Emergencia:** Botón físico `DETENER` con prioridad absoluta.
* **Panel de 3 Estados de Conectividad:**
  * **Canal WSS:** Monitoreo activo de apertura, error, desconexión y reconexión automática.
  * **Servidor AWS:** Diagnóstico periódico mediante `GET /`.
  * **Base RDS:** Comprobación real de persistencia mediante consulta de estado `GET /vehiculos/1/estado`.
* **Rutinas DEMO:** Selección, inicio y cancelación en tiempo real, observando la secuencia emitida por WebSocket sin duplicar almacenamiento en el historial.

## Configuración y Ejecución Local
1. Clona el repositorio:
   ```bash
   git clone https://github.com/TU_USUARIO/vehiculo-iot-control.git
   cd vehiculo-iot-control
   ```
2. Ejecuta un servidor local ligero:
   ```bash
   # Con Python:
   python -m http.server 3000
   ```
3. Abre tu navegador en: `http://localhost:3000`

## Despliegue en GitHub Pages
1. Sube tu código a GitHub en la rama `main`.
2. Ve a **Settings** -> **Pages**.
3. En **Build and deployment**, selecciona la fuente **Deploy from a branch** -> Rama `main` -> Carpeta `/ (root)`.
4. Tu sitio quedará disponible bajo HTTPS en: `https://TU_USUARIO.github.io/vehiculo-iot-control/`

## Verificación Independiente por WebSocket
Puedes validar la reactividad abriendo una sesión WSS independiente en Thunder Client hacia:
`wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/1`
Al presionar cualquier botón en la Web App, observarás llegar el payload `MOVIMIENTO_INDIVIDUAL` en tiempo real.
