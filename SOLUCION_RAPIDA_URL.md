# 🚀 Solución Rápida para Obtener la URL

## ⚡ Opción Rápida: Túnel Rápido (Quick Tunnel)

Para obtener una URL **inmediatamente**, usa un túnel rápido:

### Pasos:

1. **Cierra el túnel actual** (si está corriendo):
   - Ve a la ventana donde está corriendo `cloudflared tunnel run ollama-tunnel`
   - Presiona `Ctrl+C` para detenerlo

2. **Asegúrate de que Ollama esté corriendo:**
   ```powershell
   ollama serve
   ```
   (En otra ventana, o verifica que esté corriendo)

3. **Ejecuta el túnel rápido:**
   ```powershell
   cloudflared tunnel --url http://localhost:11434
   ```

4. **Verás la URL inmediatamente:**
   ```
   +----------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time   |
   |  to be reachable):                                                         |
   |  https://abc-123-def-456.cfargotunnel.com                                  |
   +----------------------------------------------------------------------------+
   ```

5. **¡Esa es tu URL!** Copiala y configúrala en Vercel.

### ⚠️ Nota Importante:

- Esta URL es **temporal** (cambia cada vez que ejecutas el comando)
- Pero es **perfecta para una presentación**
- El túnel se detiene cuando cierras la ventana

### Para Producción:

Si necesitas una URL permanente, usa el túnel con nombre y configúralo en el Dashboard de Cloudflare, o asigna un dominio personalizado.

## ✅ Una vez que tengas la URL:

1. **Copiala completa** (incluyendo `https://`)
2. **Ve a Vercel Dashboard**
3. **Settings → Environment Variables**
4. **Agrega:**
   - Name: `OLLAMA_URL`
   - Value: `https://[tu-url].cfargotunnel.com`
5. **Save y redeploy**

