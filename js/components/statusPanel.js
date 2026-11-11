export class StatusPanel {
  constructor() {
    this.dotWs = document.getElementById("dot-ws");
    this.lblWs = document.getElementById("lbl-status-ws");
    this.dotApi = document.getElementById("dot-api");
    this.lblApi = document.getElementById("lbl-status-api");
    this.dotRds = document.getElementById("dot-rds");
    this.lblRds = document.getElementById("lbl-status-rds");

    this.actionBanner = document.getElementById("lbl-last-action");
    this.actionBadge = document.getElementById("lbl-action-status");
  }

  // 1. Estado del Canal WebSocket WSS
  setWsStatus(status) {
    switch (status) {
      case "ONLINE":
        this._setBadge(this.dotWs, this.lblWs, "bg-success", "En línea");
        break;
      case "CONNECTING":
        this._setBadge(this.dotWs, this.lblWs, "bg-warning", "Reconectando");
        break;
      case "DISCONNECTED":
      case "ERROR":
      default:
        this._setBadge(this.dotWs, this.lblWs, "bg-danger", "Desconectado");
        break;
    }
  }

  // 2. Estado del Servidor AWS (FastAPI)
  setApiStatus(status) {
    switch (status) {
      case "ONLINE":
        this._setBadge(this.dotApi, this.lblApi, "bg-success", "Disponible");
        break;
      case "CHECKING":
        this._setBadge(this.dotApi, this.lblApi, "bg-warning", "Comprobando");
        break;
      case "OFFLINE":
      default:
        this._setBadge(this.dotApi, this.lblApi, "bg-danger", "No disponible");
        break;
    }
  }

  // 3. Estado de la Base de Datos Amazon RDS
  setRdsStatus(status) {
    switch (status) {
      case "ONLINE":
        this._setBadge(this.dotRds, this.lblRds, "bg-success", "Disponible");
        break;
      case "OFFLINE":
        this._setBadge(this.dotRds, this.lblRds, "bg-danger", "No disponible");
        break;
      case "UNVERIFIED":
      default:
        this._setBadge(this.dotRds, this.lblRds, "bg-secondary", "Sin verificar");
        break;
    }
  }

  _setBadge(dotEl, lblEl, bgClass, text) {
    if (!dotEl || !lblEl) return;
    dotEl.className = `status-indicator ${bgClass}`;
    lblEl.textContent = text;
  }

  // Mensaje de retroalimentación de operaciones
  setActionMessage(message, statusBadge = "OK", badgeClass = "bg-success") {
    if (this.actionBanner) {
      this.actionBanner.innerHTML = `<i class="bi bi-broadcast me-1"></i> ${message}`;
    }
    if (this.actionBadge) {
      this.actionBadge.textContent = statusBadge;
      this.actionBadge.className = `badge font-monospace ${badgeClass}`;
    }
  }
}
