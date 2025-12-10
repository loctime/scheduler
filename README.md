# Sistema de Gestión de Horarios del Personal

Aplicación web completa para crear, modificar y gestionar horarios de empleados con historial completo de cambios, gestión de pedidos y stock, y asistente de IA.

## Características

### Gestión de Horarios
- **Autenticación con Google** usando Firebase Auth
- **Gestión de Empleados**: Crear, editar y eliminar empleados con información de contacto
- **Turnos Configurables**: Define turnos personalizados con horarios, colores y turnos cortados (dos franjas horarias)
- **Calendario Semanal Interactivo**: Asigna múltiples turnos por día a cada empleado
- **Vista Mensual**: Visualiza todos los horarios del mes en una vista consolidada
- **Horarios Fijos**: Marca días específicos como horarios fijos que se aplican automáticamente
- **Medios Turnos**: Configura medios turnos personalizados para asignar 1/2 franco
- **Separadores**: Organiza empleados en grupos usando separadores personalizados
- **Historial Completo**: Visualiza y compara todas las versiones anteriores de horarios
- **Seguimiento de Usuarios**: Cada cambio registra quién lo realizó y cuándo
- **Validaciones**: Previene errores validando datos antes de guardar (horas máximas, solapamientos, etc.)
- **Exportación**: Descarga horarios como imagen PNG o documento PDF
- **PWA (Progressive Web App)**: Instalable en dispositivos móviles y desktop

### Gestión de Pedidos y Stock
- **Sistema de Pedidos**: Gestiona múltiples pedidos/proveedores con productos personalizados
- **Gestión de Stock**: Controla el stock actual de cada producto con movimientos de entrada y salida
- **Stock Mínimo**: Configura niveles mínimos de stock por producto
- **Cálculo Automático**: Calcula automáticamente qué productos necesitas pedir según el stock mínimo
- **Importación de Productos**: Importa productos desde texto plano con formato personalizable
- **Formato Personalizable**: Personaliza el formato de salida de los pedidos con placeholders
- **Historial de Movimientos**: Registra todos los movimientos de stock con usuario y fecha

### Chat de Stock con IA
- **Asistente de IA**: Chat inteligente para gestionar stock usando lenguaje natural
- **Integración con Ollama**: Soporte opcional para IA local (Ollama)
- **Gestión por Voz/Texto**: Ingresa o retira stock hablando o escribiendo en lenguaje natural
- **Consultas Inteligentes**: Pregunta sobre stock, productos, pedidos y más
- **Generación Automática de Pedidos**: Genera pedidos automáticamente basados en stock bajo
- **Modos de Operación**: Modos específicos para ingreso, egreso, consulta y stock general

### Configuración
- **Configuración de Empresa**: Personaliza nombre y color de la empresa
- **Configuración de Horarios**: Define horas máximas por día, minutos de descanso, formato de hora (12/24h)
- **Configuración de Semana**: Define día de inicio de semana y si mostrar fines de semana
- **Orden Personalizado**: Reordena empleados y separadores según tus necesidades

### Interfaz
- **Interfaz en Español**: Todo el sistema está completamente en español
- **Tema Claro/Oscuro**: Soporte para modo claro y oscuro
- **Responsive**: Diseño adaptativo para móviles, tablets y desktop
- **Accesibilidad**: Interfaz accesible y fácil de usar

## Estructura de Datos

