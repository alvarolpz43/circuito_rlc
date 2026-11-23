# PROYECTO 2: EL CIRCUITO RLC COMO FILTRO DE AUDIO
### Institución Universitaria Colegio Mayor del Cauca
**Facultad de Ingeniería — Programa de Ingeniería Informática**  
**Asignatura:** Ecuaciones Diferenciales (Unidad 3: EDOs de Orden Superior)  
**Docente:** DIANA MARCELA MENDEZ ASTUDILLO  

**Grupo 3:**
* ACOSTA GALINDEZ JESSICA VANESA (Código: 90125041)
* BERMUDEZ ZAMORA KEVIN DANIEL (Código: 90125059)
* LOPEZ QUIRA ALVARO JOSE (Código: 90125048)
* MUÑOZ DULCEY JORGE ENRIQUE (Código: 90125037)

---

## 1. ESTRUCTURA Y CONTENIDO DEL REPOSITORIO

Este proyecto contiene la deducción analítica matemática completa, el código fuente en Python, la suite interactiva web, las figuras científicas en alta resolución (300 DPI), los archivos de audio sintético y procesado y el informe académico formal:

```
circuito_rlc/
│
├── index.html                                      # Plataforma Web Interactiva de Simulación RLC
├── css/
│   └── styles.css                                  # Estilos maestros (Glassmorphism 2.0, Paleta Institucional)
├── js/
│   ├── rlc_engine.js                               # Motor matemático de cálculo RK4, analítica y polos
│   ├── app.js                                      # Controlador principal, atajos de teclado y telemetría
│   ├── audio_lab.js                                # Laboratorio Web Audio API (Sintetizador, Mic y Archivos)
│   ├── analogia_canvas.js                          # Animación Hi-DPI masa-resorte vs cargas RLC (60 FPS)
│   └── lucide.min.js                               # Iconos vectoriales profesionales (Modo 100% Offline)
├── assets/
│   ├── logo_unimayor.png                           # Escudo oficial de la Institución Universitaria Colegio Mayor del Cauca
│   ├── logo_unimayor_transparent.png               # Versión transparente del escudo institucional
│   └── favicon.png                                 # Favicon institucional para navegador
│
├── circuito_rlc.py                                 # Pipeline científico modular en Python (RK4, FFT, Bode y WAV)
├── INFORME_PROYECTO_RLC.md                         # Informe académico formal exhaustivo (Paper de ingeniería)
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

## 2. APLICACIÓN WEB INTERACTIVA

Para abrir la plataforma de simulación interactiva en tiempo real:
- Haz doble clic sobre `index.html` en el explorador de archivos, o ábrelo en Google Chrome, Microsoft Edge o Firefox.
- **Modo 100% Offline:** Todas las librerías vectoriales y motores matemáticos operan localmente sin depender de internet en el aula.

### Funcionalidades de la Plataforma Web:
1. **Simulador RK4 con Superposición Analítica en Vivo:**
   - Sliders de $R, L, C$ y $E_0$ a 60 FPS fijos.
   - Botón *"Superponer Analítica"* que calcula el error residual de convergencia en nanovoltios ($L_\infty \approx 3.69\text{ nV}$).
2. **Diagrama de Polos en el Plano Complejo $s$ (Lugar de las Raíces):**
   - Muestra las raíces $s_{1,2} = -\alpha \pm \sqrt{\alpha^2 - \omega_n^2}$ moviéndose dinámicamente y el semiplano izquierdo de estabilidad de Lyapunov.
3. **Laboratorio de Audio Sensorial:**
   - Sintetizador polifónico en vivo con corte acústico instantáneo.
   - **Micrófono en Vivo:** Permite hablar y escuchar la voz en tiempo real filtrada "bajo el agua".
   - **Carga de Archivo Propio:** Permite subir canciones MP3/WAV para procesarlas por el filtro RLC.
4. **Control por Teclado:**
   - `←` / `→` Cambiar pestañas • `P` Modo Presentación Pantalla Completa.

---

## 3. REQUISITOS Y EJECUCIÓN (PYTHON)

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

## 4. RESUMEN DE RESULTADOS CLAVE

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

---

## 5. TECNOLOGÍAS, LIBRERÍAS E INTELIGENCIA ARTIFICIAL UTILIZADA

### 5.1. Asistencia con Inteligencia Artificial
Para la conceptualización, formulación analítica y desarrollo de software de este proyecto se utilizó **Antigravity AI**, el entorno de desarrollo agéntico avanzado de **Google DeepMind**, impulsado por los modelos de lenguaje y razonamiento multimodal **Google Gemini (Gemini 3.8 Flash / Gemini Pro)**.

La IA intervino en los siguientes aspectos del proyecto:
* **Deducción Matemática y Rigor Teórico:** Asistencia en el planteamiento formal a partir de la Segunda Ley de Kirchhoff (LVK), cálculo analítico exacto de la respuesta al escalón mediante coeficientes indeterminados y caracterización de los discriminantes de los cuatro regímenes de amortiguamiento.
* **Computación Científica y Algorítmica (Python):** Implementación del integrador numérico Runge-Kutta de 4to orden (RK4), algoritmos de transformada rápida de Fourier (FFT), trazado de diagramas de Bode y bucles optimizados de procesamiento de audio muestra a muestra.
* **Desarrollo de la Suite Web Interactiva:** Arquitectura frontend modular basada en HTML5, CSS3 con Glassmorphism 2.0 y JavaScript Vanilla; integración del motor de simulación a 60 FPS, diagrama dinámico de polos en el plano complejo $s$ y canvas interactivo de la analogía electromecánica masa-resorte.
* **Laboratorio de Audio Sensorial (Web Audio API):** Configuración del pipeline de audio en tiempo real con nodos `BiquadFilterNode`, sintetizador polifónico virtual y captura de micrófono en vivo para reproducir el efecto de inmersión acústica marina.
* **Generación de Documentación y Reportes:** Redacción técnica del informe académico, generación automatizada de figuras a 300 DPI y pipeline de compilación a PDF de alta resolución con tipografía KaTeX.

---

### 5.2. Librerías y Ecosistema de Software Utilizado

#### A. Entorno Científico y Pipeline de Audio (Python):
| Biblioteca / Módulo | Versión Recomendada | Propósito en el Proyecto |
| :--- | :---: | :--- |
| **`numpy`** | `^1.24.0` | Álgebra lineal, cálculo matricial vectorizado, discretización temporal y arrays numéricos para el solver RK4. |
| **`scipy`** (`signal`, `io.wavfile`) | `^1.10.0` | Transformada Rápida de Fourier (FFT), respuesta frecuencial de Bode y codificación/exportación de audio WAV a 44.1 kHz de 16 bits. |
| **`matplotlib`** | `^3.7.0` | Generación de las 4 figuras científicas en alta resolución (300 DPI) con estilos publication-ready. |
| **`plotly`** | `^5.14.0` | Renderizado interactivo y exportación del panel consolidado en HTML. |
| **`pypdf`** | `^4.0.0` | Inspección de integridad, recuento de páginas y verificación estructural del documento PDF final. |

#### B. Plataforma Web Interactiva y Motor Acústico (Frontend):
| Tecnología / Biblioteca | Modo de Uso | Propósito en el Proyecto |
| :--- | :---: | :--- |
| **`Web Audio API`** | Nativo (W3C Standard) | Procesamiento digital de audio en tiempo real en el navegador (`AudioContext`, `BiquadFilterNode`, `OscillatorNode`, `AnalyserNode`). |
| **`HTML5 Canvas API`** | Nativo | Motor gráfico 2D acelerado por GPU a 60 FPS para la analogía masa-resorte y el plano complejo $s$. |
| **`KaTeX`** | CDN / Local | Motor tipográfico ultrarrápido para renderizar ecuaciones matemáticas complejas en formato LaTeX sin demoras. |
| **`Chart.js`** | `v4.x` | Gráficos interactivos responsivos para la visualización de señales temporales y espectro FFT en la Galería. |
| **`Lucide Icons`** | `lucide.min.js` (Offline) | Conjunto de iconos vectoriales SVG para una interfaz moderna, limpia y funcional sin requerir conexión a internet. |

#### C. Herramientas de Compilación Documental:
| Herramienta | Mecanismo | Propósito en el Proyecto |
| :--- | :--- | :--- |
| **`Microsoft Edge Headless`** | `--headless=new --print-to-pdf` | Compilación del informe técnico desde HTML/CSS print hacia PDF vectorial de calidad de imprenta. |

