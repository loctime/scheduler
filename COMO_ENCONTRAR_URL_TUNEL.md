# 🔍 Cómo Encontrar la URL del Túnel

## 📍 Dónde está la URL

La URL del túnel aparece **cuando ejecutás el comando del túnel** en PowerShell.

## 🎯 Pasos para ver la URL:

### Opción 1: Si ya ejecutaste el túnel

1. **Busca la ventana de PowerShell** donde ejecutaste:
   ```
   cloudflared tunnel run ollama-tunnel
   ```

2. **Busca este mensaje** en esa ventana:
   ```
   +----------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time   |
   |  to be reachable):                                                         |
   |  https://abc-123-def-456.cfargotunnel.com                                  |
   +----------------------------------------------------------------------------+
   ```

3. **La URL es la que está después de "Visit it at:"**
   - Ejemplo: `https://abc-123-def-456.cfargotunnel.com`

### Opción 2: Ejecutar el comando de nuevo

Si no encontrás la ventana o querés ver la URL de nuevo:

1. **Abre PowerShell** (nueva ventana)

2. **Ejecuta:**
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```

3. **Espera unos segundos** y verás la URL aparecer

4. **Copiá la URL** que empieza con `https://` y termina con `.cfargotunnel.com`

## 📸 Qué buscar

La URL se ve así:
```
https://[letras-y-numeros].cfargotunnel.com
```

Ejemplos:
- `https://abc-123-def-456.cfargotunnel.com`
- `https://xyz-789-ghi-012.cfargotunnel.com`

## ⚠️ Importante

- **El túnel debe estar corriendo** para que la URL funcione
- **No cierres la ventana** donde está corriendo el túnel
- **La URL es estable** (no cambia a menos que elimines el túnel)

## 🔄 Si no ves la URL

1. Verifica que el túnel esté corriendo:
   - Deberías ver mensajes en la ventana de PowerShell
   - Si no hay mensajes, el túnel no está corriendo

2. Verifica que Ollama esté corriendo:
   ```powershell
   ollama list
   ```

3. Ejecuta el túnel de nuevo:
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```

## ✅ Una vez que tengas la URL

1. **Copiala completa** (incluyendo `https://`)
2. **Ve a Vercel Dashboard**
3. **Settings → Environment Variables**
4. **Agrega:**
   - Name: `OLLAMA_URL`
   - Value: `https://[tu-url].cfargotunnel.com`
5. **Save y redeploy**

