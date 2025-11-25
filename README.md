# Sistema de Gestión de Horarios del Personal

Aplicación web para crear, modificar y gestionar horarios de empleados con historial completo de cambios.

## Características

- **Autenticación con Google** usando Firebase Auth
- **Gestión de Empleados**: Crear, editar y eliminar empleados
- **Turnos Configurables**: Define turnos personalizados con horarios y colores
- **Calendario Semanal Interactivo**: Asigna múltiples turnos por día a cada empleado
- **Historial Completo**: Visualiza y compara todas las versiones anteriores de horarios
- **Seguimiento de Usuarios**: Cada cambio registra quién lo realizó y cuándo
- **Validaciones**: Previene errores validando datos antes de guardar
- **Exportación**: Descarga horarios como imagen PNG o documento PDF
- **Interfaz en Español**: Todo el sistema está completamente en español

## Estructura de Datos

### Empleados
\`\`\`typescript
{
  id: string
  nombre: string
  apellido: string
  cargo: string
  activo: boolean
  createdAt: Date
}
\`\`\`

### Turnos
\`\`\`typescript
{
  id: string
  nombre: string
  horaInicio: string  // formato "HH:mm"
  horaFin: string     // formato "HH:mm"
  color: string       // código hex
  createdAt: Date
}
\`\`\`

### Horarios
\`\`\`typescript
{
  id: string
  nombre: string
  semanaInicio: Date
  semanaFin: Date
  asignaciones: {
    [empleadoId]: {
      [dia]: string[]  // array de IDs de turnos
    }
  }
  createdAt: Date
  modifiedAt: Date
  createdBy: string
}
\`\`\`

## Configuración Inicial

### 1. Crear Proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita **Authentication** → Sign-in method → Google
4. Habilita **Firestore Database** en modo producción

### 2. Configurar Variables de Entorno

En la sección **Vars** del proyecto, agrega:

\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
\`\`\`

Obtén estos valores en Firebase Console → Project Settings → General → Your apps

### 3. Configurar Reglas de Firestore

En Firebase Console → Firestore Database → Rules, agrega:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura/escritura solo a usuarios autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
\`\`\`

## Uso de la Aplicación

### Primera Vez

1. **Inicia sesión** con tu cuenta de Google
2. **Crea empleados** desde la pestaña "Empleados"
3. **Define turnos** desde la pestaña "Turnos" (ej: Mañana 08:00-14:00, Tarde 14:00-20:00)
4. **Crea tu primer horario** desde la pestaña "Horarios"

### Crear un Horario

1. Haz clic en "Crear Horario"
2. **Ingresa un nombre** para el horario (requerido)
3. Selecciona los turnos para cada empleado y día usando los checkboxes
4. Puedes asignar múltiples turnos por día a cada empleado
5. Guarda el horario
6. El sistema validará que existan empleados y turnos antes de crear

### Modificar un Horario

1. Selecciona el horario activo en la lista
2. Haz clic en "Editar Horario"
3. Modifica las asignaciones de turnos
4. Guarda los cambios
5. **La versión anterior se guarda automáticamente en el historial** antes de aplicar los cambios

### Exportar un Horario

1. Abre el horario que deseas exportar
2. Haz clic en "Exportar"
3. Elige formato: Imagen PNG o PDF
4. El archivo se descargará automáticamente

### Ver Historial

1. Ve a la pestaña "Historial"
2. Visualiza todas las versiones de horarios creados y modificados
3. **Compara dos versiones** seleccionando "Comparar" en dos versiones diferentes
4. **Ver detalles** de cualquier versión haciendo clic en "Ver"
5. Ve quién creó/modificó cada versión y cuándo
6. El historial se agrupa por horario para fácil navegación

## Tecnologías Utilizadas

- **Next.js 16** con App Router
- **React 19** con Server Components
- **TypeScript** para type safety
- **Tailwind CSS v4** para estilos
- **shadcn/ui** para componentes
- **Firebase Auth** para autenticación
- **Firestore** para base de datos
- **html2canvas** para exportar como imagen
- **jsPDF** para exportar como PDF
- **date-fns** para manejo de fechas

## Estructura del Proyecto

\`\`\`
app/
├── page.tsx                    # Página de login
├── dashboard/
│   ├── page.tsx               # Vista principal de horarios
│   ├── empleados/page.tsx     # Gestión de empleados
│   ├── turnos/page.tsx        # Gestión de turnos
│   └── historial/page.tsx     # Historial de horarios

components/
├── dashboard-layout.tsx       # Layout del dashboard
├── login-form.tsx             # Formulario de login con Google
├── schedule-calendar.tsx      # Calendario con selector de semana
├── schedule-grid.tsx          # Cuadrícula de horarios
└── create-schedule-dialog.tsx # Diálogo para crear horarios

lib/
├── firebase.ts                # Configuración de Firebase
└── utils.ts                   # Utilidades (incluye cn)
\`\`\`

## Deploy en Vercel

### Prerrequisitos

1. Una cuenta en [Vercel](https://vercel.com)
2. Repositorio en GitHub (recomendado) o GitLab/Bitbucket
3. Proyecto Firebase configurado con todas las credenciales

### Pasos para Deploy

#### 1. Conectar Repositorio

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Haz clic en "Add New..." → "Project"
3. Conecta tu repositorio de GitHub: `loctime/scheduler`
4. Vercel detectará automáticamente que es un proyecto Next.js

#### 2. Configurar Variables de Entorno

En la sección **Environment Variables** de Vercel, agrega todas las variables de Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
```