### Empleados
\`\`\`typescript
{
  id: string
  name: string
  email?: string
  phone?: string
  userId: string
  createdAt?: Date
  updatedAt?: Date
}
\`\`\`

### Turnos
\`\`\`typescript
{
  id: string
  name: string
  startTime?: string      // formato "HH:mm" - Primera franja horaria
  endTime?: string        // formato "HH:mm" - Primera franja horaria
  startTime2?: string     // formato "HH:mm" - Segunda franja (turno cortado)
  endTime2?: string       // formato "HH:mm" - Segunda franja (turno cortado)
  color: string           // código hex
  userId: string
  createdAt?: Date
  updatedAt?: Date
}
\`\`\`

### Asignaciones de Turno
\`\`\`typescript
{
  shiftId?: string        // Opcional para franco/medio_franco
  type?: "shift" | "franco" | "medio_franco"
  startTime?: string     // horario ajustado (opcional)
  endTime?: string       // horario ajustado (opcional)
  startTime2?: string    // segunda franja ajustada (opcional)
  endTime2?: string      // segunda franja ajustada (opcional)
}
\`\`\`

### Horarios
\`\`\`typescript
{
  id: string
  nombre: string
  weekStart: string       // formato "yyyy-MM-dd"
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignment[] | string[]
    }
  }
  completada?: boolean
  completadaPor?: string
  completadaPorNombre?: string
  completadaEn?: Date
  empleadosSnapshot?: Array<{
    id: string
    name: string
    email?: string
    phone?: string
  }>
  ordenEmpleadosSnapshot?: string[]
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  createdByName?: string
  modifiedBy?: string
  modifiedByName?: string
}
\`\`\`

### Pedidos
\`\`\`typescript
{
  id: string
  nombre: string                    // Nombre del pedido/proveedor
  stockMinimoDefault: number        // Stock mínimo por defecto
  formatoSalida: string            // Formato con placeholders: {nombre}, {cantidad}, {unidad}
  mensajePrevio?: string            // Mensaje que aparece al inicio del pedido
  userId: string
  createdAt?: Date
  updatedAt?: Date
}
\`\`\`

### Productos
\`\`\`typescript
{
  id: string
  pedidoId: string                  // ID del pedido al que pertenece
  nombre: string
  stockMinimo: number                // Stock mínimo configurado
  unidad?: string                    // Unidad de medida (ej: "kg", "unidades")
  orden?: number                     // Orden de visualización
  userId: string
  createdAt?: Date
  updatedAt?: Date
}
\`\`\`

### Stock Actual
\`\`\`typescript
{
  id: string
  productoId: string
  pedidoId: string
  cantidad: number
  ultimaActualizacion: Date
  userId: string
}
\`\`\`

### Movimientos de Stock
\`\`\`typescript
{
  id: string
  productoId: string
  productoNombre?: string           // Nombre del producto (para historial)
  tipo: "entrada" | "salida"
  cantidad: number
  unidad?: string
  motivo?: string                    // Motivo o descripción
  userId: string
  userName?: string
  pedidoId?: string
  createdAt?: Date
}
\`\`\`

### Configuración
\`\`\`typescript
{
  id?: string
  nombreEmpresa?: string             // Nombre de la empresa
  colorEmpresa?: string              // Color de fondo (hex)
  mesInicioDia: number               // Día del mes en que empieza (1-28)
  horasMaximasPorDia: number         // Horas máximas por día
  semanaInicioDia: number            // Día de inicio de semana (0=domingo, 1=lunes)
  mostrarFinesDeSemana: boolean
  formatoHora24: boolean             // true = 24h, false = 12h
  minutosDescanso: number            // Minutos de descanso que se restan
  horasMinimasParaDescanso: number   // Horas mínimas para aplicar descanso
  mediosTurnos?: MedioTurno[]       // Medios turnos predefinidos
  separadores?: Separador[]          // Separadores para organizar empleados
  ordenEmpleados?: string[]          // Orden personalizado (IDs de empleados o separadores)
  fixedSchedules?: Array<{          // Horarios fijos
    employeeId: string
    dayOfWeek: number                // 0=domingo, 1=lunes, etc.
    assignments?: ShiftAssignment[]
  }>
  createdAt?: Date
  updatedAt?: Date
  updatedBy?: string
  updatedByName?: string
}
\`\`\`

### Medio Turno
\`\`\`typescript
{
  id: string                         // ID único
  startTime: string                   // formato "HH:mm"
  endTime: string                     // formato "HH:mm"
  nombre?: string                     // Nombre opcional (ej: "Mañana", "Tarde")
  color?: string                      // código hex (por defecto verde)
}
\`\`\`

### Separador
\`\`\`typescript
{
  id: string                         // ID único
  nombre: string                     // Nombre del separador (ej: "SALÓN", "COCINA")
  tipo: "puesto" | "personalizado"
  color?: string                     // código hex (opcional)
  createdAt?: Date
  updatedAt?: Date
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

Las reglas de Firestore están organizadas modularmente en la carpeta `rules/`. Para más información sobre la arquitectura de reglas, consulta `rules/README.md`.

**Nota:** Si estás usando un Firestore compartido con otras aplicaciones, las reglas se gestionan desde el repositorio CONTROLFILE. Consulta `rules/README.md` para más detalles.

Para desarrollo local, puedes usar las reglas básicas:

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

### 4. Configurar Ollama (Opcional - para Chat de Stock con IA)

El chat de stock funciona sin Ollama, pero puedes configurarlo para respuestas más inteligentes:

#### Opción A: Ollama Local (Solo Desarrollo)

1. Instala [Ollama](https://ollama.ai/) en tu PC
2. Descarga un modelo compatible (ej: `ollama pull llama3.2`)
3. El sistema detectará automáticamente si Ollama está disponible en `http://localhost:11434`

