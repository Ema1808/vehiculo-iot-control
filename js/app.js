import { CONFIG } from "./config.js";
import { vehicleService } from "./api/vehicleService.js";
import { wsClient } from "./ws/wsClient.js";
import { StatusPanel } from "./components/statusPanel.js";
import { VirtualJoystick } from "./components/joystick.js";
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
      ["DETENER", 9],
      ["LUCES", 25],
      ["SONIDO", 26]
    ]);
    this.isSending = false;

    // Estados de Sonido y Luz
    this.isSoundOn = false;
    this.isLightOn = false;
    this.audioCtx = null;
    this.soundOsc = null;
    this.soundGain = null;

    // 1. Control de Rutinas DEMO
    this.demoController = new DemoController(
      this.handleStartDemo.bind(this),
      this.handleCancelDemo.bind(this)
    );

    // 2. Cabina Dual Joystick Táctil (Izquierdo: Dirección | Derecho: Brazo y Pala)
    this.joystickDrive = new VirtualJoystick(
      "joystick-base",
      "joystick-knob",
      "lbl-joystick-dir",
      {
        up: "AVANZAR",
        down: "RETROCEDER",
        left: "GIRAR_IZQUIERDA",
        right: "GIRAR_DERECHA"
      },
      this.handleJoystickDirection.bind(this)
    );

    this.joystickActuators = new VirtualJoystick(
      "joystick-act-base",
      "joystick-act-knob",
      "lbl-joystick-act-dir",
      {
        up: "SUBIR_BRAZO",
        down: "BAJAR_BRAZO",
        left: "ABRIR_PALA",
        right: "CERRAR_PALA"
      },
      this.handleJoystickDirection.bind(this),
      {
        "NEUTRAL": "NEUTRAL",
        "SUBIR_BRAZO": "SUBIR BRAZO",
        "BAJAR_BRAZO": "BAJAR BRAZO",
        "ABRIR_PALA": "GIRO CARRO IZQ",
        "CERRAR_PALA": "GIRO CARRO DER"
      }
    );

    // 3. Vista de Monitoreo
    this.monitoringView = new MonitoringView();

    // 4. Vista de Administración y RBAC
    this.adminView = new AdminView(
      this.handleAuthChange.bind(this),
      this.handleSelectVehicle.bind(this)
    );

    // 5. Gestor de Navegación entre las 3 Vistas
    this.navigation = new Navigation(this.handleViewChange.bind(this));
  }

  async init() {
    console.log("Iniciando cabina IoT con Dual Joystick, Luz y Sonido...");
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
      lbl.textContent = `ID: ${CONFIG.VEHICLE_ID}`;
    }
  }

  _bindGlobalEvents() {
    // Botón de parada de emergencia (Prioridad absoluta)
    const btnStop = document.getElementById("btn-stop-emergency");
    if (btnStop) {
      btnStop.addEventListener("click", () => this.handleCommandName("DETENER"));
    }

    // Botón Activar / Desactivar Sonido de la excavadora
    const btnSound = document.getElementById("btn-toggle-sound");
    if (btnSound) {
      btnSound.addEventListener("click", () => this.handleToggleSound());
    }

    // Botón Encender / Apagar Luz
    const btnLight = document.getElementById("btn-toggle-light");
    if (btnLight) {
      btnLight.addEventListener("click", () => this.handleToggleLight());
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

  handleToggleSound() {
    this.isSoundOn = !this.isSoundOn;
    const btn = document.getElementById("btn-toggle-sound");
    const icon = document.getElementById("icon-sound");
    const lbl = document.getElementById("lbl-sound-status");

    if (this.isSoundOn) {
      this._startEngineAudio();
      if (btn) btn.className = "btn btn-info text-dark flex-fill py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-glow-cyan";
      if (icon) icon.className = "bi bi-volume-up-fill fs-6";
      if (lbl) lbl.textContent = "Sonido: ON";
      this.statusPanel.setActionMessage("Sonido de motor activado", "SONIDO ON", "bg-info text-dark");
    } else {
      this._stopEngineAudio();
      if (btn) btn.className = "btn btn-outline-info flex-fill py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm";
      if (icon) icon.className = "bi bi-volume-mute-fill fs-6";
      if (lbl) lbl.textContent = "Sonido: OFF";
      this.statusPanel.setActionMessage("Sonido desactivado", "SONIDO OFF", "bg-secondary");
    }

    this.handleCommandName("SONIDO");
  }

  _startEngineAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      this._stopEngineAudio();

      this.soundOsc = this.audioCtx.createOscillator();
      this.soundGain = this.audioCtx.createGain();

      this.soundOsc.type = "sawtooth";
      this.soundOsc.frequency.setValueAtTime(60, this.audioCtx.currentTime); // ~60 Hz motor diésel
      this.soundGain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);

      this.soundOsc.connect(this.soundGain);
      this.soundGain.connect(this.audioCtx.destination);
      this.soundOsc.start();
    } catch (e) {
      console.warn("Audio synthesis:", e);
    }
  }

  _stopEngineAudio() {
    if (this.soundOsc) {
      try {
        this.soundOsc.stop();
        this.soundOsc.disconnect();
      } catch (_) {}
      this.soundOsc = null;
    }
  }

  handleToggleLight() {
    this.isLightOn = !this.isLightOn;
    const btn = document.getElementById("btn-toggle-light");
    const icon = document.getElementById("icon-light");
    const lbl = document.getElementById("lbl-light-status");

    if (this.isLightOn) {
      if (btn) btn.className = "btn btn-warning text-dark flex-fill py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-glow-amber";
      if (icon) icon.className = "bi bi-lightbulb-fill fs-6";
      if (lbl) lbl.textContent = "Luz: ON";
      this.statusPanel.setActionMessage("Faros LED encendidos", "LUZ ON", "bg-warning text-dark");
    } else {
      if (btn) btn.className = "btn btn-outline-warning flex-fill py-1 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm";
      if (icon) icon.className = "bi bi-lightbulb fs-6";
      if (lbl) lbl.textContent = "Luz: OFF";
      this.statusPanel.setActionMessage("Faros LED apagados", "LUZ OFF", "bg-secondary");
    }

    this.handleCommandName("LUCES");
  }

  _bindAuthEvents() {
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

          this.statusPanel.setActionMessage(`Sesión iniciada: ${res.user.nombre_completo}`, "AUTH OK", "bg-success");
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

    // Botones de acceso rápido para demostración
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

    // Botón de cierre de sesión
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        await vehicleService.logout();
        this.updateAuthUI();
        this._closeAuthModal();
        this.adminView.load();
        wsClient.reconnectWithAuth();

        this.statusPanel.setActionMessage("Sesión cerrada. Acceso público.", "LOGOUT", "bg-secondary");
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
      const primerNombre = user.nombre_completo.split(" ")[0];
      if (lblUserName) lblUserName.textContent = primerNombre;
      if (btnAuth) {
        btnAuth.className = "btn btn-sm btn-outline-success d-flex align-items-center gap-1 rounded-pill px-2 py-1";
      }
      if (formBox) formBox.classList.add("d-none");
      if (profileBox) {
        profileBox.classList.remove("d-none");
        document.getElementById("profile-name").textContent = user.nombre_completo;
        document.getElementById("profile-email").textContent = user.email;
        const badgeRole = document.getElementById("profile-role");
        if (badgeRole) {
          badgeRole.textContent = `ROL: ${user.rol}`;
          badgeRole.className = `badge px-3 py-1 text-uppercase mb-3 ${user.rol === "ADMINISTRADOR" ? "bg-danger" : user.rol === "USUARIO" ? "bg-primary" : "bg-warning text-dark"}`;
        }
      }
    } else {
      if (lblUserName) lblUserName.textContent = "Acceso";
      if (btnAuth) {
        btnAuth.className = "btn btn-sm btn-outline-info d-flex align-items-center gap-1 rounded-pill px-2 py-1";
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

    const newWsUrl = `wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/${idVehiculo}`;
    wsClient.setUrl(newWsUrl);

    this._loadInitialData();
    this.monitoringView.loadAll();

    this.statusPanel.setActionMessage(`Operando: ${CONFIG.VEHICLE_NAME}`, "VEHÍCULO", "bg-primary");
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
      this.statusPanel.setActionMessage("Canal WSS sincronizado con telemetría.", "EN LÍNEA", "bg-info");
      this.monitoringView.loadAll();
    });

    wsClient.on("MOVIMIENTO_INDIVIDUAL", data => {
      const origen = data.origen || "REMOTO";
      const comando = data.comando || data.codigo_comando;
      const codigo = data.codigo || data.id_comando;
      this.statusPanel.setActionMessage(`📡 En vivo: ${comando} (#${codigo})`, "TELEMETRÍA", "bg-primary");
      this.monitoringView.handleWsMovimiento(data);
    });

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
      this.statusPanel.setActionMessage("Sincronizando comandos...", "CARGANDO", "bg-warning");
      const comandos = await vehicleService.getComandos(CONFIG.VEHICLE_ID);
      comandos.forEach(c => this.catalogMap.set(c.nombre, c.id_comando));

      const demos = await vehicleService.getDemos(CONFIG.VEHICLE_ID);
      this.demoController.populateDemos(demos);

      this.statusPanel.setActionMessage("Listo para operar.", "LISTO", "bg-success");
      await this._runDiagnostics();
    } catch (e) {
      this.statusPanel.setActionMessage(`Falla de catálogo: ${e.message}`, "ERROR", "bg-danger");
      this.statusPanel.setApiStatus("OFFLINE");
      this.statusPanel.setRdsStatus("OFFLINE");
    }
  }

  async _runDiagnostics() {
    try {
      await vehicleService.checkApiHealth();
      this.statusPanel.setApiStatus("ONLINE");
    } catch (e) {
      this.statusPanel.setApiStatus("OFFLINE");
    }

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

    const friendlyName = {
      "ABRIR_PALA": "Giro Carro Izquierda",
      "CERRAR_PALA": "Giro Carro Derecha",
      "SUBIR_BRAZO": "Subir Brazo",
      "BAJAR_BRAZO": "Bajar Brazo",
      "AVANZAR": "Avanzar",
      "RETROCEDER": "Retroceder",
      "GIRAR_IZQUIERDA": "Giro Izquierda",
      "GIRAR_DERECHA": "Giro Derecha",
      "DETENER": "Detener"
    }[commandName] || commandName;

    try {
      this.statusPanel.setActionMessage(`Transmitiendo: ${friendlyName}...`, "ENVIANDO", "bg-warning");
      const res = await vehicleService.enviarMovimiento(idComando, "WEB-CONTROL", CONFIG.VEHICLE_ID);
      this.statusPanel.setActionMessage(`Ejecutado: ${friendlyName} (#${idComando})`, "OK", "bg-success");
    } catch (e) {
      this.statusPanel.setActionMessage(`Fallo: ${e.message}`, "FALLO", "bg-danger");
    } finally {
      this.isSending = false;
    }
  }

  async handleStartDemo(idDemo) {
    try {
      this.statusPanel.setActionMessage(`Iniciando DEMO #${idDemo}...`, "INICIANDO", "bg-info");
      await vehicleService.iniciarDemo(idDemo, CONFIG.VEHICLE_ID);
    } catch (e) {
      this.statusPanel.setActionMessage(`Error DEMO: ${e.message}`, "ERROR", "bg-danger");
    }
  }

  async handleCancelDemo() {
    try {
      this.statusPanel.setActionMessage("Cancelando DEMO...", "CANCELANDO", "bg-warning");
      await vehicleService.cancelarDemo(CONFIG.VEHICLE_ID);
      this.handleCommandName("DETENER");
    } catch (e) {
      this.statusPanel.setActionMessage(`Error al cancelar: ${e.message}`, "ERROR", "bg-danger");
    }
  }
}

// Iniciar aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
