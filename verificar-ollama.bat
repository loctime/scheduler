@echo off
chcp 65001 >nul
echo ========================================
echo   Verificación de Ollama
echo ========================================
echo.

REM Verificar si Ollama está instalado
where ollama >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Ollama no está instalado
    echo Instala Ollama desde https://ollama.ai/
    pause
    exit /b 1
)

echo [1] Verificando que Ollama esté corriendo...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Ollama está corriendo en http://localhost:11434
    echo.
    echo [2] Modelos disponibles:
    ollama list
) else (
    echo [ERROR] Ollama no está corriendo
    echo.
    echo Para iniciar Ollama, ejecuta:
    echo   ollama serve
    echo.
    echo O ejecuta: iniciar-ollama-tunnel.bat
)

echo.
echo ========================================
pause

