/**
 * ==============================================================================
 * CONTROLADOR PRINCIPAL OPTIMIZADO (60 FPS & ULTRA-FLUIDO)
 * Proyecto 2: El Circuito RLC como Filtro de Audio
 * Institución Universitaria Colegio Mayor del Cauca - Grupo 3
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Inicializar KaTeX con manejo seguro de errores
    try {
        if (window.renderMathInElement) {
            renderMathInElement(document.body, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\[", right: "\\]", display: true },
                    { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false
            });
        }
    } catch (e) {
        console.warn("KaTeX render notice:", e);
    }

    // 2. Control de Pestañas con gestión de ciclo de vida
    initTabNavigation();

    // 3. Inicializar Simulador RK4 con RAF Throttling
    initSimulator();

    // 4. Inicializar Temporizador de Defensa de 15 Minutos
    initDefenseTimer();

    // 5. Acordeón de Preguntas
    initQuestionsAccordion();

    // 6. Modal de Zoom de Imágenes
    initImageModal();

    // 7. Inicializar Canvas de Analogía
    AnalogiaCanvas.init();

    // 8. Inicializar Laboratorio de Audio
    initAudioStudio();
});

/**
 * ==============================================================================
 * 1. NAVEGACIÓN POR PESTAÑAS Y GESTIÓN DE CICLO DE VIDA
 * ==============================================================================
 */
function initTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-tab");

            tabButtons.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add("active");
            }

            // Gestión de ciclo de vida de bucles de animación:
            // Si salimos de tab-analogia, pausar canvas para liberar CPU/GPU
            if (targetId !== "tab-analogia" && AnalogiaCanvas.isRunning) {
                AnalogiaCanvas.pause();
            } else if (targetId === "tab-analogia") {
                AnalogiaCanvas.init();
            }

            // Si salimos de tab-audio, detener sintetizador si está sonando
            if (targetId !== "tab-audio" && AudioLab.isPlaying) {
                AudioLab.stopLiveSynth();
            }
        });
    });
}

/**
 * ==============================================================================
 * 2. SIMULADOR EN VIVO RK4 CON RAF THROTTLING (60 FPS FIJOS)
 * ==============================================================================
 */
let rk4Chart = null;
let rafPending = false; // Bandera de Throttling por requestAnimationFrame

