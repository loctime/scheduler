# ✅ Configuración Final - URL de ngrok

## 🎉 URL Obtenida

Tu URL de ngrok es:
```
https://eurythermal-entertainingly-daine.ngrok-free.dev
```

## 📋 Pasos para Configurar en Vercel

### 1. Ve a Vercel Dashboard
- https://vercel.com/dashboard
- Selecciona tu proyecto

### 2. Configura la Variable de Entorno
1. Ve a **Settings** → **Environment Variables**
2. Haz clic en **Add New**
3. Completa:
   - **Name:** `OLLAMA_URL`
   - **Value:** `https://eurythermal-entertainingly-daine.ngrok-free.dev`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
4. Haz clic en **Save**

### 3. Redeploy
- Ve a **Deployments**
- Haz clic en los tres puntos (...) del último deployment
- Selecciona **Redeploy**

O simplemente haz un nuevo push a tu repositorio.

## ✅ Verificar que Funcione

1. En tu app de Vercel, ve al chat de stock
2. Debería mostrar "Ollama conectado" ✅

## 🎯 Para la Presentación

**IMPORTANTE:** Antes de la presentación:

1. **Asegúrate de que Ollama esté corriendo:**
   ```powershell
   ollama serve
   ```
   (O verifica que esté corriendo)

2. **Asegúrate de que ngrok esté corriendo:**
   ```powershell
   ngrok http 11434
   ```
   (Deja esa ventana abierta)

3. **Deja ambas ventanas abiertas** durante la presentación

## ⚠️ Notas

- La URL de ngrok **cambia cada vez** que ejecutas ngrok (a menos que tengas plan de pago)
- Si reinicias ngrok, obtendrás una nueva URL y tendrás que actualizarla en Vercel
- Para la presentación, deja ngrok corriendo y no lo reinicies

## 🔄 Si Necesitas una Nueva URL

Si por alguna razón necesitas una nueva URL:

1. Ejecuta: `ngrok http 11434`
2. Copia la nueva URL que aparece
3. Actualiza `OLLAMA_URL` en Vercel con la nueva URL
4. Haz redeploy

