/**
 * Gestor de navegación entre las vistas de CONTROL, MONITOREO y ADMINISTRACIÓN.
 * Garantiza accesibilidad ARIA, gestión de teclado y actualización limpia de vistas.
 */
export class Navigation {
  constructor(onViewChange) {
    this.onViewChange = onViewChange;
    this.currentView = "control";

    this.navBtns = document.querySelectorAll("[data-nav-view]");
    this.views = {
      control: document.getElementById("view-control"),
      monitoreo: document.getElementById("view-monitoreo"),
      administracion: document.getElementById("view-administracion")
    };

    this._bindEvents();
  }

  _bindEvents() {
    this.navBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = btn.dataset.navView;
        if (targetView && targetView !== this.currentView) {
          this.switchView(targetView);
        }
      });
    });
  }

  switchView(viewName) {
    // Re-evaluar vistas por si se agregaron dinámicamente
    if (!this.views[viewName]) {
      this.views[viewName] = document.getElementById(`view-${viewName}`);
    }
    if (!this.views[viewName]) return;

    this.currentView = viewName;

    // Actualizar botones de navegación
    document.querySelectorAll("[data-nav-view]").forEach(btn => {
      const isActive = btn.dataset.navView === viewName;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // Alternar visibilidad de las vistas
    Object.keys(this.views).forEach(key => {
      const el = this.views[key];
      if (el) {
        if (key === viewName) {
          el.classList.remove("d-none");
          el.setAttribute("aria-hidden", "false");
        } else {
          el.classList.add("d-none");
          el.setAttribute("aria-hidden", "true");
        }
      }
    });

    if (typeof this.onViewChange === "function") {
      this.onViewChange(viewName);
    }
  }
}
