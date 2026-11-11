export class VirtualJoystick {
  constructor(baseId, knobId, onDirectionChange) {
    this.base = document.getElementById(baseId);
    this.knob = document.getElementById(knobId);
    this.onDirectionChange = onDirectionChange;

    this.active = false;
    this.currentDirection = "NEUTRAL";
    this.pointerId = null;

    this.baseRadius = 110;
    this.knobRadius = 40;
    this.maxDistance = this.baseRadius - this.knobRadius;
    this.deadZone = 25; // 25px de zona muerta para evitar falsos toques

    this._bindEvents();
  }

  _bindEvents() {
    this.base.addEventListener("pointerdown", this._onStart.bind(this));
    window.addEventListener("pointermove", this._onMove.bind(this));
    window.addEventListener("pointerup", this._onEnd.bind(this));
    window.addEventListener("pointercancel", this._onEnd.bind(this));
  }

  _onStart(e) {
    this.active = true;
    this.pointerId = e.pointerId;
    this.base.setPointerCapture(e.pointerId);
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

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Calcular desplazamiento visual acotado
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(distance, this.maxDistance);
    const knobX = clampedDist * Math.cos(angle);
    const knobY = clampedDist * Math.sin(angle);

    this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    // Detección de dirección
    if (distance < this.deadZone) {
      this._setDirection("NEUTRAL");
      return;
    }

    const deg = (angle * 180 / Math.PI + 360) % 360;

    if (deg >= 45 && deg < 135) {
      this._setDirection("RETROCEDER");
    } else if (deg >= 135 && deg < 225) {
      this._setDirection("GIRAR_IZQUIERDA");
    } else if (deg >= 225 && deg < 315) {
      this._setDirection("AVANZAR");
    } else {
      this._setDirection("GIRAR_DERECHA");
    }
  }

  _setDirection(dir) {
    if (this.currentDirection !== dir) {
      this.currentDirection = dir;
      const lbl = document.getElementById("lbl-joystick-dir");
      if (lbl) lbl.textContent = `ESTADO: ${dir}`;
      if (typeof this.onDirectionChange === "function") {
        this.onDirectionChange(dir);
      }
    }
  }

  _resetKnob() {
    this.knob.style.transform = "translate(0px, 0px)";
  }
}