#### Opción B: Ollama con Cloudflare Tunnel (Para Presentación/Demo)

Para exponer Ollama desde tu PC de forma segura usando Cloudflare Tunnel:

1. Sigue la guía completa en [`CLOUDFLARE_TUNNEL_SETUP.md`](./CLOUDFLARE_TUNNEL_SETUP.md)
2. O ejecuta el script `iniciar-ollama-tunnel.bat` que configura todo automáticamente
3. Configura la variable de entorno `OLLAMA_URL` en Vercel con la URL del túnel

#### Opción C: Ollama en Servidor (Para Producción)

1. Instala [Ollama](https://ollama.ai/) en tu servidor (Railway, Render, VPS, etc.)
2. Configura la variable de entorno `OLLAMA_URL` en Vercel con la URL del servidor
3. Descarga un modelo compatible (ej: `ollama pull llama3.2`)

**Nota:** Ollama es completamente opcional. El chat funciona perfectamente sin él usando procesamiento básico de lenguaje natural.

## Uso de la Aplicación

### Primera Vez

1. **Inicia sesión** con tu cuenta de Google
2. **Configura tu empresa** desde la pestaña "Configuración" (nombre, colores, horarios)
3. **Crea empleados** desde la pestaña "Empleados"
4. **Define turnos** desde la pestaña "Turnos" (ej: Mañana 08:00-14:00, Tarde 14:00-20:00)
5. **Crea tu primer horario** desde la pestaña "Horarios"

### Gestión de Horarios

#### Crear un Horario

1. Haz clic en "Crear Horario"
2. **Ingresa un nombre** para el horario (requerido)
3. Selecciona los turnos para cada empleado y día usando los checkboxes
4. Puedes asignar múltiples turnos por día a cada empleado
5. Puedes ajustar horarios individuales haciendo clic en el turno
6. Puedes asignar francos o medios francos
7. Guarda el horario
8. El sistema validará que existan empleados y turnos antes de crear

#### Modificar un Horario

1. Selecciona el horario activo en la lista
2. Haz clic en "Editar Horario"
3. Modifica las asignaciones de turnos
4. Guarda los cambios
5. **La versión anterior se guarda automáticamente en el historial** antes de aplicar los cambios

#### Vista Mensual

1. Ve a la pestaña "Vista Mensual"
2. Visualiza todos los horarios del mes en una vista consolidada
3. Navega entre meses usando los controles
4. Cada semana muestra sus horarios correspondientes

#### Exportar un Horario

1. Abre el horario que deseas exportar
2. Haz clic en "Exportar"
3. Elige formato: Imagen PNG o PDF
4. El archivo se descargará automáticamente

#### Ver Historial

1. Ve a la pestaña "Historial"
2. Visualiza todas las versiones de horarios creados y modificados
3. **Compara dos versiones** seleccionando "Comparar" en dos versiones diferentes
4. **Ver detalles** de cualquier versión haciendo clic en "Ver"
5. Ve quién creó/modificó cada versión y cuándo
6. El historial se agrupa por horario para fácil navegación

### Gestión de Pedidos y Stock

#### Crear un Pedido

1. Ve a la pestaña "Pedidos"
2. Haz clic en "Crear Pedido"
3. Ingresa el nombre del pedido/proveedor
4. Configura el stock mínimo por defecto
5. Personaliza el formato de salida (opcional)
6. Agrega un mensaje previo (opcional)

#### Agregar Productos

1. Selecciona un pedido
2. Haz clic en "Agregar Producto"
3. Ingresa nombre, stock mínimo y unidad
4. O usa "Importar" para agregar múltiples productos desde texto

#### Importar Productos

1. Haz clic en "Importar"
2. Pega el texto con los productos (uno por línea)
3. El sistema detectará automáticamente nombres y cantidades
4. Revisa y confirma la importación

#### Gestionar Stock

1. En la tabla de productos, edita el stock actual manualmente
2. O usa el **Chat de Stock** para gestionar por voz/texto
3. El sistema calcula automáticamente qué productos necesitas pedir

#### Generar Pedido

1. Haz clic en "Generar Pedido"
2. El sistema mostrará todos los productos con stock bajo
3. Copia el texto generado con el formato configurado
4. Envía el pedido a tu proveedor

### Chat de Stock con IA

#### Configuración Inicial (Opcional)

1. El chat funciona sin IA, pero puedes configurar Ollama para respuestas más inteligentes
2. Instala Ollama en tu servidor local o remoto
3. El sistema detectará automáticamente si Ollama está disponible

#### Usar el Chat

1. Accede al chat desde el botón flotante o desde la página dedicada (`/chat`)
2. Escribe o habla en lenguaje natural:
   - "Agregar 10 litros de leche"
   - "Quitar 5 kg de harina"
   - "¿Cuánto stock tengo de azúcar?"
   - "Mostrar productos con stock bajo"
   - "Generar pedido para Proveedor Bebidas"
3. El sistema procesará tu mensaje y ejecutará la acción
4. Para acciones importantes, se pedirá confirmación

#### Modos del Chat

- **Modo Pregunta** (por defecto): Consultas generales
- **Modo Ingreso**: Acumula productos para ingresar stock
- **Modo Egreso**: Acumula productos para retirar stock
- **Modo Stock**: Consultas específicas de stock

### Configuración del Sistema

1. Ve a la pestaña "Configuración"
2. **Configuración General**:
   - Nombre de la empresa
   - Color de la empresa
3. **Configuración de Horarios**:
   - Horas máximas por día
   - Minutos de descanso
   - Horas mínimas para aplicar descanso
   - Formato de hora (12h/24h)
4. **Configuración de Semana**:
   - Día de inicio de semana
   - Mostrar/ocultar fines de semana
5. **Medios Turnos**: Define medios turnos personalizados para 1/2 franco
6. **Separadores**: Crea separadores para organizar empleados
7. **Orden de Empleados**: Reordena empleados y separadores arrastrando

## Tecnologías Utilizadas

- **Next.js 16** con App Router
- **React 19** con Server Components
- **TypeScript** para type safety
- **Tailwind CSS v4** para estilos
- **shadcn/ui** para componentes UI
- **Firebase Auth** para autenticación
- **Firestore** para base de datos
- **Ollama** (opcional) para IA local en el chat de stock
- **html2canvas** para exportar como imagen
- **jsPDF** para exportar como PDF
- **dom-to-image-more** para exportación avanzada
- **date-fns** para manejo de fechas
- **xlsx** para importación/exportación de Excel
- **next-themes** para tema claro/oscuro
- **Service Worker** para funcionalidad PWA

## Estructura del Proyecto

\`\`\`
app/
├── page.tsx                           # Página de login
├── chat/
│   └── page.tsx                       # Página del chat de stock
├── dashboard/
│   ├── page.tsx                       # Vista principal de horarios semanales
│   ├── horarios-mensuales/
│   │   └── page.tsx                   # Vista mensual de horarios
│   ├── empleados/
│   │   └── page.tsx                   # Gestión de empleados
│   ├── turnos/
│   │   └── page.tsx                   # Gestión de turnos
│   ├── pedidos/
│   │   └── page.tsx                   # Gestión de pedidos y stock
│   ├── configuracion/
│   │   └── page.tsx                   # Configuración del sistema
│   └── historial/
│       └── page.tsx                   # Historial de horarios
├── api/
│   └── stock-chat/
│       └── route.ts                    # API route para el chat de stock
└── layout.tsx                          # Layout principal

components/
├── dashboard-layout.tsx                # Layout del dashboard con navegación
├── login-form.tsx                      # Formulario de login con Google
├── schedule-calendar.tsx               # Calendario con selector de semana
├── schedule-grid/                     # Componentes de la grilla de horarios
│   ├── index.tsx
│   ├── components/
│   │   ├── cell-assignments.tsx
│   │   ├── employee-row.tsx
│   │   ├── grid-header.tsx
│   │   ├── inline-shift-selector.tsx
│   │   ├── quick-shift-selector.tsx
│   │   ├── schedule-cell.tsx
│   │   ├── schedule-grid-mobile.tsx
│   │   └── separator-row.tsx
│   ├── hooks/
│   │   ├── use-cell-background-styles.ts
│   │   ├── use-drag-and-drop.ts
│   │   ├── use-schedule-grid-data.ts
│   │   └── use-separators.ts
│   └── utils/
│       ├── schedule-grid-utils.ts
│       └── shift-display-utils.ts
├── schedule-calendar/                 # Componentes del calendario
│   ├── week-schedule.tsx
│   ├── employee-view.tsx
│   ├── general-view.tsx
│   ├── shift-view.tsx
│   └── ...
├── pedidos/                            # Componentes de pedidos
│   ├── pedidos-sidebar.tsx
│   ├── productos-table.tsx
│   └── pedido-dialogs.tsx
├── stock/                              # Componentes de stock
│   ├── chat-interface.tsx
│   ├── stock-chat-floating.tsx
│   ├── stock-chat-sidebar.tsx
│   └── stock-sidebar.tsx
├── shift-selector/                     # Selector de turnos
│   ├── shift-item.tsx
│   ├── special-type-selector.tsx
│   └── time-adjustment-form.tsx
├── export-overlay.tsx                  # Overlay para exportación
├── pwa-install-prompt.tsx              # Prompt para instalar PWA
└── ui/                                 # Componentes de shadcn/ui

contexts/
├── data-context.tsx                    # Contexto global de datos
└── stock-chat-context.tsx              # Contexto del chat de stock

hooks/
├── use-pedidos.ts                      # Hook para gestión de pedidos
├── use-stock-chat.ts                   # Hook para el chat de stock
├── use-config.ts                       # Hook para configuración
├── use-schedules-listener.ts           # Hook para escuchar horarios
├── use-export-schedule.ts              # Hook para exportar horarios
├── use-undo-redo.ts                    # Hook para deshacer/rehacer
├── use-week-actions.ts                 # Hook para acciones de semana
└── ...

lib/
├── firebase.ts                         # Configuración de Firebase
├── firestore-helpers.ts                # Helpers para Firestore
├── types.ts                            # Tipos TypeScript
├── utils.ts                            # Utilidades generales
├── validations.ts                      # Validaciones de datos
├── schedule-utils.ts                   # Utilidades de horarios
├── pattern-learning.ts                 # Aprendizaje de patrones
├── logger.ts                           # Logger
└── error-handler.ts                    # Manejo de errores

rules/                                  # Reglas de Firestore (modulares)
├── base.rules
├── horarios.rules
├── build.js
└── README.md

scripts/                                # Scripts de utilidad
├── delete-old-schedules.js
└── README.md

public/
├── sw.js                               # Service Worker para PWA
├── manifest.json                       # Manifest de PWA
└── ...
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

## Estructura de Colecciones en Firestore

La aplicación crea automáticamente estas colecciones:

\`\`\`
firestore/
├── empleados/                    # Empleados del sistema
│   └── {empleadoId}/
│       ├── name: string
│       ├── email?: string
│       ├── phone?: string
│       ├── userId: string
│       └── createdAt: timestamp
│
├── turnos/                       # Turnos configurados
│   └── {turnoId}/
│       ├── name: string
│       ├── startTime?: string
│       ├── endTime?: string
│       ├── startTime2?: string
│       ├── endTime2?: string
│       ├── color: string
│       ├── userId: string
│       └── createdAt: timestamp
│
├── horarios/                     # Horarios semanales
│   └── {horarioId}/
│       ├── nombre: string
│       ├── weekStart: string
│       ├── semanaInicio: string
│       ├── semanaFin: string
│       ├── assignments: map
│       ├── completada?: boolean
│       └── ...
│
├── historial/                    # Historial de cambios
│   └── {historialId}/
│       ├── horarioId: string
│       ├── nombre: string
│       ├── assignments: map
│       ├── accion: "creado" | "modificado"
│       └── ...
│
├── pedidos/                      # Pedidos/Proveedores
│   └── {pedidoId}/
│       ├── nombre: string
│       ├── stockMinimoDefault: number
│       ├── formatoSalida: string
│       ├── mensajePrevio?: string
│       └── userId: string
│
├── productos/                     # Productos de los pedidos
│   └── {productoId}/
│       ├── pedidoId: string
│       ├── nombre: string
│       ├── stockMinimo: number
│       ├── unidad?: string
│       ├── orden?: number
│       └── userId: string
│
├── stockActual/                   # Stock actual por producto
│   └── {stockId}/
│       ├── productoId: string
│       ├── pedidoId: string
│       ├── cantidad: number
│       └── userId: string
│
├── stockMovimientos/              # Historial de movimientos
│   └── {movimientoId}/
│       ├── productoId: string
│       ├── tipo: "entrada" | "salida"
│       ├── cantidad: number
│       └── ...
│
├── configuracion/                 # Configuración del sistema
│   └── {configId}/
│       ├── nombreEmpresa?: string
│       ├── colorEmpresa?: string
│       ├── horasMaximasPorDia: number
│       ├── mediosTurnos?: array
│       ├── separadores?: array
│       └── ...
│
└── chatMessages/                  # Mensajes del chat (opcional)
    └── {messageId}/
        ├── tipo: "usuario" | "sistema"
        ├── contenido: string
        └── timestamp: timestamp
\`\`\`

## PWA (Progressive Web App)

La aplicación es una PWA instalable:

### Instalación en Desktop

1. En Chrome/Edge, busca el ícono de instalación en la barra de direcciones
2. Haz clic en "Instalar"
3. La app se instalará como una aplicación nativa

### Instalación en Móvil

1. En Android: Chrome mostrará un banner de instalación
2. En iOS: Safari → Compartir → "Añadir a pantalla de inicio"
3. La app funcionará offline para consultas básicas

### Funcionalidades PWA

- ✅ Instalable en dispositivos
- ✅ Funciona offline (modo limitado)
- ✅ Notificaciones push (futuro)
- ✅ Acceso rápido desde la pantalla de inicio

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

# Generar reglas de Firestore (si es necesario)
pnpm build:rules
```

### Scripts Adicionales

Consulta `scripts/README.md` para scripts de utilidad como:
- `delete-old-schedules.js`: Eliminar horarios antiguos sin `createdBy`

## Documentación Adicional

Este README cubre las funcionalidades principales. Para información más detallada, consulta:

- **[CHAT_STOCK_DOCUMENTACION.md](./CHAT_STOCK_DOCUMENTACION.md)**: Documentación completa del Chat de Stock (funciones, comandos, ejemplos)
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**: Guía detallada de configuración de Firebase
- **[VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)**: Guía rápida de deploy en Vercel
- **[rules/README.md](./rules/README.md)**: Arquitectura y gestión de reglas de Firestore
- **[scripts/README.md](./scripts/README.md)**: Scripts de utilidad disponibles

## Características Avanzadas

### Horarios Fijos

Puedes marcar días específicos como "horarios fijos" que se aplicarán automáticamente a todas las semanas:

1. Asigna el horario deseado a un día específico
2. Marca el día como "fijo" desde la configuración
3. El sistema aplicará automáticamente ese horario cada semana

### Separadores y Orden Personalizado

1. Crea separadores desde la configuración (ej: "SALÓN", "COCINA")
2. Reordena empleados y separadores arrastrando
3. El orden se mantiene en todas las vistas

### Medios Turnos

1. Define medios turnos en la configuración (ej: "Mañana 08:00-12:00")
2. Asigna "1/2 franco" a un empleado
3. Selecciona el medio turno deseado

### Formato Personalizable de Pedidos

Personaliza cómo se genera el texto de los pedidos usando placeholders:
- `{nombre}`: Nombre del producto
- `{cantidad}`: Cantidad a pedir
- `{unidad}`: Unidad de medida

Ejemplo: `{nombre} ({cantidad} {unidad})` → "Leche (8 litros)"

## Soporte

Para problemas o preguntas sobre Firebase:
- [Documentación Firebase](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- Ver `FIREBASE_SETUP.md` para configuración detallada

Para problemas con Next.js o la aplicación:
- [Documentación Next.js](https://nextjs.org/docs)
- [Documentación shadcn/ui](https://ui.shadcn.com)

Para problemas con Vercel:
- [Documentación Vercel](https://vercel.com/docs)
- [Vercel Dashboard](https://vercel.com/dashboard)
- Ver `VERCEL_DEPLOY.md` para guía de deploy

Para problemas con Ollama:
- [Documentación Ollama](https://ollama.ai/docs)
- El chat funciona sin Ollama, es completamente opcional
