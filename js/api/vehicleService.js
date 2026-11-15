import { ApiClient } from "./apiClient.js";
import { CONFIG } from "../config.js";

class VehicleService {
  constructor() {
    this.client = new ApiClient();
  }

  // --- 1. DIAGNÓSTICOS Y SALUD ---
  async checkApiHealth() {
    return await this.client.get(CONFIG.ENDPOINTS.HEALTH);
  }

  async checkRdsConnection(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.get(CONFIG.ENDPOINTS.ESTADO(idVehiculo));
  }

  // --- 2. OPERACIÓN Y TELEMETRÍA (4.1 & 4.2) ---
  async getEstado(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.get(CONFIG.ENDPOINTS.ESTADO(idVehiculo));
  }

  async getHistorial(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.get(CONFIG.ENDPOINTS.HISTORIAL(idVehiculo));
  }

  async getComandos(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.get(CONFIG.ENDPOINTS.COMANDOS(idVehiculo));
  }

  async getDemos(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.get(CONFIG.ENDPOINTS.DEMOS(idVehiculo));
  }

  async enviarMovimiento(idComando, origen = "WEB-CONTROL", idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.post(CONFIG.ENDPOINTS.MOVIMIENTO(idVehiculo), {
      id_comando: Number(idComando),
      origen: String(origen)
    });
  }

  async iniciarDemo(idDemo, idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.post(CONFIG.ENDPOINTS.INICIAR_DEMO(idVehiculo, idDemo));
  }

  async cancelarDemo(idVehiculo = CONFIG.VEHICLE_ID) {
    return await this.client.post(CONFIG.ENDPOINTS.CANCELAR_DEMO(idVehiculo));
  }

  // --- 3. AUTENTICACIÓN Y ROLES (4.3) ---
  async login(email, password) {
    const res = await this.client.post(CONFIG.AUTH.LOGIN, { email, password });
    if (res && res.access_token) {
      sessionStorage.setItem("iot_auth_token", res.access_token);
      sessionStorage.setItem("iot_user", JSON.stringify(res.user));
    }
    return res;
  }

  async getMe() {
    return await this.client.get(CONFIG.AUTH.ME);
  }

  async logout() {
    try {
      await this.client.post(CONFIG.AUTH.LOGOUT);
    } catch (e) {
      console.warn("Aviso en logout:", e);
    } finally {
      sessionStorage.removeItem("iot_auth_token");
      sessionStorage.removeItem("iot_user");
    }
  }

  getCurrentUser() {
    const raw = sessionStorage.getItem("iot_user");
    return raw ? JSON.parse(raw) : null;
  }

  // --- 4. PANEL ADMINISTRATIVO (ADMIN) ---
  async getDashboardMetrics() {
    return await this.client.get(CONFIG.ADMIN.METRICAS);
  }

  async getModelos() {
    return await this.client.get(CONFIG.ADMIN.MODELOS);
  }

  async createModelo(data) {
    return await this.client.post(CONFIG.ADMIN.MODELOS, data);
  }

  async getUnidades() {
    return await this.client.get(CONFIG.ADMIN.UNIDADES);
  }

  async createUnidad(data) {
    return await this.client.post(CONFIG.ADMIN.UNIDADES, data);
  }

  async getClientes() {
    return await this.client.get(CONFIG.ADMIN.CLIENTES);
  }

  async getAsignaciones() {
    return await this.client.get(CONFIG.ADMIN.ASIGNACIONES);
  }

  async assignVehiculo(data) {
    return await this.client.post(CONFIG.ADMIN.ASIGNACIONES, data);
  }

  async getBitacora(limite = 50) {
    return await this.client.get(`${CONFIG.ADMIN.BITACORA}?limite=${limite}`);
  }

  // --- 5. PORTAL DE USUARIOS E INVITADOS ---
  async getMisVehiculos() {
    return await this.client.get(CONFIG.PORTAL.MIS_VEHICULOS);
  }

  async toggleSoporte(idVehiculo, autoriza) {
    return await this.client.post(`${CONFIG.PORTAL.AUTORIZAR_SOPORTE(idVehiculo)}?autoriza=${autoriza}`);
  }

  async getCatalogoPublico() {
    return await this.client.get(CONFIG.PORTAL.CATALOGO);
  }

  async reservarPruebaInvitado(idVehiculo) {
    return await this.client.post(CONFIG.PORTAL.RESERVAR_INVITADO, { id_vehiculo: idVehiculo });
  }
}

export const vehicleService = new VehicleService();
