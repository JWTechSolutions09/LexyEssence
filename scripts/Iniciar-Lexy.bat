@echo off
title Lexy Essence
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Instala Node.js LTS desde https://nodejs.org
  pause
  exit /b 1
)

if not exist ".env" (
  echo Falta el archivo .env con DATABASE_MODE, DATABASE_URL y LEXY_JWT_SECRET.
  echo Copia .env.example a .env
  echo Modo tienda recomendado: DATABASE_MODE=dual + SQL Server LexyLocal.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Lexy Essence - Modo tienda
echo ========================================
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3001"
npm run store

pause
