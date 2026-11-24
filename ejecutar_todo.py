#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script maestro para ejecutar todo el proyecto RLC de una sola vez:
1. Simulación científica, cálculo RK4 y archivos de audio (circuito_rlc.py).
2. Generación de las figuras interactivas Plotly y dashboard (graficas_interactivas_rlc.py).
3. Apertura automática en el navegador del simulador interactivo y del dashboard.
"""

import os
import sys
import subprocess
import webbrowser

def main():
    directorio_raiz = os.path.dirname(os.path.abspath(__file__))
    os.chdir(directorio_raiz)

    print("=" * 80)
    print("EJECUTANDO PROYECTO COMPLETO: CIRCUITO RLC - GRUPO 3")
    print("=" * 80)

    # 1. Pipeline científico base
    print("\n[1/3] Ejecutando simulación científica (RK4, FFT, PNGs y WAVs)...")
    res1 = subprocess.run([sys.executable, "circuito_rlc.py"])
    if res1.returncode != 0:
        print("[ERROR] Falló la ejecución de circuito_rlc.py")
        sys.exit(res1.returncode)

    # 2. Gráficas interactivas Plotly
    print("\n[2/3] Generando gráficas interactivas Plotly...")
    subprocess.run([sys.executable, "graficas_interactivas_rlc.py", "--no-open"])

    # 3. Abrir simulador web y dashboard en el navegador
    print("\n[3/3] Abriendo simulador web y dashboard en el navegador...")
    index_path = os.path.join(directorio_raiz, "index.html")
    dashboard_path = os.path.join(directorio_raiz, "dashboard_interactivo_rlc.html")

    webbrowser.open(f"file:///{index_path}")
    if os.path.exists(dashboard_path):
        webbrowser.open(f"file:///{dashboard_path}")

    print("\n" + "=" * 80)
    print("¡TODO EL PROYECTO SE HA EJECUTADO Y ABIERTO EXITOSAMENTE!")
    print("=" * 80)

if __name__ == "__main__":
    main()
