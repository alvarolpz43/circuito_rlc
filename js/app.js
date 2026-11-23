/**
 * ==============================================================================
 * CONTROLADOR PRINCIPAL OPTIMIZADO (60 FPS & ULTRA-FLUIDO)
 * Proyecto 2: El Circuito RLC como Filtro de Audio
 * Institución Universitaria Colegio Mayor del Cauca - Grupo 3
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // 0. Renderizar Iconos Vectoriales (Lucide)
    if (window.lucide) {
        try {
            lucide.createIcons();
        } catch (e) {
            console.warn("Lucide notice:", e);
        }
    }

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

    // 3. Inicializar Simulador RK4, Superposición y Plano s
    initSimulator();

    // 4. Inicializar Gráficas Científicas Interactivas de Galería
    if (typeof GaleriaCharts !== 'undefined') {
        GaleriaCharts.init();
    }

    // 7. Inicializar Canvas de Analogía Electromecánica
    AnalogiaCanvas.init();

    // 8. Inicializar Laboratorio de Audio y Altavoz Sumergible
    if (typeof UnderwaterSpeaker !== 'undefined') {
        UnderwaterSpeaker.init();
    }
    initAudioStudio();

    // 8.5 Inicializar Sonda Auditiva Interactiva de Bode
    if (typeof BodeProbe !== 'undefined') {
        BodeProbe.init();
    }

    // 9. Inicializar Visor de Código Científico y Selector de Galería
    initGalleryViewSwitcher();
    initCodeViewer();

    // 10. Inicializar Editor Interactivo de Ecuación y Descomposición
    initEquationEditor();

    // 11. Modo Presentación Magistral y Atajos de Teclado
    initPresentationMode();
    initKeyboardShortcuts();
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
                if (window.lucide) {
                    lucide.createIcons();
                }
            }

            // Gestión de bucles de animación para liberar CPU/GPU
            if (targetId !== "tab-analogia" && AnalogiaCanvas.isRunning) {
                AnalogiaCanvas.pause();
            } else if (targetId === "tab-analogia") {
                AnalogiaCanvas.init();
            }

            // Si entramos a la pestaña de Galería, renderizar/redimensionar gráficas de Chart.js
            if (targetId === "tab-galeria" && typeof GaleriaCharts !== 'undefined') {
                setTimeout(() => {
                    GaleriaCharts.renderOrResize();
                }, 50);
            }

            // Si entramos a Deducción, redimensionar mini-canvas de descomposición
            if (targetId === "tab-deduccion" && typeof decompChart !== 'undefined' && decompChart) {
                setTimeout(() => {
                    decompChart.resize();
                    decompChart.update('none');
                }, 50);
            }

            // Si entramos a Código Científico, renderizar KaTeX
            if (targetId === "tab-codigo" && window.renderMathInElement) {
                renderMathInElement(targetPane, {
                    delimiters: [
                        { left: "$$", right: "$$", display: true },
                        { left: "$", right: "$", display: false }
                    ],
                    throwOnError: false
                });
            }

            // Si salimos de tab-audio, detener audio si está sonando y pausar altavoz sumergible
            if (targetId !== "tab-audio") {
                if (AudioLab.isPlaying) {
                    AudioLab.stopAllAudio();
                }
                if (typeof UnderwaterSpeaker !== 'undefined') {
                    UnderwaterSpeaker.pause();
                }
            } else if (targetId === "tab-audio") {
                if (typeof UnderwaterSpeaker !== 'undefined') {
                    UnderwaterSpeaker.resize();
                    UnderwaterSpeaker.start();
                }
            }

            // Si salimos de tab-galeria, detener sonda de Bode si está sonando
            if (targetId !== "tab-galeria" && typeof BodeProbe !== 'undefined' && BodeProbe.isPlaying) {
                BodeProbe.stopTone();
            }
        });
    });
}

/**
 * ==============================================================================
 * 2. SIMULADOR EN VIVO RK4, SUPERPOSICIÓN ANALÍTICA Y DIAGRAMA DE POLOS EN PLANO s
 * ==============================================================================
 */
let rk4Chart = null;
let rafPending = false;
let showAnalytical = false;

