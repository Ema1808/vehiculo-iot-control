export class DemoController {
  constructor(onStartDemo, onCancelDemo) {
    this.onStartDemo = onStartDemo;
    this.onCancelDemo = onCancelDemo;

    this.selectEl = document.getElementById("select-demos");
    this.btnStart = document.getElementById("btn-start-demo");
    this.btnCancel = document.getElementById("btn-cancel-demo");
    this.progressBox = document.getElementById("demo-progress-box");
    this.progressBar = document.getElementById("bar-demo-progress");
    this.lblStatus = document.getElementById("lbl-demo-status");

    this.totalSteps = 0;
    this.currentStep = 0;
    this.isRunning = false;

    this._bindEvents();
  }

  _bindEvents() {
    this.btnStart.addEventListener("click", () => {
      const idDemo = this.selectEl.value;
      if (idDemo && !this.isRunning) {
        this.onStartDemo(idDemo);
      }
    });

    this.btnCancel.addEventListener("click", () => {
      if (this.isRunning) {
        this.onCancelDemo();
      }
    });
  }

  populateDemos(demos) {
    this.selectEl.innerHTML = "";
    if (!demos || demos.length === 0) {
      this.selectEl.innerHTML = '<option value="">No hay DEMOS activas</option>';
      this.btnStart.disabled = true;
      return;
    }

    demos.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id_demo;
      opt.textContent = `${d.nombre} (ID: ${d.id_demo})`;
      this.selectEl.appendChild(opt);
    });

    this.btnStart.disabled = false;
  }

  onDemoStart(data) {
    this.isRunning = true;
    this.totalSteps = data.total_movimientos || 8;
    this.currentStep = 0;

    this.btnStart.disabled = true;
    this.btnCancel.disabled = false;
    this.selectEl.disabled = true;

    this.progressBox.classList.remove("d-none");
    this.progressBar.style.width = "0%";
    this.lblStatus.textContent = `Iniciando DEMO #${data.id_demo}... (${this.totalSteps} pasos)`;
  }

  onDemoStep(data) {
    if (!this.isRunning) return;
    this.currentStep = data.orden || (this.currentStep + 1);
    const pct = Math.min(100, Math.round((this.currentStep / this.totalSteps) * 100));

    this.progressBar.style.width = `${pct}%`;
    this.lblStatus.textContent = `Paso ${this.currentStep}/${this.totalSteps}: ${data.comando} (${data.duracion_ms}ms)`;
  }

  onDemoEnd() {
    this.isRunning = false;
    this.btnStart.disabled = false;
    this.btnCancel.disabled = true;
    this.selectEl.disabled = false;

    this.progressBar.style.width = "100%";
    this.lblStatus.textContent = "DEMO finalizada exitosamente.";
    setTimeout(() => this.progressBox.classList.add("d-none"), 3000);
  }

  onDemoCancel() {
    this.isRunning = false;
    this.btnStart.disabled = false;
    this.btnCancel.disabled = true;
    this.selectEl.disabled = false;

    this.lblStatus.textContent = "DEMO cancelada por el operador.";
    setTimeout(() => this.progressBox.classList.add("d-none"), 3000);
  }
}
