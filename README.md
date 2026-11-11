# PROYECTO 2: EL CIRCUITO RLC COMO FILTRO DE AUDIO
### Institución Universitaria Colegio Mayor del Cauca
**Facultad de Ingeniería — Programa de Ingeniería Informática**  
**Asignatura:** Ecuaciones Diferenciales (Unidad 3: EDOs de Orden Superior)  
**Grupo 3:**
* ACOSTA GALINDEZ JESSICA VANESA
* BERMUDEZ ZAMORA KEVIN DANIEL
* LOPEZ QUIRA ALVARO JOSE
* MUÑOZ DULCEY JORGE ENRIQUE

---

## 📁 ESTRUCTURA Y CONTENIDO DEL REPOSITORIO

Este proyecto contiene la deducción analítica matemática completa, el código fuente en Python, las figuras científicas en alta resolución (300 DPI), los archivos de audio sintético y procesado, el informe académico formal y el guion cronometrado para la sustentación oral de 15 minutos:

```
circuito_rlc/
│
├── circuito_rlc.py                                 # Script modular en Python con RK4, gráficas y audio
├── INFORME_PROYECTO_RLC.md                         # Informe académico formal y exhaustivo (Paper universitario)
├── GUION_EXPOSICION_DEFENSA.md                     # Guion de sustentación oral (15 min repartidos) + Preguntas
├── README.md                                       # Este archivo descriptivo del proyecto
│
├── figura1_validacion_rk4_vs_analitica.png         # Superposición analítica vs RK4 (Error: 3.69 nV)
├── figura2_comparativa_regimenes_amortiguamiento.png # Respuestas temporales para R = 10, 50, 100, 200 Ω
├── figura3_filtrado_senal_multitono.png            # Filtrado temporal y espectral FFT (5, 50, 500 Hz)
├── figura4_diagrama_bode_filtro_audio.png          # Respuesta en frecuencia (Bode magnitud en dB y fase)
│
├── audio_original.wav                              # Audio sintético rico en agudos (3.5 s, 44.1 kHz)
└── audio_filtrado_submarino.wav                    # Audio procesado con el filtro RLC ("efecto bajo el agua")
```

---

## 🚀 REQUISITOS Y EJECUCIÓN

### Requisitos de Python:
El proyecto requiere Python 3.9 o superior y las siguientes bibliotecas de computación científica:
```bash
pip install numpy matplotlib scipy
```

### Ejecución de la Simulación Completa:
Para regenerar todas las figuras numéricas, recalcular los errores de verificación y procesar las pistas de audio WAV:
```powershell
python circuito_rlc.py
```

---

## 📊 RESUMEN DE RESULTADOS CLAVE

1. **Parámetros Característicos:**
   - Frecuencia angular natural: $\omega_n = \frac{1}{\sqrt{LC}} = 100.0\text{ rad/s}$ ($f_n \approx 15.92\text{ Hz}$)
   - Resistencia crítica: $R_{cr} = 2\sqrt{\frac{L}{C}} = 100.0\,\Omega$
2. **Validación Numérica vs. Analítica ($R = 10\,\Omega$, Escalón de $12\text{ V}$):**
   - Error máximo absoluto (norma $L_\infty$): **$3.69 \times 10^{-9}\text{ V}$**
   - Sobreimpulso analítico máximo: $V_{C,\max} = 20.75\text{ V}$ en $t_p = 31.57\text{ ms}$ (Sobreimpulso del $72.9\%$)
3. **Comportamiento en Frecuencia (Filtro Pasa-Bajo):**
   - Atenuación asintótica de altas frecuencias: **$-40\text{ dB/década}$** ($-12\text{ dB/octava}$)
   - Componente de $5\text{ Hz}$: pasa sin atenuación ($0\text{ dB}$)
   - Componente de $50\text{ Hz}$: atenuada en **$-20.1\text{ dB}$** (al $10\%$)
   - Componente de $500\text{ Hz}$: atenuada en **$-60.0\text{ dB}$** (al $0.1\%$)
4. **Elección de Ingeniería:**
   - La resistencia óptima recomendada para ecualización de audio es **$R \approx 70.7\,\Omega$** (alineación Butterworth, $\zeta = 0.707$) o **$R = 100\,\Omega$** (amortiguamiento crítico sin sobreimpulso ni ringing).
