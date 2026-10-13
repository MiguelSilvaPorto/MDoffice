@echo off
rem Watchdog do app de desenvolvimento: vigia o codigo e reinicia o app a cada mudanca.
rem (a politica de execucao bloqueia .ps1 direto, por isso o atalho em .cmd)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watchdog.ps1" %*
if errorlevel 1 pause
