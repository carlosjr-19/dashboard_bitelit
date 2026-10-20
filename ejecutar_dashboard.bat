@echo off
title Bitelit Dashboard
chcp 65001 > nul
echo ===================================================
echo        DASHBOARD OPERATIVO Y FINANCIERO BITELIT
echo ===================================================
echo.
echo 1. Abriendo la plataforma en tu navegador...
timeout /t 2 /nobreak > nul
start http://localhost:5000
echo 2. Iniciando servidor en http://localhost:5000
python app.py
pause
