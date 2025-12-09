# ✅ Resumen de Configuración - Cloudflare Tunnel

## ✅ Lo que ya está hecho:

1. ✅ **Autenticación con Cloudflare** - Completada
2. ✅ **Túnel creado** - `ollama-tunnel` con ID: `7b97f006-14c1-46d5-b57e-f378e3a39ba2`
3. ✅ **Archivo de configuración creado** - `C:\Users\User\.cloudflared\config.yml`

## 📋 Pasos finales (hacer manualmente):

### 1. Asegurarse de que Ollama esté corriendo

Abre PowerShell y ejecuta:

```powershell
ollama serve
```

O verifica que esté corriendo:

```powershell
ollama list
```

### 2. Ejecutar el túnel de Cloudflare

En otra ventana de PowerShell, ejecuta:

```powershell
cloudflared tunnel run ollama-tunnel
```

**IMPORTANTE:** Verás una URL como:
```
https://abc-123-def-456.cfargotunnel.com
```

**¡COPIA ESA URL!** Es la que necesitás para Vercel.

### 3. Configurar en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega nueva variable:
   - **Name:** `OLLAMA_URL`
   - **Value:** `https://[la-url-que-copiaste].cfargotunnel.com`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Haz clic en **Save**
6. Ve a **Deployments** y haz un nuevo deploy

### 4. Verificar que funcione

1. En tu app de Vercel, ve al chat de stock
2. Debería mostrar "Ollama conectado" ✅

## 🎯 Para la Presentación

Antes de la presentación:

1. **Inicia Ollama:**
   ```powershell
   ollama serve
   ```

2. **Inicia el túnel:**
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```

3. **Deja ambas ventanas abiertas** durante la presentación

## 🔍 Verificar Modelos

Si no tenés modelos descargados:

```powershell
ollama pull llama3.2
```

## 📝 Notas

- El túnel debe estar corriendo cuando quieras usar Ollama desde Vercel
- La URL del túnel es estable (no cambia a menos que elimines el túnel)
- Tu IP real está oculta gracias al túnel
- No necesitás abrir puertos en tu router

## 🆘 Solución de Problemas

### El túnel no se conecta
- Verifica que Ollama esté corriendo: `ollama list`
- Verifica que el archivo `config.yml` esté en `C:\Users\User\.cloudflared\`

### cloudflared no se encuentra
- Si lo instalaste con winget, puede estar en: `C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\`
- O ejecuta: `winget install --id Cloudflare.cloudflared`

### Ollama no responde
- Verifica que esté corriendo: `curl http://localhost:11434/api/tags`
- Reinicia Ollama: Cierra la ventana y ejecuta `ollama serve` de nuevo