function initSimulator() {
    const sliderR = document.getElementById("sliderR");
    const sliderL = document.getElementById("sliderL");
    const sliderC = document.getElementById("sliderC");
    const sliderE = document.getElementById("sliderE");
    const sliderQ0 = document.getElementById("sliderQ0");
    const sliderI0 = document.getElementById("sliderI0");
    const btnResetCI = document.getElementById("btnResetCI");

    const valR = document.getElementById("valR");
    const valL = document.getElementById("valL");
    const valC = document.getElementById("valC");
    const valE = document.getElementById("valE");
    const valQ0 = document.getElementById("valQ0");
    const valI0 = document.getElementById("valI0");

    const btnToggleAnalytical = document.getElementById("btnToggleAnalytical");
    const badgeResidualError = document.getElementById("badgeResidualError");
    const valResidualError = document.getElementById("valResidualError");

    const ctx = document.getElementById("chartRK4").getContext("2d");

    // Configuración de Chart.js optimizada para máximo rendimiento
    rk4Chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'V_C(t) Numérica (RK4) [V]',
                    data: [],
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    borderWidth: 2.2,
                    fill: true,
                    tension: 0,
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
                },
                {
                    label: 'V_C(t) Analítica Exacta [V]',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 2.0,
                    borderDash: [5, 4],
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    hidden: true
                },
                {
                    label: 'Pico Máximo (t_p, V_C,max)',
                    data: [],
                    borderColor: '#f43f5e',
                    backgroundColor: '#f43f5e',
                    borderWidth: 0,
                    showLine: false,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointStyle: 'triangle',
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
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
                    title: { display: true, text: 'Voltaje V_C(t) [V]', color: '#38bdf8' },
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
                    backgroundColor: 'rgba(8, 12, 22, 0.94)',
                    titleColor: '#38bdf8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 4 && context.parsed.y !== null) {
                                return `⚡ Cúspide: Vc,max = ${context.parsed.y.toFixed(2)} V en t_p = ${context.label} ms`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(2) : ''}`;
                        }
                    }
                }
            }
        }
    });

    // Toggle para Superponer Solución Analítica Exacta y Error Residual
    if (btnToggleAnalytical) {
        btnToggleAnalytical.addEventListener("click", () => {
            showAnalytical = !showAnalytical;
            btnToggleAnalytical.classList.toggle("active", showAnalytical);
            rk4Chart.data.datasets[3].hidden = !showAnalytical;
            if (badgeResidualError) {
                badgeResidualError.style.display = showAnalytical ? "flex" : "none";
            }
            queueSimulationUpdate();
        });
    }

    // Inicialización del Plano de Fase 2D (Espacio de Estados de Lyapunov Q vs I)
    let phaseChart = null;
    const canvasPhase = document.getElementById("chartPhasePortrait");
    if (canvasPhase) {
        phaseChart = new Chart(canvasPhase.getContext("2d"), {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Trayectoria Espacio de Estados (Q, I)',
                        data: [],
                        showLine: true,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.06)',
                        borderWidth: 2.2,
                        pointRadius: 0,
                        tension: 0.15
                    },
                    {
                        label: 'Condición Inicial (Q_0, I_0)',
                        data: [],
                        borderColor: '#22c55e',
                        backgroundColor: '#22c55e',
                        pointRadius: 6,
                        pointHoverRadius: 8
                    },
                    {
                        label: 'Punto Fijo Atractor (Q*, I*)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        pointRadius: 7,
                        pointHoverRadius: 9,
                        pointStyle: 'rectRot'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Carga en el Condensador Q(t) [mC]', color: '#38bdf8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        title: { display: true, text: 'Corriente en la Malla I(t) = dQ/dt [A]', color: '#10b981' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9', font: { family: 'Inter', size: 11 }, boxWidth: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return `${ctx.dataset.label}: Q = ${ctx.parsed.x.toFixed(2)} mC, I = ${ctx.parsed.y.toFixed(3)} A`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Selector de Modo de Gráfica: Forma de Onda vs Plano de Fase 2D
    const btnWave = document.getElementById("btnViewWaveform");
    const btnPhase = document.getElementById("btnViewPhasePortrait");
    const canvasRK4 = document.getElementById("chartRK4");
    const footerPhase = document.getElementById("phasePortraitFooter");
    const titleSim = document.getElementById("simChartTitle");
    const subSim = document.getElementById("simChartSubtitle");

    if (btnWave && btnPhase) {
        btnWave.addEventListener("click", () => {
            btnWave.classList.add("active");
            btnPhase.classList.remove("active");
            if (canvasRK4) canvasRK4.style.display = "block";
            if (canvasPhase) canvasPhase.style.display = "none";
            if (footerPhase) footerPhase.style.display = "none";
            if (titleSim) titleSim.innerHTML = 'Respuesta Temporal en Bornes del Condensador V<sub>C</sub>(t)';
            if (subSim) subSim.textContent = 'RK4 • 60 FPS FIJOS';
            rk4Chart.resize();
        });

        btnPhase.addEventListener("click", () => {
            btnPhase.classList.add("active");
            btnWave.classList.remove("active");
            if (canvasRK4) canvasRK4.style.display = "none";
            if (canvasPhase) canvasPhase.style.display = "block";
            if (footerPhase) footerPhase.style.display = "flex";
            if (titleSim) titleSim.innerHTML = 'Plano de Fase 2D en el Espacio de Estados: Carga Q(t) vs Corriente I(t)';
            if (subSim) subSim.textContent = 'ESPACIO DE ESTADOS DE LYAPUNOV • 60 FPS';
            if (phaseChart) phaseChart.resize();
        });
    }

    // Función de actualización real ejecutada a 60 FPS
    const executeSimulation = () => {
        const R = parseFloat(sliderR.value);
        const L = parseFloat(sliderL.value);
        const C = parseFloat(sliderC.value) * 1e-6; // µF a F
        const E0 = parseFloat(sliderE.value);
        const q0 = sliderQ0 ? parseFloat(sliderQ0.value) * 1e-3 : 0.0; // mC a C
        const i0 = sliderI0 ? parseFloat(sliderI0.value) : 0.0;        // A

        valR.textContent = `${R.toFixed(1)} Ω`;
        valL.textContent = `${L.toFixed(2)} H`;
        valC.textContent = `${(C * 1e6).toFixed(0)} µF`;
        valE.textContent = `${E0.toFixed(1)} V`;

        if (valQ0) {
            const v0 = q0 / C;
            valQ0.textContent = `${(q0 * 1e3).toFixed(2)} mC (${v0.toFixed(1)} V)`;
        }
        if (valI0) {
            valI0.textContent = `${i0.toFixed(2)} A`;
        }

        // Telemetría matemática
        const p = RLCEngine.calculateParameters(R, L, C);

        const overshootStr = p.overshootPct > 0 
            ? `+${p.overshootPct.toFixed(1)}%` 
            : '0.0%';
        const peakTimeStr = p.t_p > 0 
            ? `${(p.t_p * 1000).toFixed(1)} ms` 
            : 'N/A';

        document.getElementById("telDelta").textContent = p.delta.toFixed(1);
        document.getElementById("telZeta").textContent = p.zeta.toFixed(3);
        document.getElementById("telWn").textContent = `${p.omega_n.toFixed(1)} rad/s`;
        document.getElementById("telRcr").textContent = `${p.R_cr.toFixed(1)} Ω`;

        const pill = document.getElementById("telRegime");
        pill.textContent = p.regimeName;
        pill.className = `regime-pill ${p.regimeClass}`;

        document.getElementById("telOvershoot").textContent = overshootStr;
        document.getElementById("telPeakTime").textContent = peakTimeStr;

        // Sincronizar simultáneamente la Barra HUD tipo Instrumentación sobre la Gráfica RK4
        const chartTelDelta = document.getElementById("chartTelDelta");
        const chartTelWn = document.getElementById("chartTelWn");
        const chartTelZeta = document.getElementById("chartTelZeta");
        const chartTelRcr = document.getElementById("chartTelRcr");
        const chartTelOvershoot = document.getElementById("chartTelOvershoot");
        const chartTelPeakTime = document.getElementById("chartTelPeakTime");
        const chartTelRegime = document.getElementById("chartTelRegime");

        if (chartTelDelta) chartTelDelta.textContent = p.delta.toFixed(1);
        if (chartTelWn) chartTelWn.textContent = `${p.omega_n.toFixed(1)} rad/s`;
        if (chartTelZeta) chartTelZeta.textContent = p.zeta.toFixed(3);
        if (chartTelRcr) chartTelRcr.textContent = `${p.R_cr.toFixed(1)} Ω`;
        if (chartTelOvershoot) chartTelOvershoot.textContent = overshootStr;
        if (chartTelPeakTime) chartTelPeakTime.textContent = peakTimeStr;
        if (chartTelRegime) {
            chartTelRegime.textContent = p.regimeName.split(' ')[0];
            chartTelRegime.className = `regime-pill ${p.regimeClass}`;
        }

        // Solución RK4 con paso fino (dt = 0.5 ms -> 600 puntos) con condiciones iniciales editables
        const sol = RLCEngine.solveRK4(R, L, C, E0, 0.30, 0.0005, q0, i0);

        // Identificar la coordenada del primer pico máximo (cúspide) en caso de régimen subamortiguado
        let peakSampleIdx = -1;
        let peakMaxVc = -Infinity;
        if (p.delta < -1e-7 && p.t_p > 0) {
            for (let i = 1; i < sol.Vc.length - 1; i++) {
                if (sol.Vc[i] >= sol.Vc[i - 1] && sol.Vc[i] > sol.Vc[i + 1]) {
                    peakSampleIdx = i;
                    peakMaxVc = sol.Vc[i];
                    break;
                }
            }
            if (peakSampleIdx === -1) {
                for (let i = 0; i < sol.Vc.length; i++) {
                    if (sol.Vc[i] > peakMaxVc) {
                        peakMaxVc = sol.Vc[i];
                        peakSampleIdx = i;
                    }
                }
            }
        }

        // Decimación a ~120 puntos para dibujo ultra-rápido (< 1 ms de render)
        const stride = Math.max(1, Math.floor(sol.t.length / 120));
        const labels = [];
        const vcData = [];
        const iData = [];
        const refData = [];
        const analitData = [];
        const peakData = [];

        // Si la comparativa analítica está activa, calcular valores analíticos con q0 e i0
        let analitFull = null;
        if (showAnalytical) {
            const errRes = RLCEngine.calculateResidualError(sol.t, sol.Vc, R, L, C, E0, q0, i0);
            analitFull = errRes.Vc_analit;
            if (valResidualError) {
                const err = errRes.maxError;
                if (err < 1e-6) {
                    valResidualError.textContent = `${(err * 1e9).toFixed(2)} nV`;
                } else if (err < 1e-3) {
                    valResidualError.textContent = `${(err * 1e6).toFixed(2)} µV`;
                } else {
                    valResidualError.textContent = `${(err * 1e3).toFixed(3)} mV`;
                }
            }
        }

        // Encontrar índice decimado más cercano al instante del pico
        let nearestDecimatedIdx = -1;
        if (peakSampleIdx !== -1) {
            const peakTimeSec = sol.t[peakSampleIdx];
            let minDiff = Infinity;
            for (let i = 0; i < sol.t.length; i += stride) {
                const diff = Math.abs(sol.t[i] - peakTimeSec);
                const decIdx = Math.floor(i / stride);
                if (diff < minDiff) {
                    minDiff = diff;
                    nearestDecimatedIdx = decIdx;
                }
            }
        }

        for (let i = 0; i < sol.t.length; i += stride) {
            const decIdx = Math.floor(i / stride);
            labels.push((sol.t[i] * 1000).toFixed(0));
            vcData.push(sol.Vc[i]);
            iData.push(sol.I[i] * 10.0);
            refData.push(E0);
            if (showAnalytical && analitFull) {
                analitData.push(analitFull[i]);
            }
            if (decIdx === nearestDecimatedIdx) {
                peakData.push(peakMaxVc);
            } else {
                peakData.push(null);
            }
        }

        rk4Chart.data.labels = labels;
        rk4Chart.data.datasets[0].data = vcData;
        rk4Chart.data.datasets[1].data = iData;
        rk4Chart.data.datasets[2].data = refData;
        if (showAnalytical) {
            rk4Chart.data.datasets[3].data = analitData;
        }
        rk4Chart.data.datasets[4].data = peakData;

        rk4Chart.update('none');

        // Actualizar Plano de Fase 2D (Espacio de Estados Q vs I)
        if (phaseChart) {
            const phaseData = [];
            for (let i = 0; i < sol.t.length; i += stride) {
                phaseData.push({ x: sol.Q[i] * 1000.0, y: sol.I[i] });
            }
            phaseChart.data.datasets[0].data = phaseData;
            phaseChart.data.datasets[1].data = [{ x: q0 * 1000.0, y: i0 }];

            const qPerm = C * E0 * 1000.0;
            phaseChart.data.datasets[2].data = [{ x: qPerm, y: 0.0 }];
            phaseChart.update('none');

            // Actualizar chips de telemetría del plano de fase
            const lblEq = document.getElementById("phaseEquilibriumPt");
            const lblClass = document.getElementById("phaseClassification");
            const lblLyap = document.getElementById("phaseLyapunov");

            if (lblEq) lblEq.textContent = `(${qPerm.toFixed(2)} mC, 0.00 A)`;
            if (lblClass) {
                if (p.zeta < 0.999) {
                    lblClass.textContent = "Foco Estable (Espiral Convergente al Atractor)";
                    lblClass.style.color = "var(--accent-cyan)";
                } else if (p.zeta > 1.001) {
                    lblClass.textContent = "Nodo Estable (Convergencia Asintótica Directa)";
                    lblClass.style.color = "var(--accent-purple)";
                } else {
                    lblClass.textContent = "Nodo Degenerado Crítico (Amortiguamiento Crítico)";
                    lblClass.style.color = "var(--accent-amber)";
                }
            }
            if (lblLyap) {
                lblLyap.textContent = `Asintóticamente Estable (Re(λ) = -${p.alpha.toFixed(1)} < 0)`;
            }
        }

        // Actualizar Diagrama de Polos en el Plano Complejo s
        renderSPlane(p);

        // Notificar al canvas de analogía para sincronización
        AnalogiaCanvas.setResistance(R);

        // Notificar al laboratorio de audio para ajustar Q y corte
        AudioLab.updateFilterParams(R, L, C);
    };

    // Throttling por requestAnimationFrame para 60 FPS fijos
    const queueSimulationUpdate = () => {
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
                executeSimulation();
                rafPending = false;
            });
        }
    };

    sliderR.addEventListener("input", queueSimulationUpdate);
    sliderL.addEventListener("input", queueSimulationUpdate);
    sliderC.addEventListener("input", queueSimulationUpdate);
    sliderE.addEventListener("input", queueSimulationUpdate);
    if (sliderQ0) sliderQ0.addEventListener("input", queueSimulationUpdate);
    if (sliderI0) sliderI0.addEventListener("input", queueSimulationUpdate);

    if (btnResetCI) {
        btnResetCI.addEventListener("click", () => {
            if (sliderQ0) sliderQ0.value = 0;
            if (sliderI0) sliderI0.value = 0;
            queueSimulationUpdate();
        });
    }

    // Botones de presets obligatorios
    const presetButtons = document.querySelectorAll(".btn-preset");
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            presetButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sliderR.value = btn.getAttribute("data-r");
            queueSimulationUpdate();
        });
    });

    // Ejecutar simulación inicial
    executeSimulation();
}

/**
 * ==============================================================================
 * DIBUJO DEL PLANO COMPLEJO s (LUGAR DE LAS RAÍCES Y ESTABILIDAD)
 * ==============================================================================
 */
function renderSPlane(p) {
    const canvas = document.getElementById("canvasSPlane");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const baseW = 580;
    const baseH = 280;

    if (canvas.width !== baseW * dpr) {
        canvas.width = baseW * dpr;
        canvas.height = baseH * dpr;
        canvas.style.width = "100%";
        canvas.style.maxWidth = `${baseW}px`;
        canvas.style.height = `${baseH}px`;
    }

    if (ctx.resetTransform) {
        ctx.resetTransform();
    } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.scale(dpr, dpr);

    // Limpiar canvas con tono recogido obsidian
    ctx.fillStyle = "#0b111e";
    ctx.fillRect(0, 0, baseW, baseH);

    // Origen coordenado en el canvas (lado derecho para enfatizar LHP Re(s) < 0)
    const originX = 430;
    const originY = 140;
    const scale = 1.45; // 1 unidad = 1.45 px

    // 1. Sombrear el Semiplano Izquierdo Estable (LHP: Re(s) < 0)
    ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
    ctx.fillRect(0, 0, originX, baseH);

    // 2. Líneas de cuadrícula sutiles
    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1;
    for (let r = -250; r <= 50; r += 50) {
        const x = originX + r * scale;
        if (x >= 0 && x <= baseW) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, baseH);
            ctx.stroke();
        }
    }
    for (let im = -100; im <= 100; im += 50) {
        const y = originY - im * scale;
        if (y >= 0 && y <= baseH) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(baseW, y);
            ctx.stroke();
        }
    }

    // 3. Eje Real (\sigma) y Eje Imaginario (j\omega)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1.5;

    // Eje Real (horizontal)
    ctx.beginPath();
    ctx.moveTo(10, originY);
    ctx.lineTo(baseW - 10, originY);
    ctx.stroke();

    // Eje Imaginario (vertical)
    ctx.beginPath();
    ctx.moveTo(originX, 10);
    ctx.lineTo(originX, baseH - 10);
    ctx.stroke();

    // Flechas y etiquetas de ejes
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 11px 'Fira Code', monospace";
    ctx.fillText("σ [s⁻¹]", baseW - 55, originY - 8);
    ctx.fillText("+jω [rad/s]", originX + 8, 22);
    ctx.fillText("-jω", originX + 8, baseH - 15);
    ctx.fillText("0", originX + 6, originY + 14);

    // 4. Círculo de Frecuencia Natural \omega_n = 100 rad/s
    const rWn = p.omega_n * scale;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(originX, originY, rWn, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta del círculo \omega_n
    ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
    ctx.fillText(`|ωₙ| = ${p.omega_n.toFixed(0)}`, originX - rWn - 10, originY - 10);

    // 5. Graficar los Polos (Raíces de la ecuación característica)
    if (p.poles && p.poles.length >= 2) {
        p.poles.forEach((pole, idx) => {
            const px = originX + pole.real * scale;
            const py = originY - pole.imag * scale;

            // Halo suave
            ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, 2 * Math.PI);
            ctx.fill();

            // Dibujar cruz 'X'
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(px - 6, py - 6);
            ctx.lineTo(px + 6, py + 6);
            ctx.moveTo(px + 6, py - 6);
            ctx.lineTo(px - 6, py + 6);
            ctx.stroke();

            // Texto de coordenada del polo
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 10px 'Fira Code', monospace";
            const textOffset = idx === 0 ? -14 : 18;
            ctx.fillText(`s${idx + 1}`, px + 8, py + textOffset);
        });

        // Actualizar detalles textuales
        const elP1 = document.getElementById("poleVal1");
        const elP2 = document.getElementById("poleVal2");
        const elAlpha = document.getElementById("poleAlpha");
        const elWd = document.getElementById("poleWd");
        const elBadge = document.getElementById("splaneRegimeBadge");

        if (elP1) elP1.textContent = p.poles[0].label;
        if (elP2) elP2.textContent = p.poles[1].label;
        if (elAlpha) elAlpha.textContent = `${p.alpha.toFixed(1)} s⁻¹`;
        if (elWd) {
            elWd.textContent = p.omega_d > 0 
                ? `${p.omega_d.toFixed(2)} rad/s (${(p.omega_d / (2 * Math.PI)).toFixed(2)} Hz)` 
                : '0 rad/s (Aperiódico)';
        }
        if (elBadge) {
            elBadge.textContent = p.regimeName;
            elBadge.className = `regime-pill ${p.regimeClass}`;
        }
    }
}

/**
 * ==============================================================================
 * 3. MODAL DE ZOOM DE FIGURAS
 * ==============================================================================
 */
function initImageModal() {
    const modal = document.getElementById("imageModal");
    if (!modal) return;
    const modalImg = document.getElementById("modalImg");
    const modalClose = document.getElementById("modalClose");
    const figureImgs = document.querySelectorAll(".figure-img-wrap");

    figureImgs.forEach(wrap => {
        wrap.addEventListener("click", () => {
            const img = wrap.querySelector(".figure-img");
            if (img && modal && modalImg) {
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

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && modal.classList.contains("active")) {
            modal.classList.remove("active");
        }
    });
}

/**
 * ==============================================================================
 * 6. LABORATORIO DE AUDIO & ENTRADAS EN VIVO (MICRÓFONO Y ARCHIVO)
 * ==============================================================================
 */
function initAudioStudio() {
    const btnPlaySynth = document.getElementById("btnPlaySynth");
    const btnToggleFilter = document.getElementById("btnToggleFilter");
    const btnLiveMic = document.getElementById("btnLiveMic");
    const audioFileInput = document.getElementById("audioFileInput");

    if (btnPlaySynth) {
        btnPlaySynth.addEventListener("click", () => {
            if (AudioLab.isPlaying && AudioLab.currentSource === 'synth') {
                AudioLab.stopAllAudio();
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

    if (btnLiveMic) {
        btnLiveMic.addEventListener("click", () => {
            AudioLab.startLiveMic();
        });
    }

    if (audioFileInput) {
        audioFileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                AudioLab.loadCustomFile(e.target.files[0]);
            }
        });
    }

    // Enlazar reproductores nativos WAV con la animación del altavoz sumergible
    const nativeOrig = document.getElementById("nativeAudioOriginal");
    const nativeFilt = document.getElementById("nativeAudioFiltrado");
    if (nativeOrig) {
        nativeOrig.addEventListener("play", () => {
            if (nativeFilt) nativeFilt.pause();
            if (typeof UnderwaterSpeaker !== 'undefined') {
                UnderwaterSpeaker.surface();
            }
        });
    }
    if (nativeFilt) {
        nativeFilt.addEventListener("play", () => {
            if (nativeOrig) nativeOrig.pause();
            if (typeof UnderwaterSpeaker !== 'undefined') {
                UnderwaterSpeaker.submerge();
            }
        });
    }

    // Controles de la analogía masa-resorte
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

/**
 * ==============================================================================
 * 7. MODO PRESENTACIÓN MAGISTRAL & ATAJOS DE TECLADO
 * ==============================================================================
 */
function initPresentationMode() {
    const btnPres = document.getElementById("btnPresentationMode");
    if (!btnPres) return;

    btnPres.addEventListener("click", () => {
        const isPres = document.body.classList.toggle("presentation-mode");
        btnPres.classList.toggle("active", isPres);

        if (isPres) {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        } else {
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        }
    });
}

function initKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
        // Evitar interceptar teclas si el foco está en un slider o campo
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
        const currentIndex = tabButtons.findIndex(btn => btn.classList.contains("active"));

        if (e.key === "ArrowRight") {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % tabButtons.length;
            tabButtons[nextIndex].click();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
            tabButtons[prevIndex].click();
        } else if (e.key === "p" || e.key === "P") {
            e.preventDefault();
            const btnPres = document.getElementById("btnPresentationMode");
            if (btnPres) btnPres.click();
        }
    });
}

/**
 * ==============================================================================
 * 10. SELECTOR DE VISTA EN GALERÍA (CHART.JS VS. PLOTLY DASHBOARD EMBEBIDO)
 * ==============================================================================
 */
function initGalleryViewSwitcher() {
    const btnChartJs = document.getElementById("btnViewChartJs");
    const btnPlotly = document.getElementById("btnViewPlotly");
    const chartJsGrid = document.getElementById("chartJsGalleryGrid");
    const plotlyWrapper = document.getElementById("plotlyEmbedWrapper");

    if (!btnChartJs || !btnPlotly || !chartJsGrid || !plotlyWrapper) return;

    btnChartJs.addEventListener("click", () => {
        btnChartJs.classList.add("active");
        btnPlotly.classList.remove("active");
        chartJsGrid.style.display = "grid";
        plotlyWrapper.style.display = "none";
        if (typeof GaleriaCharts !== 'undefined') {
            setTimeout(() => {
                GaleriaCharts.renderOrResize();
            }, 50);
        }
    });

    btnPlotly.addEventListener("click", () => {
        btnPlotly.classList.add("active");
        btnChartJs.classList.remove("active");
        chartJsGrid.style.display = "none";
        plotlyWrapper.style.display = "block";
    });
}

/**
 * ==============================================================================
 * 11. VISOR INTERACTIVO DE CÓDIGO CIENTÍFICO Y COPIADO AL PORTAPAPELES
 * ==============================================================================
 */
function initCodeViewer() {
    const moduleButtons = document.querySelectorAll(".code-module-btn");
    const modulePanes = document.querySelectorAll(".code-module-pane");

    moduleButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-module");
            moduleButtons.forEach(b => b.classList.remove("active"));
            modulePanes.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add("active");
                if (window.lucide) {
                    lucide.createIcons();
                }
                if (window.renderMathInElement) {
                    renderMathInElement(targetPane, {
                        delimiters: [
                            { left: "$$", right: "$$", display: true },
                            { left: "$", right: "$", display: false }
                        ],
                        throwOnError: false
                    });
                }
            }
        });
    });

    // Botones de copiar código con retroalimentación visual
    const copyButtons = document.querySelectorAll(".btn-copy-code");
    copyButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const preEl = document.getElementById(targetId);
            if (preEl) {
                const textToCopy = preEl.innerText;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = `<i data-lucide="check"></i> <span>¡Copiado!</span>`;
                    btn.classList.add("copied");
                    if (window.lucide) lucide.createIcons();
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                        btn.classList.remove("copied");
                        if (window.lucide) lucide.createIcons();
                    }, 2000);
                }).catch(err => {
                    console.warn("Error al copiar código:", err);
                });
            }
        });
    });
}

/**
 * ==============================================================================
 * 12. EDITOR INTERACTIVO DE ECUACIÓN Y DESCOMPOSICIÓN TRANSITORIA / PERMANENTE
 * ==============================================================================
 */
let decompChart = null;

function initEquationEditor() {
    const sliderQ0 = document.getElementById("sliderEditQ0");
    const sliderI0 = document.getElementById("sliderEditI0");
    const dispQ0 = document.getElementById("dispEditQ0");
    const dispI0 = document.getElementById("dispEditI0");
    const dispConsts = document.getElementById("dispConstantsSummary");
    const katexContainer = document.getElementById("katexDynamicEquation");
    const presetBtns = document.querySelectorAll(".btn-ci-preset");
    const canvas = document.getElementById("canvasDecompPlot");

    if (!sliderQ0 || !sliderI0 || !katexContainer || !canvas) return;

    // Inicializar Chart.js para el mini visualizador de descomposición
    const ctx = canvas.getContext("2d");
    decompChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Parte Permanente V_perm (12 V)',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Parte Transitoria V_trans(t)',
                    data: [],
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.08)',
                    borderWidth: 2.0,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Respuesta Total V_C(t)',
                    data: [],
                    borderColor: '#38bdf8',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(8, 12, 22, 0.94)',
                    titleColor: '#38bdf8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => `Tiempo t = ${items[0].label} ms`,
                        label: (item) => ` ${item.dataset.label}: ${parseFloat(item.formattedValue).toFixed(2)} V`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Tiempo t [milisegundos, ms]', color: '#94a3b8', font: { size: 10.5 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 9 }
                },
                y: {
                    title: { display: true, text: 'Voltaje [V]', color: '#38bdf8', font: { size: 10.5 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 6 }
                }
            }
        }
    });

    const updateEquationAndPlot = () => {
        const Q0_mC = parseFloat(sliderQ0.value); // mC
        const q0 = Q0_mC * 1e-3;                  // C
        const i0 = parseFloat(sliderI0.value);    // A

        const R = 10.0;
        const L = 0.5;
        const C = 200e-6;
        const E0 = 12.0;
        const alpha = R / (2.0 * L); // 10.0
        const omega_d = 10.0 * Math.sqrt(99.0); // ~99.4987 rad/s
        const V0 = q0 / C; // Voltaje inicial

        // Actualizar badges numéricos
        dispQ0.textContent = `${Q0_mC >= 0 ? '+' : ''}${Q0_mC.toFixed(2)} mC (${V0 >= 0 ? '+' : ''}${V0.toFixed(1)} V)`;
        dispI0.textContent = `${i0 >= 0 ? '+' : ''}${i0.toFixed(2)} A`;

        // Constantes en Coulombs y mC
        const Q_perm_C = C * E0; // 0.0024 C = 2.4 mC
        const C1_C = q0 - Q_perm_C;
        const C2_C = (i0 + alpha * C1_C) / omega_d;

        const C1_mC = C1_C * 1e3;
        const C2_mC = C2_C * 1e3;

        // Constantes en Voltios para V_C(t)
        const A_V = V0 - E0;
        const B_V = (i0 / C + alpha * (V0 - E0)) / omega_d;

        dispConsts.textContent = `C₁ = ${C1_mC.toFixed(2)} mC | C₂ = ${C2_mC.toFixed(2)} mC | V(0) = ${V0.toFixed(1)} V`;

        // Generar formato KaTeX
        const signC2 = C2_mC >= 0 ? `+ ${C2_mC.toFixed(2)}` : `- ${Math.abs(C2_mC).toFixed(2)}`;
        const signB = B_V >= 0 ? `+ ${B_V.toFixed(2)}` : `- ${Math.abs(B_V).toFixed(2)}`;

        const latexCode = `
        $$\\begin{aligned}
        Q(t) &= \\underbrace{2.40\\text{ mC}}_{Q_{\\text{perm}} \\text{ (Permanente)}} + \\underbrace{e^{-10t} \\left[ (${C1_mC.toFixed(2)}) \\cos(10\\sqrt{99} t) ${signC2} \\sin(10\\sqrt{99} t) \\right]}_{Q_{\\text{trans}}(t) \\text{ (Transitoria [mC])}} \\\\[8pt]
        V_C(t) &= \\underbrace{12.00\\text{ V}}_{V_{C,\\text{perm}} \\text{ (Permanente)}} + \\underbrace{e^{-10t} \\left[ (${A_V.toFixed(2)}) \\cos(10\\sqrt{99} t) ${signB} \\sin(10\\sqrt{99} t) \\right]}_{V_{C,\\text{trans}}(t) \\text{ (Transitoria [V])}}
        \\end{aligned}$$
        `;

        katexContainer.innerHTML = latexCode;
        if (window.renderMathInElement) {
            renderMathInElement(katexContainer, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                ],
                throwOnError: false
            });
        }

        // Generar datos para la mini-gráfica en [0, 0.40] s
        const N = 120;
        const tMax = 0.40;
        const labels = [];
        const dataPerm = [];
        const dataTrans = [];
        const dataTotal = [];

        for (let idx = 0; idx < N; idx++) {
            const t = (idx / (N - 1)) * tMax;
            const decay = Math.exp(-alpha * t);
            const vTrans = decay * (A_V * Math.cos(omega_d * t) + B_V * Math.sin(omega_d * t));
            const vTotal = E0 + vTrans;

            labels.push((t * 1000).toFixed(0));
            dataPerm.push(E0);
            dataTrans.push(vTrans);
            dataTotal.push(vTotal);
        }

        decompChart.data.labels = labels;
        decompChart.data.datasets[0].data = dataPerm;
        decompChart.data.datasets[1].data = dataTrans;
        decompChart.data.datasets[2].data = dataTotal;
        decompChart.update('none');
    };

    sliderQ0.addEventListener("input", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        updateEquationAndPlot();
    });

    sliderI0.addEventListener("input", () => {
        presetBtns.forEach(b => b.classList.remove("active"));
        updateEquationAndPlot();
    });

    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sliderQ0.value = btn.getAttribute("data-q0");
            sliderI0.value = btn.getAttribute("data-i0");
            updateEquationAndPlot();
        });
    });

    // Ejecución inicial
    updateEquationAndPlot();
}
