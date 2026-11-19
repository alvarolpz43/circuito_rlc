/**
 * ==============================================================================
 * SONDA AUDITIVA DE FRECUENCIA PARA EL DIAGRAMA DE BODE
 * Proyecto 2: El Circuito RLC como Filtro de Audio - Ecuaciones Diferenciales
 * Generación de tonos senoidales en tiempo real y cálculo exacto de H(jω)
 * ==============================================================================
 */

const BodeProbe = {
    audioCtx: null,
    osc: null,
    gainNode: null,
    isPlaying: false,
    currentMode: null, // 'input' | 'output' | 'ab'
    abInterval: null,
    abState: 'input', // 'input' | 'output'

    // Parámetros nominales del circuito RLC
    L: 0.5,
    C: 200e-6,
    R: 50.0, // Resistencia de audio nominal

    currentFreq: 15.92, // Hz

    init() {
        this.bindEvents();
        this.updateCalculations(this.currentFreq);
    },

    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 0.0;
            this.gainNode.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    bindEvents() {
        const slider = document.getElementById("sliderBodeFreq");
        const btnPlayIn = document.getElementById("btnPlayBodeIn");
        const btnPlayOut = document.getElementById("btnPlayBodeOut");
        const btnToggleAB = document.getElementById("btnBodeToggleAB");
        const btnStop = document.getElementById("btnStopBodeTone");
        const presetBtns = document.querySelectorAll(".bode-pill-btn");

        if (slider) {
            slider.addEventListener("input", (e) => {
                const norm = parseFloat(e.target.value) / 1000.0;
                // Escala logarítmica de 1 Hz a 10,000 Hz
                const freq = Math.pow(10, norm * 4.0);
                this.setFrequency(freq, false);
                presetBtns.forEach(b => b.classList.remove("active"));
            });
        }

        presetBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                presetBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const f = parseFloat(btn.dataset.f);
                this.setFrequency(f, true);
            });
        });

        if (btnPlayIn) {
            btnPlayIn.addEventListener("click", () => {
                if (this.isPlaying && this.currentMode === 'input') {
                    this.stopTone();
                } else {
                    this.startTone('input');
                }
            });
        }

        if (btnPlayOut) {
            btnPlayOut.addEventListener("click", () => {
                if (this.isPlaying && this.currentMode === 'output') {
                    this.stopTone();
                } else {
                    this.startTone('output');
                }
            });
        }

        if (btnToggleAB) {
            btnToggleAB.addEventListener("click", () => {
                if (this.isPlaying && this.currentMode === 'ab') {
                    this.stopTone();
                } else {
                    this.startTone('ab');
                }
            });
        }

        if (btnStop) {
            btnStop.addEventListener("click", () => {
                this.stopTone();
            });
        }
    },

    setFrequency(freq, updateSlider = true) {
        this.currentFreq = Math.max(1, Math.min(10000, freq));

        if (updateSlider) {
            const slider = document.getElementById("sliderBodeFreq");
            if (slider) {
                const norm = Math.log10(this.currentFreq) / 4.0;
                slider.value = Math.round(norm * 1000);
            }
        }

        const lbl = document.getElementById("lblBodeProbeFreq");
        if (lbl) {
            lbl.textContent = this.currentFreq >= 1000 
                ? `${(this.currentFreq / 1000).toFixed(2)} kHz`
                : `${this.currentFreq.toFixed(2)} Hz`;
        }

        this.updateCalculations(this.currentFreq);

        if (this.isPlaying && this.osc && this.audioCtx) {
            this.osc.frequency.setTargetAtTime(this.currentFreq, this.audioCtx.currentTime, 0.04);
            this.applyGainForMode(this.currentMode === 'ab' ? this.abState : this.currentMode);
        }
    },

    calculateH(freq) {
        const omega = 2 * Math.PI * freq;
        const real = 1.0 - Math.pow(omega, 2) * this.L * this.C;
        const imag = omega * this.R * this.C;
        const denom = Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2));

        const linGain = 1.0 / denom;
        const dBGain = 20.0 * Math.log10(Math.max(1e-6, linGain));
        const phaseDeg = -Math.atan2(imag, real) * (180.0 / Math.PI);
        const powerPct = Math.min(100.0, Math.pow(linGain, 2) * 100.0);

        return { linGain, dBGain, phaseDeg, powerPct };
    },

    updateCalculations(freq) {
        const h = this.calculateH(freq);

        const badge = document.getElementById("badgeBodeGain");
        const linVal = document.getElementById("bodeLinGainVal");
        const dBVal = document.getElementById("bodedBVal");
        const phaseVal = document.getElementById("bodePhaseVal");
        const powerVal = document.getElementById("bodePowerVal");

        if (badge) {
            badge.textContent = `Ganancia: ${h.dBGain >= 0 ? '+' : ''}${h.dBGain.toFixed(2)} dB (${(h.linGain * 100).toFixed(1)}%)`;
            badge.className = `bode-gain-badge ${h.dBGain < -3 ? 'attenuated' : 'passband'}`;
        }
        if (linVal) linVal.textContent = `${h.linGain.toFixed(3)} V/V`;
        if (dBVal) {
            dBVal.textContent = `${h.dBGain >= 0 ? '+' : ''}${h.dBGain.toFixed(2)} dB`;
            dBVal.style.color = h.dBGain < -12 ? "var(--accent-rose)" : (h.dBGain < -3 ? "var(--accent-amber)" : "var(--accent-green)");
        }
        if (phaseVal) phaseVal.textContent = `${h.phaseDeg.toFixed(1)}°`;
        if (powerVal) powerVal.textContent = `${h.powerPct.toFixed(2)}%`;
    },

    startTone(mode) {
        this.initAudio();
        this.stopTone();

        this.isPlaying = true;
        this.currentMode = mode;
        this.abState = 'input';

        // Crear oscilador senoidal puro
        this.osc = this.audioCtx.createOscillator();
        this.osc.type = "sine";
        this.osc.frequency.setValueAtTime(this.currentFreq, this.audioCtx.currentTime);

        this.osc.connect(this.gainNode);
        this.osc.start();

        if (mode === 'ab') {
            this.applyGainForMode('input');
            this.abInterval = setInterval(() => {
                this.abState = (this.abState === 'input') ? 'output' : 'input';
                this.applyGainForMode(this.abState);
                this.updateUIButtons();
            }, 1200);
        } else {
            this.applyGainForMode(mode);
        }

        this.updateUIButtons();
    },

    applyGainForMode(mode) {
        if (!this.gainNode || !this.audioCtx) return;
        const baseVol = 0.28; // Volumen base seguro para oídos

        if (mode === 'input') {
            this.gainNode.gain.setTargetAtTime(baseVol, this.audioCtx.currentTime, 0.05);
        } else {
            const h = this.calculateH(this.currentFreq);
            // Ganancia física real atenuada según la curva de Bode
            const targetGain = Math.min(0.6, baseVol * h.linGain);
            this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.05);
        }
    },

    stopTone() {
        if (this.abInterval) {
            clearInterval(this.abInterval);
            this.abInterval = null;
        }

        if (this.osc) {
            try {
                if (this.gainNode && this.audioCtx) {
                    this.gainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.03);
                }
                setTimeout(() => {
                    try { this.osc.stop(); this.osc.disconnect(); } catch(e){}
                    this.osc = null;
                }, 40);
            } catch(e) {}
        }

        this.isPlaying = false;
        this.currentMode = null;
        this.updateUIButtons();
    },

    updateUIButtons() {
        const btnIn = document.getElementById("btnPlayBodeIn");
        const btnOut = document.getElementById("btnPlayBodeOut");
        const btnAB = document.getElementById("btnBodeToggleAB");
        const btnStop = document.getElementById("btnStopBodeTone");

        if (btnIn) btnIn.classList.toggle("active", this.isPlaying && (this.currentMode === 'input' || (this.currentMode === 'ab' && this.abState === 'input')));
        if (btnOut) btnOut.classList.toggle("active", this.isPlaying && (this.currentMode === 'output' || (this.currentMode === 'ab' && this.abState === 'output')));
        if (btnAB) btnAB.classList.toggle("active", this.isPlaying && this.currentMode === 'ab');
        if (btnStop) btnStop.style.display = this.isPlaying ? "inline-flex" : "none";
    }
};