function initSimulator() {
    const sliderR = document.getElementById("sliderR");
    const sliderL = document.getElementById("sliderL");
    const sliderC = document.getElementById("sliderC");
    const sliderE = document.getElementById("sliderE");

    const valR = document.getElementById("valR");
    const valL = document.getElementById("valL");
    const valC = document.getElementById("valC");
    const valE = document.getElementById("valE");

    const ctx = document.getElementById("chartRK4").getContext("2d");

    // Configuración de Chart.js optimizada para máximo rendimiento
    rk4Chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Voltaje en Condensador V_C(t) [V]',
                    data: [],
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.08)',
                    borderWidth: 2.2,
                    fill: true,
                    tension: 0, // 0 = lineal para renderizado vectorial instantáneo
                    pointRadius: 0
                },
                {
                    label: 'Corriente I(t) x10 [A]',
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 1.6,
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    yAxisID: 'y1'
                },
                {
                    label: 'Tensión Permanente E_0 [V]',
                    data: [],
                    borderColor: 'rgba(255, 255, 255, 0.35)',
                    borderWidth: 1.2,
                    borderDash: [3, 3],
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Desactivar animaciones de transición para respuesta en 0ms
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            scales: {
                x: {
                    title: { display: true, text: 'Tiempo t [milisegundos, ms]', color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 8 }
                },
                y: {
                    title: { display: true, text: 'Voltaje V_C(t) [V]', color: '#00f2fe' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 6 },
                    suggestedMin: 0,
                    suggestedMax: 24
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'Corriente I(t) x10 [A]', color: '#10b981' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#10b981', maxTicksLimit: 6 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f1f5f9', font: { family: 'Inter', size: 11 }, boxWidth: 14 }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(8, 12, 22, 0.92)',
                    titleColor: '#00f2fe',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            }
        }
    });

    // Función de actualización real ejecutada a 60 FPS
    const executeSimulation = () => {
        const R = parseFloat(sliderR.value);
        const L = parseFloat(sliderL.value);
        const C = parseFloat(sliderC.value) * 1e-6; // µF a F
        const E0 = parseFloat(sliderE.value);

        valR.textContent = `${R.toFixed(1)} Ω`;
        valL.textContent = `${L.toFixed(2)} H`;
        valC.textContent = `${(C * 1e6).toFixed(0)} µF`;
        valE.textContent = `${E0.toFixed(1)} V`;

        // Telemetría matemática
        const p = RLCEngine.calculateParameters(R, L, C);

        document.getElementById("telDelta").textContent = p.delta.toFixed(1);
        document.getElementById("telZeta").textContent = p.zeta.toFixed(3);
        document.getElementById("telWn").textContent = `${p.omega_n.toFixed(1)} rad/s`;
        document.getElementById("telRcr").textContent = `${p.R_cr.toFixed(1)} Ω`;

        const pill = document.getElementById("telRegime");
        pill.textContent = p.regimeName;
        pill.className = `regime-pill ${p.regimeClass}`;

        document.getElementById("telOvershoot").textContent = p.overshootPct > 0 
            ? `+${p.overshootPct.toFixed(1)}%` 
            : '0.0%';
        document.getElementById("telPeakTime").textContent = p.t_p > 0 
            ? `${(p.t_p * 1000).toFixed(1)} ms` 
            : 'N/A';

        // Solución RK4 con paso optimizado (dt = 0.5 ms -> 600 puntos)
        const sol = RLCEngine.solveRK4(R, L, C, E0, 0.30, 0.0005);

        // Decimación a ~120 puntos visuales para dibujo ultra-rápido (< 1 ms de render)
        const stride = Math.max(1, Math.floor(sol.t.length / 120));
        const labels = [];
        const vcData = [];
        const iData = [];
        const refData = [];

        for (let i = 0; i < sol.t.length; i += stride) {
            labels.push((sol.t[i] * 1000).toFixed(0));
            vcData.push(sol.Vc[i]);
            iData.push(sol.I[i] * 10.0);
            refData.push(E0);
        }

        rk4Chart.data.labels = labels;
        rk4Chart.data.datasets[0].data = vcData;
        rk4Chart.data.datasets[1].data = iData;
        rk4Chart.data.datasets[2].data = refData;
        rk4Chart.update('none'); // 'none' salta el motor de animación de Chart.js

        // Actualizar parámetros pasivos sin recrear objetos
        AudioLab.updateFilterParams(R, L, C);
        AnalogiaCanvas.setResistance(R);

        rafPending = false;
    };

    // Función agrupada con requestAnimationFrame (Throttling)
    const queueSimulation = () => {
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(executeSimulation);
        }
    };

    sliderR.addEventListener("input", queueSimulation);
    sliderL.addEventListener("input", queueSimulation);
    sliderC.addEventListener("input", queueSimulation);
    sliderE.addEventListener("input", queueSimulation);

    // Botones de presets obligatorios
    const presetBtns = document.querySelectorAll(".btn-preset");
    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sliderR.value = btn.getAttribute("data-r");
            queueSimulation();
        });
    });

    // Ejecutar render inicial
    executeSimulation();
}

/**
 * ==============================================================================
 * 3. TEMPORIZADOR DE DEFENSA DE 15 MINUTOS
 * ==============================================================================
 */
let timerInterval = null;
let secondsRemaining = 15 * 60; // 900 s
let isTimerRunning = false;

