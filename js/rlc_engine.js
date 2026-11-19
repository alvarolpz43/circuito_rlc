/**
 * ==============================================================================
 * MOTOR CIENTÍFICO RLC: SIMULACIÓN RK4 Y MODELADO ANALÍTICO
 * Proyecto 2: El Circuito RLC como Filtro de Audio
 * Institución Universitaria Colegio Mayor del Cauca - Grupo 3
 * ==============================================================================
 */

const RLCEngine = {
    // Constantes nominales estandarizadas del proyecto
    NOMINAL_RESISTANCES: [10.0, 50.0, 100.0, 200.0],
    DEFAULT_R: 10.0,
    DEFAULT_L: 0.5,
    DEFAULT_C: 200e-6,
    DEFAULT_E0: 12.0,
    R_AUDIO: 50.0,
    R_CRITICAL: 100.0,

    /**
     * Calcula los parámetros físicos, frecuencias y régimen de amortiguamiento.
     */
    calculateParameters(R, L, C) {
        const omega_n = 1.0 / Math.sqrt(L * C);
        const f_n = omega_n / (2.0 * Math.PI);
        const R_cr = 2.0 * Math.sqrt(L / C);
        const delta = Math.pow(R, 2) - (4.0 * L) / C;
        const zeta = R / R_cr;
        const alpha = R / (2.0 * L);

        let regimeName = "";
        let regimeClass = "";
        let omega_d = 0;
        let t_p = 0;
        let overshootPct = 0;

        if (delta < -1e-7) {
            regimeName = "Subamortiguado (Oscilatorio)";
            regimeClass = "regime-sub";
            omega_d = Math.sqrt(Math.pow(omega_n, 2) - Math.pow(alpha, 2));
            t_p = Math.PI / omega_d; // Tiempo del primer pico
            overshootPct = Math.exp(-alpha * (Math.PI / omega_d)) * 100.0;
        } else if (Math.abs(delta) <= 1e-7) {
            regimeName = "Críticamente Amortiguado";
            regimeClass = "regime-crit";
            omega_d = 0;
            t_p = 0;
            overshootPct = 0;
        } else {
            regimeName = "Sobreamortiguado (Aperiódico)";
            regimeClass = "regime-over";
            omega_d = 0;
            t_p = 0;
            overshootPct = 0;
        }

        // Cálculo de polos en el plano complejo s (Raíces de la EDO)
        let poles = [];
        if (delta < -1e-7) {
            poles = [
                { real: -alpha, imag: omega_d, label: `-${alpha.toFixed(1)} + j${omega_d.toFixed(1)} rad/s` },
                { real: -alpha, imag: -omega_d, label: `-${alpha.toFixed(1)} - j${omega_d.toFixed(1)} rad/s` }
            ];
        } else if (Math.abs(delta) <= 1e-7) {
            poles = [
                { real: -alpha, imag: 0, label: `-${alpha.toFixed(1)} s⁻¹ (raíz doble)` },
                { real: -alpha, imag: 0, label: `-${alpha.toFixed(1)} s⁻¹ (raíz doble)` }
            ];
        } else {
            const sqrtDelta = Math.sqrt(delta);
            const s1 = (-R + sqrtDelta) / (2.0 * L);
            const s2 = (-R - sqrtDelta) / (2.0 * L);
            poles = [
                { real: s1, imag: 0, label: `${s1.toFixed(1)} s⁻¹` },
                { real: s2, imag: 0, label: `${s2.toFixed(1)} s⁻¹` }
            ];
        }

        return {
            R, L, C,
            omega_n,
            f_n,
            R_cr,
            delta,
            zeta,
            alpha,
            omega_d,
            t_p,
            overshootPct,
            regimeName,
            regimeClass,
            poles
        };
    },

    /**
     * Calcula la solución analítica exacta y el error residual infinito L_inf = max |V_num - V_exacta|.
     */
    calculateResidualError(tArray, Vc_num, R, L, C, E0, q0 = 0.0, i0 = 0.0) {
        const Vc_analit = this.solveAnalytical(R, L, C, E0, tArray, q0, i0);
        let maxError = 0.0;
        const N = tArray.length;
        for (let i = 0; i < N; i++) {
            const err = Math.abs(Vc_num[i] - Vc_analit[i]);
            if (err > maxError) maxError = err;
        }
        return { maxError, Vc_analit };
    },

    /**
     * Integrador numérico Runge-Kutta de 4to orden (RK4) para el circuito RLC serie.
     * Admite condiciones iniciales editables de carga q0 [C] y corriente i0 [A].
     * EDO: L*Q'' + R*Q' + (1/C)*Q = E0 (Escalón)
     */
    solveRK4(R, L, C, E0 = 12.0, tMax = 0.35, dt = 0.0001, q0 = 0.0, i0 = 0.0) {
        const N = Math.floor(tMax / dt) + 1;
        const t = new Float64Array(N);
        const Vc = new Float64Array(N);
        const I = new Float64Array(N);
        const Q = new Float64Array(N);

        let q = q0;
        let i = i0;
        const invL = 1.0 / L;
        const invC = 1.0 / C;

        const f_derivatives = (curr_q, curr_i) => {
            const dq_dt = curr_i;
            const di_dt = (E0 - R * curr_i - invC * curr_q) * invL;
            return [dq_dt, di_dt];
        };

        for (let step = 0; step < N; step++) {
            const curr_t = step * dt;
            t[step] = curr_t;
            Q[step] = q;
            Vc[step] = q * invC;
            I[step] = i;

            if (step < N - 1) {
                // k1
                const [k1_q, k1_i] = f_derivatives(q, i);

                // k2
                const q_k2 = q + 0.5 * dt * k1_q;
                const i_k2 = i + 0.5 * dt * k1_i;
                const [k2_q, k2_i] = f_derivatives(q_k2, i_k2);

                // k3
                const q_k3 = q + 0.5 * dt * k2_q;
                const i_k3 = i + 0.5 * dt * k2_i;
                const [k3_q, k3_i] = f_derivatives(q_k3, i_k3);

                // k4
                const q_k4 = q + dt * k3_q;
                const i_k4 = i + dt * k3_i;
                const [k4_q, k4_i] = f_derivatives(q_k4, i_k4);

                // Actualizar estado
                q += (dt / 6.0) * (k1_q + 2.0 * k2_q + 2.0 * k3_q + k4_q);
                i += (dt / 6.0) * (k1_i + 2.0 * k2_i + 2.0 * k3_i + k4_i);
            }
        }

        return { t, Vc, I, Q };
    },

    /**
     * Solución analítica exacta generalizada ante escalón E0 para condiciones iniciales arbitrarias Q(0) = q0 e I(0) = i0.
     */
    solveAnalytical(R, L, C, E0, tArray, q0 = 0.0, i0 = 0.0) {
        const decomp = this.decomposeAnalytical(R, L, C, E0, tArray, q0, i0);
        return decomp.Vc_total;
    },

    /**
     * Descompone formalmente la solución analítica en Respuesta Permanente y Respuesta Transitoria.
     * Retorna { Vc_total, Vc_perm, Vc_trans, Q_perm, Q_trans, C1, C2, alpha, omega_d }
     */
    decomposeAnalytical(R, L, C, E0, tArray, q0 = 0.0, i0 = 0.0) {
        const p = this.calculateParameters(R, L, C);
        const N = tArray.length;
        const Vc_total = new Float64Array(N);
        const Vc_trans = new Float64Array(N);
        const Vc_perm = new Float64Array(N);

        const Q_perm_val = C * E0; // Carga en régimen permanente [C]
        const V_perm_val = E0;      // Voltaje en régimen permanente [V]
        const V0 = q0 / C;          // Voltaje inicial [V]

        let C1 = 0;
        let C2 = 0;

        if (p.delta < -1e-7) {
            // ==========================================
            // Régimen Subamortiguado (Oscilatorio)
            // ==========================================
            C1 = q0 - Q_perm_val; // En Coulombs
            C2 = (i0 + p.alpha * C1) / p.omega_d;

            const A = V0 - V_perm_val; // Coeficiente cos en V
            const B = (i0 / C + p.alpha * (V0 - V_perm_val)) / p.omega_d; // Coeficiente sin en V

            for (let idx = 0; idx < N; idx++) {
                const t = tArray[idx];
                const decay = Math.exp(-p.alpha * t);
                const trans = decay * (A * Math.cos(p.omega_d * t) + B * Math.sin(p.omega_d * t));
                Vc_perm[idx] = V_perm_val;
                Vc_trans[idx] = trans;
                Vc_total[idx] = V_perm_val + trans;
            }
        } else if (Math.abs(p.delta) <= 1e-7) {
            // ==========================================
            // Régimen Críticamente Amortiguado
            // ==========================================
            C1 = q0 - Q_perm_val;
            C2 = i0 + p.alpha * C1;

            const A = V0 - V_perm_val;
            const B = i0 / C + p.alpha * (V0 - V_perm_val);

            for (let idx = 0; idx < N; idx++) {
                const t = tArray[idx];
                const decay = Math.exp(-p.alpha * t);
                const trans = decay * (A + B * t);
                Vc_perm[idx] = V_perm_val;
                Vc_trans[idx] = trans;
                Vc_total[idx] = V_perm_val + trans;
            }
        } else {
            // ==========================================
            // Régimen Sobreamortiguado
            // ==========================================
            const s1 = -p.alpha + Math.sqrt(p.delta) / (2.0 * L);
            const s2 = -p.alpha - Math.sqrt(p.delta) / (2.0 * L);
            const diff_s = s1 - s2;

            C1 = (i0 - s2 * (q0 - Q_perm_val)) / diff_s;
            C2 = (s1 * (q0 - Q_perm_val) - i0) / diff_s;

            const A = (i0 / C - s2 * (V0 - V_perm_val)) / diff_s;
            const B = (s1 * (V0 - V_perm_val) - i0 / C) / diff_s;

            for (let idx = 0; idx < N; idx++) {
                const t = tArray[idx];
                const trans = A * Math.exp(s1 * t) + B * Math.exp(s2 * t);
                Vc_perm[idx] = V_perm_val;
                Vc_trans[idx] = trans;
                Vc_total[idx] = V_perm_val + trans;
            }
        }

        return {
            Vc_total,
            Vc_perm,
            Vc_trans,
            Q_perm: Q_perm_val,
            V_perm: V_perm_val,
            C1,
            C2,
            alpha: p.alpha,
            omega_d: p.omega_d
        };
    },

    /**
     * Calcula la respuesta en frecuencia (Magnitud en dB y Fase en grados).
     */
    calculateBode(R, L, C, numPoints = 120) {
        const omega_n = 1.0 / Math.sqrt(L * C);
        const f_n = omega_n / (2.0 * Math.PI);
        const zeta = R / (2.0 * Math.sqrt(L / C));

        const freqs = [];
        const mag_db = [];
        const phase_deg = [];

        // Frecuencias desde 1 Hz hasta 1000 Hz en escala logarítmica
        const logMin = 0;   // 10^0 = 1 Hz
        const logMax = 3;   // 10^3 = 1000 Hz
        const step = (logMax - logMin) / (numPoints - 1);

        for (let i = 0; i < numPoints; i++) {
            const f = Math.pow(10, logMin + i * step);
            const omega = 2.0 * Math.PI * f;
            const w_ratio = omega / omega_n;

            // Denominador: (1 - (w/wn)^2) + j*(2*zeta*(w/wn))
            const real = 1.0 - Math.pow(w_ratio, 2);
            const imag = 2.0 * zeta * w_ratio;
            const denomMag = Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2));

            const H_mag = 1.0 / denomMag;
            const H_db = 20.0 * Math.log10(H_mag);
            let H_phase = -Math.atan2(imag, real) * (180.0 / Math.PI);

            freqs.push(f);
            mag_db.push(H_db);
            phase_deg.push(H_phase);
        }

        return { freqs, mag_db, phase_deg, f_n };
    },

    /**
     * Calcula los datos de la señal multi-tono (Figura 3) en dominio del tiempo y frecuencia.
     * E(t) = sen(2*pi*5*t) + sen(2*pi*50*t) + sen(2*pi*500*t)
     */
    calculateMultitoneData(R = 50.0, L = 0.5, C = 200e-6, duration = 0.4, numPoints = 400) {
        const omega_n = 1.0 / Math.sqrt(L * C);
        const f1 = 5.0, f2 = 50.0, f3 = 500.0;
        const freqs = [f1, f2, f3];

        // Función de transferencia en cada armónico: H(j*omega) = omega_n^2 / ((omega_n^2 - omega^2) + j*(R/L)*omega)
        const harmonics = freqs.map(f => {
            const w = 2.0 * Math.PI * f;
            const real = Math.pow(omega_n, 2) - Math.pow(w, 2);
            const imag = (R / L) * w;
            const mag = Math.pow(omega_n, 2) / Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2));
            const phase = -Math.atan2(imag, real);
            const db = 20.0 * Math.log10(mag);
            return { f, mag, phase, db };
        });

        // Muestreo en el dominio del tiempo (0 a duration s, graficado en ms)
        const t_ms = [];
        const e_in = [];
        const vc_out = [];
        const ref_5hz = [];

        const dt = duration / (numPoints - 1);
        for (let i = 0; i < numPoints; i++) {
            const t = i * dt;
            const ms = t * 1000.0;
            const val_in = Math.sin(2 * Math.PI * f1 * t) + 
                           Math.sin(2 * Math.PI * f2 * t) + 
                           Math.sin(2 * Math.PI * f3 * t);
            
            const val_out = harmonics[0].mag * Math.sin(2 * Math.PI * f1 * t + harmonics[0].phase) +
                            harmonics[1].mag * Math.sin(2 * Math.PI * f2 * t + harmonics[1].phase) +
                            harmonics[2].mag * Math.sin(2 * Math.PI * f3 * t + harmonics[2].phase);

            const val_ref = Math.sin(2 * Math.PI * f1 * t);

            t_ms.push(ms.toFixed(1));
            e_in.push(parseFloat(val_in.toFixed(3)));
            vc_out.push(parseFloat(val_out.toFixed(3)));
            ref_5hz.push(parseFloat(val_ref.toFixed(3)));
        }

        // Espectro frecuencial comparativo
        const spectrum = {
            labels: ['5 Hz (Graves)', '50 Hz (Medios)', '500 Hz (Agudos)'],
            frequencies: [5, 50, 500],
            inputMag: [1.0, 1.0, 1.0],
            outputMag: [
                parseFloat(harmonics[0].mag.toFixed(3)),
                parseFloat(harmonics[1].mag.toFixed(3)),
                parseFloat(harmonics[2].mag.toFixed(4))
            ],
            attenuationDb: [
                harmonics[0].db.toFixed(1),
                harmonics[1].db.toFixed(1),
                harmonics[2].db.toFixed(1)
            ]
        };

        return { t_ms, e_in, vc_out, ref_5hz, spectrum, harmonics };
    }
};
