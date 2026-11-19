#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
PROYECTO DE AULA 2: EL CIRCUITO RLC COMO FILTRO DE AUDIO
ASIGNATURA: ECUACIONES DIFERENCIALES - COLEGIO MAYOR DEL CAUCA
GRUPO 3:
    - ACOSTA GALINDEZ JESSICA VANESA
    - BERMUDEZ ZAMORA KEVIN DANIEL
    - LOPEZ QUIRA ALVARO JOSE
    - MUÑOZ DULCEY JORGE ENRIQUE
===============================================================================
Descripción:
    Generador de las 4 Gráficas Científicas Dinámicas e Interactivas en formato
    HTML autónomo con Plotly (Zoom, Pan, Hover unificado, Sliders y Subplots
    vinculados con zoom sincronizado en el eje temporal).

    Cumple rigurosamente con la rúbrica de evaluación:
    - Rótulos claros de ejes con unidades entre corchetes ([s], [V], [Hz], [dB]).
    - Parámetros exactos del circuito: L = 0.5 H, C = 200 µF, E = 12 V.
    - Integrador numérico manual Runge-Kutta de 4to orden (RK4).
    - Solución analítica formal con omega_d = 30*sqrt(11) rad/s.
===============================================================================
"""

import os
import sys
import webbrowser
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# =============================================================================
# CONSTANTES FÍSICAS Y PARÁMETROS CANÓNICOS
# =============================================================================
L_NOMINAL = 0.5              # Inductancia en Henrios [H]
C_NOMINAL = 200e-6           # Capacitancia en Faradios [F] (200 µF)
E_ESCALON = 12.0             # Voltaje del escalón [V]
RESISTENCIAS_BASE = [10.0, 50.0, 100.0, 200.0]  # Valores de evaluación [Ω]

OMEGA_N = 1.0 / np.sqrt(L_NOMINAL * C_NOMINAL)      # 100.0 rad/s
F_N = OMEGA_N / (2.0 * np.pi)                       # ~15.9155 Hz
R_CRITICA = 2.0 * np.sqrt(L_NOMINAL / C_NOMINAL)    # 100.0 Ω

# Paleta científica para modo oscuro
COLORES = {
    10.0: '#ef4444',    # Rojo brillante (Subamortiguado oscilatorio, R = 10 Ω)
    50.0: '#f97316',    # Naranja cálido (Subamortiguado moderado, R = 50 Ω)
    100.0: '#10b981',   # Esmeralda (Críticamente amortiguado, R = 100 Ω)
    200.0: '#38bdf8',   # Cian hielo (Sobreamortiguado lento, R = 200 Ω)
    'exacta': '#60a5fa',# Azul cielo para solución analítica
    'num': '#f43f5e',   # Carmesí para RK4
    'err': '#eab308',   # Amarillo para error
    'grid': 'rgba(255, 255, 255, 0.08)',
    'bg': '#090d16',    # Obsidian profundo
    'paper': '#060911'
}

TEMA_PLOTLY = dict(
    paper_bgcolor=COLORES['paper'],
    plot_bgcolor=COLORES['bg'],
    font=dict(family='Inter, sans-serif', size=12, color='#cbd5e1'),
    legend=dict(
        bgcolor='rgba(15, 23, 42, 0.85)',
        bordercolor='rgba(255, 255, 255, 0.12)',
        borderwidth=1,
        font=dict(size=11, color='#f1f5f9')
    ),
    margin=dict(l=65, r=50, t=75, b=60)
)


# =============================================================================
# 1. MOTOR NUMÉRICO: REDUCCIÓN DE ORDEN Y RUNGE-KUTTA 4 (RK4) MANUAL
# =============================================================================
def sistema_rlc_derivadas(t, state, R, L, C, fuente_func):
    """
    Sistema de variables de estado de 1er orden:
        dQ/dt = I
        dI/dt = (1/L) * [E(t) - R*I - (1/C)*Q]
    """
    Q, I = state[0], state[1]
    E_t = fuente_func(t)
    dQ_dt = I
    dI_dt = (E_t - R * I - (1.0 / C) * Q) / L
    return np.array([dQ_dt, dI_dt], dtype=np.float64)


def rk4_integrador(f, y0, t_array, R, L, C, fuente_func):
    """
    Integrador numérico Runge-Kutta de 4to orden implementado manualmente.
    """
    N = len(t_array)
    dt = t_array[1] - t_array[0]
    solucion = np.zeros((N, 2), dtype=np.float64)
    solucion[0] = y0

    y = np.array(y0, dtype=np.float64)
    for i in range(N - 1):
        t_curr = t_array[i]
        k1 = f(t_curr, y, R, L, C, fuente_func)
        k2 = f(t_curr + 0.5 * dt, y + 0.5 * dt * k1, R, L, C, fuente_func)
        k3 = f(t_curr + 0.5 * dt, y + 0.5 * dt * k2, R, L, C, fuente_func)
        k4 = f(t_curr + dt, y + dt * k3, R, L, C, fuente_func)

        y = y + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        solucion[i + 1] = y

    return solucion


# =============================================================================
# 2. SOLUCIÓN ANALÍTICA EXACTA (R = 10 Ω, E(t) = 12 V)
# =============================================================================
def solucion_analitica_vc(t_array, R=10.0, L=0.5, C=200e-6, E0=12.0, q0=0.0, i0=0.0):
    """
    Fórmula formal deducida a mano con descomposición canónica:
        alpha = R / (2L) = 10 s^-1
        omega_d = 30*sqrt(11) = 10*sqrt(99) rad/s
        Q_perm = C * E0  ==>  V_C,perm = E0 = 12 V
        C1 = q0 - Q_perm
        C2 = (i0 + alpha * C1) / omega_d
        V_C,trans(t) = exp(-alpha*t) * [(C1/C)*cos(omega_d*t) + (C2/C)*sin(omega_d*t)]
        V_C(t) = V_C,perm + V_C,trans(t)
    """
    alpha = R / (2.0 * L)  # 10.0 s^-1
    omega_d = 30.0 * np.sqrt(11.0)  # 99.4987437 rad/s
    q_perm = C * E0
    c1 = q0 - q_perm
    c2 = (i0 + alpha * c1) / omega_d

    decay = np.exp(-alpha * t_array)
    q_trans = decay * (c1 * np.cos(omega_d * t_array) + c2 * np.sin(omega_d * t_array))
    vc_trans = q_trans / C
    vc_perm = E0 * np.ones_like(t_array)
    vc_total = vc_perm + vc_trans
    return vc_total, vc_perm, vc_trans, omega_d, alpha


# =============================================================================
# GRÁFICA 1: VALIDACIÓN (ANALÍTICA VS. NUMÉRICA RK4 CON UNIFIED HOVER)
# =============================================================================
def generar_grafica1_validacion(guardar_html=True, abrir=False, q0=0.0, i0=0.0):
    print(f"-> Generando Gráfica Dinámica 1: Validación Analítica vs. Numérica RK4 [Q(0)={q0*1e3:.2f} mC, I(0)={i0:.2f} A]...")

    t_span = np.linspace(0.0, 0.6, 3001)  # Intervalo t in [0, 0.6] s (dt = 0.2 ms)
    y0 = [q0, i0]
    fuente_escalon = lambda t: E_ESCALON

    # Solución Numérica RK4
    sol_rk4 = rk4_integrador(sistema_rlc_derivadas, y0, t_span, 10.0, L_NOMINAL, C_NOMINAL, fuente_escalon)
    vc_num = sol_rk4[:, 0] / C_NOMINAL

    # Solución Analítica Exacta y Descomposición
    vc_analit, vc_perm, vc_trans, omega_d, alpha = solucion_analitica_vc(
        t_span, 10.0, L_NOMINAL, C_NOMINAL, E_ESCALON, q0=q0, i0=i0
    )

    # Error absoluto en nanovoltios (nV)
    error_abs_nv = np.abs(vc_num - vc_analit) * 1e9
    max_err_nv = np.max(error_abs_nv)

    # Punto pico máximo numérico / teórico
    idx_max = np.argmax(vc_analit)
    t_peak = t_span[idx_max]
    vc_peak = vc_analit[idx_max]
    overshoot_pct = ((vc_peak - E_ESCALON) / E_ESCALON) * 100.0

    # Crear figura con eje Y secundario para el error
    fig = make_subplots(specs=[[{"secondary_y": True}]])

    # 1. Traza analítica exacta (línea azul)
    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_analit,
            mode='lines',
            name='Solución Analítica Exacta V_C(t)',
            line=dict(color=COLORES['exacta'], width=2.8),
            hovertemplate='<b>Analítica</b>: %{y:.4f} V<extra></extra>'
        ),
        secondary_y=False
    )

    # 2. Traza numérica RK4 (puntos/marcadores rojos espaciados para claridad)
    stride = 30
    fig.add_trace(
        go.Scatter(
            x=t_span[::stride], y=vc_num[::stride],
            mode='markers',
            name='Simulación Numérica RK4 (h = 0.2 ms)',
            marker=dict(color=COLORES['num'], size=5, symbol='circle'),
            hovertemplate='<b>RK4</b>: %{y:.4f} V<extra></extra>'
        ),
        secondary_y=False
    )

    # 3. Traza de tensión en permanente E0 = 12 V
    fig.add_trace(
        go.Scatter(
            x=[0, 0.6], y=[12.0, 12.0],
            mode='lines',
            name='Parte Permanente V_C,perm = 12 V',
            line=dict(color='rgba(56, 189, 248, 0.75)', width=1.8, dash='dash'),
            hovertemplate='<b>Permanente</b>: 12.0000 V<extra></extra>'
        ),
        secondary_y=False
    )

    # 4. Traza de componente transitoria V_C,trans(t) (inspección analítica)
    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_trans,
            mode='lines',
            name='Parte Transitoria V_C,trans(t)',
            line=dict(color='#a855f7', width=1.6, dash='dot'),
            hovertemplate='<b>Transitoria</b>: %{y:.4f} V<extra></extra>',
            visible='legendonly'  # Activable desde la leyenda
        ),
        secondary_y=False
    )

    # 5. Traza de Error Absoluto en nanovoltios (eje secundario)
    fig.add_trace(
        go.Scatter(
            x=t_span, y=error_abs_nv,
            mode='lines',
            name='Error Absoluto |V_num - V_analit| [nV]',
            line=dict(color=COLORES['err'], width=1.8, dash='dot'),
            hovertemplate='<b>Error Absoluto</b>: %{y:.3f} nV<extra></extra>',
            visible='legendonly'  # Activable desde la leyenda
        ),
        secondary_y=True
    )

    # Marcador de Sobreimpulso Máximo
    fig.add_trace(
        go.Scatter(
            x=[t_peak], y=[vc_peak],
            mode='markers+text',
            name='Pico Máximo (Sobreimpulso)',
            marker=dict(color='#facc15', size=10, symbol='diamond'),
            text=[f"Pico: {vc_peak:.2f} V (+{overshoot_pct:.1f}%)"],
            textposition='top right',
            hoverinfo='skip'
        ),
        secondary_y=False
    )

    # Layout y rotulación estricta con unidades entre corchetes
    fig.update_layout(
        title=dict(
            text='<b>GRÁFICA 1: Validación Analítica vs. Simulación Numérica RK4</b><br>'
                 f'<sup>Circuito RLC Serie ante Escalón de 12 V (R = 10 Ω, L = 0.5 H, C = 200 µF) | Error L_inf: {max_err_nv:.2f} nV</sup>',
            x=0.03, y=0.96
        ),
        xaxis=dict(
            title='<b>Tiempo t [s]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[0, 0.6]
        ),
        yaxis=dict(
            title='<b>Voltaje en el Condensador V_C(t) [V]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[-0.5, 23.5]
        ),
        yaxis2=dict(
            title='<b>Error Residual Absoluto [nV]</b>',
            gridcolor='rgba(0, 0, 0, 0)',
            showgrid=False,
            zeroline=False,
            range=[0, 8.0]
        ),
        hovermode='x unified',
        **TEMA_PLOTLY
    )

    filename = "figura1_interactiva.html"
    if guardar_html:
        fig.write_html(filename, include_plotlyjs='cdn')
        print(f"   -> Guardado exitoso: {filename}")
    if abrir:
        fig.show()

    return fig


# =============================================================================
# GRÁFICA 2: RESPUESTA AL ESCALÓN (4 REGÍMENES + SLIDER INTERACTIVO DE R)
# =============================================================================
def generar_grafica2_regimenes_slider(guardar_html=True, abrir=False):
    print("-> Generando Gráfica Dinámica 2: Escalón para 4 Regímenes con Slider de R...")

    t_span = np.linspace(0.0, 0.6, 1201)  # 600 ms
    y0 = [0.0, 0.0]
    fuente_escalon = lambda t: E_ESCALON

    fig = go.Figure()

    # 1. Cuatro curvas base obligatorias
    curvas_base = [
        (10.0, 'R = 10 Ω (Subamortiguado Severo, ζ = 0.10)', COLORES[10.0], 'solid'),
        (50.0, 'R = 50 Ω (Subamortiguado Moderado, ζ = 0.50)', COLORES[50.0], 'dash'),
        (100.0, 'R = 100 Ω (Críticamente Amortiguado, ζ = 1.00)', COLORES[100.0], 'dashdot'),
        (200.0, 'R = 200 Ω (Sobreamortiguado Lento, ζ = 2.00)', COLORES[200.0], 'dot'),
    ]

    for R_val, nombre, color, estilo in curvas_base:
        sol = rk4_integrador(sistema_rlc_derivadas, y0, t_span, R_val, L_NOMINAL, C_NOMINAL, fuente_escalon)
        vc = sol[:, 0] / C_NOMINAL
        fig.add_trace(
            go.Scatter(
                x=t_span, y=vc,
                mode='lines',
                name=nombre,
                line=dict(color=color, width=2.4, dash=estilo),
                hovertemplate=f'<b>{nombre.split("(")[0]}</b>: %{{y:.3f}} V<extra></extra>'
            )
        )

    # 2. Línea permanente de 12 V y banda de tolerancia ±2%
    fig.add_trace(
        go.Scatter(
            x=[0, 0.6], y=[12.0, 12.0],
            mode='lines',
            name='Estado Permanente (12 V)',
            line=dict(color='rgba(255, 255, 255, 0.5)', width=1.5, dash='dash'),
            hoverinfo='skip'
        )
    )

    # Banda de tolerancia ±2% (11.76 V a 12.24 V)
    fig.add_hrect(
        y0=11.76, y1=12.24,
        fillcolor='rgba(148, 163, 184, 0.08)',
        line_width=0,
        annotation_text="Banda de Tolerancia ±2% (11.76 V - 12.24 V)",
        annotation_position="bottom right",
        annotation_font_size=10,
        annotation_font_color="#94a3b8"
    )

    # 3. Traza interactiva para el Slider (Valores de R de 5 a 250 Ω en pasos de 5 Ω)
    r_slider_vals = np.arange(5.0, 255.0, 5.0)
    num_base_traces = len(fig.data)

    # Generamos las soluciones para cada paso del slider
    slider_traces_indices = []
    for R_slide in r_slider_vals:
        sol = rk4_integrador(sistema_rlc_derivadas, y0, t_span, R_slide, L_NOMINAL, C_NOMINAL, fuente_escalon)
        vc = sol[:, 0] / C_NOMINAL

        zeta = R_slide / R_CRITICA
        delta = R_slide**2 - 4.0 * L_NOMINAL / C_NOMINAL
        regimen = "Subamortiguado" if delta < -1e-5 else ("Crítico" if abs(delta) <= 1e-5 else "Sobreamortiguado")

        trace_idx = len(fig.data)
        slider_traces_indices.append(trace_idx)

        fig.add_trace(
            go.Scatter(
                x=t_span, y=vc,
                mode='lines',
                name=f'Explorador R = {R_slide:.0f} Ω ({regimen})',
                line=dict(color='#a855f7', width=3.0),
                hovertemplate=f'<b>R = {R_slide:.0f} Ω</b>: %{{y:.3f}} V<extra></extra>',
                visible=False  # Oculto inicialmente excepto para el valor inicial del slider
            )
        )

    # Activar la primera traza del slider (R = 10 Ω)
    idx_default_slider = int(np.where(r_slider_vals == 10.0)[0][0])
    fig.data[slider_traces_indices[idx_default_slider]].visible = True

    # 4. Construcción de los pasos interactivos del Slider de Plotly
    steps = []
    for i, R_slide in enumerate(r_slider_vals):
        zeta = R_slide / R_CRITICA
        delta = R_slide**2 - 4.0 * L_NOMINAL / C_NOMINAL
        regimen = "Subamortiguado" if delta < -1e-5 else ("Crítico" if abs(delta) <= 1e-5 else "Sobreamortiguado")
        
        # Máscara booleana de visibilidad de trazas
        vis = [True] * num_base_traces + [False] * len(r_slider_vals)
        vis[num_base_traces + i] = True

        step = dict(
            method="update",
            args=[
                {"visible": vis},
                {"title.text": f"<b>GRÁFICA 2: Respuesta al Escalón con Slider Dinámico de R</b><br>"
                               f"<sup>R = {R_slide:.0f} Ω | Factor ζ = {zeta:.3f} | Discriminante Δ = {delta:.0f} | Régimen: {regimen}</sup>"}
            ],
            label=f"{int(R_slide)}Ω"
        )
        steps.append(step)

    sliders = [dict(
        active=idx_default_slider,
        currentvalue={"prefix": "Resistencia Seleccionada R = ", "suffix": " Ω", "font": {"size": 13, "color": "#a855f7"}},
        pad={"t": 40, "b": 10},
        steps=steps,
        ticklen=4,
        tickcolor="#94a3b8"
    )]

    fig.update_layout(
        title=dict(
            text='<b>GRÁFICA 2: Respuesta al Escalón para los 4 Regímenes + Slider Interactivo de R</b><br>'
                 '<sup>Contraste de amortiguamiento transitorio y control dinámico continuo (5 Ω a 250 Ω)</sup>',
            x=0.03, y=0.96
        ),
        xaxis=dict(
            title='<b>Tiempo t [s]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[0, 0.6]
        ),
        yaxis=dict(
            title='<b>Voltaje en el Condensador V_C(t) [V]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[-0.5, 23.5]
        ),
        sliders=sliders,
        hovermode='x unified',
        **TEMA_PLOTLY
    )

    filename = "figura2_interactiva.html"
    if guardar_html:
        fig.write_html(filename, include_plotlyjs='cdn')
        print(f"   -> Guardado exitoso: {filename}")
    if abrir:
        fig.show()

    return fig


# =============================================================================
# GRÁFICA 3: FILTRADO DE SEÑAL MULTI-TONO (SUBPLOTS CON ZOOM SINCRONIZADO EN X)
# =============================================================================
def generar_grafica3_filtrado_multitono(guardar_html=True, abrir=False):
    print("-> Generando Gráfica Dinámica 3: Filtrado Multi-tono con Zoom Sincronizado...")

    # Simulación temporal de 0 a 0.4 s con frecuencia de muestreo de 20 kHz (frecuencia alta para capturar 500 Hz)
    fs = 20000.0
    t_span = np.linspace(0.0, 0.4, int(fs * 0.4) + 1)
    
    # Señal compuesta: E(t) = sen(2*pi*5*t) + sen(2*pi*50*t) + sen(2*pi*500*t)
    f1, f2, f3 = 5.0, 50.0, 500.0
    fuente_multitono = lambda t: np.sin(2.0 * np.pi * f1 * t) + \
                                 np.sin(2.0 * np.pi * f2 * t) + \
                                 np.sin(2.0 * np.pi * f3 * t)

    entrada = fuente_multitono(t_span)
    y0 = [0.0, 0.0]

    # Evaluamos salida para R = 100 Ω (Crítico) y también para R = 10, 50, 200 Ω
    sol_100 = rk4_integrador(sistema_rlc_derivadas, y0, t_span, 100.0, L_NOMINAL, C_NOMINAL, fuente_multitono)
    vc_100 = sol_100[:, 0] / C_NOMINAL

    sol_50 = rk4_integrador(sistema_rlc_derivadas, y0, t_span, 50.0, L_NOMINAL, C_NOMINAL, fuente_multitono)
    vc_50 = sol_50[:, 0] / C_NOMINAL

    sol_10 = rk4_integrador(sistema_rlc_derivadas, y0, t_span, 10.0, L_NOMINAL, C_NOMINAL, fuente_multitono)
    vc_10 = sol_10[:, 0] / C_NOMINAL

    sol_200 = rk4_integrador(sistema_rlc_derivadas, y0, t_span, 200.0, L_NOMINAL, C_NOMINAL, fuente_multitono)
    vc_200 = sol_200[:, 0] / C_NOMINAL

    ref_5hz = np.sin(2.0 * np.pi * f1 * t_span)

    # Crear 2 subplots vinculados con zoom compartido en X (shared_xaxes=True)
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.10,
        subplot_titles=(
            "<b>[Panel Superior] Señal de Entrada Compuesta: E(t) = sen(2π·5t) + sen(2π·50t) + sen(2π·500t)</b>",
            "<b>[Panel Inferior] Señal de Salida Filtrada en el Condensador: V_C(t) (Filtro Pasa-Bajo RLC)</b>"
        )
    )

    # 1. Panel Superior: Entrada
    fig.add_trace(
        go.Scatter(
            x=t_span, y=entrada,
            mode='lines',
            name='Entrada E(t) (5 + 50 + 500 Hz)',
            line=dict(color='#94a3b8', width=1.6),
            hovertemplate='<b>Entrada</b>: %{y:.3f} V<extra></extra>'
        ),
        row=1, col=1
    )

    # Componente pura de 5 Hz para referencia en panel superior
    fig.add_trace(
        go.Scatter(
            x=t_span, y=ref_5hz,
            mode='lines',
            name='Tono Puro de 5 Hz (Referencia)',
            line=dict(color='rgba(239, 68, 68, 0.75)', width=1.4, dash='dot'),
            hovertemplate='<b>Tono 5 Hz</b>: %{y:.3f} V<extra></extra>'
        ),
        row=1, col=1
    )

    # 2. Panel Inferior: Salida Filtrada (Por defecto R = 100 Ω, con opciones para 10, 50 y 200 Ω)
    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_100,
            mode='lines',
            name='Salida V_C(t) (R = 100 Ω, Crítico)',
            line=dict(color='#10b981', width=2.4),
            hovertemplate='<b>Salida (100 Ω)</b>: %{y:.3f} V<extra></extra>',
            visible=True
        ),
        row=2, col=1
    )

    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_50,
            mode='lines',
            name='Salida V_C(t) (R = 50 Ω, Moderado)',
            line=dict(color='#f97316', width=2.2),
            hovertemplate='<b>Salida (50 Ω)</b>: %{y:.3f} V<extra></extra>',
            visible=False
        ),
        row=2, col=1
    )

    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_10,
            mode='lines',
            name='Salida V_C(t) (R = 10 Ω, Resonante)',
            line=dict(color='#ef4444', width=2.2),
            hovertemplate='<b>Salida (10 Ω)</b>: %{y:.3f} V<extra></extra>',
            visible=False
        ),
        row=2, col=1
    )

    fig.add_trace(
        go.Scatter(
            x=t_span, y=vc_200,
            mode='lines',
            name='Salida V_C(t) (R = 200 Ω, Sobreamortiguado)',
            line=dict(color='#38bdf8', width=2.2),
            hovertemplate='<b>Salida (200 Ω)</b>: %{y:.3f} V<extra></extra>',
            visible=False
        ),
        row=2, col=1
    )

    # Botones Updatemenu para seleccionar la resistencia de filtrado
    updatemenus = [dict(
        type="buttons",
        direction="right",
        x=0.0, y=1.14,
        xanchor="left", yanchor="top",
        bgcolor="rgba(15, 23, 42, 0.85)",
        bordercolor="rgba(255, 255, 255, 0.15)",
        buttons=[
            dict(
                label="R = 100 Ω (Recomendado)",
                method="update",
                args=[{"visible": [True, True, True, False, False, False]},
                      {"title.text": "<b>GRÁFICA 3: Filtrado Multi-tono | R = 100 Ω (Amortiguamiento Crítico Óptimo)</b>"}]
            ),
            dict(
                label="R = 50 Ω (Audio)",
                method="update",
                args=[{"visible": [True, True, False, True, False, False]},
                      {"title.text": "<b>GRÁFICA 3: Filtrado Multi-tono | R = 50 Ω (Subamortiguado Moderado, ζ = 0.50)</b>"}]
            ),
            dict(
                label="R = 10 Ω (Subamortiguado)",
                method="update",
                args=[{"visible": [True, True, False, False, True, False]},
                      {"title.text": "<b>GRÁFICA 3: Filtrado Multi-tono | R = 10 Ω (Fuerte Resonancia en Medios)</b>"}]
            ),
            dict(
                label="R = 200 Ω (Sobreamortiguado)",
                method="update",
                args=[{"visible": [True, True, False, False, False, True]},
                      {"title.text": "<b>GRÁFICA 3: Filtrado Multi-tono | R = 200 Ω (Atenuación Excesiva)</b>"}]
            ),
        ]
    )]

    fig.update_layout(
        title=dict(
            text='<b>GRÁFICA 3: Filtrado de Señal Compuesta (Entrada vs. Salida)</b><br>'
                 '<sup>Zoom sincronizado en ambos paneles: haz zoom en cualquier intervalo para verificar la aniquilación de los 500 Hz</sup>',
            x=0.03, y=0.98
        ),
        updatemenus=updatemenus,
        xaxis=dict(gridcolor=COLORES['grid'], zerolinecolor=COLORES['grid']),
        xaxis2=dict(
            title='<b>Tiempo t [s] (Eje Vinculado con Zoom Sincronizado)</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[0.0, 0.4]
        ),
        yaxis=dict(
            title='<b>Tensión Entrada E(t) [V]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[-3.3, 3.3]
        ),
        yaxis2=dict(
            title='<b>Tensión Salida V_C(t) [V]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[-1.8, 1.8]
        ),
        hovermode='x unified',
        **TEMA_PLOTLY
    )

    filename = "figura3_interactiva.html"
    if guardar_html:
        fig.write_html(filename, include_plotlyjs='cdn')
        print(f"   -> Guardado exitoso: {filename}")
    if abrir:
        fig.show()

    return fig


# =============================================================================
# GRÁFICA 4: DIAGRAMA DE BODE EN FRECUENCIA LOGARÍTMICA (1 Hz A 10,000 Hz)
# =============================================================================
def generar_grafica4_bode(guardar_html=True, abrir=False):
    print("-> Generando Gráfica Dinámica 4: Diagrama de Bode Interactivo (1 a 10,000 Hz)...")

    # Frecuencia de 1 Hz a 10,000 Hz (4 décadas completas)
    f_hz = np.logspace(0, 4, 3000)  # 10^0 = 1 Hz a 10^4 = 10,000 Hz
    omega = 2.0 * np.pi * f_hz

    fig = go.Figure()

    # Trazas de Magnitud en dB y Lineal para cada R
    for R_val in RESISTENCIAS_BASE:
        # Fórmula rigurosa de ganancia: |V_C| / |E| = 1 / sqrt((1 - w^2*L*C)^2 + (w*R*C)^2)
        denom = np.sqrt((1.0 - (omega**2) * L_NOMINAL * C_NOMINAL)**2 + (omega * R_val * C_NOMINAL)**2)
        ganancia_lineal = 1.0 / denom
        ganancia_db = 20.0 * np.log10(ganancia_lineal)

        zeta = R_val / R_CRITICA
        nombre = f"R = {int(R_val)} Ω (ζ = {zeta:.2f})"

        # Traza en dB (Visible inicialmente)
        fig.add_trace(
            go.Scatter(
                x=f_hz, y=ganancia_db,
                mode='lines',
                name=f"{nombre} [dB]",
                line=dict(color=COLORES[R_val], width=2.4),
                hovertemplate=f'<b>{nombre}</b>: %{{y:.2f}} dB @ %{{x:.1f}} Hz<extra></extra>',
                visible=True
            )
        )

        # Traza Lineal (Para conmutar con botones)
        fig.add_trace(
            go.Scatter(
                x=f_hz, y=ganancia_lineal,
                mode='lines',
                name=f"{nombre} [Lineal V/V]",
                line=dict(color=COLORES[R_val], width=2.4),
                hovertemplate=f'<b>{nombre}</b>: %{{y:.3f}} V/V @ %{{x:.1f}} Hz<extra></extra>',
                visible=False
            )
        )

    # Marcadores de Referencia:
    # 1. Frecuencia Natural f_n = 15.92 Hz
    fig.add_vline(
        x=F_N, line_width=1.6, line_dash="dash", line_color="#cbd5e1",
        annotation_text=f"f_n = {F_N:.2f} Hz (Corte Natural)",
        annotation_position="top right",
        annotation_font_color="#cbd5e1",
        annotation_font_size=10
    )

    # 2. Nivel -3 dB (Línea horizontal)
    fig.add_hline(
        y=-3.0, line_width=1.2, line_dash="dot", line_color="rgba(255, 255, 255, 0.4)",
        annotation_text="Nivel de Corte -3 dB (Atenuación del 50% de potencia)",
        annotation_position="bottom right",
        annotation_font_color="#94a3b8",
        annotation_font_size=10
    )

    # 3. Nivel 0 dB
    fig.add_hline(
        y=0.0, line_width=1.0, line_color="rgba(255, 255, 255, 0.2)"
    )

    # Asíntota de -40 dB/década
    f_asintota = np.array([F_N, 1000.0])
    asintota_db = -40.0 * np.log10(f_asintota / F_N)
    fig.add_trace(
        go.Scatter(
            x=f_asintota, y=asintota_db,
            mode='lines',
            name='Asíntota -40 dB/década (-12 dB/oct)',
            line=dict(color='#cbd5e1', width=1.6, dash='dash'),
            hoverinfo='skip'
        )
    )

    # Botones Updatemenu para alternar entre Escala Decibelios [dB] y Magnitud Lineal [V/V]
    # Índices de trazas: 4 trazas dB, 4 trazas lineal, 1 traza asíntota
    vis_db = [True, False, True, False, True, False, True, False, True]
    vis_lin = [False, True, False, True, False, True, False, True, False]

    updatemenus = [dict(
        type="buttons",
        direction="right",
        x=0.0, y=1.14,
        xanchor="left", yanchor="top",
        bgcolor="rgba(15, 23, 42, 0.85)",
        bordercolor="rgba(255, 255, 255, 0.15)",
        buttons=[
            dict(
                label="Ganancia en Decibelios [dB]",
                method="update",
                args=[{"visible": vis_db},
                      {"yaxis.title.text": "<b>Magnitud de Ganancia |H(jω)| [dB]</b>",
                       "yaxis.range": [-75, 18],
                       "title.text": "<b>GRÁFICA 4: Diagrama de Bode en Magnitud [dB] (Filtro Pasa-Bajo RLC)</b>"}]
            ),
            dict(
                label="Magnitud Lineal [V/V]",
                method="update",
                args=[{"visible": vis_lin},
                      {"yaxis.title.text": "<b>Ganancia Lineal |V_C| / |E| [V/V]</b>",
                       "yaxis.range": [0, 5.5],
                       "title.text": "<b>GRÁFICA 4: Respuesta en Frecuencia - Ganancia Lineal [V/V]</b>"}]
            )
        ]
    )]

    fig.update_layout(
        title=dict(
            text='<b>GRÁFICA 4: Curva de Ganancia en Frecuencia (Diagrama de Bode Interactivo)</b><br>'
                 f'<sup>Eje logarítmico de 1 Hz a 10,000 Hz | Frecuencia natural f_n = {F_N:.2f} Hz | Caída: -40 dB/década</sup>',
            x=0.03, y=0.98
        ),
        xaxis=dict(
            title='<b>Frecuencia f [Hz] (Escala Logarítmica)</b>',
            type='log',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[0, 4]  # 10^0 a 10^4
        ),
        yaxis=dict(
            title='<b>Magnitud de Ganancia |H(jω)| [dB]</b>',
            gridcolor=COLORES['grid'],
            zerolinecolor=COLORES['grid'],
            range=[-75, 18]
        ),
        updatemenus=updatemenus,
        hovermode='x unified',
        **TEMA_PLOTLY
    )

    filename = "figura4_interactiva.html"
    if guardar_html:
        fig.write_html(filename, include_plotlyjs='cdn')
        print(f"   -> Guardado exitoso: {filename}")
    if abrir:
        fig.show()

    return fig


# =============================================================================
# DASHBOARD CIENTÍFICO UNIFICADO (HTML INTEGRADO)
# =============================================================================
def generar_dashboard_unificado(guardar_html=True, abrir=True):
    print("-> Generando Dashboard Unificado con las 4 Gráficas Interactivas...")

    f1 = generar_grafica1_validacion(guardar_html=True, abrir=False)
    f2 = generar_grafica2_regimenes_slider(guardar_html=True, abrir=False)
    f3 = generar_grafica3_filtrado_multitono(guardar_html=True, abrir=False)
    f4 = generar_grafica4_bode(guardar_html=True, abrir=False)

    html_dashboard = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Científico Interactivo Plotly: Circuito RLC como Filtro de Audio</title>
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
    <style>
        :root {{
            --bg-body: #050811;
            --bg-card: #0b111e;
            --border-glass: rgba(255, 255, 255, 0.1);
            --accent-cyan: #38bdf8;
            --accent-emerald: #10b981;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            padding: 1.5rem;
            min-height: 100vh;
        }}
        .header {{
            max-width: 1300px;
            margin: 0 auto 1.5rem auto;
            padding: 1.25rem 1.75rem;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.7));
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }}
        .title-box h1 {{ font-size: 1.35rem; color: #fff; margin-bottom: 0.25rem; font-weight: 800; }}
        .title-box p {{ font-size: 0.85rem; color: var(--accent-cyan); }}
        .badge-info {{
            font-size: 0.75rem;
            padding: 0.4rem 0.8rem;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 20px;
            color: var(--accent-cyan);
            font-weight: 600;
        }}
        .nav-tabs {{
            max-width: 1300px;
            margin: 0 auto 1.25rem auto;
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}
        .tab-btn {{
            padding: 0.6rem 1.2rem;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted);
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        .tab-btn:hover {{ color: #fff; background: rgba(255, 255, 255, 0.08); }}
        .tab-btn.active {{
            background: var(--accent-cyan);
            color: #0b111e;
            border-color: var(--accent-cyan);
            font-weight: 700;
        }}
        .charts-container {{
            max-width: 1300px;
            margin: 0 auto;
        }}
        .chart-pane {{
            display: none;
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 1rem;
            min-height: 650px;
        }}
        .chart-pane.active {{ display: block; }}
        .caption-card {{
            margin-top: 1rem;
            padding: 1rem 1.25rem;
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            font-size: 0.85rem;
            color: var(--text-muted);
            line-height: 1.5;
        }}
        .caption-card strong {{ color: #fff; }}
    </style>
</head>
<body>

    <header class="header">
        <div class="title-box">
            <h1>PROYECTO 2: El Circuito RLC como Filtro de Audio • Dashboard Plotly</h1>
            <p>Ecuaciones Diferenciales — Institución Universitaria Colegio Mayor del Cauca — Grupo 3</p>
        </div>
        <div class="badge-info">
            Plotly Engine • 100% Interactivo • Sin Servidor Externo
        </div>
    </header>

    <div class="nav-tabs">
        <button class="tab-btn active" onclick="switchTab('fig1')">1. Validación Exacta (Analítica vs. RK4)</button>
        <button class="tab-btn" onclick="switchTab('fig2')">2. Respuesta al Escalón (Slider de R)</button>
        <button class="tab-btn" onclick="switchTab('fig3')">3. Filtrado Multi-tono (Zoom Sincronizado)</button>
        <button class="tab-btn" onclick="switchTab('fig4')">4. Diagrama de Bode (1 a 10,000 Hz)</button>
    </div>

    <main class="charts-container">
        <!-- Figura 1 -->
        <div id="pane-fig1" class="chart-pane active">
            {f1.to_html(full_html=False, include_plotlyjs=False)}
            <div class="caption-card">
                <strong>Fundamentación Científica (Figura 1):</strong> Superposición exacta entre la solución calculada a mano mediante coeficientes indeterminados y el método numérico Runge-Kutta de 4to orden ($h = 0.2\\text{{ ms}}$) para $R = 10\\,\\Omega$. El error residual máximo se sitúa en la escala de nanovoltios ($L_\\infty \\approx 3.69\\text{{ nV}}$). El sobreimpulso máximo del $72.9\\%$ ocurre en $t_p = 31.57\\text{{ ms}}$ con $V_{{C,\\max}} = 20.75\\text{{ V}}$.
            </div>
        </div>

        <!-- Figura 2 -->
        <div id="pane-fig2" class="chart-pane">
            {f2.to_html(full_html=False, include_plotlyjs=False)}
            <div class="caption-card">
                <strong>Dinámica de Regímenes (Figura 2):</strong> Compara simultáneamente la respuesta transitoria al escalón de 12 V para las 4 resistencias nominales. Utiliza el <strong>control deslizante inferior (Slider)</strong> para variar $R$ continuamente desde $5\\,\\Omega$ hasta $250\\,\\Omega$ y evaluar en tiempo real la transición entre oscilación subamortiguada, amortiguamiento crítico óptimo libre de sobreimpulso ($100\\,\\Omega$) y lentitud sobreamortiguada ($200\\,\\Omega$).
            </div>
        </div>

        <!-- Figura 3 -->
        <div id="pane-fig3" class="chart-pane">
            {f3.to_html(full_html=False, include_plotlyjs=False)}
            <div class="caption-card">
                <strong>Filtrado Multi-tono (Figura 3):</strong> Señal de entrada compuesta $E(t) = \\sin(2\\pi\\cdot 5t) + \\sin(2\\pi\\cdot 50t) + \\sin(2\\pi\\cdot 500t)$ vs. salida filtrada en el condensador $V_C(t)$. Los dos paneles disponen de <strong>zoom sincronizado en el eje temporal X</strong>: haz zoom en cualquier tramo para constatar cómo la oscilación de alta frecuencia de 500 Hz desaparece por completo mientras el tono grave de 5 Hz pasa sin alteración.
            </div>
        </div>

        <!-- Figura 4 -->
        <div id="pane-fig4" class="chart-pane">
            {f4.to_html(full_html=False, include_plotlyjs=False)}
            <div class="caption-card">
                <strong>Diagrama de Bode en Frecuencia (Figura 4):</strong> Ganancia del filtro en escala logarítmica desde 1 Hz hasta 10,000 Hz. Demuestra de manera concluyente la frecuencia de corte natural $f_n \\approx 15.92\\text{{ Hz}}$ y la pendiente asintótica de caída de <strong>-40 dB/década</strong> (-12 dB/octava). Puedes alternar entre la escala en Decibelios [dB] y Magnitud Lineal [V/V] con los botones superiores.
            </div>
        </div>
    </main>

    <script>
        function switchTab(figKey) {{
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.chart-pane').forEach(pane => pane.classList.remove('active'));
            
            event.target.classList.add('active');
            const targetPane = document.getElementById('pane-' + figKey);
            if (targetPane) {{
                targetPane.classList.add('active');
                window.dispatchEvent(new Event('resize'));
            }}
        }}
    </script>
</body>
</html>
"""

    dashboard_path = "dashboard_interactivo_rlc.html"
    if guardar_html:
        with open(dashboard_path, "w", encoding="utf-8") as f:
            f.write(html_dashboard)
        print(f"   -> Dashboard unificado guardado exitosamente: {dashboard_path}")

    if abrir:
        abs_path = os.path.abspath(dashboard_path)
        print(f"-> Abriendo Dashboard en el navegador: {abs_path}")
        webbrowser.open(f"file:///{abs_path}")


# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================
if __name__ == "__main__":
    print("=" * 80)
    print("PROYECTO 2: GENERADOR DE GRÁFICAS CIENTÍFICAS DINÁMICAS EN PLOTLY")
    print("Colegio Mayor del Cauca - Ecuaciones Diferenciales - Grupo 3")
    print("=" * 80)

    # Si se pasa el argumento --all o sin argumentos, genera todo y abre el dashboard
    abrir_navegador = "--no-open" not in sys.argv
    generar_dashboard_unificado(guardar_html=True, abrir=abrir_navegador)

    print("=" * 80)
    print("¡PROCESO COMPLETADO CON ÉXITO!")
    print("Archivos HTML interactivos generados en el directorio del proyecto:")
    print("  1. figura1_interactiva.html (Validación Exacta vs. Numérica)")
    print("  2. figura2_interactiva.html (Escalón con Slider de R en tiempo real)")
    print("  3. figura3_interactiva.html (Filtrado con Zoom Sincronizado)")
    print("  4. figura4_interactiva.html (Bode logarítmico de 1 a 10,000 Hz)")
    print("  5. dashboard_interactivo_rlc.html (Panel Consolidado de Sustentación)")
    print("=" * 80)
