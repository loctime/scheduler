# Guía de Configuración de Firebase

## Paso 1: Crear Proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Ingresa el nombre del proyecto: "Horarios Personal"
4. Acepta los términos y haz clic en "Continuar"
5. Desactiva Google Analytics (opcional)
6. Haz clic en "Crear proyecto"

## Paso 2: Configurar Autenticación

1. En el menú lateral, ve a **Authentication**
2. Haz clic en "Comenzar"
3. Selecciona **Google** como proveedor
4. Activa el switch "Habilitar"
5. Selecciona un correo de soporte del proyecto
6. Haz clic en "Guardar"

## Paso 3: Configurar Firestore Database

1. En el menú lateral, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de producción"
4. Selecciona la ubicación más cercana
5. Haz clic en "Habilitar"

### Configurar Reglas de Seguridad

1. En Firestore Database, ve a la pestaña **Reglas**
2. Reemplaza las reglas con:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer y escribir
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
\`\`\`

3. Haz clic en "Publicar"

## Paso 4: Obtener Credenciales

1. Haz clic en el ícono de engranaje ⚙️ → **Configuración del proyecto**
2. En la sección "Tus apps", haz clic en el ícono web `</>`
3. Registra la app con el nombre "Horarios Web App"
4. Copia las credenciales de Firebase config

Verás algo como:

\`\`\`javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};
\`\`\`

## Paso 5: Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto y agrega:

\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
\`\`\`

## Paso 6: Configurar Dominio Autorizado (Opcional)

Si despliegas en Vercel:

1. En Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Agrega tu dominio de Vercel: `tu-app.vercel.app`
3. También puedes agregar dominios personalizados aquí

## Verificación

Para verificar que todo está configurado correctamente:

1. Inicia la aplicación
2. Intenta iniciar sesión con Google
3. Verifica que puedes crear empleados y turnos
4. Los datos deben aparecer en Firestore Database en la consola

## Estructura de Colecciones en Firestore

La aplicación creará automáticamente estas colecciones:

\`\`\`
firestore/
├── empleados/
│   └── {empleadoId}/
│       ├── nombre: string
│       ├── apellido: string
│       ├── cargo: string
│       ├── activo: boolean
│       └── createdAt: timestamp
│
├── turnos/
│   └── {turnoId}/
│       ├── nombre: string
│       ├── horaInicio: string
│       ├── horaFin: string
│       ├── color: string
│       └── createdAt: timestamp
│
├── horarios/
│   └── {horarioId}/
│       ├── nombre: string
│       ├── semanaInicio: timestamp
│       ├── semanaFin: timestamp
│       ├── asignaciones: map
│       ├── createdAt: timestamp
│       ├── modifiedAt: timestamp
│       └── createdBy: string
│
└── historial/
    └── {historialId}/
        ├── horarioId: string
        ├── nombre: string
        ├── semanaInicio: timestamp
        ├── semanaFin: timestamp
        ├── asignaciones: map
        ├── createdAt: timestamp
        ├── createdBy: string
        └── accion: string
\`\`\`

## Costos

Firebase ofrece un plan gratuito generoso:

- **Authentication**: Ilimitado y gratuito
- **Firestore**: 
  - 50,000 lecturas/día
  - 20,000 escrituras/día
  - 20,000 eliminaciones/día
  - 1 GB de almacenamiento

Para ~10 empleados y uso moderado, el plan gratuito será más que suficiente.

## Solución de Problemas

### Error: "Firebase: Error (auth/unauthorized-domain)"

- Ve a Authentication → Settings → Authorized domains
- Agrega el dominio donde está desplegada tu app

### Error: "Missing or insufficient permissions"

- Verifica las reglas de Firestore
- Asegúrate de estar autenticado

### No se guardan los datos

- Verifica que las variables de entorno estén correctamente configuradas
- Revisa la consola del navegador para errores
- Verifica que Firestore esté habilitado en Firebase Console
