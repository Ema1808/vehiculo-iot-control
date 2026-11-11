export class ActionButtons {
  constructor(onCommandTrigger) {
    this.onCommandTrigger = onCommandTrigger;
    this.buttons = document.querySelectorAll(".btn-actuator");
    this._init();
  }

  _init() {
    this.buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const comando = btn.dataset.comando;
        if (comando && typeof this.onCommandTrigger === "function") {
          this._animateButton(btn);
          this.onCommandTrigger(comando);
        }
      });
    });
  }

  _animateButton(btn) {
    btn.classList.add("active");
    setTimeout(() => btn.classList.remove("active"), 200);
  }

  setEnabled(enabled) {
    this.buttons.forEach(btn => btn.disabled = !enabled);
  }
}
