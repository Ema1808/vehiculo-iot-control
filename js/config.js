/**
 * Configuración centralizada de la aplicación cliente.
 * Se conecta al backend público en AWS sin exponer secretos.
 */
export const CONFIG = {
  // URLs del servidor AWS
  API_BASE_URL: "https://vehiculo-iot-excavadora.duckdns.org",
  WS_URL: "wss://vehiculo-iot-excavadora.duckdns.org/ws/vehiculos/1",

  // Datos del vehículo objetivo predeterminado
  VEHICLE_ID: 1,
  VEHICLE_NAME: "Excavadora IoT #1",

  // Endpoints de Operación y Monitoreo (4.1 y 4.2)
  ENDPOINTS: {
    HEALTH: "/",
    ESTADO: (id = 1) => `/vehiculos/${id}/estado`,
    HISTORIAL: (id = 1) => `/vehiculos/${id}/historial`,
    COMANDOS: (id = 1) => `/vehiculos/${id}/comandos`,
    MOVIMIENTO: (id = 1) => `/vehiculos/${id}/movimiento`,
    DEMOS: (id = 1) => `/vehiculos/${id}/demos`,
    INICIAR_DEMO: (idVehiculo, idDemo) => `/vehiculos/${idVehiculo}/demos/${idDemo}/iniciar`,
    CANCELAR_DEMO: (idVehiculo = 1) => `/vehiculos/${idVehiculo}/demos/cancelar`
  },

  // Endpoints Administrativos y RBAC (4.3)
  AUTH: {
    LOGIN: "/auth/login",
    ME: "/auth/me",
    LOGOUT: "/auth/logout"
  },
  ADMIN: {
    METRICAS: "/admin/dashboard/metricas",
    MODELOS: "/admin/modelos",
    UNIDADES: "/admin/unidades",
    CLIENTES: "/admin/clientes",
    ASIGNACIONES: "/admin/asignaciones",
    BITACORA: "/admin/bitacora"
  },
  PORTAL: {
    MIS_VEHICULOS: "/portal/mis-vehiculos",
    AUTORIZAR_SOPORTE: (id) => `/portal/mis-vehiculos/${id}/autorizar-soporte`,
    CATALOGO: "/portal/catalogo-publico",
    RESERVAR_INVITADO: "/portal/invitados/reservar"
  },

  // Temporizadores
  TIMEOUT_MS: 10000,
  POLLING_HEALTH_MS: 15000
};
