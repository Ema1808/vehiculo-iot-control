import { CONFIG } from "../config.js";

export class ApiClient {
  constructor(baseUrl = CONFIG.API_BASE_URL, defaultTimeout = CONFIG.TIMEOUT_MS) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const isJson = (response.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        throw new Error(data.detail || `Error HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Tiempo de espera agotado al conectar con el servidor AWS.");
      }
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body)
    });
  }
}
