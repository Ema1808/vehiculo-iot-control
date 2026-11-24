import { vehicleService } from "../api/vehicleService.js";
import { formatDateTime } from "../utils/dateFormatter.js";

/**
 * Vista de ADMINISTRACIÓN IoT + RBAC + Portales por Rol.
 * Soporta:
 * - Modo ADMINISTRADOR: Dashboard de métricas, inventario, modelos, asignaciones y bitácora.
 * - Modo USUARIO: Mis vehículos, autorización de soporte técnico.
 * - Modo INVITADO: Catálogo público y reserva temporal de unidad de exhibición.
 * - Autenticación JWT y cambio dinámico de rol en caliente.
 */
export class AdminView {
  constructor(onAuthChange, onSelectVehicle) {
    this.onAuthChange = onAuthChange;
    this.onSelectVehicle = onSelectVehicle;
    this.container = document.getElementById("view-administracion");
    this.guestTimerInterval = null;

    this._bindEvents();
  }

  _bindEvents() {
    // Delegación de eventos dentro del contenedor de administración
    if (this.container) {
      this.container.addEventListener("click", (e) => {
        const btnSubTab = e.target.closest("[data-admin-subtab]");
        if (btnSubTab) {
          e.preventDefault();
          this._switchSubTab(btnSubTab.dataset.adminSubtab);
          return;
        }

        const btnToggleSoporte = e.target.closest("[data-toggle-soporte]");
        if (btnToggleSoporte) {
          const vid = btnToggleSoporte.dataset.toggleSoporte;
          const currentVal = btnToggleSoporte.dataset.currentVal === "true";
          this._handleToggleSoporte(vid, !currentVal);
          return;
        }

        const btnReservarExpo = e.target.closest("[data-reservar-expo]");
        if (btnReservarExpo) {
          const vid = btnReservarExpo.dataset.reservarExpo;
          this._handleReservarInvitado(vid);
          return;
        }

        const btnSwitchVehicle = e.target.closest("[data-switch-vehicle]");
        if (btnSwitchVehicle) {
          const vid = Number(btnSwitchVehicle.dataset.switchVehicle);
          const vname = btnSwitchVehicle.dataset.vehicleName;
          if (typeof this.onSelectVehicle === "function") {
            this.onSelectVehicle(vid, vname);
          }
          return;
        }
      });
    }
  }

  async load() {
    const user = vehicleService.getCurrentUser();
    this._renderViewForUser(user);
  }

  _renderViewForUser(user) {
    if (!this.container) return;

    if (!user) {
      this._renderGuestOrNoAuthView();
      return;
    }

    switch (user.rol) {
      case "ADMINISTRADOR":
        this._renderAdminDashboard(user);
        break;
      case "USUARIO":
        this._renderUserPortal(user);
        break;
      case "INVITADO":
        this._renderGuestPortal(user);
        break;
      default:
        this._renderGuestOrNoAuthView();
        break;
    }
  }

