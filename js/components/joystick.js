/**
 * VirtualJoystick táctil y responsivo con soporte para multi-touch independiente.
 * Soporta cualquier diámetro de base, cálculo dinámico de zona muerta y mapeo de comandos.
 */
export class VirtualJoystick {
  constructor(baseId, knobId, labelId, directionMap, onDirectionChange) {
    this.base = document.getElementById(baseId);
    this.knob = document.getElementById(knobId);
    this.label = document.getElementById(labelId);
    this.directionMap = directionMap || {
      up: "AVANZAR",
      down: "RETROCEDER",
      left: "GIRAR_IZQUIERDA",
      right: "GIRAR_DERECHA"
    };
    this.onDirectionChange = onDirectionChange;

    this.active = false;
    this.currentDirection = "NEUTRAL";
    this.pointerId = null;

    if (this.base && this.knob) {
      this._bindEvents();
    }
  }

  _bindEvents() {
    this.base.addEventListener("pointerdown", this._onStart.bind(this));
    window.addEventListener("pointermove", this._onMove.bind(this));
    window.addEventListener("pointerup", this._onEnd.bind(this));
    window.addEventListener("pointercancel", this._onEnd.bind(this));
  }

  _onStart(e) {
    if (this.active) return;
    this.active = true;
    this.pointerId = e.pointerId;
    try {
      this.base.setPointerCapture(e.pointerId);
    } catch (_) {}
    this._processCoord(e.clientX, e.clientY);
  }

  _onMove(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    this._processCoord(e.clientX, e.clientY);
  }

  _onEnd(e) {
    if (!this.active || (e && e.pointerId !== this.pointerId)) return;
    this.active = false;
    this.pointerId = null;
    this._resetKnob();
    this._setDirection("NEUTRAL");
  }

  _processCoord(clientX, clientY) {
    const rect = this.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const baseRadius = rect.width / 2;
    const knobRadius = (this.knob.offsetWidth || 44) / 2;
    const maxDistance = Math.max(10, baseRadius - knobRadius);
    const deadZone = baseRadius * 0.22;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Desplazamiento visual acotado al perímetro
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(distance, maxDistance);
    const knobX = clampedDist * Math.cos(angle);
    const knobY = clampedDist * Math.sin(angle);

    this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    // Zona muerta para evitar envíos involuntarios
    if (distance < deadZone) {
      this._setDirection("NEUTRAL");
      return;
    }

    const deg = (angle * 180 / Math.PI + 360) % 360;

    if (deg >= 45 && deg < 135) {
      this._setDirection(this.directionMap.down);
    } else if (deg >= 135 && deg < 225) {
      this._setDirection(this.directionMap.left);
    } else if (deg >= 225 && deg < 315) {
      this._setDirection(this.directionMap.up);
    } else {
      this._setDirection(this.directionMap.right);
    }
  }

  _setDirection(dir) {
    if (this.currentDirection !== dir) {
      this.currentDirection = dir;
      if (this.label) {
        this.label.textContent = dir;
      }
      if (typeof this.onDirectionChange === "function") {
        this.onDirectionChange(dir);
      }
    }
  }

  _resetKnob() {
    this.knob.style.transform = "translate(0px, 0px)";
  }
}