function initDefenseTimer() {
    const display = document.getElementById("timerDisplay");
    const btnToggle = document.getElementById("btnTimerToggle");
    const btnReset = document.getElementById("btnTimerReset");
    const speakerCards = document.querySelectorAll(".speaker-card");

    const updateDisplay = () => {
        const mins = Math.floor(secondsRemaining / 60);
        const secs = secondsRemaining % 60;
        display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // 4 intervalos de 225 segundos (3m 45s c/u)
        const elapsed = 900 - secondsRemaining;
        const activeIndex = Math.min(3, Math.floor(elapsed / 225));

        speakerCards.forEach((card, idx) => {
            if (idx === activeIndex) {
                card.classList.add("active-speaker");
            } else {
                card.classList.remove("active-speaker");
            }
        });
    };

    btnToggle.addEventListener("click", () => {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            btnToggle.innerHTML = "▶️ Continuar";
        } else {
            isTimerRunning = true;
            btnToggle.innerHTML = "⏸️ Pausar";
            timerInterval = setInterval(() => {
                if (secondsRemaining > 0) {
                    secondsRemaining--;
                    updateDisplay();
                } else {
                    clearInterval(timerInterval);
                    isTimerRunning = false;
                    btnToggle.innerHTML = "✅ Tiempo Cumplido";
                }
            }, 1000);
        }
    });

    btnReset.addEventListener("click", () => {
        clearInterval(timerInterval);
        isTimerRunning = false;
        secondsRemaining = 15 * 60;
        btnToggle.innerHTML = "▶️ Iniciar Defensa";
        updateDisplay();
    });

    updateDisplay();
}

/**
 * ==============================================================================
 * 4. ACORDEÓN DE PREGUNTAS
 * ==============================================================================
 */
function initQuestionsAccordion() {
    const headers = document.querySelectorAll(".question-header");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            const item = header.parentElement;
            const wasOpen = item.classList.contains("open");
            document.querySelectorAll(".question-item").forEach(i => i.classList.remove("open"));
            if (!wasOpen) {
                item.classList.add("open");
            }
        });
    });
}

/**
 * ==============================================================================
 * 5. MODAL DE ZOOM DE IMÁGENES
 * ==============================================================================
 */
function initImageModal() {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");
    const modalClose = document.getElementById("modalClose");
    const figureWraps = document.querySelectorAll(".figure-img-wrap");

    figureWraps.forEach(wrap => {
        wrap.addEventListener("click", () => {
            const img = wrap.querySelector("img");
            if (img && modal) {
                modalImg.src = img.src;
                modal.classList.add("active");
            }
        });
    });

    if (modalClose) {
        modalClose.addEventListener("click", () => {
            modal.classList.remove("active");
        });
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("active");
            }
        });
    }
}

/**
 * ==============================================================================
 * 6. ESTUDIO DE AUDIO Y ANALOGÍA
 * ==============================================================================
 */
function initAudioStudio() {
    const btnPlaySynth = document.getElementById("btnPlaySynth");
    const btnToggleFilter = document.getElementById("btnToggleFilter");

    if (btnPlaySynth) {
        btnPlaySynth.addEventListener("click", () => {
            if (AudioLab.isPlaying) {
                AudioLab.stopLiveSynth();
            } else {
                AudioLab.startLiveSynth();
            }
        });
    }

    if (btnToggleFilter) {
        btnToggleFilter.addEventListener("click", () => {
            AudioLab.toggleFilter();
        });
    }

    const btnPlayAnalogia = document.getElementById("btnPlayAnalogia");
    const btnResetAnalogia = document.getElementById("btnResetAnalogia");

    if (btnPlayAnalogia) {
        btnPlayAnalogia.addEventListener("click", () => {
            if (AnalogiaCanvas.isRunning) {
                AnalogiaCanvas.pause();
            } else {
                AnalogiaCanvas.start();
            }
        });
    }

    if (btnResetAnalogia) {
        btnResetAnalogia.addEventListener("click", () => {
            AnalogiaCanvas.reset();
        });
    }
}
