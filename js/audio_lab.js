/**
 * ==============================================================================
 * LABORATORIO DE AUDIO OPTIMIZADO (WEB AUDIO API & FFT CANVAS)
 * Proyecto 2: El Circuito RLC como Filtro de Audio - Grupo 3
 * Soporte para Sintetizador, Micrófono en Vivo, Bandeja de Playlist de Audios,
 * Controles Completos (Reproducir, Pausar, Reiniciar) y Filtrado RLC Dinámico
 * ==============================================================================
 */

const AudioLab = {
    audioCtx: null,
    isPlaying: false,
    filterEnabled: true,
    currentSource: null, // 'synth' | 'mic' | 'file' | null
    oscillators: [],
    micStream: null,
    micSourceNode: null,
    fileBufferNode: null,
    filterNode: null,
    analyserNode: null,
    gainNode: null,
    animFrameId: null,

    // Elementos en caché
    canvas: null,
    canvasCtx: null,
    dataArray: null,

    // Parámetros físicos del filtro RLC (Inicializados a R_audio = 50 Ω)
    R: 50.0,
    L: 0.5,
    C: 200e-6,

    // =========================================================================
    // ESTADO DE LA BANDEJA DE AUDIOS Y REPRODUCTOR MULTIMEDIA
    // =========================================================================
    playlist: [], // Array de { id, name, duration, size, buffer, type: 'custom' | 'project' }
    selectedTrackIndex: -1,
    playerState: 'stopped', // 'stopped' | 'playing' | 'paused'
    playbackStartedAt: 0,   // currentTime del audioCtx al iniciar
    offsetSeconds: 0,       // segundo de reproducción actual
    progressTimer: null,
    isSeeking: false,

    getCutoffFreq() {
        const omega_n = 1.0 / Math.sqrt(this.L * this.C);
        const f_n = omega_n / (2.0 * Math.PI);
        return Math.max(15, f_n * 2.2);
    },

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
                const dpr = window.devicePixelRatio || 1;
                this.canvas.width = 800 * dpr;
                this.canvas.height = 120 * dpr;
                this.canvas.style.width = "100%";
                this.canvas.style.maxWidth = "800px";
                this.canvas.style.height = "120px";
                this.canvasCtx = this.canvas.getContext("2d");
                this.canvasCtx.scale(dpr, dpr);
                this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
            }

            // Inicializar eventos de la bandeja de audios
            this.initPlaylistUI();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    formatTime(sec) {
        if (isNaN(sec) || sec < 0) return "00:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    },

    stopSynthAndMicOnly() {
        // Detener osciladores del sintetizador
        if (this.oscillators.length > 0) {
            this.oscillators.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            this.oscillators = [];
        }

        // Detener micrófono
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        if (this.micSourceNode) {
            try { this.micSourceNode.disconnect(); } catch (e) {}
            this.micSourceNode = null;
        }
        const btnMic = document.getElementById("btnLiveMic");
        if (btnMic) {
            btnMic.classList.remove("active");
            btnMic.innerHTML = '<i data-lucide="mic"></i> <span>Hablar por Micrófono</span>';
        }

        const btnPlaySynth = document.getElementById("btnPlaySynth");
        if (btnPlaySynth) {
            btnPlaySynth.classList.remove("stop");
            btnPlaySynth.innerHTML = '<i data-lucide="play"></i> <span>Iniciar Sintetizador</span>';
        }
    },

    stopAllAudio() {
        this.stopSynthAndMicOnly();

        // Detener reproducción de archivo activo
        if (this.fileBufferNode) {
            this.fileBufferNode.onended = null;
            try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
            this.fileBufferNode = null;
        }

        this.isPlaying = false;
        this.currentSource = null;
        this.playerState = 'stopped';
        this.offsetSeconds = 0;
        this.stopProgressTimer();

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        this.updateUIState(false);
        this.updateDeckUI();
        this.renderPlaylist();
        this.clearCanvas();
        this.updateSourceIndicator("Ninguna fuente activa");
        if (window.lucide) lucide.createIcons();
    },

    startLiveSynth() {
        this.initAudioContext();
        if (this.isPlaying && this.currentSource === 'synth') {
            this.stopAllAudio();
            return;
        }
        this.stopAllAudio();

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
        this.currentSource = 'synth';
        this.startSpectrumVisualizer();
        this.updateUIState(true);
        this.updateSourceIndicator("Fuente activa: Sintetizador Polifónico Multitono");
    },

    stopLiveSynth() {
        this.stopAllAudio();
    },

    async startLiveMic() {
        this.initAudioContext();
        const btnMic = document.getElementById("btnLiveMic");

        if (this.isPlaying && this.currentSource === 'mic') {
            this.stopAllAudio();
            return;
        }
        this.stopAllAudio();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micStream = stream;
            this.micSourceNode = this.audioCtx.createMediaStreamSource(stream);

            // Ajustar volumen controlado para prevenir acople
            this.gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);

            this.routeAudio(this.micSourceNode);
            this.isPlaying = true;
            this.currentSource = 'mic';
            this.startSpectrumVisualizer();

            if (btnMic) {
                btnMic.classList.add("active");
                btnMic.innerHTML = '<i data-lucide="volume-x"></i> <span>Detener Micrófono</span>';
                if (window.lucide) lucide.createIcons();
            }

            this.updateSourceIndicator("Fuente activa: Micrófono en Vivo (Voz Filtrada)");
        } catch (err) {
            console.error("Error al acceder al micrófono:", err);
            alert("No se pudo conectar el micrófono. Verifica los permisos de audio en tu navegador.");
        }
    },

    // =========================================================================
    // GESTIÓN DE AUDIOS CARGADOS, PLAYLIST Y REPRODUCTOR (PLAY, PAUSA, REINICIO)
    // =========================================================================

    initPlaylistUI() {
        const fileInput1 = document.getElementById("audioFileInput");
        const fileInput2 = document.getElementById("audioFileInputExtra");
        const btnPreload = document.getElementById("btnPreloadProjectTracks");
        const btnClear = document.getElementById("btnClearAllTracks");

        const btnPlay = document.getElementById("btnDeckPlay");
        const btnPause = document.getElementById("btnDeckPause");
        const btnRestart = document.getElementById("btnDeckRestart");
        const btnStop = document.getElementById("btnDeckStop");
        const progressBar = document.getElementById("deckProgressBar");

        if (fileInput1 && !fileInput1._bound) {
            fileInput1._bound = true;
            fileInput1.addEventListener("change", (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.loadFiles(e.target.files);
                }
            });
        }

        if (fileInput2 && !fileInput2._bound) {
            fileInput2._bound = true;
            fileInput2.addEventListener("change", (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.loadFiles(e.target.files);
                }
            });
        }

        if (btnPreload && !btnPreload._bound) {
            btnPreload._bound = true;
            btnPreload.addEventListener("click", () => {
                this.preloadProjectTracks();
            });
        }

        if (btnClear && !btnClear._bound) {
            btnClear._bound = true;
            btnClear.addEventListener("click", () => {
                this.clearAllTracks();
            });
        }

        if (btnPlay && !btnPlay._bound) {
            btnPlay._bound = true;
            btnPlay.addEventListener("click", () => {
                this.playDeckTrack();
            });
        }

        if (btnPause && !btnPause._bound) {
            btnPause._bound = true;
            btnPause.addEventListener("click", () => {
                this.pauseDeckTrack();
            });
        }

        if (btnRestart && !btnRestart._bound) {
            btnRestart._bound = true;
            btnRestart.addEventListener("click", () => {
                this.restartDeckTrack();
            });
        }

        if (btnStop && !btnStop._bound) {
            btnStop._bound = true;
            btnStop.addEventListener("click", () => {
                this.stopDeckTrack();
            });
        }

        if (progressBar && !progressBar._bound) {
            progressBar._bound = true;
            progressBar.addEventListener("input", (e) => {
                this.isSeeking = true;
                const targetSec = parseFloat(e.target.value);
                const curTrack = this.playlist[this.selectedTrackIndex];
                if (curTrack) {
                    const curTimeLbl = document.getElementById("deckCurrentTime");
                    if (curTimeLbl) curTimeLbl.textContent = this.formatTime(targetSec);
                }
            });

            progressBar.addEventListener("change", (e) => {
                this.isSeeking = false;
                const targetSec = parseFloat(e.target.value);
                this.seekDeckTrack(targetSec);
            });
        }
    },

    async loadFiles(fileList) {
        this.initAudioContext();
        let loadedCount = 0;

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

                const track = {
                    id: 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: file.name,
                    duration: audioBuffer.duration,
                    size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
                    buffer: audioBuffer,
                    type: 'custom'
                };

                this.playlist.push(track);
                loadedCount++;
            } catch (err) {
                console.error("Error al procesar el archivo:", file.name, err);
                alert(`No se pudo leer el archivo "${file.name}". Verifica que sea un formato de audio válido (.mp3, .wav, .ogg, .flac).`);
            }
        }

        if (loadedCount > 0) {
            // Si no había ninguno seleccionado, seleccionar el primero recién agregado
            if (this.selectedTrackIndex === -1) {
                this.selectedTrackIndex = this.playlist.length - loadedCount;
            }
            this.renderPlaylist();
            this.updateDeckUI();
            const lbl = document.getElementById("lblAudioFile");
            if (lbl) {
                const curTrack = this.playlist[this.selectedTrackIndex];
                lbl.textContent = curTrack.name.length > 15 ? curTrack.name.substring(0, 13) + "..." : curTrack.name;
            }
        }
    },

    // Compatibilidad hacia atrás con llamada anterior
    loadCustomFile(file) {
        if (!file) return;
        this.loadFiles([file]);
    },

    async preloadProjectTracks() {
        this.initAudioContext();
        const projectFiles = [
            { name: "audio_original.wav (Audio Sintético)", url: "audio_original.wav" },
            { name: "audio_filtrado_submarino.wav (Filtrado RLC)", url: "audio_filtrado_submarino.wav" }
        ];

        let addedCount = 0;
        for (const item of projectFiles) {
            // Evitar duplicados si ya existen
            if (this.playlist.some(t => t.name === item.name)) continue;

            try {
                const resp = await fetch(item.url);
                if (!resp.ok) throw new Error("Fetch falló con código " + resp.status);
                const arrayBuffer = await resp.arrayBuffer();
                const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

                this.playlist.push({
                    id: 'proj_' + Math.random().toString(36).substr(2, 6),
                    name: item.name,
                    duration: audioBuffer.duration,
                    size: "308 KB",
                    buffer: audioBuffer,
                    type: 'project'
                });
                addedCount++;
            } catch (err) {
                console.log("No se pudo precargar vía fetch relativo (comportamiento habitual en file:///):", err);
            }
        }

        if (addedCount > 0) {
            if (this.selectedTrackIndex === -1) this.selectedTrackIndex = 0;
            this.renderPlaylist();
            this.updateDeckUI();
        } else if (this.playlist.length === 0) {
            alert("En modo archivo local (file:///), por favor presiona '+ Agregar Audios' o 'Cargar Audio(s)' y selecciona directamente los archivos .wav desde la carpeta del proyecto.");
        }
    },

    selectTrack(index, autoplay = false) {
        if (index < 0 || index >= this.playlist.length) return;

        // Si ya está sonando esta misma pista, no reiniciar si solo se hace clic
        if (this.selectedTrackIndex === index && this.playerState === 'playing' && !autoplay) {
            return;
        }

        // Detener la reproducción actual
        if (this.fileBufferNode) {
            this.fileBufferNode.onended = null;
            try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
            this.fileBufferNode = null;
        }

        this.selectedTrackIndex = index;
        this.offsetSeconds = 0;
        this.playerState = 'stopped';
        this.isPlaying = false;
        this.stopProgressTimer();

        this.updateDeckUI();
        this.renderPlaylist();

        if (autoplay) {
            this.playDeckTrack();
        }
    },

    getDeckCurrentTime() {
        if (this.playerState === 'playing') {
            const elapsed = this.offsetSeconds + (this.audioCtx.currentTime - this.playbackStartedAt);
            const curTrack = this.playlist[this.selectedTrackIndex];
            return curTrack ? Math.min(elapsed, curTrack.duration) : 0;
        }
        return this.offsetSeconds;
    },

    playDeckTrack() {
        if (this.playlist.length === 0) return;
        if (this.selectedTrackIndex < 0) this.selectedTrackIndex = 0;

        this.initAudioContext();
        this.stopSynthAndMicOnly();

        const track = this.playlist[this.selectedTrackIndex];
        if (!track || !track.buffer) return;

        // Si ya hay un buffer node activo, detenerlo
        if (this.fileBufferNode) {
            this.fileBufferNode.onended = null;
            try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
            this.fileBufferNode = null;
        }

        const src = this.audioCtx.createBufferSource();
        src.buffer = track.buffer;
        this.routeAudio(src);
        this.fileBufferNode = src;

        let startOffset = this.offsetSeconds;
        if (startOffset < 0 || startOffset >= track.duration) {
            startOffset = 0;
        }
        this.offsetSeconds = startOffset;
        this.playbackStartedAt = this.audioCtx.currentTime;

        src.start(0, startOffset);

        src.onended = () => {
            if (this.playerState === 'playing') {
                const elapsed = this.offsetSeconds + (this.audioCtx.currentTime - this.playbackStartedAt);
                if (elapsed >= track.duration - 0.25) {
                    this.onDeckTrackEnded();
                }
            }
        };

        this.playerState = 'playing';
        this.isPlaying = true;
        this.currentSource = 'file';

        this.startSpectrumVisualizer();
        this.startProgressTimer();
        this.updateDeckUI();
        this.renderPlaylist();
        this.updateSourceIndicator(`Reproduciendo: ${track.name} (${this.filterEnabled ? 'Con Filtro RLC' : 'Audio Directo'})`);
    },

    pauseDeckTrack() {
        if (this.playerState !== 'playing' || !this.fileBufferNode) return;

        const curTime = this.getDeckCurrentTime();
        const curTrack = this.playlist[this.selectedTrackIndex];
        this.offsetSeconds = (curTrack && curTime >= curTrack.duration) ? 0 : curTime;

        this.fileBufferNode.onended = null;
        try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
        this.fileBufferNode = null;

        this.playerState = 'paused';
        this.isPlaying = false;
        this.stopProgressTimer();

        this.updateDeckUI();
        this.renderPlaylist();
        this.updateSourceIndicator(`En pausa: ${curTrack ? curTrack.name : ''} [${this.formatTime(this.offsetSeconds)}]`);
    },

    restartDeckTrack() {
        if (this.playlist.length === 0 || this.selectedTrackIndex < 0) return;
        this.initAudioContext();

        // Rebobinar offset al segundo 0
        this.offsetSeconds = 0;

        if (this.fileBufferNode) {
            this.fileBufferNode.onended = null;
            try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
            this.fileBufferNode = null;
        }

        // Iniciar reproducción inmediata desde el inicio
        this.playDeckTrack();
    },

    stopDeckTrack() {
        this.offsetSeconds = 0;
        this.playerState = 'stopped';
        this.isPlaying = false;

        if (this.fileBufferNode) {
            this.fileBufferNode.onended = null;
            try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
            this.fileBufferNode = null;
        }

        this.stopProgressTimer();
        this.clearCanvas();
        this.updateDeckUI();
        this.renderPlaylist();
        this.updateSourceIndicator("Reproductor en reposo (00:00)");
    },

    seekDeckTrack(targetSeconds) {
        const curTrack = this.playlist[this.selectedTrackIndex];
        if (!curTrack) return;

        targetSeconds = Math.max(0, Math.min(targetSeconds, curTrack.duration));
        this.offsetSeconds = targetSeconds;

        if (this.playerState === 'playing') {
            if (this.fileBufferNode) {
                this.fileBufferNode.onended = null;
                try { this.fileBufferNode.stop(); this.fileBufferNode.disconnect(); } catch (e) {}
                this.fileBufferNode = null;
            }
            this.playDeckTrack();
        } else {
            const curTimeLbl = document.getElementById("deckCurrentTime");
            if (curTimeLbl) curTimeLbl.textContent = this.formatTime(targetSeconds);
            const progressBar = document.getElementById("deckProgressBar");
            if (progressBar) progressBar.value = targetSeconds;
        }
    },

    onDeckTrackEnded() {
        this.playerState = 'stopped';
        this.offsetSeconds = 0;
        this.isPlaying = false;
        this.fileBufferNode = null;

        this.stopProgressTimer();
        this.clearCanvas();
        this.updateDeckUI();
        this.renderPlaylist();
        this.updateSourceIndicator("Pista finalizada");
    },

    removeTrack(index, event) {
        if (event) event.stopPropagation();
        if (index < 0 || index >= this.playlist.length) return;

        if (index === this.selectedTrackIndex) {
            this.stopDeckTrack();
            this.playlist.splice(index, 1);
            if (this.playlist.length > 0) {
                this.selectedTrackIndex = Math.min(index, this.playlist.length - 1);
            } else {
                this.selectedTrackIndex = -1;
            }
        } else if (index < this.selectedTrackIndex) {
            this.selectedTrackIndex--;
            this.playlist.splice(index, 1);
        } else {
            this.playlist.splice(index, 1);
        }

        this.renderPlaylist();
        this.updateDeckUI();
    },

    clearAllTracks() {
        this.stopDeckTrack();
        this.playlist = [];
        this.selectedTrackIndex = -1;
        this.offsetSeconds = 0;
        this.renderPlaylist();
        this.updateDeckUI();
    },

    startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(() => {
            if (this.playerState !== 'playing' || this.isSeeking) return;

            const curTime = this.getDeckCurrentTime();
            const curTrack = this.playlist[this.selectedTrackIndex];
            if (!curTrack) return;

            const curTimeLbl = document.getElementById("deckCurrentTime");
            if (curTimeLbl) curTimeLbl.textContent = this.formatTime(curTime);

            const progressBar = document.getElementById("deckProgressBar");
            if (progressBar) progressBar.value = curTime;
        }, 80);
    },

    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    },

    updateDeckUI() {
        const titleEl = document.getElementById("deckTrackTitle");
        const durEl = document.getElementById("deckTrackDuration");
        const statusEl = document.getElementById("deckTrackStatus");
        const iconWrapper = document.getElementById("deckIconWrapper");

        const curTimeLbl = document.getElementById("deckCurrentTime");
        const totalDurLbl = document.getElementById("deckTotalDuration");
        const progressBar = document.getElementById("deckProgressBar");

        const btnPlay = document.getElementById("btnDeckPlay");
        const btnPause = document.getElementById("btnDeckPause");
        const btnRestart = document.getElementById("btnDeckRestart");
        const btnStop = document.getElementById("btnDeckStop");

        const curTrack = this.playlist[this.selectedTrackIndex];

        if (!curTrack) {
            if (titleEl) titleEl.textContent = "Ningún audio seleccionado";
            if (durEl) durEl.textContent = "Duración: --:--";
            if (statusEl) {
                statusEl.textContent = "En espera";
                statusEl.className = "deck-status-pill status-idle";
            }
            if (iconWrapper) iconWrapper.classList.remove("pulsing");
            if (curTimeLbl) curTimeLbl.textContent = "00:00";
            if (totalDurLbl) totalDurLbl.textContent = "00:00";
            if (progressBar) {
                progressBar.max = 100;
                progressBar.value = 0;
                progressBar.disabled = true;
            }

            if (btnPlay) btnPlay.disabled = true;
            if (btnPause) btnPause.disabled = true;
            if (btnRestart) btnRestart.disabled = true;
            if (btnStop) btnStop.disabled = true;
            return;
        }

        // Si hay pista seleccionada
        if (titleEl) titleEl.textContent = curTrack.name;
        if (durEl) durEl.textContent = `Duración: ${this.formatTime(curTrack.duration)} (${curTrack.size})`;
        if (totalDurLbl) totalDurLbl.textContent = this.formatTime(curTrack.duration);

        if (progressBar) {
            progressBar.disabled = false;
            progressBar.max = curTrack.duration;
            if (!this.isSeeking) {
                progressBar.value = this.getDeckCurrentTime();
            }
        }
        if (curTimeLbl && !this.isSeeking) {
            curTimeLbl.textContent = this.formatTime(this.getDeckCurrentTime());
        }

        if (btnPlay) btnPlay.disabled = false;
        if (btnPause) btnPause.disabled = (this.playerState !== 'playing');
        if (btnRestart) btnRestart.disabled = false;
        if (btnStop) btnStop.disabled = (this.playerState === 'stopped');

        if (statusEl) {
            if (this.playerState === 'playing') {
                statusEl.textContent = "Reproduciendo";
                statusEl.className = "deck-status-pill status-playing";
                if (iconWrapper) iconWrapper.classList.add("pulsing");
            } else if (this.playerState === 'paused') {
                statusEl.textContent = "En Pausa";
                statusEl.className = "deck-status-pill status-paused";
                if (iconWrapper) iconWrapper.classList.remove("pulsing");
            } else {
                statusEl.textContent = "Listo";
                statusEl.className = "deck-status-pill status-idle";
                if (iconWrapper) iconWrapper.classList.remove("pulsing");
            }
        }
    },

    renderPlaylist() {
        const container = document.getElementById("playlistTracksList");
        const badgeCount = document.getElementById("playlistBadgeCount");
        const btnClear = document.getElementById("btnClearAllTracks");

        if (badgeCount) {
            badgeCount.textContent = `${this.playlist.length} ${this.playlist.length === 1 ? 'pista' : 'pistas'}`;
        }

        if (btnClear) {
            btnClear.style.display = this.playlist.length > 0 ? "inline-flex" : "none";
        }

        if (!container) return;

        if (this.playlist.length === 0) {
            container.innerHTML = `
                <div id="playlistEmptyState" class="playlist-empty-state">
                    <i data-lucide="music"></i>
                    <p>No hay audios en la bandeja.</p>
                    <span>Haz clic en <strong>"Cargar Audio(s)"</strong> para subir canciones o notas de voz (.wav, .mp3, .ogg), o presiona <strong>"Pistas del Proyecto"</strong>.</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        let html = "";
        this.playlist.forEach((track, idx) => {
            const isActive = idx === this.selectedTrackIndex;
            let statusText = "Elegir";
            if (isActive) {
                if (this.playerState === 'playing') statusText = "Sonando";
                else if (this.playerState === 'paused') statusText = "En Pausa";
                else statusText = "Seleccionada";
            }

            const originTag = track.type === 'project' 
                ? '<span class="track-origin-tag project">Proyecto</span>' 
                : '<span class="track-origin-tag">Subido</span>';

            html += `
                <div class="playlist-track-row ${isActive ? 'active' : ''}" onclick="AudioLab.selectTrack(${idx}, false)">
                    <div class="track-row-left">
                        <span class="track-num">${idx + 1}</span>
                        <div class="track-name-wrap">
                            <div class="track-name" title="${track.name}">${track.name}</div>
                            <div class="track-details">
                                <span>${this.formatTime(track.duration)}</span>
                                <span>•</span>
                                <span>${track.size}</span>
                                <span>•</span>
                                ${originTag}
                            </div>
                        </div>
                    </div>
                    <div class="track-row-right">
                        <button type="button" class="btn-select-track" onclick="event.stopPropagation(); AudioLab.selectTrack(${idx}, true);" title="${isActive && this.playerState === 'playing' ? 'Pista activa' : 'Seleccionar y reproducir'}">
                            <i data-lucide="${isActive && this.playerState === 'playing' ? 'volume-2' : 'play-circle'}" style="width:13px;height:13px;"></i>
                            <span>${statusText}</span>
                        </button>
                        <button type="button" class="btn-remove-track" onclick="AudioLab.removeTrack(${idx}, event);" title="Eliminar de la lista">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    },

    updateSourceIndicator(text) {
        const el = document.getElementById("audioSourceText");
        if (el) el.textContent = text;
    },

    toggleFilter() {
        this.filterEnabled = !this.filterEnabled;
        const btn = document.getElementById("btnToggleFilter");
        if (btn) {
            if (this.filterEnabled) {
                btn.innerHTML = '<i data-lucide="filter"></i> <span>Filtro RLC: <strong>ACTIVADO (Bajo el Agua)</strong></span>';
                btn.style.borderColor = "var(--accent-cyan)";
                btn.classList.add("btn-filter-active");
            } else {
                btn.innerHTML = '<i data-lucide="volume-2"></i> <span>Filtro RLC: <strong>DESACTIVADO (Audio Original)</strong></span>';
                btn.style.borderColor = "var(--border-glass)";
                btn.classList.remove("btn-filter-active");
            }
            if (window.lucide) lucide.createIcons();
        }
        if (this.filterNode && this.audioCtx) {
            const targetFreq = this.filterEnabled ? this.getCutoffFreq() : 18000.0;
            this.filterNode.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.06);
        }

        // Sincronizar la animación de inmersión del altavoz submarino
        if (typeof UnderwaterSpeaker !== 'undefined') {
            if (this.filterEnabled) {
                UnderwaterSpeaker.submerge();
            } else {
                UnderwaterSpeaker.surface();
            }
        }

        if (this.playerState === 'playing' && this.playlist[this.selectedTrackIndex]) {
            this.updateSourceIndicator(`Reproduciendo: ${this.playlist[this.selectedTrackIndex].name} (${this.filterEnabled ? 'Con Filtro RLC' : 'Audio Directo'})`);
        }
    },

    routeAudio(sourceNode) {
        try { sourceNode.disconnect(); } catch (e) {}
        sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.analyserNode);
        this.analyserNode.connect(this.gainNode);

        const targetFreq = this.filterEnabled ? this.getCutoffFreq() : 18000.0;
        this.filterNode.frequency.setValueAtTime(targetFreq, this.audioCtx.currentTime);
    },

    updateFilterParams(R, L, C) {
        if (R !== undefined) this.R = R;
        if (L !== undefined) this.L = L;
        if (C !== undefined) this.C = C;
        if (!this.filterNode || !this.audioCtx) return;
        const omega_n = 1.0 / Math.sqrt(this.L * this.C);
        const f_n = omega_n / (2.0 * Math.PI);
        const zeta = this.R / (2.0 * Math.sqrt(this.L / this.C));
        const Q = 1.0 / (2.0 * zeta);

        if (this.filterEnabled) {
            this.filterNode.frequency.setTargetAtTime(this.getCutoffFreq(), this.audioCtx.currentTime, 0.05);
            this.filterNode.Q.setTargetAtTime(Math.min(8, Math.max(0.1, Q)), this.audioCtx.currentTime, 0.05);
        }
    },

    startSpectrumVisualizer() {
        if (!this.canvasCtx || !this.canvas || !this.analyserNode) return;
        const ctx = this.canvasCtx;
        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = this.dataArray;
        const w = 800;
        const h = 120;

        const draw = () => {
            if (!this.isPlaying) return;
            this.animFrameId = requestAnimationFrame(draw);
            this.analyserNode.getByteFrequencyData(dataArray);

            ctx.fillStyle = "#0b111e";
            ctx.fillRect(0, 0, w, h);

            // Líneas de referencia de cuadrícula discretas (dB/frecuencia)
            ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h * 0.25); ctx.lineTo(w, h * 0.25);
            ctx.moveTo(0, h * 0.50); ctx.lineTo(w, h * 0.50);
            ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75);
            ctx.stroke();

            const numBars = 64;
            const barWidth = w / numBars;

            for (let i = 0; i < numBars; i++) {
                const index = Math.floor(Math.pow(i / numBars, 1.8) * (bufferLength / 2));
                const barHeight = Math.max(2, (dataArray[index] / 255) * (h - 10));

                const barGrad = ctx.createLinearGradient(0, h, 0, h - barHeight);
                barGrad.addColorStop(0, "rgba(2, 132, 199, 0.85)");
                barGrad.addColorStop(0.6, "rgba(56, 189, 248, 0.95)");
                barGrad.addColorStop(1, "rgba(125, 211, 252, 1.0)");

                ctx.fillStyle = barGrad;
                ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1.5, barHeight);

                ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
                ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1.5, 1.5);
            }
        };
        draw();
    },

    clearCanvas() {
        if (!this.canvasCtx || !this.canvas) return;
        this.canvasCtx.fillStyle = "#0b111e";
        this.canvasCtx.fillRect(0, 0, 800, 120);
    },

    updateUIState(isPlaying) {
        const btnPlay = document.getElementById("btnPlaySynth");
        if (btnPlay) {
            if (isPlaying && this.currentSource === 'synth') {
                btnPlay.classList.add("stop");
                btnPlay.innerHTML = '<i data-lucide="square"></i> <span>Detener Síntesis</span>';
            } else {
                btnPlay.classList.remove("stop");
                btnPlay.innerHTML = '<i data-lucide="play"></i> <span>Iniciar Sintetizador</span>';
            }
            if (window.lucide) lucide.createIcons();
        }
    }
};