**Importante:** Asegúrate de que estas variables estén disponibles para todos los ambientes (Production, Preview, Development).

#### 3. Configurar Build Settings

Vercel debería detectar automáticamente:
- **Framework Preset**: Next.js
- **Build Command**: `next build` (automático)
- **Output Directory**: `.next` (automático)
- **Install Command**: `pnpm install` (o el que uses)

#### 4. Configurar Dominio Autorizado en Firebase

Una vez que Vercel te asigne un dominio (ej: `tu-proyecto.vercel.app`):

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Haz clic en "Add domain"
5. Agrega tu dominio de Vercel: `tu-proyecto.vercel.app`
6. (Opcional) Si tienes un dominio personalizado, también agrégalo aquí

#### 5. Deploy

1. Haz clic en "Deploy" en Vercel
2. Espera a que termine el proceso (2-3 minutos)
3. Una vez completado, tu aplicación estará disponible en `https://tu-proyecto.vercel.app`

#### 6. Deploy Automático

Cada vez que hagas `git push` a la rama principal, Vercel hará un deploy automático. También creará previews para cada Pull Request.

### Verificación Post-Deploy

1. ✅ Visita tu aplicación en Vercel
2. ✅ Intenta iniciar sesión con Google
3. ✅ Verifica que puedas crear empleados y turnos
4. ✅ Revisa la consola del navegador para errores
5. ✅ Verifica que los datos se guarden en Firestore

### Solución de Problemas Comunes

#### Error: "Firebase: Error (auth/unauthorized-domain)"
- **Solución**: Agrega tu dominio de Vercel en Firebase Console → Authentication → Settings → Authorized domains

#### Error: "Missing or insufficient permissions"
- **Solución**: Verifica las reglas de Firestore y que las variables de entorno estén correctamente configuradas

#### Los datos no se guardan
- **Solución**: Verifica que todas las variables de entorno en Vercel estén correctas y sin espacios extra

#### Error 500 en producción
- **Solución**: Revisa los logs de Vercel en el dashboard para ver el error específico

## Desarrollo Local

```bash
# Instalar dependencias
pnpm install

# Ejecutar en desarrollo
pnpm dev

# Build para producción
pnpm build

# Ejecutar build de producción localmente
pnpm start
```

## Soporte

Para problemas o preguntas sobre Firebase:
- [Documentación Firebase](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)

Para problemas con Next.js o la aplicación:
- [Documentación Next.js](https://nextjs.org/docs)
- [Documentación shadcn/ui](https://ui.shadcn.com)

Para problemas con Vercel:
- [Documentación Vercel](https://vercel.com/docs)
- [Vercel Dashboard](https://vercel.com/dashboard)
