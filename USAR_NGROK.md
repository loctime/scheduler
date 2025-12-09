# 🚀 Usar ngrok en lugar de Cloudflare Tunnel

## ✅ Ventaja: ngrok es completamente gratis y no requiere tarjeta

## 📥 Instalación de ngrok

### Opción 1: Con winget (Recomendado)

```powershell
winget install ngrok
```

### Opción 2: Descarga Manual

1. Ve a: https://ngrok.com/download
2. Descarga la versión para Windows
3. Extrae el archivo `ngrok.exe`
4. Colócalo en una carpeta (ej: `C:\ngrok\`)

## 🚀 Uso Rápido

Una vez instalado, ejecuta:

```powershell
ngrok http 11434
```

Esto te dará una URL inmediatamente, algo como:
```
Forwarding  https://abc-123-def-456.ngrok-free.app -> http://localhost:11434
```

**¡Esa URL es la que necesitas!**

## ⚙️ Configuración en Vercel

1. Copia la URL que te da ngrok (ej: `https://abc-123-def-456.ngrok-free.app`)
2. Ve a Vercel Dashboard
3. Settings → Environment Variables
4. Agrega:
   - Name: `OLLAMA_URL`
   - Value: `https://abc-123-def-456.ngrok-free.app`
5. Save y redeploy

## ⚠️ Notas Importantes

- **La URL cambia cada vez** que ejecutas ngrok (a menos que tengas cuenta gratuita)
- **ngrok es gratis** pero con algunas limitaciones
- **Perfecto para presentaciones** y desarrollo

## 🔐 Cuenta Gratuita de ngrok (Opcional)

Si creas una cuenta gratuita en ngrok:
- Puedes tener URLs más estables
- Más tiempo de conexión
- Sin necesidad de tarjeta

1. Ve a: https://dashboard.ngrok.com/signup
2. Crea cuenta gratuita
3. Obtén tu authtoken
4. Configura: `ngrok config add-authtoken [tu-token]`

## ✅ Ventajas de ngrok

- ✅ Completamente gratis
- ✅ No requiere tarjeta
- ✅ Fácil de usar
- ✅ URL inmediata
- ✅ Perfecto para presentaciones

