@echo off
rem ElondiaRPG: double-click to start the game (keep the black window open while playing).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows.ps1"
if errorlevel 1 pause
