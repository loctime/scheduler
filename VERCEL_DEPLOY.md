# Guía Rápida de Deploy en Vercel

## Pasos Rápidos

### 1. Preparar el Repositorio

```bash
# Asegúrate de estar en la rama principal
git checkout main

# Agrega todos los archivos
git add .

# Commit
git commit -m "Preparado para deploy en Vercel"

# Push al repositorio
git push origin main
```

### 2. Conectar con Vercel

1. Ve a https://vercel.com/new
2. Conecta tu cuenta de GitHub
3. Selecciona el repositorio: `loctime/scheduler`
4. Vercel detectará automáticamente Next.js

### 3. Configurar Variables de Entorno

En la pantalla de configuración del proyecto, ve a **Environment Variables** y agrega:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Tu API Key de Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Tu dominio de auth |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Tu Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Tu Storage Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Tu Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Tu App ID |

**Asegúrate de marcarlas para todos los ambientes:** Production, Preview, Development

### 4. Deploy

1. Haz clic en **Deploy**
2. Espera 2-3 minutos
3. Tu app estará disponible en `https://tu-proyecto.vercel.app`

### 5. Configurar Firebase

Después del primer deploy:

1. Copia el dominio que Vercel te asignó
2. Ve a Firebase Console → Authentication → Settings
3. Agrega el dominio en **Authorized domains**

### 6. Verificar

✅ Visita tu aplicación
✅ Inicia sesión con Google
✅ Crea un empleado de prueba
✅ Verifica que todo funcione

## Comandos Útiles

```bash
# Instalar Vercel CLI (opcional)
npm i -g vercel

# Deploy manual desde tu máquina
vercel

# Deploy a producción
vercel --prod

# Ver logs
vercel logs
```

## Importante

- 🔒 **NUNCA** subas archivos `.env.local` al repositorio
- ✅ Todas las variables de entorno deben estar en Vercel Dashboard
- 🔄 Cada push a `main` hace deploy automático
- 📝 Los Pull Requests generan previews automáticos