  // =========================================================================
  // 1. PANEL DE ADMINISTRADOR (ADMIN)
  // =========================================================================
  async _renderAdminDashboard(user) {
    this.container.innerHTML = `
      <div class="row g-3">
        <!-- Encabezado de Administración -->
        <div class="col-12 d-flex justify-content-between align-items-center flex-wrap gap-2 border-bottom border-secondary pb-3">
          <div>
            <span class="badge bg-danger mb-1"><i class="bi bi-shield-lock-fill me-1"></i> PANEL EMPRESARIAL · ADMINISTRADOR</span>
            <h2 class="h5 mb-0 fw-bold">Gestión de Inventario, Modelos y Auditoría</h2>
            <small class="text-secondary">Operando como: ${user.nombre_completo} (${user.email})</small>
          </div>
          <button class="btn btn-sm btn-outline-info" id="btn-refresh-admin">
            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar Métricas
          </button>
        </div>

        <!-- Tarjetas de Métricas -->
        <div class="col-12">
          <div class="row g-2 text-center" id="admin-metrics-row">
            <div class="col-6 col-md-3">
              <div class="p-2 rounded bg-dark border border-secondary">
                <small class="text-secondary d-block">Modelos</small>
                <span class="h4 fw-bold text-info" id="metric-modelos">--</span>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="p-2 rounded bg-dark border border-secondary">
                <small class="text-secondary d-block">Unidades Totales</small>
                <span class="h4 fw-bold text-light" id="metric-unidades">--</span>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="p-2 rounded bg-dark border border-secondary">
                <small class="text-secondary d-block">Unidades Vendidas</small>
                <span class="h4 fw-bold text-success" id="metric-vendidas">--</span>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="p-2 rounded bg-dark border border-secondary">
                <small class="text-secondary d-block">Clientes Compradores</small>
                <span class="h4 fw-bold text-warning" id="metric-clientes">--</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pestañas Internas de Administración -->
        <div class="col-12">
          <ul class="nav nav-tabs border-secondary mb-3" role="tablist">
            <li class="nav-item">
              <button class="nav-link active text-light fw-semibold" data-admin-subtab="unidades">
                <i class="bi bi-truck me-1"></i> Unidades Físicas
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link text-secondary fw-semibold" data-admin-subtab="modelos">
                <i class="bi bi-box-seam me-1"></i> Modelos Comerciales
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link text-secondary fw-semibold" data-admin-subtab="asignaciones">
                <i class="bi bi-person-check me-1"></i> Asignaciones a Clientes
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link text-secondary fw-semibold" data-admin-subtab="auditoria">
                <i class="bi bi-journal-text me-1"></i> Bitácora de Auditoría
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link text-secondary fw-semibold" data-admin-subtab="demos">
                <i class="bi bi-play-btn me-1"></i> Editor de Demos
              </button>
            </li>
          </ul>

          <div id="admin-subtab-content" class="control-card p-3 rounded-4 border border-secondary shadow-lg">
            <div class="text-center py-4 text-secondary">
              <div class="spinner-border spinner-border-sm text-info me-2"></div> Cargando inventario...
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-refresh-admin")?.addEventListener("click", () => this._loadAdminData());
    await this._loadAdminData();
  }

  async _loadAdminData() {
    try {
      const metricas = await vehicleService.getDashboardMetrics();
      document.getElementById("metric-modelos").textContent = metricas.total_modelos;
      document.getElementById("metric-unidades").textContent = metricas.total_unidades;
      document.getElementById("metric-vendidas").textContent = metricas.unidades_vendidas;
      document.getElementById("metric-clientes").textContent = metricas.total_clientes;

      await this._switchSubTab("unidades");
    } catch (e) {
      console.error("Error al cargar datos de admin:", e);
    }
  }

  async _switchSubTab(tabName) {
    document.querySelectorAll("[data-admin-subtab]").forEach(btn => {
      const isActive = btn.dataset.adminSubtab === tabName;
      btn.classList.toggle("active", isActive);
      btn.classList.toggle("text-light", isActive);
      btn.classList.toggle("text-secondary", !isActive);
    });

    const box = document.getElementById("admin-subtab-content");
    if (!box) return;
    box.innerHTML = `<div class="text-center py-4 text-secondary"><div class="spinner-border spinner-border-sm text-info me-2"></div> Cargando ${tabName}...</div>`;

    try {
      if (tabName === "unidades") {
        const unidades = await vehicleService.getUnidades();
        box.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Inventario Físico de Vehículos</h3>
            <span class="badge bg-secondary font-monospace">${unidades.length} Registradas</span>
          </div>
          <div class="table-responsive">
            <table class="table table-dark table-hover table-sm align-middle">
              <thead class="text-secondary small font-monospace">
                <tr>
                  <th>ID</th>
                  <th>Número de Serie</th>
                  <th>Modelo Comercial</th>
                  <th>Nombre Unidad</th>
                  <th>Estado</th>
                  <th>Propietario</th>
                  <th>Soporte</th>
                </tr>
              </thead>
              <tbody>
                ${unidades.map(u => `
                  <tr>
                    <td class="font-monospace text-secondary fw-bold">#${u.id_vehiculo}</td>
                    <td class="font-monospace text-info">${u.numero_serie || "--"}</td>
                    <td>${u.modelo_nombre || u.modelo || "--"}</td>
                    <td class="fw-semibold">${u.nombre}</td>
                    <td><span class="badge ${this._getEstadoBadgeClass(u.estado_comercial)}">${u.estado_comercial}</span></td>
                    <td class="small">${u.propietario_nombre || "<span class='text-secondary'>Sin asignar</span>"}</td>
                    <td>${u.autoriza_soporte ? "<span class='badge bg-success'>Autorizado</span>" : "<span class='badge bg-dark border border-secondary text-secondary'>Bloqueado</span>"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      } else if (tabName === "modelos") {
        const modelos = await vehicleService.getModelos();
        box.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Modelos Comerciales Fabricados</h3>
          </div>
          <div class="row g-3">
            ${modelos.map(m => `
              <div class="col-12 col-md-4">
                <div class="p-3 rounded bg-dark border border-secondary h-100">
                  <span class="badge bg-info text-dark mb-2">${m.categoria}</span>
                  <h4 class="h6 fw-bold text-light">${m.nombre}</h4>
                  <p class="small text-secondary mb-2">${m.descripcion || "Sin descripción"}</p>
                  <small class="text-secondary font-monospace d-block">Microcontrolador: ${m.microcontrolador_base}</small>
                </div>
              </div>
            `).join("")}
          </div>
        `;
      } else if (tabName === "asignaciones") {
        const asignaciones = await vehicleService.getAsignaciones();
        box.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Asignaciones de Vehículos a Clientes</h3>
          </div>
          <div class="table-responsive">
            <table class="table table-dark table-hover table-sm align-middle">
              <thead class="text-secondary small font-monospace">
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Vehículo Asignado</th>
                  <th>Serie</th>
                  <th>Fecha Asignación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${asignaciones.map(a => `
                  <tr>
                    <td class="font-monospace text-secondary">${a.id_asignacion}</td>
                    <td><strong>${a.cliente_nombre}</strong><br><small class="text-secondary">${a.cliente_email}</small></td>
                    <td>${a.vehiculo_nombre}</td>
                    <td class="font-monospace text-info">${a.numero_serie || "--"}</td>
                    <td class="small font-monospace">${formatDateTime(a.fecha_asignacion)}</td>
                    <td><span class="badge bg-success">${a.estado}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      } else if (tabName === "demos") {
        await this._renderDemoEditor(box);
      } else if (tabName === "auditoria") {
        const logs = await vehicleService.getBitacora(25);
        box.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Bitácora de Auditoría del Sistema</h3>
          </div>
          <div class="table-responsive">
            <table class="table table-dark table-hover table-sm align-middle">
              <thead class="text-secondary small font-monospace">
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td class="small font-monospace">${formatDateTime(l.fecha_hora)}</td>
                    <td>${l.usuario_nombre || "Sistema"}</td>
                    <td><span class="badge bg-secondary font-monospace">${l.accion}</span></td>
                    <td class="font-monospace text-info">${l.entidad_afectada} #${l.id_entidad || ""}</td>
                    <td class="small font-monospace text-secondary">${l.ip_origen || "--"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (e) {
      box.innerHTML = `<div class="alert alert-danger py-2 px-3 small">Error al cargar contenido: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 2. PORTAL DE COMPRADOR (USUARIO)
  // =========================================================================
  async _renderUserPortal(user) {
    this.container.innerHTML = `
      <div class="row g-3">
        <div class="col-12 border-bottom border-secondary pb-3">
          <span class="badge bg-primary mb-1"><i class="bi bi-person-fill-check me-1"></i> PORTAL DEL COMPRADOR</span>
          <h2 class="h5 mb-0 fw-bold">Mis Vehículos y Ajustes de Soporte</h2>
          <small class="text-secondary">Bienvenido, ${user.nombre_completo}</small>
        </div>

        <div class="col-12">
          <h3 class="h6 text-uppercase tracking-wider text-secondary mb-3">Vehículos Registrados a mi Nombre</h3>
          <div id="user-vehicles-list" class="row g-3">
            <div class="col-12 text-center py-4 text-secondary">
              <div class="spinner-border spinner-border-sm text-info me-2"></div> Consultando mis vehículos...
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const misVehiculos = await vehicleService.getMisVehiculos();
      const listContainer = document.getElementById("user-vehicles-list");
      if (!listContainer) return;

      if (!misVehiculos || misVehiculos.length === 0) {
        listContainer.innerHTML = `
          <div class="col-12">
            <div class="alert alert-warning py-3 text-center">
              <i class="bi bi-exclamation-circle fs-4 d-block mb-2"></i>
              No tienes vehículos asignados actualmente. Contacta al administrador para adquirir o registrar tu unidad.
            </div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = misVehiculos.map(v => `
        <div class="col-12 col-md-6">
          <div class="control-card p-4 rounded-4 border border-secondary shadow-lg h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-success">PROPIEDAD PRIVADA</span>
                <span class="font-monospace text-info small">Serie: ${v.numero_serie || "N/A"}</span>
              </div>
              <h4 class="h5 fw-bold text-light mb-1">${v.nombre}</h4>
              <p class="small text-secondary mb-3">${v.modelo_nombre || v.modelo} · Microcontrolador: ${v.microcontrolador}</p>
            </div>

            <div class="border-top border-secondary pt-3 mt-2">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <small class="d-block fw-semibold text-light">Autorización de Soporte Técnico</small>
                  <small class="text-secondary" style="font-size: 0.75rem;">Permite al Administrador operar el control en remoto</small>
                </div>
                <button class="btn btn-sm ${v.autoriza_soporte ? "btn-success" : "btn-outline-secondary"}" 
                        data-toggle-soporte="${v.id_vehiculo}" 
                        data-current-val="${v.autoriza_soporte ? "true" : "false"}">
                  <i class="bi ${v.autoriza_soporte ? "bi-check-circle-fill" : "bi-slash-circle"} me-1"></i>
                  ${v.autoriza_soporte ? "Autorizado" : "Bloqueado"}
                </button>
              </div>

              <button class="btn btn-primary w-100 py-2 fw-semibold" 
                      data-switch-vehicle="${v.id_vehiculo}" 
                      data-vehicle-name="${v.nombre}">
                <i class="bi bi-joystick me-1"></i> Operar este Vehículo en Control
              </button>
            </div>
          </div>
        </div>
      `).join("");
    } catch (e) {
      console.error("Error al cargar portal de usuario:", e);
    }
  }

  // =========================================================================
  // 3. PORTAL DE INVITADO (INVITADO)
  // =========================================================================
  async _renderGuestPortal(user) {
    this.container.innerHTML = `
      <div class="row g-3">
        <div class="col-12 border-bottom border-secondary pb-3">
          <span class="badge bg-warning text-dark mb-1"><i class="bi bi-eye-fill me-1"></i> SESIÓN DE INVITADO · CLIENTE POTENCIAL</span>
          <h2 class="h5 mb-0 fw-bold">Catálogo Comercial y Prueba de Exhibición</h2>
          <small class="text-secondary">Explora nuestros modelos IoT y prueba una unidad en vivo por 3 minutos.</small>
        </div>

        <!-- Módulo de Reserva de Prueba -->
        <div class="col-12">
          <div class="p-3 rounded-4 bg-black border border-warning shadow-lg">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h3 class="h6 mb-1 text-warning fw-bold"><i class="bi bi-play-circle-fill me-1"></i> Unidad de Exhibición en Vivo</h3>
                <small class="text-secondary">Reserva un turno exclusivo de 3 minutos para operar la Excavadora Expo desde la pestaña Control.</small>
              </div>
              <button class="btn btn-warning fw-bold px-4 py-2" data-reservar-expo="1" id="btn-reservar-prueba">
                <i class="bi bi-stopwatch me-1"></i> Iniciar Prueba (3 Minutos)
              </button>
            </div>
            <div id="guest-timer-box" class="mt-3 p-2 rounded bg-dark border border-secondary text-center d-none">
              <span class="text-secondary small d-block">TIEMPO RESTANTE DE PRUEBA:</span>
              <span class="h3 fw-bold font-monospace text-warning" id="lbl-guest-countdown">03:00</span>
              <small class="d-block text-secondary mt-1">Ve a la pestaña <strong>Control</strong> para manejar la unidad.</small>
            </div>
          </div>
        </div>

        <!-- Catálogo de Modelos -->
        <div class="col-12 mt-4">
          <h3 class="h6 text-uppercase tracking-wider text-secondary mb-3">Modelos Comerciales Disponibles</h3>
          <div id="guest-catalog-row" class="row g-3">
            <div class="col-12 text-center py-4 text-secondary">
              <div class="spinner-border spinner-border-sm text-info me-2"></div> Cargando catálogo...
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const data = await vehicleService.getCatalogoPublico();
      const catRow = document.getElementById("guest-catalog-row");
      if (catRow && data.modelos) {
        catRow.innerHTML = data.modelos.map(m => `
          <div class="col-12 col-md-4">
            <div class="control-card p-3 rounded-4 border border-secondary h-100 d-flex flex-column justify-content-between">
              <div>
                <span class="badge bg-secondary mb-2">${m.categoria}</span>
                <h4 class="h6 fw-bold text-light">${m.nombre}</h4>
                <p class="small text-secondary mb-2">${m.descripcion}</p>
              </div>
              <div class="border-top border-secondary pt-2 mt-2">
                <small class="text-info font-monospace d-block">Controlador: ${m.microcontrolador_base}</small>
              </div>
            </div>
          </div>
        `).join("");
      }
    } catch (e) {
      console.error("Error al cargar catálogo de invitado:", e);
    }
  }

  // =========================================================================
  // 4. VISTA SIN AUTENTICAR (MODO DEMO / LABORATORIO)
  // =========================================================================
  _renderGuestOrNoAuthView() {
    this.container.innerHTML = `
      <div class="row g-3 justify-content-center text-center py-4">
        <div class="col-12 col-md-8 col-lg-6">
          <div class="control-card p-4 rounded-4 border border-secondary shadow-lg">
            <i class="bi bi-shield-lock text-warning display-4 d-block mb-3"></i>
            <h2 class="h5 fw-bold text-light mb-2">Control de Acceso y Administración IoT</h2>
            <p class="text-secondary small mb-4">
              Para ingresar al panel de administración empresarial, ver tus vehículos privados o reservar una sesión de prueba como invitado, inicia sesión con tus credenciales.
            </p>
            <button class="btn btn-primary px-4 py-2 fw-semibold" id="btn-open-login-direct">
              <i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sesión / Seleccionar Rol
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-open-login-direct")?.addEventListener("click", () => {
      document.getElementById("btn-auth-user")?.click();
    });
  }

  // =========================================================================
  // 5. MÉTODOS AUXILIARES Y ACCIONES
  // =========================================================================
  async _handleToggleSoporte(idVehiculo, nuevoValor) {
    try {
      await vehicleService.toggleSoporte(idVehiculo, nuevoValor);
      await this.load();
    } catch (e) {
      alert(`Error al actualizar permiso: ${e.message}`);
    }
  }

  async _handleReservarInvitado(idVehiculo = 1) {
    const btn = document.getElementById("btn-reservar-prueba");
    const btnBar = document.getElementById("btn-start-guest-trial-bar");
    if (btn) btn.disabled = true;
    if (btnBar) {
      btnBar.disabled = true;
      btnBar.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Conectando...`;
    }

    try {
      const res = await vehicleService.reservarPruebaInvitado(idVehiculo);
      const timerBox = document.getElementById("guest-timer-box");
      const countdownLbl = document.getElementById("lbl-guest-countdown");
      const countdownBar = document.getElementById("lbl-guest-countdown-bar");
      if (timerBox) timerBox.classList.remove("d-none");
      if (countdownBar) countdownBar.classList.remove("d-none");

      if (btnBar) {
        btnBar.innerHTML = `<i class="bi bi-play-circle-fill me-1"></i> Prueba en Curso`;
      }

      if (typeof this.onSelectVehicle === "function") {
        this.onSelectVehicle(idVehiculo, "Excavadora IoT (Prueba Invitado)");
      }

      let seconds = res.segundos_restantes || 180;
      if (this.guestTimerInterval) clearInterval(this.guestTimerInterval);

      const updateCountdownUI = (sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        const timeStr = `${m}:${s}`;
        if (countdownLbl) countdownLbl.textContent = timeStr;
        if (countdownBar) countdownBar.textContent = timeStr;
      };

      updateCountdownUI(seconds);

      this.guestTimerInterval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(this.guestTimerInterval);
          if (countdownLbl) countdownLbl.textContent = "00:00 (Expirada)";
          if (countdownBar) countdownBar.textContent = "00:00";
          alert("Tu sesión de prueba de 3 minutos ha concluido. El vehículo se ha detenido de forma segura.");
          if (btn) btn.disabled = false;
          if (btnBar) {
            btnBar.disabled = false;
            btnBar.innerHTML = `<i class="bi bi-play-circle-fill me-1"></i> Iniciar Prueba (3 Min)`;
          }
        } else {
          updateCountdownUI(seconds);
        }
      }, 1000);

    } catch (e) {
      alert(`No se pudo reservar prueba: ${e.message}`);
      if (btn) btn.disabled = false;
      if (btnBar) {
        btnBar.disabled = false;
        btnBar.innerHTML = `<i class="bi bi-play-circle-fill me-1"></i> Iniciar Prueba (3 Min)`;
      }
    }
  }

  _getEstadoBadgeClass(estado) {
    switch (estado) {
      case "VENDIDO": return "bg-success";
      case "EXHIBICION": return "bg-warning text-dark";
      case "DISPONIBLE": return "bg-info text-dark";
      default: return "bg-secondary";
    }
  }

  // =========================================================================
  // EDITOR VISUAL DE RUTINAS DEMO (PRÁCTICA 4.3 - PUNTO 9)
  // =========================================================================
  async _renderDemoEditor(container, targetVehicleId = 1) {
    container.innerHTML = `
      <div class="row g-3">
        <!-- Diseñador de Secuencias -->
        <div class="col-12 col-lg-7">
          <div class="p-3 rounded bg-dark border border-secondary">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Diseñador de Rutinas DEMO</h3>
              <span class="badge bg-info text-dark" id="demo-total-duration">⏱ Total: 0.0s (0 pasos)</span>
            </div>
            <p class="small text-secondary mb-3">Diseña secuencias autónomas de pasos ordenados y guárdalas directamente en Amazon RDS MySQL.</p>

            <form id="form-create-demo">
              <div class="mb-2">
                <label class="form-label small text-secondary mb-1">Nombre de la Rutina DEMO</label>
                <input type="text" class="form-control form-control-sm bg-black text-light border-secondary" id="demo-name-input" placeholder="Ej: Excavación y Acopio Automático" required>
              </div>
              <div class="mb-3">
                <label class="form-label small text-secondary mb-1">Descripción</label>
                <input type="text" class="form-control form-control-sm bg-black text-light border-secondary" id="demo-desc-input" placeholder="Secuencia de demostración comercial">
              </div>

              <div class="d-flex justify-content-between align-items-center mb-2">
                <h4 class="h6 small text-uppercase text-secondary mb-0">Pasos de la Secuencia</h4>
                <button type="button" class="btn btn-xs btn-outline-success py-1 px-2" id="btn-add-demo-step">
                  <i class="bi bi-plus-circle me-1"></i> Agregar Paso
                </button>
              </div>

              <!-- Tabla interactiva de pasos -->
              <div class="table-responsive mb-3" style="max-height: 250px;">
                <table class="table table-dark table-sm align-middle mb-0" id="table-demo-steps">
                  <thead class="text-secondary small font-monospace">
                    <tr>
                      <th style="width: 35px;">#</th>
                      <th>Comando</th>
                      <th style="width: 105px;">Duración (ms)</th>
                      <th style="width: 105px;">Pausa (ms)</th>
                      <th style="width: 40px;"></th>
                    </tr>
                  </thead>
                  <tbody id="demo-steps-tbody">
                  </tbody>
                </table>
              </div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm flex-grow-1 fw-bold py-2" id="btn-save-demo">
                  <i class="bi bi-cloud-arrow-up-fill me-1"></i> Guardar Rutina en Amazon RDS
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm py-2 px-3" id="btn-reset-demo">
                  Limpiar
                </button>
              </div>
            </form>
            <div id="demo-alert-msg" class="mt-2 d-none"></div>
          </div>
        </div>

        <!-- Lista de Rutinas Existentes -->
        <div class="col-12 col-lg-5">
          <div class="p-3 rounded bg-dark border border-secondary">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h3 class="h6 mb-0 text-uppercase tracking-wider text-secondary">Rutinas en Amazon RDS</h3>
              <button class="btn btn-xs btn-outline-secondary" id="btn-refresh-demos-list" title="Refrescar lista">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
            <p class="small text-secondary mb-3">Rutinas guardadas en la base de datos para la Excavadora IoT #1.</p>
            <div id="demo-existing-list" class="d-flex flex-column gap-2" style="max-height: 380px; overflow-y: auto;">
              <div class="text-center py-3 text-secondary small">
                <span class="spinner-border spinner-border-sm me-1"></span> Consultando rutinas...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Comandos disponibles para pasos
    const availableCommands = [
      { id: 1, name: "AVANZAR" },
      { id: 2, name: "RETROCEDER" },
      { id: 3, name: "GIRAR_IZQ" },
      { id: 4, name: "GIRAR_DER" },
      { id: 5, name: "SUBIR_BRAZO" },
      { id: 6, name: "BAJAR_BRAZO" },
      { id: 7, name: "ABRIR_PALA" },
      { id: 8, name: "CERRAR_PALA" },
      { id: 9, name: "DETENER" },
      { id: 25, name: "LUCES" },
      { id: 26, name: "SONIDO" }
    ];

    let currentSteps = [
      { id_comando: 1, comando_nombre: "AVANZAR", duracion_ms: 1500, pausa_ms: 300 },
      { id_comando: 5, comando_nombre: "SUBIR_BRAZO", duracion_ms: 1000, pausa_ms: 200 },
      { id_comando: 7, comando_nombre: "ABRIR_PALA", duracion_ms: 800, pausa_ms: 200 },
      { id_comando: 9, comando_nombre: "DETENER", duracion_ms: 500, pausa_ms: 0 }
    ];

    const updateStepsUI = () => {
      const tbody = document.getElementById("demo-steps-tbody");
      const durationBadge = document.getElementById("demo-total-duration");
      if (!tbody) return;

      if (currentSteps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary small py-3">No hay pasos agregados. Pulsa "+ Agregar Paso".</td></tr>`;
        if (durationBadge) durationBadge.textContent = "⏱ Total: 0.0s (0 pasos)";
        return;
      }

      let totalMs = 0;
      tbody.innerHTML = currentSteps.map((step, idx) => {
        totalMs += (Number(step.duracion_ms) || 0) + (Number(step.pausa_ms) || 0);
        const optionsHtml = availableCommands.map(cmd =>
          `<option value="${cmd.id}" ${cmd.id === step.id_comando ? "selected" : ""}>${cmd.name}</option>`
        ).join("");

        return `
          <tr data-step-index="${idx}">
            <td class="font-monospace text-secondary">${idx + 1}</td>
            <td>
              <select class="form-select form-select-sm bg-black text-light border-secondary step-cmd-select" data-idx="${idx}">
                ${optionsHtml}
              </select>
            </td>
            <td>
              <input type="number" class="form-control form-control-sm bg-black text-light border-secondary step-duration-input" data-idx="${idx}" value="${step.duracion_ms}" min="100" max="10000" step="100">
            </td>
            <td>
              <input type="number" class="form-control form-control-sm bg-black text-light border-secondary step-pause-input" data-idx="${idx}" value="${step.pausa_ms}" min="0" max="5000" step="50">
            </td>
            <td class="text-center">
              <button type="button" class="btn btn-xs btn-outline-danger btn-remove-step" data-idx="${idx}" title="Eliminar paso">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      if (durationBadge) {
        durationBadge.textContent = `⏱ Total: ${(totalMs / 1000).toFixed(1)}s (${currentSteps.length} pasos)`;
      }
    };

    updateStepsUI();

    // Eventos de la tabla de pasos
    document.getElementById("btn-add-demo-step")?.addEventListener("click", () => {
      currentSteps.push({ id_comando: 1, comando_nombre: "AVANZAR", duracion_ms: 1000, pausa_ms: 200 });
      updateStepsUI();
    });

    document.getElementById("table-demo-steps")?.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.idx);
      if (isNaN(idx) || !currentSteps[idx]) return;

      if (e.target.classList.contains("step-cmd-select")) {
        const cmdId = Number(e.target.value);
        currentSteps[idx].id_comando = cmdId;
        const found = availableCommands.find(c => c.id === cmdId);
        currentSteps[idx].comando_nombre = found ? found.name : "COMANDO";
      } else if (e.target.classList.contains("step-duration-input")) {
        currentSteps[idx].duracion_ms = Number(e.target.value) || 500;
        updateStepsUI();
      } else if (e.target.classList.contains("step-pause-input")) {
        currentSteps[idx].pausa_ms = Number(e.target.value) || 0;
        updateStepsUI();
      }
    });

    document.getElementById("table-demo-steps")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-remove-step");
      if (btn) {
        const idx = Number(btn.dataset.idx);
        currentSteps.splice(idx, 1);
        updateStepsUI();
      }
    });

    document.getElementById("btn-reset-demo")?.addEventListener("click", () => {
      currentSteps = [];
      updateStepsUI();
      document.getElementById("demo-name-input").value = "";
      document.getElementById("demo-desc-input").value = "";
    });

    // Cargar demos existentes desde RDS
    const loadDemosList = async () => {
      const listDiv = document.getElementById("demo-existing-list");
      if (!listDiv) return;
      try {
        const demos = await vehicleService.getDemos(targetVehicleId);
        if (!demos || demos.length === 0) {
          listDiv.innerHTML = `<div class="text-center py-4 text-secondary small">Sin rutinas registradas en este vehículo.</div>`;
          return;
        }

        listDiv.innerHTML = demos.map(d => `
          <div class="p-2 rounded bg-black border border-secondary d-flex justify-content-between align-items-center">
            <div>
              <strong class="text-light small d-block">${d.nombre}</strong>
              <small class="text-secondary d-block" style="font-size: 0.72rem;">ID: #${d.id_demo} · ${d.descripcion || "Sin descripción"}</small>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-xs btn-outline-danger btn-delete-demo" data-id-demo="${d.id_demo}" title="Eliminar demo">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `).join("");
      } catch (err) {
        listDiv.innerHTML = `<div class="text-danger small">Error al consultar demos: ${err.message}</div>`;
      }
    };

    loadDemosList();
    document.getElementById("btn-refresh-demos-list")?.addEventListener("click", loadDemosList);

    // Eliminar demo
    document.getElementById("demo-existing-list")?.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-delete-demo");
      if (btn && confirm(`¿Deseas eliminar la rutina DEMO #${btn.dataset.idDemo}?`)) {
        try {
          await vehicleService.deleteDemo(targetVehicleId, btn.dataset.idDemo);
          loadDemosList();
        } catch (err) {
          alert(`Error al eliminar: ${err.message}`);
        }
      }
    });

    // Guardar Demo y sus Pasos en RDS
    document.getElementById("form-create-demo")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("demo-name-input").value.trim();
      const descripcion = document.getElementById("demo-desc-input").value.trim();
      const btnSave = document.getElementById("btn-save-demo");
      const alertBox = document.getElementById("demo-alert-msg");

      if (currentSteps.length === 0) {
        alert("Agrega al menos un paso a la secuencia antes de guardar.");
        return;
      }

      btnSave.disabled = true;
      btnSave.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Persistiendo en RDS...`;
      if (alertBox) alertBox.classList.add("d-none");

      try {
        // 1. Crear cabecera de la demo
        const demoRes = await vehicleService.createDemo(targetVehicleId, { nombre, descripcion });
        const idDemo = demoRes.id_demo;

        // 2. Agregar cada movimiento
        for (let i = 0; i < currentSteps.length; i++) {
          const s = currentSteps[i];
          await vehicleService.addMovimientoDemo(targetVehicleId, idDemo, {
            id_comando: s.id_comando,
            orden: i + 1,
            duracion_ms: s.duracion_ms,
            pausa_ms: s.pausa_ms
          });
        }

        if (alertBox) {
          alertBox.className = "alert alert-success py-2 small mt-2";
          alertBox.textContent = `¡Rutina DEMO "${nombre}" (#${idDemo}) guardada con éxito con ${currentSteps.length} pasos en Amazon RDS!`;
          alertBox.classList.remove("d-none");
        }

        // Limpiar formulario y recargar lista
        document.getElementById("demo-name-input").value = "";
        document.getElementById("demo-desc-input").value = "";
        currentSteps = [];
        updateStepsUI();
        loadDemosList();

      } catch (err) {
        if (alertBox) {
          alertBox.className = "alert alert-danger py-2 small mt-2";
          alertBox.textContent = `Error al guardar rutina: ${err.message}`;
          alertBox.classList.remove("d-none");
        }
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Guardar Rutina en Amazon RDS`;
      }
    });
  }

}
