/**
 * ==============================================================================
 * LABORATORIO DE AUDIO OPTIMIZADO (WEB AUDIO API & FFT CANVAS)
 * Proyecto 2: El Circuito RLC como Filtro de Audio - Grupo 3
 * ==============================================================================
 */

const AudioLab = {
    audioCtx: null,
    isPlaying: false,
    filterEnabled: true,
    oscillators: [],
    filterNode: null,
    analyserNode: null,
    gainNode: null,
    animFrameId: null,

    // Elementos en caché
    canvas: null,
    canvasCtx: null,
    dataArray: null,

    initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            this.analyserNode = this.audioCtx.createAnalyser();
            this.analyserNode.fftSize = 512;
            this.analyserNode.smoothingTimeConstant = 0.8;

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 0.35;

            this.filterNode = this.audioCtx.createBiquadFilter();
            this.filterNode.type = "lowpass";
            this.filterNode.frequency.value = 25.0; // Frecuencia de corte baja RLC
            this.filterNode.Q.value = 1.0;

            this.gainNode.connect(this.audioCtx.destination);

            this.canvas = document.getElementById("canvasSpectrum");
            if (this.canvas) {
                this.canvasCtx = this.canvas.getContext("2d");
                this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
            }
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    startLiveSynth() {
        this.initAudioContext();
        if (this.isPlaying) return;

        const freqs = [110, 164.8, 220, 440, 880, 1760, 3520];
        const gains = [0.25, 0.2, 0.18, 0.14, 0.1, 0.07, 0.04];

        this.oscillators = [];
        const mixBus = this.audioCtx.createGain();
        mixBus.gain.value = 0.5;

        freqs.forEach((f, idx) => {
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.type = idx % 2 === 0 ? "sawtooth" : "square";
            osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
            g.gain.setValueAtTime(gains[idx], this.audioCtx.currentTime);
            osc.connect(g);
            g.connect(mixBus);
            osc.start();
            this.oscillators.push(osc);
        });

        this.routeAudio(mixBus);
        this.isPlaying = true;
        this.startSpectrumVisualizer();
        this.updateUIState(true);
    },

    stopLiveSynth() {
        if (!this.isPlaying) return;
        this.oscillators.forEach(osc => {
            try { osc.stop(); osc.disconnect(); } catch (e) {}
        });
        this.oscillators = [];
        this.isPlaying = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.updateUIState(false);
        this.clearCanvas();
    },

    toggleFilter() {
        this.filterEnabled = !this.filterEnabled;
        const btn = document.getElementById("btnToggleFilter");
        if (btn) {
            if (this.filterEnabled) {
                btn.innerHTML = "🎛️ Filtro RLC: <strong>ACTIVADO (Bajo el Agua)</strong>";
                btn.style.borderColor = "var(--accent-cyan)";
            } else {
                btn.innerHTML = "🔊 Filtro RLC: <strong>DESACTIVADO (Audio Original)</strong>";
                btn.style.borderColor = "var(--border-glass)";
            }
        }
        if (this.filterNode && this.audioCtx) {
            const targetFreq = this.filterEnabled ? 35.0 : 18000.0;
            this.filterNode.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.06);
        }
    },

    routeAudio(sourceNode) {
        sourceNode.disconnect();
        sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.analyserNode);
        this.analyserNode.connect(this.gainNode);

        const targetFreq = this.filterEnabled ? 35.0 : 18000.0;
        this.filterNode.frequency.setValueAtTime(targetFreq, this.audioCtx.currentTime);
    },

    updateFilterParams(R, L, C) {
        if (!this.filterNode || !this.audioCtx) return;
        const omega_n = 1.0 / Math.sqrt(L * C);
        const f_n = omega_n / (2.0 * Math.PI);
        const zeta = R / (2.0 * Math.sqrt(L / C));
        const Q = 1.0 / (2.0 * zeta);

        if (this.filterEnabled) {
            this.filterNode.frequency.setTargetAtTime(Math.max(12, f_n * 2.0), this.audioCtx.currentTime, 0.05);
            this.filterNode.Q.setTargetAtTime(Math.min(8, Math.max(0.1, Q)), this.audioCtx.currentTime, 0.05);
        }
    },

    startSpectrumVisualizer() {
        if (!this.canvasCtx || !this.canvas) return;
        const ctx = this.canvasCtx;
        const canvas = this.canvas;
        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = this.dataArray;

        const draw = () => {
            if (!this.isPlaying) return;
            this.animFrameId = requestAnimationFrame(draw);
            this.analyserNode.getByteFrequencyData(dataArray);

            ctx.fillStyle = "#05070c";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const numBars = 64;
            const barWidth = canvas.width / numBars;

            for (let i = 0; i < numBars; i++) {
                const index = Math.floor(Math.pow(i / numBars, 1.8) * (bufferLength / 2));
                const barHeight = (dataArray[index] / 255) * (canvas.height - 10);

                const hue = 180 + (i / numBars) * 110;
                ctx.fillStyle = `hsl(${hue}, 95%, 55%)`;
                ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1.5, barHeight);
            }
        };
        draw();
    },

    clearCanvas() {
        if (!this.canvasCtx || !this.canvas) return;
        this.canvasCtx.fillStyle = "#05070c";
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    updateUIState(isPlaying) {
        const btnPlay = document.getElementById("btnPlaySynth");
        if (btnPlay) {
            if (isPlaying) {
                btnPlay.classList.add("stop");
                btnPlay.innerHTML = "⏹️ Detener Síntesis";
            } else {
                btnPlay.classList.remove("stop");
                btnPlay.innerHTML = "▶️ Iniciar Sintetizador";
            }
        }
    }
};
