/**
 * Configuración centralizada de la aplicación cliente.
 * Se conecta al backend público en AWS sin exponer secretos.
 */
export const CONFIG = {
  // URLs del servidor AWS
  API_BASE_URL: "https://vehiculo-iot-excavadora.duckdns.org",
  WS_URL: "wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/1",

  // Datos del vehículo objetivo
  VEHICLE_ID: 1,
  VEHICLE_NAME: "Excavadora IoT #1",

  // Endpoints reales
  ENDPOINTS: {
    HEALTH: "/",
    ESTADO: "/vehiculos/1/estado",
    COMANDOS: "/vehiculos/1/comandos",
    MOVIMIENTO: "/vehiculos/1/movimiento",
    DEMOS: "/vehiculos/1/demos",
    INICIAR_DEMO: (idDemo) => `/vehiculos/1/demos/${idDemo}/iniciar`,
    CANCELAR_DEMO: "/vehiculos/1/demos/cancelar"
  },

  // Temporizadores
  TIMEOUT_MS: 10000,
  POLLING_HEALTH_MS: 15000
};
