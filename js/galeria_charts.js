/**
 * ==============================================================================
 * GALERÍA CIENTÍFICA INTERACTIVA (CHART.JS)
 * Proyecto 2: El Circuito RLC como Filtro de Audio - Grupo 3
 * Reemplazo dinámico e interactivo de las figuras estáticas PNG
 * ==============================================================================
 */

const GaleriaCharts = {
    charts: {
        fig1: null,
        fig2: null,
        fig3: null,
        fig4: null,
        modal: null
    },

    state: {
        fig1ShowResidual: false,
        fig3Mode: 'time',   // 'time' | 'freq'
        fig4Mode: 'mag',    // 'mag' | 'phase'
        activeModalChart: null,
        initialized: false
    },

    /**
     * Paleta científica coherente para los regímenes de amortiguamiento
     */
    colors: {
        r10: '#ef4444',    // Rojo (Subamortiguado oscilatorio, R = 10 Ω)
        r50: '#f97316',    // Naranja (Subamortiguado moderado, R = 50 Ω)
        r100: '#10b981',   // Esmeralda (Críticamente amortiguado, R = 100 Ω)
        r200: '#38bdf8',   // Cian (Sobreamortiguado lento, R = 200 Ω)
        ref: 'rgba(255, 255, 255, 0.45)',
        grid: 'rgba(255, 255, 255, 0.06)',
        text: '#94a3b8'
    },

    /**
     * Inicializa todas las gráficas de la galería
     */
    init() {
        if (this.state.initialized) return;

        this.initFig1();
        this.initFig2();
        this.initFig3();
        this.initFig4();
        this.initControls();
        this.initExpandModal();

        if (window.lucide) {
            try { lucide.createIcons(); } catch (e) {}
        }

        this.state.initialized = true;
    },

    /**
     * Asegura el redibujado correcto cuando la pestaña se vuelve visible
     */
    renderOrResize() {
        if (!this.state.initialized) {
            this.init();
            return;
        }
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key] && key !== 'modal') {
                this.charts[key].resize();
                this.charts[key].update('none');
            }
        });
    },

    /**
     * --------------------------------------------------------------------------
     * FIGURA 1: VALIDACIÓN ANALÍTICA VS. NUMÉRICA RK4 (R = 10 Ω)
     * --------------------------------------------------------------------------
     */
    initFig1() {
        const canvas = document.getElementById("chartGaleriaFig1");
        if (!canvas) return;

        const R = 10.0;
        const L = RLCEngine.DEFAULT_L;
        const C = RLCEngine.DEFAULT_C;
        const E0 = RLCEngine.DEFAULT_E0;

        // Simulación RK4 con paso fino (dt = 0.5 ms -> 800 pasos)
        const sol = RLCEngine.solveRK4(R, L, C, E0, 0.40, 0.0005);
        const errRes = RLCEngine.calculateResidualError(sol.t, sol.Vc, R, L, C, E0);

        // Decimación a ~130 puntos para renderizado fluido
        const stride = Math.max(1, Math.floor(sol.t.length / 130));
        const labels = [];
        const analitData = [];
        const rk4Data = [];
        const errData = [];
        const refData = [];

        for (let i = 0; i < sol.t.length; i += stride) {
            const ms = (sol.t[i] * 1000).toFixed(1);
            labels.push(ms);
            analitData.push(parseFloat(errRes.Vc_analit[i].toFixed(4)));
            rk4Data.push(parseFloat(sol.Vc[i].toFixed(4)));
            errData.push(parseFloat((Math.abs(sol.Vc[i] - errRes.Vc_analit[i]) * 1e9).toFixed(3))); // nV
            refData.push(E0);
        }

        const ctx = canvas.getContext("2d");
        this.charts.fig1 = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Solución Analítica Exacta V_C(t) [V]',
                        data: analitData,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        borderWidth: 2.5,
                        fill: false,
                        tension: 0.15,
                        pointRadius: 0,
                        order: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Simulación Numérica RK4 (h = 0.1 ms)',
                        data: rk4Data,
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 0,
                        showLine: false,
                        pointRadius: 2.8,
                        pointHoverRadius: 5,
                        pointStyle: 'circle',
                        order: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Tensión Permanente E₀ = 12 V',
                        data: refData,
                        borderColor: this.colors.ref,
                        borderWidth: 1.4,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Error Residual |V_num - V_analit| [nV]',
                        data: errData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        borderWidth: 1.8,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        hidden: true,
                        order: 0,
                        yAxisID: 'yErr'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9', font: { family: 'Inter', size: 10.5 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(8, 12, 22, 0.95)',
                        titleColor: '#38bdf8',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => `Tiempo t = ${items[0].label} ms`,
                            label: (item) => {
                                if (item.datasetIndex === 3) {
                                    return ` ${item.dataset.label}: ${item.formattedValue} nV`;
                                }
                                return ` ${item.dataset.label}: ${item.formattedValue} V`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Tiempo t [milisegundos, ms]', color: this.colors.text, font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 9 }
                    },
                    y: {
                        title: { display: true, text: 'Voltaje V_C(t) [V]', color: '#38bdf8', font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 7 },
                        suggestedMin: 0,
                        suggestedMax: 23
                    },
                    yErr: {
                        position: 'right',
                        display: false,
                        title: { display: true, text: 'Error Residual [nV]', color: '#f59e0b', font: { size: 11 } },
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#f59e0b', maxTicksLimit: 6 },
                        suggestedMin: 0,
                        suggestedMax: 4.5
                    }
                }
            }
        });
    },

    /**
     * --------------------------------------------------------------------------
     * FIGURA 2: COMPARATIVA DE REGÍMENES DE AMORTIGUAMIENTO (10, 50, 100, 200 Ω)
     * --------------------------------------------------------------------------
     */
    initFig2() {
        const canvas = document.getElementById("chartGaleriaFig2");
        if (!canvas) return;

        const L = RLCEngine.DEFAULT_L;
        const C = RLCEngine.DEFAULT_C;
        const E0 = RLCEngine.DEFAULT_E0;

        const tMax = 0.25; // 250 ms
        const dt = 0.0005;
        const N = Math.floor(tMax / dt) + 1;
        const stride = Math.max(1, Math.floor(N / 120));

        const labels = [];
        for (let i = 0; i < N; i += stride) {
            labels.push((i * dt * 1000).toFixed(0));
        }

        const regimesConfig = [
            { r: 10.0, label: 'R = 10 Ω | Subamortiguado (ζ = 0.10)', color: this.colors.r10, dash: [] },
            { r: 50.0, label: 'R = 50 Ω | Subamortiguado Moderado (ζ = 0.50)', color: this.colors.r50, dash: [4, 3] },
            { r: 100.0, label: 'R = 100 Ω | Críticamente Amortiguado (ζ = 1.00)', color: this.colors.r100, dash: [6, 4] },
            { r: 200.0, label: 'R = 200 Ω | Sobreamortiguado Lento (ζ = 2.00)', color: this.colors.r200, dash: [2, 2] }
        ];

        const datasets = regimesConfig.map(cfg => {
            const sol = RLCEngine.solveRK4(cfg.r, L, C, E0, tMax, dt);
            const data = [];
            for (let i = 0; i < sol.Vc.length; i += stride) {
                data.push(parseFloat(sol.Vc[i].toFixed(3)));
            }
            return {
                label: cfg.label,
                data: data,
                borderColor: cfg.color,
                borderWidth: 2.2,
                borderDash: cfg.dash,
                pointRadius: 0,
                tension: 0.15,
                fill: false
            };
        });

        // Línea permanente de 12 V
        const refLine = labels.map(() => E0);
        datasets.push({
            label: 'Estado Permanente (12 V ± 2%)',
            data: refLine,
            borderColor: this.colors.ref,
            borderWidth: 1.4,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false
        });

        const ctx = canvas.getContext("2d");
        this.charts.fig2 = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9', font: { family: 'Inter', size: 10.5 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(8, 12, 22, 0.95)',
                        titleColor: '#38bdf8',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => `Tiempo t = ${items[0].label} ms`,
                            label: (item) => ` ${item.dataset.label.split('|')[0]}: ${item.formattedValue} V`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Tiempo t [milisegundos, ms]', color: this.colors.text, font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 9 }
                    },
                    y: {
                        title: { display: true, text: 'Voltaje en Condensador V_C(t) [V]', color: '#38bdf8', font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 7 },
                        suggestedMin: 0,
                        suggestedMax: 23
                    }
                }
            }
        });
    },

    /**
     * --------------------------------------------------------------------------
     * FIGURA 3: FILTRADO MULTI-TONO (5, 50, 500 Hz - R = 50 Ω)
     * --------------------------------------------------------------------------
     */
    initFig3() {
        const canvas = document.getElementById("chartGaleriaFig3");
        if (!canvas) return;

        const multiData = RLCEngine.calculateMultitoneData(50.0, RLCEngine.DEFAULT_L, RLCEngine.DEFAULT_C, 0.35, 140);
        const ctx = canvas.getContext("2d");

        // Configuración inicial en Dominio del Tiempo
        this.charts.fig3 = new Chart(ctx, {
            type: 'line',
            data: {
                labels: multiData.t_ms,
                datasets: [
                    {
                        label: 'Entrada E(t) (5 + 50 + 500 Hz)',
                        data: multiData.e_in,
                        borderColor: '#94a3b8',
                        borderWidth: 1.4,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Salida Filtrada V_C(t) (R = 50 Ω)',
                        data: multiData.vc_out,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        borderWidth: 2.4,
                        fill: true,
                        tension: 0.15,
                        pointRadius: 0
                    },
                    {
                        label: 'Referencia Pura de 5 Hz',
                        data: multiData.ref_5hz,
                        borderColor: '#ef4444',
                        borderWidth: 1.6,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9', font: { family: 'Inter', size: 10.5 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(8, 12, 22, 0.95)',
                        titleColor: '#38bdf8',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => `Tiempo = ${items[0].label} ms`,
                            label: (item) => ` ${item.dataset.label}: ${item.formattedValue} V`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Tiempo t [milisegundos, ms]', color: this.colors.text, font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 8 }
                    },
                    y: {
                        title: { display: true, text: 'Tensión [V]', color: '#38bdf8', font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 6 }
                    }
                }
            }
        });
    },

    /**
     * Alterna la Figura 3 entre Dominio del Tiempo y Espectro FFT
     */
    switchFig3Mode(mode) {
        if (!this.charts.fig3 || this.state.fig3Mode === mode) return;
        this.state.fig3Mode = mode;

        const multiData = RLCEngine.calculateMultitoneData(50.0, RLCEngine.DEFAULT_L, RLCEngine.DEFAULT_C, 0.35, 140);
        const chart = this.charts.fig3;

        if (mode === 'time') {
            chart.config.type = 'line';
            chart.data.labels = multiData.t_ms;
            chart.data.datasets = [
                {
                    label: 'Entrada E(t) (5 + 50 + 500 Hz)',
                    data: multiData.e_in,
                    borderColor: '#94a3b8',
                    borderWidth: 1.4,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Salida Filtrada V_C(t) (R = 50 Ω)',
                    data: multiData.vc_out,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2.4,
                    fill: true,
                    tension: 0.15,
                    pointRadius: 0
                },
                {
                    label: 'Referencia Pura de 5 Hz',
                    data: multiData.ref_5hz,
                    borderColor: '#ef4444',
                    borderWidth: 1.6,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false
                }
            ];
            chart.options.scales.x.title.text = 'Tiempo t [milisegundos, ms]';
            chart.options.scales.y.title.text = 'Tensión [V]';
            chart.options.plugins.tooltip.callbacks.title = (items) => `Tiempo = ${items[0].label} ms`;
            chart.options.plugins.tooltip.callbacks.label = (item) => ` ${item.dataset.label}: ${item.formattedValue} V`;
        } else {
            // Modo Espectro FFT (Barras de Atenuación)
            chart.config.type = 'bar';
            chart.data.labels = multiData.spectrum.labels;
            chart.data.datasets = [
                {
                    label: 'Espectro Entrada E(f) [V]',
                    data: multiData.spectrum.inputMag,
                    backgroundColor: 'rgba(148, 163, 184, 0.65)',
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    barPercentage: 0.6
                },
                {
                    label: 'Espectro Salida Filtrada V_C(f) [V]',
                    data: multiData.spectrum.outputMag,
                    backgroundColor: 'rgba(56, 189, 248, 0.75)',
                    borderColor: '#38bdf8',
                    borderWidth: 1.2,
                    barPercentage: 0.6
                }
            ];
            chart.options.scales.x.title.text = 'Frecuencias de Tono [Hz]';
            chart.options.scales.y.title.text = 'Amplitud Espectral [V]';
            chart.options.plugins.tooltip.callbacks.title = (items) => `Frecuencia: ${items[0].label}`;
            chart.options.plugins.tooltip.callbacks.label = (item) => {
                const idx = item.dataIndex;
                const att = multiData.spectrum.attenuationDb[idx];
                return ` ${item.dataset.label}: ${item.formattedValue} V (Atenuación: ${att} dB)`;
            };
        }

        chart.update();

        // Actualizar estado visual de los botones
        const btnTime = document.getElementById("btnFig3Time");
        const btnFreq = document.getElementById("btnFig3Freq");
        if (btnTime && btnFreq) {
            btnTime.classList.toggle("active", mode === 'time');
            btnFreq.classList.toggle("active", mode === 'freq');
        }
    },

    /**
     * --------------------------------------------------------------------------
     * FIGURA 4: DIAGRAMA DE BODE (MAGNITUD Y FASE - 10, 50, 100, 200 Ω)
     * --------------------------------------------------------------------------
     */
    initFig4() {
        const canvas = document.getElementById("chartGaleriaFig4");
        if (!canvas) return;

        const L = RLCEngine.DEFAULT_L;
        const C = RLCEngine.DEFAULT_C;
        const numPoints = 80;

        // Generar datos de frecuencia logarítmica
        const bode10 = RLCEngine.calculateBode(10.0, L, C, numPoints);
        const bode50 = RLCEngine.calculateBode(50.0, L, C, numPoints);
        const bode100 = RLCEngine.calculateBode(100.0, L, C, numPoints);
        const bode200 = RLCEngine.calculateBode(200.0, L, C, numPoints);

        const labels = bode10.freqs.map(f => f.toFixed(1));

        const datasetsMag = [
            {
                label: 'R = 10 Ω (ζ = 0.10)',
                data: bode10.mag_db.map(v => parseFloat(v.toFixed(2))),
                borderColor: this.colors.r10,
                borderWidth: 2.2,
                pointRadius: 0
            },
            {
                label: 'R = 50 Ω (ζ = 0.50)',
                data: bode50.mag_db.map(v => parseFloat(v.toFixed(2))),
                borderColor: this.colors.r50,
                borderWidth: 2.2,
                borderDash: [4, 3],
                pointRadius: 0
            },
            {
                label: 'R = 100 Ω (ζ = 1.00 Crítico)',
                data: bode100.mag_db.map(v => parseFloat(v.toFixed(2))),
                borderColor: this.colors.r100,
                borderWidth: 2.2,
                borderDash: [6, 4],
                pointRadius: 0
            },
            {
                label: 'R = 200 Ω (ζ = 2.00 Sobreamortiguado)',
                data: bode200.mag_db.map(v => parseFloat(v.toFixed(2))),
                borderColor: this.colors.r200,
                borderWidth: 2.2,
                borderDash: [2, 2],
                pointRadius: 0
            },
            {
                label: 'Referencia 0 dB',
                data: labels.map(() => 0),
                borderColor: 'rgba(255, 255, 255, 0.3)',
                borderWidth: 1,
                pointRadius: 0
            },
            {
                label: 'Nivel -3 dB',
                data: labels.map(() => -3),
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                borderDash: [4, 4],
                pointRadius: 0
            }
        ];

        const ctx = canvas.getContext("2d");
        this.charts.fig4 = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: datasetsMag },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9', font: { family: 'Inter', size: 10.5 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(8, 12, 22, 0.95)',
                        titleColor: '#38bdf8',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => `Frecuencia f = ${items[0].label} Hz`,
                            label: (item) => ` ${item.dataset.label.split('(')[0]}: ${item.formattedValue} dB`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Frecuencia f [Hz] (Escala Logarítmica)', color: this.colors.text, font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 9 }
                    },
                    y: {
                        title: { display: true, text: 'Magnitud |H(jω)| [dB]', color: '#38bdf8', font: { size: 11 } },
                        grid: { color: this.colors.grid },
                        ticks: { color: this.colors.text, maxTicksLimit: 7 },
                        suggestedMin: -60,
                        suggestedMax: 18
                    }
                }
            }
        });
    },

    /**
     * Alterna la Figura 4 entre Magnitud (dB) y Fase (grados)
     */
    switchFig4Mode(mode) {
        if (!this.charts.fig4 || this.state.fig4Mode === mode) return;
        this.state.fig4Mode = mode;

        const L = RLCEngine.DEFAULT_L;
        const C = RLCEngine.DEFAULT_C;
        const numPoints = 80;

        const bode10 = RLCEngine.calculateBode(10.0, L, C, numPoints);
        const bode50 = RLCEngine.calculateBode(50.0, L, C, numPoints);
        const bode100 = RLCEngine.calculateBode(100.0, L, C, numPoints);
        const bode200 = RLCEngine.calculateBode(200.0, L, C, numPoints);

        const labels = bode10.freqs.map(f => f.toFixed(1));
        const chart = this.charts.fig4;

        if (mode === 'mag') {
            chart.data.labels = labels;
            chart.data.datasets = [
                {
                    label: 'R = 10 Ω (ζ = 0.10)',
                    data: bode10.mag_db.map(v => parseFloat(v.toFixed(2))),
                    borderColor: this.colors.r10,
                    borderWidth: 2.2,
                    pointRadius: 0
                },
                {
                    label: 'R = 50 Ω (ζ = 0.50)',
                    data: bode50.mag_db.map(v => parseFloat(v.toFixed(2))),
                    borderColor: this.colors.r50,
                    borderWidth: 2.2,
                    borderDash: [4, 3],
                    pointRadius: 0
                },
                {
                    label: 'R = 100 Ω (ζ = 1.00 Crítico)',
                    data: bode100.mag_db.map(v => parseFloat(v.toFixed(2))),
                    borderColor: this.colors.r100,
                    borderWidth: 2.2,
                    borderDash: [6, 4],
                    pointRadius: 0
                },
                {
                    label: 'R = 200 Ω (ζ = 2.00 Sobreamortiguado)',
                    data: bode200.mag_db.map(v => parseFloat(v.toFixed(2))),
                    borderColor: this.colors.r200,
                    borderWidth: 2.2,
                    borderDash: [2, 2],
                    pointRadius: 0
                },
                {
                    label: 'Referencia 0 dB',
                    data: labels.map(() => 0),
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    pointRadius: 0
                },
                {
                    label: 'Nivel -3 dB',
                    data: labels.map(() => -3),
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0
                }
            ];
            chart.options.scales.y.title.text = 'Magnitud |H(jω)| [dB]';
            chart.options.scales.y.suggestedMin = -60;
            chart.options.scales.y.suggestedMax = 18;
            chart.options.plugins.tooltip.callbacks.label = (item) => ` ${item.dataset.label.split('(')[0]}: ${item.formattedValue} dB`;
        } else {
            // Modo Fase
            chart.data.labels = labels;
            chart.data.datasets = [
                {
                    label: 'R = 10 Ω (ζ = 0.10)',
                    data: bode10.phase_deg.map(v => parseFloat(v.toFixed(1))),
                    borderColor: this.colors.r10,
                    borderWidth: 2.2,
                    pointRadius: 0
                },
                {
                    label: 'R = 50 Ω (ζ = 0.50)',
                    data: bode50.phase_deg.map(v => parseFloat(v.toFixed(1))),
                    borderColor: this.colors.r50,
                    borderWidth: 2.2,
                    borderDash: [4, 3],
                    pointRadius: 0
                },
                {
                    label: 'R = 100 Ω (ζ = 1.00 Crítico)',
                    data: bode100.phase_deg.map(v => parseFloat(v.toFixed(1))),
                    borderColor: this.colors.r100,
                    borderWidth: 2.2,
                    borderDash: [6, 4],
                    pointRadius: 0
                },
                {
                    label: 'R = 200 Ω (ζ = 2.00 Sobreamortiguado)',
                    data: bode200.phase_deg.map(v => parseFloat(v.toFixed(1))),
                    borderColor: this.colors.r200,
                    borderWidth: 2.2,
                    borderDash: [2, 2],
                    pointRadius: 0
                },
                {
                    label: 'Cruce en Resonancia (-90°)',
                    data: labels.map(() => -90),
                    borderColor: 'rgba(255, 255, 255, 0.35)',
                    borderWidth: 1,
                    borderDash: [5, 4],
                    pointRadius: 0
                }
            ];
            chart.options.scales.y.title.text = 'Fase ∠H(jω) [grados, °]';
            chart.options.scales.y.suggestedMin = -185;
            chart.options.scales.y.suggestedMax = 5;
            chart.options.plugins.tooltip.callbacks.label = (item) => ` ${item.dataset.label.split('(')[0]}: ${item.formattedValue}°`;
        }

        chart.update();

        const btnMag = document.getElementById("btnFig4Mag");
        const btnPhase = document.getElementById("btnFig4Phase");
        if (btnMag && btnPhase) {
            btnMag.classList.toggle("active", mode === 'mag');
            btnPhase.classList.toggle("active", mode === 'phase');
        }
    },

    /**
     * Alterna la visualización del error residual en la Figura 1
     */
    toggleFig1Residual() {
        if (!this.charts.fig1) return;
        this.state.fig1ShowResidual = !this.state.fig1ShowResidual;

        const chart = this.charts.fig1;
        const btn = document.getElementById("btnToggleFig1Error");

        chart.data.datasets[3].hidden = !this.state.fig1ShowResidual;
        chart.options.scales.yErr.display = this.state.fig1ShowResidual;

        if (btn) {
            btn.classList.toggle("active", this.state.fig1ShowResidual);
            btn.innerHTML = this.state.fig1ShowResidual
                ? '<i data-lucide="check"></i> <span>Ocultar Error Residual</span>'
                : '<i data-lucide="activity"></i> <span>Ver Error Residual (nV)</span>';
            if (window.lucide) lucide.createIcons();
        }

        chart.update();
    },

    /**
     * Conecta los botones y controles de la galería
     */
    initControls() {
        // Figura 1: Toggle residuo
        const btnFig1Error = document.getElementById("btnToggleFig1Error");
        if (btnFig1Error) {
            btnFig1Error.addEventListener("click", () => this.toggleFig1Residual());
        }

        // Figura 3: Alternar Tiempo / Espectro
        const btnFig3Time = document.getElementById("btnFig3Time");
        const btnFig3Freq = document.getElementById("btnFig3Freq");
        if (btnFig3Time) {
            btnFig3Time.addEventListener("click", () => this.switchFig3Mode('time'));
        }
        if (btnFig3Freq) {
            btnFig3Freq.addEventListener("click", () => this.switchFig3Mode('freq'));
        }

        // Figura 4: Alternar Magnitud / Fase
        const btnFig4Mag = document.getElementById("btnFig4Mag");
        const btnFig4Phase = document.getElementById("btnFig4Phase");
        if (btnFig4Mag) {
            btnFig4Mag.addEventListener("click", () => this.switchFig4Mode('mag'));
        }
        if (btnFig4Phase) {
            btnFig4Phase.addEventListener("click", () => this.switchFig4Mode('phase'));
        }
    },

    /**
     * Modal interactivo a pantalla completa para examinar cualquier gráfica
     */
    initExpandModal() {
        const modal = document.getElementById("chartExpandModal");
        const modalClose = document.getElementById("chartModalClose");
        const modalTitle = document.getElementById("chartModalTitle");
        const modalCanvas = document.getElementById("canvasModalChart");

        if (!modal || !modalCanvas) return;

        // Función auxiliar para clonar configuración profunda preservando callbacks y funciones
        const deepClone = (obj) => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (typeof obj === 'function') return obj;
            if (Array.isArray(obj)) return obj.map(deepClone);
            const copy = {};
            for (const key of Object.keys(obj)) {
                // Omitir propiedades internas que causan colisiones con Chart.js
                if (key.startsWith('$') || key === '_resolvers' || key === '_context') continue;
                copy[key] = deepClone(obj[key]);
            }
            return copy;
        };

        const expandButtons = document.querySelectorAll(".btn-chart-expand");
        expandButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetKey = btn.getAttribute("data-chart");
                const sourceChart = this.charts[targetKey];
                if (!sourceChart) return;

                this.state.activeModalChart = targetKey;
                const titleText = btn.getAttribute("data-title") || "Vista Detallada";
                if (modalTitle) modalTitle.textContent = titleText;

                // Destruir instancia previa del modal si existe
                if (this.charts.modal) {
                    try {
                        this.charts.modal.destroy();
                    } catch (e) {}
                    this.charts.modal = null;
                }

                // 1. Mostrar el modal primero para que el canvas tenga dimensiones reales en pantalla
                modal.classList.add("active");

                // 2. Extraer la configuración original limpia desde _config
                const rawConfig = sourceChart.config._config || sourceChart.config;
                const clonedOptions = deepClone(rawConfig.options || {});
                clonedOptions.responsive = true;
                clonedOptions.maintainAspectRatio = false;
                clonedOptions.animation = false; // Renderizado inmediato de alta definición

                // Mejorar legibilidad en pantalla completa
                if (clonedOptions.plugins && clonedOptions.plugins.legend && clonedOptions.plugins.legend.labels) {
                    clonedOptions.plugins.legend.labels.font = { size: 12, family: 'Inter' };
                    clonedOptions.plugins.legend.labels.boxWidth = 16;
                }

                const modalCtx = modalCanvas.getContext("2d");
                this.charts.modal = new Chart(modalCtx, {
                    type: rawConfig.type,
                    data: deepClone(sourceChart.data),
                    options: clonedOptions
                });

                // Redimensionar para asegurar aprovechamiento total del viewport
                requestAnimationFrame(() => {
                    if (this.charts.modal) {
                        this.charts.modal.resize();
                        this.charts.modal.update('none');
                    }
                });
            });
        });

        const closeModal = () => {
            modal.classList.remove("active");
            if (this.charts.modal) {
                try {
                    this.charts.modal.destroy();
                } catch (e) {}
                this.charts.modal = null;
            }
            this.state.activeModalChart = null;
        };

        if (modalClose) {
            modalClose.addEventListener("click", closeModal);
        }

        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("active")) {
                closeModal();
            }
        });
    }
};

// Exportar explícitamente al objeto global window
if (typeof window !== 'undefined') {
    window.GaleriaCharts = GaleriaCharts;
}
