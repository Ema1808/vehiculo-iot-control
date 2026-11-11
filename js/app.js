import { CONFIG } from "./config.js";
import { vehicleService } from "./api/vehicleService.js";
import { wsClient } from "./ws/wsClient.js";
import { StatusPanel } from "./components/statusPanel.js";
import { VirtualJoystick } from "./components/joystick.js";
import { ActionButtons } from "./components/actionButtons.js";
import { DemoController } from "./components/demoController.js";
import { Navigation } from "./components/navigation.js";
import { MonitoringView } from "./components/monitoringView.js";

class App {
  constructor() {
    this.statusPanel = new StatusPanel();

    // Catálogo precargado por defecto para tolerancia a fallos y respuesta inmediata
    this.catalogMap = new Map([
      ["AVANZAR", 1],
      ["RETROCEDER", 2],
      ["GIRAR_IZQUIERDA", 3],
      ["GIRAR_DERECHA", 4],
      ["SUBIR_BRAZO", 5],
      ["BAJAR_BRAZO", 6],
      ["ABRIR_PALA", 7],
      ["CERRAR_PALA", 8],
      ["DETENER", 9]
    ]);
    this.isSending = false;

    // Componentes de la vista de Control
    this.demoController = new DemoController(
      this.handleStartDemo.bind(this),
      this.handleCancelDemo.bind(this)
    );
    this.actionButtons = new ActionButtons(this.handleCommandName.bind(this));
    this.joystick = new VirtualJoystick("joystick-base", "joystick-knob", this.handleJoystickDirection.bind(this));

    // Componente de la vista de Monitoreo
    this.monitoringView = new MonitoringView();

    // Gestor de Navegación entre Vistas
    this.navigation = new Navigation(this.handleViewChange.bind(this));
  }

  async init() {
    console.log("Iniciando aplicación de control y monitoreo IoT...");
    document.getElementById("txt-vehicle-id").textContent = `${CONFIG.VEHICLE_NAME} · ID: ${CONFIG.VEHICLE_ID}`;

    this._bindGlobalEvents();
    this._setupWebSocket();
    await this._loadInitialData();
    await this.monitoringView.loadAll(); // Carga inicial de monitoreo
    this._startHealthPolling();
  }

