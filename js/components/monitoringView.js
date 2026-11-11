import { vehicleService } from "../api/vehicleService.js";
import { formatDateTime } from "../utils/dateFormatter.js";

/**
 * Vista de MONITOREO IoT en Tiempo Real.
 * Responsabilidades:
 * - Tarjeta visual destacada del último estado / movimiento real.
 * - Tabla semántica responsiva con los diez movimientos individuales más recientes persistidos en Amazon RDS.
 * - Sincronización reactiva mediante WebSocket sin polling continuo.
 * - Resincronización segura contra desincronización y reconexiones.
 */
export class MonitoringView {
  constructor() {
    // Elementos de la tarjeta de Último Movimiento
    this.cardLastCommand = document.getElementById("mon-last-command");
    this.cardLastCode = document.getElementById("mon-last-code");
    this.cardLastOrigin = document.getElementById("mon-last-origin");
    this.cardLastTime = document.getElementById("mon-last-time");
    this.cardLastStatus = document.getElementById("mon-last-status");
    this.cardCommandBadge = document.getElementById("mon-command-badge");

    // Elementos de la Tabla de Historial
    this.tableBody = document.getElementById("mon-history-tbody");
    this.tableStateBox = document.getElementById("mon-table-state-box");
    this.tableStateText = document.getElementById("mon-table-state-text");
    this.btnRefreshHistory = document.getElementById("btn-refresh-history");

    this.historyRecords = []; // Almacena los 10 registros persistidos en memoria
    this.isLoading = false;
    this.lastStateTimestamp = 0; // Para evitar que respuestas viejas sobrescriban eventos nuevos

    this._bindEvents();
  }

  _bindEvents() {
    if (this.btnRefreshHistory) {
      this.btnRefreshHistory.addEventListener("click", () => this.loadAll());
    }
  }

