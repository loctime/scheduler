# ⚠️ Solución: Error en Túnel Rápido

## 🔴 Problema

El servicio de túnel rápido de Cloudflare (`trycloudflare.com`) está teniendo problemas temporales (Error 1101).

## ✅ Solución: Usar el Túnel con Nombre

Ya creaste un túnel con nombre (`ollama-tunnel`), así que usemos ese.

## 📍 Cómo Obtener la URL del Túnel con Nombre

### Opción 1: Dashboard de Cloudflare (Más Fácil)

1. Ve a: https://dash.cloudflare.com/
2. Inicia sesión con tu cuenta
3. En el menú lateral, busca **Zero Trust**
4. Ve a **Networks** → **Tunnels**
5. Haz clic en tu túnel `ollama-tunnel`
6. Ahí verás la URL asignada al túnel

### Opción 2: Ejecutar el Túnel con Nombre

1. Asegúrate de que Ollama esté corriendo (ya lo está)
2. Ejecuta:
   ```powershell
   cloudflared tunnel run ollama-tunnel
   ```
3. Espera unos segundos
4. La URL debería aparecer en la salida

### Opción 3: Verificar si el Túnel Está Corriendo

Si ya ejecutaste el túnel antes, puede que esté corriendo en otra ventana. Busca la ventana de PowerShell donde lo ejecutaste y ahí debería estar la URL.

## 🔍 Si No Ves la URL

Si el túnel con nombre no muestra la URL automáticamente, puede ser que necesites:

1. **Configurar un dominio personalizado** (requiere tener un dominio en Cloudflare)
2. **O usar el Dashboard** para ver la URL asignada

## ✅ Una Vez que Tengas la URL

1. **Copiala completa** (incluyendo `https://`)
2. **Ve a Vercel Dashboard**
3. **Settings → Environment Variables**
4. **Agrega:**
   - Name: `OLLAMA_URL`
   - Value: `https://[tu-url].cfargotunnel.com`
5. **Save y redeploy**

## 💡 Recomendación

**La forma más fácil es usar el Dashboard de Cloudflare** para ver la URL del túnel con nombre. Es más confiable que el túnel rápido y la URL es más estable.