  _bindGlobalEvents() {
    // Botón de parada de emergencia (Prioridad absoluta)
    const btnStop = document.getElementById("btn-stop-emergency");
    if (btnStop) {
      btnStop.addEventListener("click", () => this.handleCommandName("DETENER"));
    }

    // Botón refrescar diagnósticos, catálogo e historial
    const btnRefresh = document.getElementById("btn-refresh-status");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        this._runDiagnostics();
        this._loadInitialData();
        this.monitoringView.loadAll();
        wsClient.connect();
      });
    }
  }

  _setupWebSocket() {
    wsClient.onStatusChange(status => {
      this.statusPanel.setWsStatus(status);
      // Al reconectar exitosamente, resincronizar estado e historial con la API REST
      if (status === "ONLINE") {
        this.monitoringView.loadAll();
      }
    });

    wsClient.on("CONEXION_ESTABLECIDA", data => {
      this.statusPanel.setActionMessage("Canal WSS sincronizado con telemetría en vivo.", "EN LÍNEA", "bg-info");
      this.monitoringView.loadAll();
    });

    // Escuchar movimientos individuales en tiempo real desde cualquier dispositivo
    wsClient.on("MOVIMIENTO_INDIVIDUAL", data => {
      const origen = data.origen || "REMOTO";
      const comando = data.comando || data.codigo_comando;
      const codigo = data.codigo || data.id_comando;
      this.statusPanel.setActionMessage(`📡 En vivo: ${comando} (ID: ${codigo}) desde ${origen}`, "TELEMETRÍA", "bg-primary");
      
      // Actualizar tarjeta y tabla en la vista de monitoreo
      this.monitoringView.handleWsMovimiento(data);
    });

    // Eventos de DEMO autónoma
    wsClient.on("DEMO_INICIO", data => {
      this.demoController.onDemoStart(data);
    });

    wsClient.on("DEMO_MOVIMIENTO", data => {
      this.demoController.onDemoStep(data);
      this.monitoringView.handleWsDemoMovimiento(data);
    });

    wsClient.on("DEMO_FIN", () => {
      this.demoController.onDemoEnd();
      this.monitoringView.handleWsDemoFin();
    });

    wsClient.on("DEMO_CANCELADA", () => {
      this.demoController.onDemoCancel();
      this.monitoringView.handleWsDemoFin();
    });

    // Iniciar conexión WSS
    wsClient.connect();
  }

  handleViewChange(viewName) {
    if (viewName === "monitoreo") {
      // Sincronizar datos frescos desde Amazon RDS al entrar a monitoreo
      this.monitoringView.loadAll();
    }
  }

  async _loadInitialData() {
    try {
      this.statusPanel.setActionMessage("Cargando catálogo de comandos desde AWS...", "CARGANDO", "bg-warning");
      const comandos = await vehicleService.getComandos();
      comandos.forEach(c => this.catalogMap.set(c.nombre, c.id_comando));

      const demos = await vehicleService.getDemos();
      this.demoController.populateDemos(demos);

      this.statusPanel.setActionMessage("Catálogo sincronizado. Listo para operar.", "LISTO", "bg-success");
      await this._runDiagnostics();
    } catch (e) {
      this.statusPanel.setActionMessage(`Falla al cargar catálogo: ${e.message}`, "ERROR", "bg-danger");
      this.statusPanel.setApiStatus("OFFLINE");
      this.statusPanel.setRdsStatus("OFFLINE");
    }
  }

  async _runDiagnostics() {
    // 1. Diagnóstico de la API en EC2
    try {
      await vehicleService.checkApiHealth();
      this.statusPanel.setApiStatus("ONLINE");
    } catch (e) {
      this.statusPanel.setApiStatus("OFFLINE");
    }

    // 2. Diagnóstico de la Base de Datos RDS
    try {
      await vehicleService.checkRdsConnection();
      this.statusPanel.setRdsStatus("ONLINE");
    } catch (e) {
      this.statusPanel.setRdsStatus("OFFLINE");
    }
  }

  _startHealthPolling() {
    setInterval(() => this._runDiagnostics(), CONFIG.POLLING_HEALTH_MS);
  }

  handleJoystickDirection(direction) {
    if (direction === "NEUTRAL") {
      this.handleCommandName("DETENER");
      return;
    }
    this.handleCommandName(direction);
  }

  async handleCommandName(commandName) {
    const idComando = this.catalogMap.get(commandName);
    if (!idComando) {
      this.statusPanel.setActionMessage(`Comando no reconocido: ${commandName}`, "ERROR", "bg-danger");
      return;
    }

    if (this.isSending) return; // Evitar colisiones de POST concurrentes
    this.isSending = true;

    try {
      this.statusPanel.setActionMessage(`Transmitiendo: ${commandName}...`, "ENVIANDO", "bg-warning");
      const res = await vehicleService.enviarMovimiento(idComando, "WEB-CONTROL");
      this.statusPanel.setActionMessage(`Ejecutado: ${commandName} (ID: ${idComando})`, "OK", "bg-success");
    } catch (e) {
      this.statusPanel.setActionMessage(`Error al emitir ${commandName}: ${e.message}`, "FALLO", "bg-danger");
    } finally {
      this.isSending = false;
    }
  }

  async handleStartDemo(idDemo) {
    try {
      this.statusPanel.setActionMessage(`Iniciando DEMO #${idDemo}...`, "INICIANDO", "bg-info");
      await vehicleService.iniciarDemo(idDemo);
    } catch (e) {
      this.statusPanel.setActionMessage(`Error al iniciar DEMO: ${e.message}`, "ERROR", "bg-danger");
    }
  }

  async handleCancelDemo() {
    try {
      this.statusPanel.setActionMessage("Cancelando DEMO en curso...", "CANCELANDO", "bg-warning");
      await vehicleService.cancelarDemo();
      this.handleCommandName("DETENER");
    } catch (e) {
      this.statusPanel.setActionMessage(`Error al cancelar DEMO: ${e.message}`, "ERROR", "bg-danger");
    }
  }
}

// Iniciar aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