  /**
   * Carga inicial completa de Estado e Historial desde Amazon RDS vía REST.
   */
  async loadAll() {
    if (this.isLoading) return;
    this.isLoading = true;
    this._showTableLoading("Consultando Amazon RDS for MySQL...");

    try {
      const [estado, historial] = await Promise.all([
        vehicleService.getEstado(),
        vehicleService.getHistorial()
      ]);

      if (estado) {
        this.renderLastState({
          comando: estado.comando || "DETENER",
          codigo: estado.codigo ?? estado.id_comando ?? 9,
          origen: "PERSISTIDO-RDS",
          timestamp: estado.fecha_actualizacion,
          conectado: estado.conectado === 1
        });
      }

      this.renderHistoryTable(historial);
    } catch (err) {
      console.error("Error al sincronizar monitoreo:", err);
      this._showTableError(`Falla al cargar historial: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Renderiza la tarjeta visual del último movimiento / estado.
   */
  renderLastState(data) {
    if (!data) return;

    const comando = data.comando || "DETENER";
    const codigo = data.codigo ?? "--";
    const origen = data.origen || "SISTEMA";
    const tiempo = data.timestamp ? formatDateTime(data.timestamp) : "--/--/---- --:--:--";
    const esDemo = data.esDemo === true;

    if (this.cardLastCommand) {
      this.cardLastCommand.textContent = comando;
    }

    if (this.cardLastCode) {
      this.cardLastCode.textContent = `Código: #${codigo}`;
    }

    if (this.cardLastOrigin) {
      this.cardLastOrigin.textContent = esDemo ? "Secuencia DEMO" : `Origen: ${origen}`;
    }

    if (this.cardLastTime) {
      this.cardLastTime.textContent = tiempo;
    }

    if (this.cardLastStatus) {
      this.cardLastStatus.textContent = esDemo ? "RUTINA AUTÓNOMA" : "PERSISTIDO EN RDS";
      this.cardLastStatus.className = `badge ${esDemo ? "bg-info text-dark" : "bg-success"}`;
    }

    // Color del badge de comando
    if (this.cardCommandBadge) {
      this.cardCommandBadge.className = `display-6 fw-bold mb-2 ${this._getCommandColorClass(comando)}`;
    }
  }

  /**
   * Renderiza la tabla semántica con los 10 movimientos individuales persistidos.
   */
  renderHistoryTable(records) {
    if (!this.tableBody) return;

    if (!Array.isArray(records) || records.length === 0) {
      this.tableBody.innerHTML = "";
      this._showTableState("No hay movimientos individuales registrados en la base de datos.");
      return;
    }

    // Ocultar mensaje de estado y mostrar tabla
    if (this.tableStateBox) this.tableStateBox.classList.add("d-none");
    this.tableBody.classList.remove("d-none");

    // Limitar a máximo 10 registros
    this.historyRecords = records.slice(0, 10);

    const rowsHtml = this.historyRecords.map((item, index) => {
      const num = index + 1;
      const comando = item.comando || "DESCONOCIDO";
      const codigo = item.codigo ?? "--";
      const fechaHora = formatDateTime(item.fecha_hora);
      const origen = item.origen || "WEB-CONTROL";
      const badgeClass = this._getCommandBadgeClass(comando);

      return `
        <tr class="align-middle">
          <td class="text-center font-monospace text-secondary fw-bold">${num}</td>
          <td>
            <span class="badge ${badgeClass} me-1">${comando}</span>
            <small class="text-secondary font-monospace">#${codigo}</small>
          </td>
          <td class="small font-monospace">${fechaHora}</td>
          <td>
            <span class="badge bg-secondary font-monospace">${origen}</span>
          </td>
        </tr>
      `;
    }).join("");

    this.tableBody.innerHTML = rowsHtml;
  }

  /**
   * Reacción inmediata a eventos individuales de WebSocket.
   */
  async handleWsMovimiento(evento) {
    if (!evento) return;

    // 1. Actualizar inmediatamente la tarjeta del último movimiento
    this.renderLastState({
      comando: evento.comando || evento.codigo_comando,
      codigo: evento.codigo ?? evento.id_comando,
      origen: evento.origen || "REMOTO",
      timestamp: evento.timestamp,
      esDemo: false
    });

    // 2. Sincronizar la tabla de historial con Amazon RDS para garantizar id_historial real
    try {
      const historialActualizado = await vehicleService.getHistorial();
      this.renderHistoryTable(historialActualizado);
    } catch (err) {
      console.warn("Falla menor al refrescar historial tras evento WSS:", err);
    }
  }

  /**
   * Reacción a movimientos ejecutados dentro de una DEMO.
   * Regla de negocio: Refleja el estado en la tarjeta, pero NO inserta en la tabla de historial.
   */
  handleWsDemoMovimiento(evento) {
    if (!evento) return;

    this.renderLastState({
      comando: evento.comando,
      codigo: evento.codigo,
      origen: "DEMO-AUTÓNOMA",
      timestamp: evento.timestamp,
      esDemo: true
    });
  }

  handleWsDemoFin() {
    this.renderLastState({
      comando: "DETENER",
      codigo: 9,
      origen: "FIN-DEMO",
      timestamp: new Date().toISOString(),
      esDemo: false
    });
  }

  _getCommandColorClass(comando) {
    switch (comando) {
      case "DETENER": return "text-danger";
      case "AVANZAR":
      case "RETROCEDER":
      case "GIRAR_IZQUIERDA":
      case "GIRAR_DERECHA": return "text-primary";
      case "SUBIR_BRAZO":
      case "BAJAR_BRAZO": return "text-info";
      case "ABRIR_PALA":
      case "CERRAR_PALA": return "text-warning";
      default: return "text-light";
    }
  }

  _getCommandBadgeClass(comando) {
    switch (comando) {
      case "DETENER": return "bg-danger";
      case "AVANZAR":
      case "RETROCEDER":
      case "GIRAR_IZQUIERDA":
      case "GIRAR_DERECHA": return "bg-primary";
      case "SUBIR_BRAZO":
      case "BAJAR_BRAZO": return "bg-info text-dark";
      case "ABRIR_PALA":
      case "CERRAR_PALA": return "bg-warning text-dark";
      default: return "bg-secondary";
    }
  }

  _showTableLoading(mensaje) {
    if (!this.tableStateBox) return;
    this.tableStateBox.classList.remove("d-none");
    this.tableStateText.innerHTML = `<div class="spinner-border spinner-border-sm text-info me-2" role="status"></div> ${mensaje}`;
    if (this.tableBody) this.tableBody.classList.add("d-none");
  }

  _showTableError(mensaje) {
    if (!this.tableStateBox) return;
    this.tableStateBox.classList.remove("d-none");
    this.tableStateText.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${mensaje}</span>`;
  }

  _showTableState(mensaje) {
    if (!this.tableStateBox) return;
    this.tableStateBox.classList.remove("d-none");
    this.tableStateText.innerHTML = `<span class="text-secondary">${mensaje}</span>`;
  }
}
