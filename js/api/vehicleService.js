import { ApiClient } from "./apiClient.js";
import { CONFIG } from "../config.js";

class VehicleService {
  constructor() {
    this.client = new ApiClient();
  }

  // 1. Diagnóstico del Servidor AWS (API Health)
  async checkApiHealth() {
    return await this.client.get(CONFIG.ENDPOINTS.HEALTH);
  }

  // 2. Diagnóstico de Persistencia en RDS (Consulta de estado)
  async checkRdsConnection() {
    return await this.client.get(CONFIG.ENDPOINTS.ESTADO);
  }

  // 3. Catálogo de Comandos del Vehículo
  async getComandos() {
    return await this.client.get(CONFIG.ENDPOINTS.COMANDOS);
  }

  // 4. Catálogo de Demos
  async getDemos() {
    return await this.client.get(CONFIG.ENDPOINTS.DEMOS);
  }

  // 5. Enviar Movimiento Individual (Transacción atómica en backend)
  async enviarMovimiento(idComando, origen = "WEB-CONTROL") {
    return await this.client.post(CONFIG.ENDPOINTS.MOVIMIENTO, {
      id_comando: Number(idComando),
      origen: String(origen)
    });
  }

  // 6. Iniciar DEMO en Servidor
  async iniciarDemo(idDemo) {
    return await this.client.post(CONFIG.ENDPOINTS.INICIAR_DEMO(idDemo));
  }

  // 7. Cancelar DEMO en Servidor
  async cancelarDemo() {
    return await this.client.post(CONFIG.ENDPOINTS.CANCELAR_DEMO);
  }
}

export const vehicleService = new VehicleService();
