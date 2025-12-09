# ✅ Túnel Conectado - Cómo Obtener la URL

## 🎉 Tu túnel está funcionando correctamente

El túnel `ollama-tunnel` está conectado y funcionando. Ahora necesitas obtener la URL.

## ⚠️ Importante

Para **túneles con nombre** (como `ollama-tunnel`), Cloudflare **no siempre muestra la URL** en la línea de comandos. Esto es normal.

## 📍 Cómo Obtener la URL

### Opción 1: Dashboard de Cloudflare (Recomendado - Más Confiable)

1. Ve a: **https://dash.cloudflare.com/**
2. Inicia sesión con tu cuenta
3. En el menú lateral, busca **Zero Trust**
4. Ve a **Networks** → **Tunnels**
5. Haz clic en tu túnel **ollama-tunnel**
6. En la página del túnel, busca la sección **"Public Hostname"** o **"Ingress"**
7. Ahí verás la URL asignada

### Opción 2: Configurar un Dominio Personalizado

Si tienes un dominio en Cloudflare, puedes asignarlo:

```powershell
cloudflared tunnel route dns ollama-tunnel ollama.tudominio.com
```

Pero esto requiere tener un dominio configurado.

### Opción 3: Esperar (Puede que Aparezca)

A veces la URL aparece después de unos minutos. Revisa la ventana del túnel periódicamente.

## 🚀 Solución Rápida para Presentación

Si necesitas la URL **ahora mismo** para la presentación, puedes:

1. **Usar el Dashboard** (opción más confiable)
2. **O crear un túnel rápido temporal** (si el servicio vuelve a funcionar)

## ✅ Una Vez que Tengas la URL

1. **Copiala completa** (incluyendo `https://`)
2. **Ve a Vercel Dashboard**
3. **Settings → Environment Variables**
4. **Agrega:**
   - Name: `OLLAMA_URL`
   - Value: `https://[tu-url].cfargotunnel.com` (o el dominio que uses)
5. **Save y redeploy**

## 💡 Nota

- El túnel con nombre es **más estable** que el rápido
- La URL puede ser **permanente** si configuras un dominio
- Para producción, es mejor usar un dominio personalizado

