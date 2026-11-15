import { CONFIG } from "./config.js";
import { vehicleService } from "./api/vehicleService.js";
import { wsClient } from "./ws/wsClient.js";
import { StatusPanel } from "./components/statusPanel.js";
import { VirtualJoystick } from "./components/joystick.js";
import { ActionButtons } from "./components/actionButtons.js";
import { DemoController } from "./components/demoController.js";
import { Navigation } from "./components/navigation.js";
import { MonitoringView } from "./components/monitoringView.js";
import { AdminView } from "./components/adminView.js";

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

    // 1. Componentes de la vista de Control (Práctica 4.1)
    this.demoController = new DemoController(
      this.handleStartDemo.bind(this),
      this.handleCancelDemo.bind(this)
    );
    this.actionButtons = new ActionButtons(this.handleCommandName.bind(this));
    this.joystick = new VirtualJoystick("joystick-base", "joystick-knob", this.handleJoystickDirection.bind(this));

    // 2. Componente de la vista de Monitoreo (Práctica 4.2)
    this.monitoringView = new MonitoringView();

    // 3. Componente de la vista de Administración y RBAC (Práctica 4.3)
    this.adminView = new AdminView(
      this.handleAuthChange.bind(this),
      this.handleSelectVehicle.bind(this)
    );

    // 4. Gestor de Navegación entre las 3 Vistas
    this.navigation = new Navigation(this.handleViewChange.bind(this));
  }

  async init() {
    console.log("Iniciando aplicación integral IoT: Control, Monitoreo y Administración...");
    this._updateVehicleHeader();
    this.updateAuthUI();

    this._bindGlobalEvents();
    this._bindAuthEvents();
    this._setupWebSocket();
    await this._loadInitialData();
    await this.monitoringView.loadAll();
    this._startHealthPolling();
  }

  _updateVehicleHeader() {
    const lbl = document.getElementById("txt-vehicle-id");
    if (lbl) {
      lbl.textContent = `${CONFIG.VEHICLE_NAME} · ID: ${CONFIG.VEHICLE_ID}`;
    }
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

  _bindAuthEvents() {
    // 1. Envío del formulario de Login
    const formLogin = document.getElementById("form-login");
    const errBox = document.getElementById("login-error-msg");
    const btnSubmit = document.getElementById("btn-login-submit");

    if (formLogin) {
      formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("input-email").value.trim();
        const pass = document.getElementById("input-password").value.trim();

        if (errBox) errBox.classList.add("d-none");
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Autenticando...`;
        }

        try {
          const res = await vehicleService.login(email, pass);
          this.updateAuthUI();
          this._closeAuthModal();
          this.adminView.load();
          wsClient.reconnectWithAuth();

          this.statusPanel.setActionMessage(`Sesión iniciada: ${res.user.nombre_completo} (${res.user.rol})`, "AUTH OK", "bg-success");
        } catch (err) {
          if (errBox) {
            errBox.textContent = `Error: ${err.message}`;
            errBox.classList.remove("d-none");
          }
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sesión`;
          }
        }
      });
    }

    // 2. Botones de acceso rápido para demostración
    document.querySelectorAll(".btn-quick-role").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const email = btn.dataset.email;
        const pass = btn.dataset.pass;
        const inputEmail = document.getElementById("input-email");
        const inputPass = document.getElementById("input-password");
        if (inputEmail) inputEmail.value = email;
        if (inputPass) inputPass.value = pass;
        if (formLogin) {
          formLogin.dispatchEvent(new Event("submit"));
        }
      });
    });

    // 3. Botón de cierre de sesión
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        await vehicleService.logout();
        this.updateAuthUI();
        this._closeAuthModal();
        this.adminView.load();
        wsClient.reconnectWithAuth();

        this.statusPanel.setActionMessage("Sesión cerrada. Acceso público restringido.", "LOGOUT", "bg-secondary");
      });
    }
  }

  _closeAuthModal() {
    const modalEl = document.getElementById("modal-auth");
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
      const modalInstance = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
      modalInstance.hide();
    }
  }

  updateAuthUI() {
    const user = vehicleService.getCurrentUser();
    const lblUserName = document.getElementById("lbl-user-name");
    const btnAuth = document.getElementById("btn-auth-user");
    const formBox = document.getElementById("auth-form-container");
    const profileBox = document.getElementById("auth-profile-container");

    if (user) {
      if (lblUserName) lblUserName.textContent = `${user.nombre_completo.split(" ")[0]} (${user.rol.substring(0, 3)})`;
      if (btnAuth) {
        btnAuth.className = "btn btn-sm btn-outline-success d-flex align-items-center gap-1 rounded-pill px-3";
      }
      if (formBox) formBox.classList.add("d-none");
      if (profileBox) {
        profileBox.classList.remove("d-none");
        document.getElementById("profile-name").textContent = user.nombre_completo;
        document.getElementById("profile-email").textContent = user.email;
        const badgeRole = document.getElementById("profile-role");
        if (badgeRole) {
          badgeRole.textContent = `ROL: ${user.rol}`;
          badgeRole.className = `badge px-3 py-2 text-uppercase mb-3 ${user.rol === "ADMINISTRADOR" ? "bg-danger" : user.rol === "USUARIO" ? "bg-primary" : "bg-warning text-dark"}`;
        }
      }
    } else {
      if (lblUserName) lblUserName.textContent = "Iniciar Sesión";
      if (btnAuth) {
        btnAuth.className = "btn btn-sm btn-outline-info d-flex align-items-center gap-1 rounded-pill px-3";
      }
      if (formBox) formBox.classList.remove("d-none");
      if (profileBox) profileBox.classList.add("d-none");
    }
  }

  handleAuthChange() {
    this.updateAuthUI();
    this.adminView.load();
  }

  handleSelectVehicle(idVehiculo, vehicleName) {
    CONFIG.VEHICLE_ID = Number(idVehiculo);
    CONFIG.VEHICLE_NAME = vehicleName || `Vehículo #${idVehiculo}`;
    this._updateVehicleHeader();

    // Actualizar conexión WebSocket al canal del nuevo vehículo
    const newWsUrl = `wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/${idVehiculo}`;
    wsClient.setUrl(newWsUrl);

    // Sincronizar catálogo y vistas
    this._loadInitialData();
    this.monitoringView.loadAll();

    this.statusPanel.setActionMessage(`Operando ahora: ${CONFIG.VEHICLE_NAME}`, "VEHÍCULO", "bg-primary");

    // Cambiar automáticamente a la vista de Control para operar el vehículo seleccionado
    this.navigation.switchView("control");
  }

  _setupWebSocket() {
    wsClient.onStatusChange(status => {
      this.statusPanel.setWsStatus(status);
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
      this.monitoringView.loadAll();
    } else if (viewName === "administracion") {
      this.adminView.load();
    }
  }

  async _loadInitialData() {
    try {
      this.statusPanel.setActionMessage("Cargando catálogo de comandos desde AWS...", "CARGANDO", "bg-warning");
      const comandos = await vehicleService.getComandos(CONFIG.VEHICLE_ID);
      comandos.forEach(c => this.catalogMap.set(c.nombre, c.id_comando));

      const demos = await vehicleService.getDemos(CONFIG.VEHICLE_ID);
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
      await vehicleService.checkRdsConnection(CONFIG.VEHICLE_ID);
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

    if (this.isSending) return;
    this.isSending = true;

    try {
      this.statusPanel.setActionMessage(`Transmitiendo: ${commandName}...`, "ENVIANDO", "bg-warning");
      const res = await vehicleService.enviarMovimiento(idComando, "WEB-CONTROL", CONFIG.VEHICLE_ID);
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
      await vehicleService.iniciarDemo(idDemo, CONFIG.VEHICLE_ID);
    } catch (e) {
      this.statusPanel.setActionMessage(`Error al iniciar DEMO: ${e.message}`, "ERROR", "bg-danger");
    }
  }

  async handleCancelDemo() {
    try {
      this.statusPanel.setActionMessage("Cancelando DEMO en curso...", "CANCELANDO", "bg-warning");
      await vehicleService.cancelarDemo(CONFIG.VEHICLE_ID);
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
