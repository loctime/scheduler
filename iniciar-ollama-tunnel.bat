@echo off
chcp 65001 >nul
echo ========================================
echo   Iniciando Ollama y Cloudflare Tunnel
echo ========================================
echo.

REM Verificar si Ollama está instalado
where ollama >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Ollama no está instalado o no está en el PATH
    echo Por favor, instala Ollama desde https://ollama.ai/
    pause
    exit /b 1
)

REM Verificar si cloudflared está instalado
where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] cloudflared no está en el PATH
    echo.
    echo Por favor, ejecuta cloudflared manualmente desde donde lo instalaste.
    echo O agrega cloudflared al PATH del sistema.
    echo.
    echo Para ejecutar el túnel manualmente, abre PowerShell y ejecuta:
    echo   cloudflared tunnel run ollama-tunnel
    echo.
    pause
    REM Continuar de todas formas, el usuario puede ejecutarlo manualmente
)

echo [1/3] Verificando que Ollama esté disponible...
timeout /t 1 >nul

REM Verificar si Ollama ya está corriendo
curl -s http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Ollama ya está corriendo
) else (
    echo [2/3] Iniciando Ollama...
    start "Ollama Server" cmd /k "ollama serve"
    echo [INFO] Esperando a que Ollama inicie...
    timeout /t 5 >nul
    
    REM Verificar nuevamente
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ADVERTENCIA] Ollama podría no estar iniciado correctamente
        echo Verifica manualmente que Ollama esté corriendo
    ) else (
        echo [OK] Ollama iniciado correctamente
    )
)

echo.
echo [3/3] Iniciando Cloudflare Tunnel...
echo [INFO] El túnel se abrirá en una nueva ventana
echo [INFO] Copia la URL que aparece (ej: https://abc-123.cfargotunnel.com)
echo [INFO] Esa URL es la que debes configurar en Vercel como OLLAMA_URL
echo.
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run ollama-tunnel"

echo.
echo ========================================
echo   Todo iniciado!
echo ========================================
echo.
echo IMPORTANTE:
echo - Deja estas ventanas abiertas durante la presentación
echo - La URL del túnel aparece en la ventana "Cloudflare Tunnel"
echo - Configura esa URL en Vercel como variable OLLAMA_URL
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul

