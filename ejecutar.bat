@echo off
chcp 65001 > nul
title Proyecto RLC - Ejecucion Integral
echo ===============================================================================
echo            PROYECTO 2: EL CIRCUITO RLC COMO FILTRO DE AUDIO
echo       Colegio Mayor del Cauca - Ecuaciones Diferenciales - Grupo 3
echo ===============================================================================
echo.

echo [1/3] Ejecutando pipeline cientifico (RK4, espectros FFT, figuras PNG y WAVs)...
python circuito_rlc.py
if errorlevel 1 (
    echo [ERROR] Ocurrio un fallo al ejecutar circuito_rlc.py
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Generando dashboard y graficas interactivas con Plotly...
python graficas_interactivas_rlc.py --no-open
if errorlevel 1 (
    echo [ADVERTENCIA] No se pudieron generar las graficas interactivas Plotly.
)

echo.
echo [3/3] Abriendo simulador web principal y dashboard interactivo en el navegador...
start "" "index.html"
start "" "dashboard_interactivo_rlc.html"

echo.
echo ===============================================================================
echo                 ¡PROCESO COMPLETO EJECUTADO CON EXITO!
echo ===============================================================================
echo.
pause
