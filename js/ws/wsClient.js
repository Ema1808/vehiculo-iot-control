import { CONFIG } from "../config.js";

export class WebSocketClient {
  constructor(url = CONFIG.WS_URL) {
    this.url = url;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.shouldReconnect = true;
    this.statusCallback = null;
  }

  onStatusChange(callback) {
    this.statusCallback = callback;
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(cb => {
        try { cb(data); } catch (e) { console.error("Error en listener WSS:", e); }
      });
    }
  }

  setUrl(newUrl) {
    if (this.url !== newUrl) {
      this.disconnect();
      this.url = newUrl;
      this.shouldReconnect = true;
      this.reconnectAttempts = 0;
      this.connect();
    }
  }

  reconnectWithAuth() {
    this.disconnect();
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._updateStatus("CONNECTING");

    try {
      const token = sessionStorage.getItem("iot_auth_token");
      let fullUrl = this.url;
      if (token) {
        const separator = fullUrl.includes("?") ? "&" : "?";
        fullUrl += `${separator}token=${encodeURIComponent(token)}`;
      }

      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this._updateStatus("ONLINE");
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.emit("message", payload);
          if (payload.tipo) {
            this.emit(payload.tipo, payload);
          }
        } catch (e) {
          console.warn("Mensaje WSS no JSON recibido:", event.data);
        }
      };

      this.ws.onerror = () => {
        this._updateStatus("ERROR");
      };

      this.ws.onclose = () => {
        this._updateStatus("DISCONNECTED");
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (e) {
      this._updateStatus("DISCONNECTED");
    }
  }

  _updateStatus(status) {
    if (typeof this.statusCallback === "function") {
      this.statusCallback(status);
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
