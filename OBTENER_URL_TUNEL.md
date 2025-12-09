# 🔗 Cómo Obtener la URL del Túnel

## ✅ Tu túnel está conectado correctamente

Veo que el túnel se está ejecutando y conectando. La URL debería aparecer en unos segundos.

## 📍 Opciones para obtener la URL:

### Opción 1: Esperar en la misma ventana

El mensaje con la URL aparecerá en la ventana donde ejecutaste:
```
cloudflared tunnel run ollama-tunnel
```

Busca un mensaje que dice:
```
Your quick Tunnel has been created! Visit it at:
https://[url].cfargotunnel.com
```

### Opción 2: Obtener información del túnel

En **otra ventana de PowerShell**, ejecuta:

```powershell
cloudflared tunnel info ollama-tunnel
```

Esto te mostrará información del túnel, incluyendo la URL.

### Opción 3: Listar todos los túneles

```powershell
cloudflared tunnel list
```

Esto mostrará todos tus túneles y sus URLs.

### Opción 4: Ver en el Dashboard de Cloudflare

1. Ve a: https://dash.cloudflare.com/
2. Ve a **Zero Trust** → **Networks** → **Tunnels**
3. Busca tu túnel `ollama-tunnel`
4. Ahí verás la URL

## ⏱️ Si la URL no aparece

El túnel puede tardar unos segundos en mostrar la URL. Si después de 30 segundos no aparece:

1. **No cierres la ventana** donde está corriendo el túnel
2. **Abre otra ventana de PowerShell** y ejecuta:
   ```powershell
   cloudflared tunnel info ollama-tunnel
   ```

## 🔍 Formato de la URL

La URL siempre tiene este formato:
```
https://[letras-y-numeros].cfargotunnel.com
```

Ejemplos:
- `https://abc-123-def-456.cfargotunnel.com`
- `https://xyz-789-ghi-012.cfargotunnel.com`

## ✅ Una vez que tengas la URL

1. **Copiala completa** (incluyendo `https://`)
2. **Ve a Vercel Dashboard**
3. **Settings → Environment Variables**
4. **Agrega:**
   - Name: `OLLAMA_URL`
   - Value: `https://[tu-url].cfargotunnel.com`
5. **Save y redeploy**

