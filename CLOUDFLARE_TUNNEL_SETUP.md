# Guía de Configuración de Cloudflare Tunnel para Ollama

Esta guía te ayudará a configurar Cloudflare Tunnel para exponer Ollama de forma segura desde tu PC.

## 📋 Requisitos Previos

- Ollama instalado y funcionando en tu PC
- Cuenta de Cloudflare (gratis)
- Windows 10/11

## 🚀 Paso 1: Instalar Cloudflare Tunnel

### Opción A: Con winget (Recomendado)

```powershell
winget install --id Cloudflare.cloudflared
```

### Opción B: Descarga Manual

1. Ve a: https://github.com/cloudflare/cloudflared/releases
2. Descarga `cloudflared-windows-amd64.exe`
3. Renómbralo a `cloudflared.exe`
4. Colócalo en una carpeta que esté en tu PATH (ej: `C:\Windows\System32\`)

## 🔐 Paso 2: Autenticarse con Cloudflare

Abre PowerShell como administrador y ejecuta:

```powershell
cloudflared tunnel login
```

Esto abrirá tu navegador para autenticarte. Si no tenés cuenta, creala (es gratis).

## 🏗️ Paso 3: Crear el Túnel

```powershell
cloudflared tunnel create ollama-tunnel
```

**IMPORTANTE:** Guardá el ID del túnel que te muestra (algo como `abc-123-def-456`).

## ⚙️ Paso 4: Configurar el Túnel

1. Crear la carpeta: `C:\Users\[TU-USUARIO]\.cloudflared\`
2. Crear el archivo: `C:\Users\[TU-USUARIO]\.cloudflared\config.yml`

**Contenido del archivo `config.yml`:**

```yaml
tunnel: ollama-tunnel
credentials-file: C:\Users\[TU-USUARIO]\.cloudflared\[TU-TUNNEL-ID].json

ingress:
  - service: http://localhost:11434
```

**Reemplazá:**
- `[TU-USUARIO]` con tu nombre de usuario de Windows
- `[TU-TUNNEL-ID]` con el ID del túnel que obtuviste en el paso 3

**Ejemplo real:**
```yaml
tunnel: ollama-tunnel
credentials-file: C:\Users\User\.cloudflared\abc-123-def-456.json

ingress:
  - service: http://localhost:11434
```

## ▶️ Paso 5: Ejecutar el Túnel

```powershell
cloudflared tunnel run ollama-tunnel
```

Verás algo como:

```
+----------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time   |
|  to be reachable):                                                         |
|  https://abc-123-def-456.cfargotunnel.com                                  |
+----------------------------------------------------------------------------+
```

**Copiá esa URL** (ej: `https://abc-123-def-456.cfargotunnel.com`)

## 🔧 Paso 6: Configurar en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Ve a **Settings** → **Environment Variables**
3. Agrega una nueva variable:
   - **Name:** `OLLAMA_URL`
   - **Value:** `https://abc-123-def-456.cfargotunnel.com` (la URL que copiaste)
   - **Environments:** Marca todas (Production, Preview, Development)
4. Haz clic en **Save**
5. Ve a **Deployments** y haz un nuevo deploy (o espera al próximo push)

## ✅ Paso 7: Verificar

1. Asegurate de que Ollama esté corriendo:
   ```powershell
   ollama serve
   ```

2. Asegurate de que el túnel esté corriendo:
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```

3. En tu app de Vercel, ve al chat de stock
4. Debería mostrar "Ollama conectado" ✅

## 🎯 Para la Presentación

Antes de la presentación, ejecutá el script `iniciar-ollama-tunnel.bat` que está en la raíz del proyecto.

O manualmente:

1. Abrí una terminal y ejecutá:
   ```powershell
   ollama serve
   ```

2. Abrí otra terminal y ejecutá:
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```

3. Dejá ambas ventanas abiertas durante la presentación

## 🔍 Verificar que Ollama Funciona

```powershell
# Ver modelos disponibles
ollama list

# Si no tenés modelos, descargar uno:
ollama pull llama3.2
```

## 🛠️ Solución de Problemas

### El túnel no se conecta

1. Verificá que Ollama esté corriendo en `http://localhost:11434`
2. Verificá que el archivo `config.yml` esté en la ubicación correcta
3. Verificá que el ID del túnel en `config.yml` sea correcto

### La URL del túnel cambia

- Las URLs de Cloudflare Tunnel son estables, pero si cambiaste algo, verificá la nueva URL ejecutando:
  ```powershell
  cloudflared tunnel run ollama-tunnel
  ```

### Ollama no responde

1. Verificá que Ollama esté corriendo:
   ```powershell
   curl http://localhost:11434/api/tags
   ```

2. Verificá que tengas modelos descargados:
   ```powershell
   ollama list
   ```

## 📝 Notas Importantes

- **La URL del túnel es pública** pero oculta tu IP real
- **No necesitás abrir puertos** en tu router
- **El túnel debe estar corriendo** cuando quieras usar Ollama desde Vercel
- **Ollama debe estar corriendo** en tu PC para que funcione

## 🔒 Seguridad

Para una presentación está bien, pero para producción considera:
- Agregar autenticación al proxy
- Usar un servicio en la nube (Railway, Render, etc.)
- Limitar el acceso por IP (si es posible)

