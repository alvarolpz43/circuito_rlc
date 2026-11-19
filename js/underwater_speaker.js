/**
 * ==============================================================================
 * SIMULACIÓN FÍSICA ACÚSTICA: ALTAVOZ SUMERGIBLE (EFECTO FILTRO PASA-BAJOS RLC)
 * Laboratorio de Audio Interactivo - Proyecto 2: Ecuaciones Diferenciales
 * Simulación a 60 FPS con Dinámica de Fluidos, Ondas Sonoras y Web Audio API
 * ==============================================================================
 */

const UnderwaterSpeaker = {
    canvas: null,
    ctx: null,
    animId: null,
    isRunning: false,

    // Geometría y dimensiones
    width: 900,
    height: 360,
    waterLevel: 140, // Nivel del agua en px

    // Estado físico del altavoz
    // depth: 0.0 = totalmente en el aire; 1.0 = totalmente sumergido
    currentDepth: 1.0,
    targetDepth: 1.0,
    depthVelocity: 0.0,
    speakerX: 450,
    speakerY: 240, // Posición vertical calculada
    speakerWidth: 120,
    speakerHeight: 160,

    // Excursión y vibración de la membrana del altavoz
    coneExcursion: 0.0,
    conePhase: 0.0,

    // Colecciones de partículas y ondas
    bubbles: [],
    soundWaves: [],
    splashes: [],
    drips: [],
    surfaceRipples: [],
    ambientParticles: [],
    causticRays: [],

    // Tiempo y temporizadores
    time: 0.0,
    lastCrossTime: 0,
    previousDepth: 1.0,
    autoCycleTimer: null,
    isAutoCycling: false,

    init() {
        this.canvas = document.getElementById("canvasUnderwaterSpeaker");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");

        this.resize();
        window.addEventListener("resize", () => this.resize());

        // Inicializar partículas ambientales subacuáticas y rayos cáusticos
        this.initAmbientParticles(35);
        this.initCausticRays(7);

        // Enlazar controles interactivos del DOM
        this.bindEvents();

        // Arrancar bucle de animación
        this.start();
    },

    resize() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayW = rect.width || 900;
        const displayH = Math.round(displayW * (360 / 900));

        this.canvas.width = 900 * dpr;
        this.canvas.height = 360 * dpr;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "auto";
        this.canvas.style.aspectRatio = "900 / 360";

        if (this.ctx.resetTransform) {
            this.ctx.resetTransform();
        } else {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        this.ctx.scale(dpr, dpr);
    },

    bindEvents() {
        const btnToggle = document.getElementById("btnToggleSubmerge");
        const btnCycle = document.getElementById("btnAnimateSubmergeCycle");
        const sliderDepth = document.getElementById("sliderImmersionDepth");

        if (btnToggle) {
            btnToggle.addEventListener("click", () => {
                this.toggleSubmerge();
            });
        }

        if (btnCycle) {
            btnCycle.addEventListener("click", () => {
                this.startDemoCycle();
            });
        }

        if (sliderDepth) {
            sliderDepth.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value) / 100.0;
                this.setDepth(val, true);
            });
        }

        // Permitir interactuar haciendo clic directamente en el canvas
        if (this.canvas) {
            this.canvas.addEventListener("click", (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = 900 / rect.width;
                const scaleY = 360 / rect.height;
                const clickX = (e.clientX - rect.left) * scaleX;
                const clickY = (e.clientY - rect.top) * scaleY;

                // Si se hace clic en la zona del altavoz o en el agua, alternar inmersión
                this.toggleSubmerge();
            });
        }
    },

    initAmbientParticles(count) {
        this.ambientParticles = [];
        for (let i = 0; i < count; i++) {
            this.ambientParticles.push({
                x: Math.random() * this.width,
                y: this.waterLevel + Math.random() * (this.height - this.waterLevel),
                radius: 1 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.3,
                alpha: 0.15 + Math.random() * 0.35
            });
        }
    },

    initCausticRays(count) {
        this.causticRays = [];
        const spacing = this.width / count;
        for (let i = 0; i < count; i++) {
            this.causticRays.push({
                xTop: i * spacing + spacing * 0.3,
                widthTop: 25 + Math.random() * 30,
                xBottom: i * spacing - 40 + Math.random() * 80,
                widthBottom: 70 + Math.random() * 60,
                phase: Math.random() * Math.PI * 2,
                speed: 0.02 + Math.random() * 0.02,
                alphaBase: 0.05 + Math.random() * 0.07
            });
        }
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        const loop = () => {
            if (!this.isRunning) return;
            this.update();
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    },

    pause() {
        this.isRunning = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    },

    /**
     * Alterna suavemente entre Sumergido (1.0) y En el Aire (0.0)
     */
    toggleSubmerge() {
        if (this.targetDepth > 0.5) {
            this.surface();
        } else {
            this.submerge();
        }
    },

    submerge() {
        this.targetDepth = 1.0;
        this.syncSlider();
        this.updateAudioLabFilter(true);
        this.updateUI();
    },

    surface() {
        this.targetDepth = 0.0;
        this.syncSlider();
        this.updateAudioLabFilter(false);
        this.updateUI();
    },

    setDepth(depthFraction, updateFilter = true) {
        this.targetDepth = Math.max(0.0, Math.min(1.0, depthFraction));
        this.syncSlider();
        if (updateFilter) {
            const isSubmerged = this.targetDepth > 0.45;
            this.updateAudioLabFilter(isSubmerged, this.targetDepth);
        }
        this.updateUI();
    },

    startDemoCycle() {
        if (this.isAutoCycling) return;
        this.isAutoCycling = true;
        const btnCycle = document.getElementById("btnAnimateSubmergeCycle");
        if (btnCycle) btnCycle.classList.add("active");

        // Secuencia: Sumergir -> Esperar -> Emerger -> Fin
        this.submerge();

        setTimeout(() => {
            this.surface();
            setTimeout(() => {
                this.isAutoCycling = false;
                if (btnCycle) btnCycle.classList.remove("active");
            }, 3000);
        }, 3500);
    },

    syncSlider() {
        const slider = document.getElementById("sliderImmersionDepth");
        if (slider) {
            slider.value = Math.round(this.targetDepth * 100);
        }
    },

    updateAudioLabFilter(isSubmerged, continuousDepth = null) {
        if (typeof AudioLab === 'undefined') return;

        // Si se provee profundidad continua, interpolar frecuencia de corte
        if (continuousDepth !== null && AudioLab.filterNode && AudioLab.audioCtx) {
            // De 20,000 Hz (aire, depth=0) a 25 Hz (sumergido, depth=1)
            // Interpolación logarítmica acústica realista
            const fMin = AudioLab.getCutoffFreq ? AudioLab.getCutoffFreq() : 25.0;
            const fMax = 18000.0;
            const targetFreq = fMax * Math.pow(fMin / fMax, continuousDepth);
            AudioLab.filterNode.frequency.setTargetAtTime(targetFreq, AudioLab.audioCtx.currentTime, 0.06);

            // Sincronizar estado booleano
            AudioLab.filterEnabled = continuousDepth > 0.45;
        } else {
            if (AudioLab.filterEnabled !== isSubmerged) {
                AudioLab.filterEnabled = isSubmerged;
                if (AudioLab.filterNode && AudioLab.audioCtx) {
                    const targetFreq = isSubmerged ? (AudioLab.getCutoffFreq ? AudioLab.getCutoffFreq() : 25.0) : 18000.0;
                    AudioLab.filterNode.frequency.setTargetAtTime(targetFreq, AudioLab.audioCtx.currentTime, 0.08);
                }
            }
        }

        // Sincronizar botón de filtro del audio lab
        const btnFilter = document.getElementById("btnToggleFilter");
        if (btnFilter) {
            if (AudioLab.filterEnabled) {
                btnFilter.innerHTML = '<i data-lucide="filter"></i> <span>Filtro RLC: <strong>ACTIVADO (Bajo el Agua)</strong></span>';
                btnFilter.classList.add("btn-filter-active");
            } else {
                btnFilter.innerHTML = '<i data-lucide="volume-2"></i> <span>Filtro RLC: <strong>DESACTIVADO (Audio Original)</strong></span>';
                btnFilter.classList.remove("btn-filter-active");
            }
            if (window.lucide) lucide.createIcons();
        }
    },

    updateUI() {
        const badge = document.getElementById("submergeBadge");
        const badgeText = document.getElementById("submergeBadgeText");
        const btnToggle = document.getElementById("btnToggleSubmerge");
        const btnSubmergeLabel = document.getElementById("btnSubmergeLabel");
        const txtDepth = document.getElementById("txtImmersionDepth");
        const lblMedium = document.getElementById("lblAcousticMedium");
        const lblCutoff = document.getElementById("lblAcousticCutoff");

        const pct = Math.round(this.targetDepth * 100);
        if (txtDepth) txtDepth.textContent = `${pct}% (${this.targetDepth > 0.5 ? 'Sumergida' : 'En el Aire'})`;

        if (this.targetDepth > 0.5) {
            if (badge) {
                badge.className = "submerge-badge submerged";
            }
            if (badgeText) {
                badgeText.innerHTML = '<i data-lucide="waves"></i> Sumergida (Filtro RLC Activo - Pasa-Bajos)';
                if (window.lucide) lucide.createIcons();
            }
            if (btnSubmergeLabel) btnSubmergeLabel.textContent = "Emerger al Aire (Desactivar Filtro)";
            if (lblMedium) {
                lblMedium.textContent = "Agua Líquida (ρ = 1000 kg/m³)";
                lblMedium.style.color = "var(--accent-cyan)";
            }
            if (lblCutoff) {
                lblCutoff.textContent = "25 Hz (Graves Únicamente)";
                lblCutoff.style.color = "var(--accent-amber)";
            }
        } else {
            if (badge) {
                badge.className = "submerge-badge surface";
            }
            if (badgeText) {
                badgeText.innerHTML = '<i data-lucide="volume-2"></i> En el Aire (Filtro Desactivado - Espectro Completo)';
                if (window.lucide) lucide.createIcons();
            }
            if (btnSubmergeLabel) btnSubmergeLabel.textContent = "Sumergir Altavoz (Activar Filtro)";
            if (lblMedium) {
                lblMedium.textContent = "Aire Ambiente (ρ = 1.2 kg/m³)";
                lblMedium.style.color = "var(--accent-green)";
            }
            if (lblCutoff) {
                lblCutoff.textContent = "20,000 Hz (Espectro Completo)";
                lblCutoff.style.color = "var(--accent-green)";
            }
        }
    },

    update() {
        this.time += 0.016;

        // 1. Dinámica suave de descenso/ascenso (Resorte-Amortiguador de 2do orden)
        const springK = 0.055;
        const damping = 0.82;
        const force = (this.targetDepth - this.currentDepth) * springK;
        this.depthVelocity = (this.depthVelocity + force) * damping;
        this.currentDepth += this.depthVelocity;

        // Mapeo de profundidad a coordenada Y del altavoz:
        // depth=0.0 -> Y=65 px (completamente fuera del agua)
        // depth=1.0 -> Y=245 px (completamente sumergido en el fondo)
        this.speakerY = 65 + this.currentDepth * (245 - 65);

        // Detectar cruce de superficie para generar salpicaduras
        const speakerBottom = this.speakerY + this.speakerHeight * 0.45;
        const speakerTop = this.speakerY - this.speakerHeight * 0.45;
        const isCrossing = (speakerBottom >= this.waterLevel && speakerTop <= this.waterLevel);

        if (Math.abs(this.depthVelocity) > 0.005 && isCrossing) {
            const now = Date.now();
            if (now - this.lastCrossTime > 120) {
                this.lastCrossTime = now;
                this.createSplash(this.speakerX, this.waterLevel, Math.abs(this.depthVelocity) * 22);
            }
        }

        // Si el altavoz emerge, generar gotas goteando desde su base
        if (this.currentDepth < 0.6 && this.depthVelocity < -0.002) {
            if (Math.random() < 0.3) {
                this.drips.push({
                    x: this.speakerX + (Math.random() - 0.5) * (this.speakerWidth * 0.7),
                    y: speakerBottom,
                    vy: 1.5 + Math.random() * 2,
                    radius: 1.5 + Math.random() * 1.5
                });
            }
        }

        // 2. Vibración del cono / diafragma reactivo al audio
        let audioAmp = 0.0;
        if (typeof AudioLab !== 'undefined' && AudioLab.isPlaying && AudioLab.analyserNode && AudioLab.dataArray) {
            AudioLab.analyserNode.getByteFrequencyData(AudioLab.dataArray);
            // Tomar energía de bajos
            let bassSum = 0;
            for (let i = 0; i < 8; i++) bassSum += AudioLab.dataArray[i];
            audioAmp = (bassSum / (8 * 255.0)) * 14.0;
        } else {
            // Si no hay audio sonando, vibración sutil ambiental
            audioAmp = (Math.sin(this.time * 8.0) * 0.5 + 0.5) * 2.5;
        }
        this.coneExcursion = audioAmp;

        // 3. Emisión periódica de ondas de sonido
        if (Math.floor(this.time * 60) % 14 === 0) {
            const isUnder = this.speakerY > this.waterLevel + 10;
            this.soundWaves.push({
                x: this.speakerX,
                y: this.speakerY + 15,
                radius: 35,
                maxRadius: isUnder ? 170 : 260,
                speed: isUnder ? 1.7 : 3.6,
                isUnderwater: isUnder,
                alpha: 0.9,
                color: isUnder ? "cyan" : "gold"
            });
        }

        // 4. Emisión de burbujas continuas si está bajo el agua
        if (this.currentDepth > 0.3) {
            const bubbleRate = Math.min(0.6, 0.15 + this.currentDepth * 0.35 + (audioAmp > 3 ? 0.3 : 0));
            if (Math.random() < bubbleRate) {
                this.bubbles.push({
                    x: this.speakerX + (Math.random() - 0.5) * (this.speakerWidth * 0.8),
                    y: this.speakerY + (Math.random() - 0.3) * (this.speakerHeight * 0.4),
                    radius: 2 + Math.random() * 4.5,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -(1.2 + Math.random() * 2.0),
                    wobbleSpeed: 4 + Math.random() * 4,
                    wobbleAmp: 1.5 + Math.random() * 2,
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        // Actualizar ondas sonoras
        for (let i = this.soundWaves.length - 1; i >= 0; i--) {
            const w = this.soundWaves[i];
            w.radius += w.speed;
            w.alpha = Math.max(0, 1 - (w.radius / w.maxRadius));
            if (w.radius >= w.maxRadius || w.alpha <= 0.01) {
                this.soundWaves.splice(i, 1);
            }
        }

        // Actualizar burbujas
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.y += b.vy;
            b.x += b.vx + Math.sin(this.time * b.wobbleSpeed + b.phase) * 0.4;

            // Al tocar la superficie, revienta la burbuja y hace una onda
            if (b.y <= this.waterLevel + 2) {
                this.surfaceRipples.push({
                    x: b.x,
                    y: this.waterLevel,
                    radius: 2,
                    maxRadius: 18 + b.radius * 3,
                    alpha: 0.7
                });
                this.bubbles.splice(i, 1);
            }
        }

        // Actualizar gotas
        for (let i = this.drips.length - 1; i >= 0; i--) {
            const d = this.drips[i];
            d.vy += 0.25; // Gravedad
            d.y += d.vy;
            if (d.y >= this.waterLevel) {
                this.surfaceRipples.push({
                    x: d.x,
                    y: this.waterLevel,
                    radius: 2,
                    maxRadius: 22,
                    alpha: 0.8
                });
                this.drips.splice(i, 1);
            }
        }

        // Actualizar salpicaduras
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.x += s.vx;
            s.vy += 0.35; // Gravedad
            s.y += s.vy;
            s.alpha -= 0.02;
            if (s.y >= this.waterLevel + 10 || s.alpha <= 0) {
                this.splashes.splice(i, 1);
            }
        }

        // Actualizar ondas de superficie
        for (let i = this.surfaceRipples.length - 1; i >= 0; i--) {
            const r = this.surfaceRipples[i];
            r.radius += 0.9;
            r.alpha -= 0.025;
            if (r.alpha <= 0 || r.radius >= r.maxRadius) {
                this.surfaceRipples.splice(i, 1);
            }
        }

        // Actualizar partículas ambientales
        this.ambientParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = this.width;
            if (p.x > this.width) p.x = 0;
            if (p.y < this.waterLevel + 5) p.y = this.height - 10;
            if (p.y > this.height) p.y = this.waterLevel + 10;
        });
    },

    createSplash(centerX, surfaceY, intensity) {
        const count = Math.min(30, Math.floor(10 + intensity * 2));
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 2 + Math.random() * (intensity * 0.5 + 4);
            this.splashes.push({
                x: centerX + (Math.random() - 0.5) * (this.speakerWidth * 0.9),
                y: surfaceY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 2.5,
                alpha: 0.9
            });
        }
        // Generar onda expansiva en la superficie
        this.surfaceRipples.push({
            x: centerX - 30,
            y: surfaceY,
            radius: 5,
            maxRadius: 60,
            alpha: 0.9
        });
        this.surfaceRipples.push({
            x: centerX + 30,
            y: surfaceY,
            radius: 5,
            maxRadius: 60,
            alpha: 0.9
        });
    },

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        const w = this.width;
        const h = this.height;

        // Limpiar lienzo
        ctx.clearRect(0, 0, w, h);

        // 1. Fondo de aire superior (Gradiente atmósfera estudio)
        const airGrad = ctx.createLinearGradient(0, 0, 0, this.waterLevel);
        airGrad.addColorStop(0, "#080c14");
        airGrad.addColorStop(1, "#0d1527");
        ctx.fillStyle = airGrad;
        ctx.fillRect(0, 0, w, this.waterLevel);

        // Líneas sutiles de cuadrícula de estudio en el aire
        ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 40; x < w; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.waterLevel);
            ctx.stroke();
        }

        // 2. Volumen de agua subacuático (Gradiente abisal oceánico con luz)
        const waterGrad = ctx.createLinearGradient(0, this.waterLevel, 0, h);
        waterGrad.addColorStop(0, "rgba(8, 145, 178, 0.55)");
        waterGrad.addColorStop(0.25, "rgba(3, 105, 161, 0.78)");
        waterGrad.addColorStop(0.7, "rgba(15, 23, 42, 0.94)");
        waterGrad.addColorStop(1, "#040d1a");
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, this.waterLevel, w, h - this.waterLevel);

        // 3. Rayos de luz cáusticos subacuáticos (God rays)
        this.causticRays.forEach(ray => {
            const alphaPulse = ray.alphaBase + Math.sin(this.time * ray.speed * 40 + ray.phase) * 0.035;
            const rayGrad = ctx.createLinearGradient(ray.xTop, this.waterLevel, ray.xBottom, h);
            rayGrad.addColorStop(0, `rgba(56, 189, 248, ${alphaPulse * 1.5})`);
            rayGrad.addColorStop(0.5, `rgba(14, 165, 233, ${alphaPulse})`);
            rayGrad.addColorStop(1, "rgba(2, 132, 199, 0.0)");

            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(ray.xTop - ray.widthTop * 0.5, this.waterLevel);
            ctx.lineTo(ray.xTop + ray.widthTop * 0.5, this.waterLevel);
            ctx.lineTo(ray.xBottom + ray.widthBottom * 0.5, h);
            ctx.lineTo(ray.xBottom - ray.widthBottom * 0.5, h);
            ctx.closePath();
            ctx.fill();
        });

        // 4. Partículas flotantes ambientales bajo el agua
        this.ambientParticles.forEach(p => {
            ctx.fillStyle = `rgba(186, 230, 253, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 5. Dibujar Ondas Sonoras acústicas emitidas (Detrás del altavoz)
        this.renderSoundWaves();

        // 6. Dibujar Cables de suspensión y Soporte mecánico
        this.renderSuspensionRig();

        // 7. Dibujar el Altavoz (Bocina) con altísima fidelidad
        this.renderSpeakerCabinet();

        // 8. Dibujar Burbujas ascendentes
        this.renderBubbles();

        // 9. Dibujar Gotas de agua y Salpicaduras
        this.renderSplashesAndDrips();

        // 10. Superficie del Agua dinámica (Ondas sinusoidales animadas y reflejos)
        this.renderWaterSurface();

        // 11. Ondas circulares en la superficie del agua (Ripples)
        this.renderSurfaceRipples();

        // 12. Interfaz y Lectura Física sobrepuesta (HUD Científico)
        this.renderHUD();
    },

    renderSuspensionRig() {
        const ctx = this.ctx;
        const spX = this.speakerX;
        const spTop = this.speakerY - this.speakerHeight * 0.5;

        // Riel superior en el techo
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(spX - 80, 0, 160, 8);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(spX - 80, 0, 160, 8);

        // Polea / montaje central
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(spX, 10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#64748b";
        ctx.stroke();

        // Cables dobles trenzados de acero
        ctx.strokeStyle = "rgba(203, 213, 225, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spX - 35, 10);
        ctx.lineTo(spX - 35, spTop);
        ctx.moveTo(spX + 35, 10);
        ctx.lineTo(spX + 35, spTop);
        ctx.stroke();

        // Argollas de anclaje en el altavoz
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        ctx.arc(spX - 35, spTop, 4, 0, Math.PI * 2);
        ctx.arc(spX + 35, spTop, 4, 0, Math.PI * 2);
        ctx.fill();
    },

    renderSpeakerCabinet() {
        const ctx = this.ctx;
        const x = this.speakerX - this.speakerWidth * 0.5;
        const y = this.speakerY - this.speakerHeight * 0.5;
        const w = this.speakerWidth;
        const h = this.speakerHeight;
        const cx = this.speakerX;
        const cy = this.speakerY;

        ctx.save();

        // Efecto de tinte acuático y refracción si está sumergido
        const isSubmerged = this.speakerY > this.waterLevel;
        if (isSubmerged) {
            ctx.shadowColor = "rgba(6, 182, 212, 0.45)";
            ctx.shadowBlur = 18;
        } else {
            ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 8;
        }

        // Caja principal del altavoz (Bafle acústico con esquinas redondeadas)
        const boxGrad = ctx.createLinearGradient(x, y, x + w, y + h);
        if (isSubmerged) {
            boxGrad.addColorStop(0, "#0e1a2b");
            boxGrad.addColorStop(0.5, "#0b1522");
            boxGrad.addColorStop(1, "#07111c");
        } else {
            boxGrad.addColorStop(0, "#1e293b");
            boxGrad.addColorStop(0.5, "#0f172a");
            boxGrad.addColorStop(1, "#090d16");
        }

        ctx.fillStyle = boxGrad;
        this.roundRect(ctx, x, y, w, h, 14, true, false);

        // Borde biselado metálico
        ctx.strokeStyle = isSubmerged ? "rgba(56, 189, 248, 0.6)" : "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 2;
        this.roundRect(ctx, x, y, w, h, 14, false, true);

        ctx.restore();

        // Acento frontal: placa de marca científica
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(cx - 18, y + 10, 36, 3);

        // 1. Tweeter superior (Altavoz de frecuencias agudas)
        const twY = cy - 38;
        const twRadius = 16;

        ctx.fillStyle = "#020617";
        ctx.beginPath();
        ctx.arc(cx, twY, twRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cúpula del tweeter
        const twDomeGrad = ctx.createRadialGradient(cx - 3, twY - 3, 2, cx, twY, twRadius);
        if (this.currentDepth < 0.4) {
            twDomeGrad.addColorStop(0, "#fde047");
            twDomeGrad.addColorStop(0.4, "#eab308");
            twDomeGrad.addColorStop(1, "#713f12");
        } else {
            twDomeGrad.addColorStop(0, "#38bdf8");
            twDomeGrad.addColorStop(0.5, "#0284c7");
            twDomeGrad.addColorStop(1, "#0369a1");
        }
        ctx.fillStyle = twDomeGrad;
        ctx.beginPath();
        ctx.arc(cx, twY, twRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Rejilla microperforada del tweeter
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, twY, twRadius * 0.35, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Woofer principal (Altavoz de graves & excursión dinámica)
        const wfY = cy + 22;
        const baseWfRadius = 38;
        const excursion = this.coneExcursion;
        const wfRadius = baseWfRadius + excursion * 0.4;

        // Suspensión de goma periférica (Surround)
        const rubberGrad = ctx.createRadialGradient(cx, wfY, wfRadius * 0.7, cx, wfY, wfRadius);
        rubberGrad.addColorStop(0, "#0f172a");
        rubberGrad.addColorStop(0.7, "#1e293b");
        rubberGrad.addColorStop(1, "#334155");
        ctx.fillStyle = rubberGrad;
        ctx.beginPath();
        ctx.arc(cx, wfY, wfRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isSubmerged ? "rgba(56, 189, 248, 0.5)" : "rgba(203, 213, 225, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cono de pulpa/polipropileno (Cono cóncavo vibrante)
        const coneGrad = ctx.createRadialGradient(cx - 5, wfY - 5, 4, cx, wfY, wfRadius * 0.75);
        coneGrad.addColorStop(0, "#1e293b");
        coneGrad.addColorStop(0.6, "#090d16");
        coneGrad.addColorStop(1, "#020617");
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.arc(cx, wfY, wfRadius * 0.78, 0, Math.PI * 2);
        ctx.fill();

        // Cúpula antipolvo central (Dust Cap) con excursión visible
        const capRadius = 14 + excursion * 0.6;
        const capGrad = ctx.createRadialGradient(cx - 3, wfY - 3, 2, cx, wfY, capRadius);
        capGrad.addColorStop(0, "#64748b");
        capGrad.addColorStop(0.5, "#1e293b");
        capGrad.addColorStop(1, "#0b0f19");
        ctx.fillStyle = capGrad;
        ctx.beginPath();
        ctx.arc(cx, wfY, capRadius, 0, Math.PI * 2);
        ctx.fill();

        // Anillo de brillo dinámico en el dust cap al vibrar
        if (excursion > 1.0) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.8, excursion * 0.15)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, wfY, capRadius * 0.85, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 3. Puerto Bass Reflex sintonizado (agujero inferior acústico)
        const portY = cy + 64;
        ctx.fillStyle = "#020408";
        ctx.beginPath();
        ctx.arc(cx, portY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // LED indicador de estado en el altavoz
        ctx.fillStyle = isSubmerged ? "#06b6d4" : "#22c55e";
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = isSubmerged ? "#06b6d4" : "#22c55e";
        ctx.shadowBlur = 6;
    },

    renderSoundWaves() {
        const ctx = this.ctx;
        this.soundWaves.forEach(w => {
            ctx.save();
            ctx.lineWidth = w.isUnderwater ? 3.5 : 2.0;

            if (w.isUnderwater) {
                // Onda acústica sumergida: gruesa, azul profunda, fuertemente amortiguada
                ctx.strokeStyle = `rgba(6, 182, 212, ${w.alpha * 0.65})`;
                ctx.shadowColor = "#0284c7";
                ctx.shadowBlur = 10;
            } else {
                // Onda acústica en el aire: rápida, brillante, tonos dorados y cian (agudos activos)
                ctx.strokeStyle = `rgba(250, 204, 21, ${w.alpha * 0.85})`;
                ctx.shadowColor = "#eab308";
                ctx.shadowBlur = 8;
            }

            // Emitir arcos concéntricos frontales hacia la izquierda y derecha
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, -Math.PI * 0.85, Math.PI * 0.85, false);
            ctx.stroke();

            // Ondulaciones secundarias que representan armónicos agudos si está en el aire
            if (!w.isUnderwater && w.alpha > 0.4) {
                ctx.strokeStyle = `rgba(56, 189, 248, ${w.alpha * 0.6})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.radius - 5, -Math.PI * 0.75, Math.PI * 0.75, false);
                ctx.stroke();
            }

            ctx.restore();
        });
    },

    renderBubbles() {
        const ctx = this.ctx;
        this.bubbles.forEach(b => {
            ctx.save();

            // Gradiente esférico translúcido para cada burbuja
            const bGrad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.1, b.x, b.y, b.radius);
            bGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
            bGrad.addColorStop(0.3, "rgba(186, 230, 253, 0.7)");
            bGrad.addColorStop(0.8, "rgba(56, 189, 248, 0.3)");
            bGrad.addColorStop(1, "rgba(2, 132, 199, 0.8)");

            ctx.fillStyle = bGrad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();

            // Reflejo especular blanco
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.beginPath();
            ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.25, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    },

    renderSplashesAndDrips() {
        const ctx = this.ctx;

        // Salpicaduras
        this.splashes.forEach(s => {
            ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Gotas escurriendo
        this.drips.forEach(d => {
            ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    renderWaterSurface() {
        const ctx = this.ctx;
        const w = this.width;
        const baseY = this.waterLevel;

        ctx.save();

        // Trazado de la onda de superficie compuesta
        ctx.beginPath();
        ctx.moveTo(0, baseY);

        for (let x = 0; x <= w; x += 4) {
            // Suma de armónicos de ondas superficiales
            const wave1 = Math.sin(x * 0.015 + this.time * 2.5) * 3.5;
            const wave2 = Math.sin(x * 0.035 - this.time * 3.2) * 1.8;
            const wave3 = Math.cos(x * 0.008 + this.time * 1.2) * 2.0;

            // Perturbación adicional cerca del altavoz si está cruzando
            let speakerDist = Math.abs(x - this.speakerX);
            let speakerPerturb = 0;
            if (speakerDist < 120 && Math.abs(this.speakerY - baseY) < 50) {
                speakerPerturb = Math.sin(speakerDist * 0.1 - this.time * 8.0) * (Math.abs(this.depthVelocity) * 35);
            }

            const y = baseY + wave1 + wave2 + wave3 + speakerPerturb;
            ctx.lineTo(x, y);
        }

        // Línea luminosa brillante de la superficie del agua
        ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Segunda capa de brillo translúcido de menisco
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.restore();
    },

    renderSurfaceRipples() {
        const ctx = this.ctx;
        this.surfaceRipples.forEach(r => {
            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha * 0.75})`;
            ctx.lineWidth = 1.5;
            // Ondas elípticas en perspectiva superficial
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.35, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    },

    renderHUD() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.save();

        // Tarjeta HUD Superior Izquierda: Estado del Medio Acústico
        ctx.fillStyle = "rgba(11, 17, 30, 0.75)";
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, 15, 15, 240, 68, 8, true, true);

        const isSub = this.currentDepth > 0.45;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillStyle = isSub ? "#38bdf8" : "#4ade80";
        ctx.fillText(isSub ? "MEDIO: AGUA LÍQUIDA (SUBMARINO)" : "MEDIO: AIRE ABIERTO (SUPERFICIE)", 25, 34);

        ctx.font = "10px monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Densidad: ${isSub ? '1000 kg/m³' : '1.2 kg/m³'} | Viscosidad: ${isSub ? 'Alta' : 'Baja'}`, 25, 50);
        ctx.fillText(`Filtro RLC: ${isSub ? 'ACTIVADO (Pasa-Bajos)' : 'DESACTIVADO (Plano)'}`, 25, 66);

        // Tarjeta HUD Inferior Izquierda: Frecuencia de Corte y Atenuación
        ctx.fillStyle = "rgba(11, 17, 30, 0.75)";
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, 15, h - 68, 255, 52, 8, true, true);

        const fCut = isSub ? "25.0 Hz" : "20,000 Hz";
        const atten = isSub ? "-48.2 dB @ 1 kHz" : "0.0 dB (Sin Pérdida)";
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(`FREC. CORTE (f_c): ${fCut}`, 25, h - 48);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`Atenuación Agudos: ${atten}`, 25, h - 30);

        // Indicador de Regla de Profundidad Submarina a la derecha
        const rx = w - 40;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, this.waterLevel);
        ctx.lineTo(rx, h - 20);
        ctx.stroke();

        ctx.font = "9px monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        for (let yStep = this.waterLevel; yStep <= h - 20; yStep += 35) {
            ctx.beginPath();
            ctx.moveTo(rx - 5, yStep);
            ctx.lineTo(rx + 5, yStep);
            ctx.stroke();
            const cm = Math.round(((yStep - this.waterLevel) / (h - 20 - this.waterLevel)) * 50);
            ctx.fillText(`${cm}cm`, rx - 32, yStep + 3);
        }

        // Flecha y marcador de profundidad actual
        const curMarkerY = Math.min(h - 22, Math.max(this.waterLevel, this.speakerY));
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(rx + 8, curMarkerY);
        ctx.lineTo(rx + 18, curMarkerY - 5);
        ctx.lineTo(rx + 18, curMarkerY + 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    },

    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof radius === 'undefined') radius = 5;
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }
};
