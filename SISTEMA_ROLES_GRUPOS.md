# Sistema de Roles, Grupos y Panel de Fábrica

## 📋 Resumen

Este documento describe el sistema completo de roles, grupos y el panel de fábrica implementado en la aplicación. Este sistema permite una gestión granular de usuarios, pedidos y remitos con control de acceso basado en roles.

## 🎭 Sistema de Roles

El sistema implementa 5 roles principales:

### 1. **Admin** (Desarrollador)
- **Acceso**: Total al sistema
- **Funcionalidades**:
  - Crear y gestionar todos los grupos
  - Crear y gestionar todos los usuarios
  - Asignar cualquier rol a usuarios
  - Ver todos los pedidos y remitos
  - Crear links de registro para cualquier rol
- **Panel**: `/dashboard/admin`

### 2. **Manager** (Gerente de Grupo)
- **Acceso**: Administración de grupos asignados
- **Funcionalidades**:
  - Crear y gestionar grupos donde es manager
  - Asignar usuarios (branch/factory) a sus grupos
  - Eliminar usuarios de sus grupos
  - Crear links de registro para `branch` o `factory` dentro de sus grupos
  - Ver usuarios y pedidos de sus grupos
- **Panel**: `/dashboard/gerente`
- **Restricciones**: No puede crear usuarios con rol `admin` o `manager`

### 3. **Factory** (Fábrica)
- **Acceso**: Panel de fábrica para procesar pedidos
- **Funcionalidades**:
  - Ver pedidos de sucursales (`branch`) de su grupo
  - Aceptar y procesar pedidos
  - Generar remitos
  - Firmar remitos digitalmente
  - Ver historial de remitos
- **Panel**: `/dashboard/fabrica`
- **Filtrado**: Solo ve pedidos de sucursales en su mismo grupo

### 4. **Branch** (Sucursal)
- **Acceso**: Gestión de pedidos y stock
- **Funcionalidades**:
  - Crear pedidos
  - Gestionar stock
  - Generar links públicos para pedidos
  - Ver sus propios remitos
  - Firmar recepción de remitos
- **Panel**: `/dashboard/pedidos` (panel principal)
- **Rol por defecto**: Nuevos usuarios sin rol asignado tienen este rol

### 5. **Invited** (Invitado/Colaborador)
- **Acceso**: Limitado, vinculado a un usuario dueño
- **Funcionalidades**: Depende de la configuración del dueño
- **Uso**: Para colaboradores temporales o con acceso restringido

## 👥 Sistema de Grupos

Los grupos permiten organizar usuarios (`branch` y `factory`) en unidades lógicas de trabajo.

### Estructura de Grupo

```typescript
interface Group {
  id: string
  nombre: string                    // Nombre del grupo (ej: "Grupo Norte")
  managerId: string                 // ID del usuario manager
  managerEmail?: string             // Email del manager (referencia)
  userIds: string[]                 // IDs de usuarios del grupo (branch, factory)
  createdAt?: timestamp
  updatedAt?: timestamp
}
```

### Características

- **Un usuario puede pertenecer a múltiples grupos**: Un `branch` puede estar en varios grupos, y una `factory` puede atender múltiples grupos
- **Manager por grupo**: Cada grupo tiene un manager asignado que lo administra
- **Sincronización automática**: El sistema sincroniza automáticamente el campo `grupoIds` en los usuarios cuando se agregan a grupos

### Gestión de Grupos

#### Crear un Grupo (Admin o Manager)

1. Ve al panel de administración (`/dashboard/admin` o `/dashboard/gerente`)
2. Pestaña "Grupos"
3. Haz clic en "Crear Grupo"
4. Ingresa el nombre del grupo
5. Selecciona el manager (solo admin puede asignar managers)
6. Agrega usuarios al grupo

#### Asignar Usuarios a un Grupo

1. Selecciona un grupo
2. Haz clic en "Agregar Usuarios"
3. Selecciona usuarios de la lista (se filtran automáticamente)
4. Los usuarios se agregan inmediatamente (UI reactiva)

#### Eliminar Usuarios de un Grupo

1. Selecciona un grupo
2. Haz clic en el botón de eliminar junto al usuario
3. El usuario se elimina inmediatamente (UI reactiva)

## 🏭 Panel de Fábrica

El panel de fábrica (`/dashboard/fabrica`) permite a usuarios con rol `factory` gestionar pedidos entrantes de sucursales.

### Funcionalidades Principales

#### 1. Vista de Pedidos Pendientes

- **Filtros**:
  - Todos
  - Pendientes (estado: `creado`)
  - En proceso (estado: `processing`)
- **Información mostrada**:
  - ID del pedido
  - Sucursal (nombre de empresa)
  - Fecha de creación
  - Estado
  - Usuario asignado (si está en proceso)
- **Lista de sucursales**: Muestra las sucursales del grupo de la fábrica

#### 2. Vista de Detalle de Pedido

Al abrir un pedido, la fábrica ve:
- **Productos solicitados**: Lista completa con cantidades
- **Estado del pedido**: `creado`, `processing`, `enviado`, `recibido`
- **Información de asignación**: Quién tomó el pedido (si está en proceso)
- **Acciones disponibles**:
  - "Marcar en proceso": Cambia estado a `processing` y asigna el pedido
  - "Generar remito": Crea el remito y cambia estado a `enviado`
  - "Firmar remito": Firma digitalmente el remito

#### 3. Historial de Remitos

- **Acceso**: Botón "Historial de Remitos" en el panel principal
- **Información mostrada**:
  - Número de remito
  - Pedido asociado
  - Sucursal
  - Fecha
  - Estado de firma (fábrica y sucursal)
- **Acciones**: Ver y descargar remitos

### Flujo de Trabajo

```
1. Sucursal crea pedido
   └─> Estado: "creado"

2. Fábrica ve pedido en panel
   └─> Estado: "creado"

3. Fábrica acepta pedido
   └─> Estado: "processing"
   └─> assignedTo: userId de la fábrica
   └─> assignedToNombre: nombre de la fábrica

4. Fábrica genera remito
   └─> Estado: "enviado"
   └─> Se crea remito con firma de fábrica

5. Sucursal recibe pedido
   └─> Estado: "recibido"
   └─> Sucursal firma recepción
   └─> Estado: "completado"
```

### Estados de Pedido

- **`creado`**: Pedido creado por sucursal, pendiente de procesar
- **`processing`**: Fábrica ha tomado el pedido y lo está procesando
- **`enviado`**: Remito generado y firmado por fábrica
- **`recibido`**: Sucursal ha recibido el pedido
- **`completado`**: Pedido completado (opcional, para historial)

## 🔐 Control de Acceso (RBAC)

### Reglas de Firestore

El sistema implementa control de acceso granular mediante reglas de Firestore:

#### Lectura de Usuarios
- **Admin**: Puede leer todos los usuarios
- **Manager**: Puede leer todos los usuarios (filtrado en aplicación)
- **Factory**: Puede leer todos los usuarios (filtrado en aplicación)
- **Branch**: Solo puede leer su propio usuario
- **Usuario**: Solo puede leer su propio usuario

#### Lectura de Grupos
- **Admin**: Puede leer todos los grupos
- **Manager**: Puede leer todos los grupos (filtrado en aplicación)
- **Factory**: Puede leer todos los grupos (filtrado en aplicación)
- **Usuario**: Puede leer grupos a los que pertenece

#### Lectura de Pedidos
- **Admin**: Puede leer todos los pedidos
- **Factory**: Solo puede leer pedidos de sucursales en su grupo
- **Branch**: Solo puede leer sus propios pedidos
- **Manager**: Puede leer pedidos de usuarios en sus grupos

#### Escritura
- **Admin**: Puede escribir en todas las colecciones
- **Manager**: Puede escribir solo en grupos que administra
- **Factory**: Puede actualizar pedidos asignados a ella
- **Branch**: Puede crear y actualizar sus propios pedidos

### Filtrado en Cliente

Debido a las limitaciones de Firestore para consultas complejas con arrays, el sistema implementa:
1. **Lectura amplia en reglas**: Managers y Factories pueden leer todos los usuarios/grupos
2. **Filtrado en cliente**: La aplicación filtra los resultados según los grupos del usuario
3. **Sincronización automática**: El sistema sincroniza `grupoIds` en usuarios automáticamente

## 📝 Links de Registro

El sistema permite crear links de registro con roles específicos:

### Crear Link de Registro

#### Como Admin
1. Ve a `/dashboard/admin`
2. Pestaña "Buscar por Email" o "Usuarios"
3. Haz clic en "Crear Link de Registro"
4. Selecciona el rol (`admin`, `manager`, `factory`, `branch`, `invited`)
5. Si es `manager`, selecciona el grupo
6. Copia el link generado

#### Como Manager
1. Ve a `/dashboard/gerente`
2. Haz clic en "Crear Link de Registro"
3. Selecciona el rol (`factory` o `branch`)
4. Selecciona el grupo (solo grupos donde es manager)
5. Copia el link generado

### Estructura de Link

```typescript
interface InvitacionLink {
  id: string
  token: string                    // Token único
  ownerId: string                  // Usuario que creó el link
  activo: boolean
  usado: boolean
  usadoPor?: string               // Usuario que usó el link
  role?: "branch" | "factory" | "admin" | "invited" | "manager"
  grupoId?: string                // Grupo asignado (para links de manager)
  createdAt?: timestamp
  expiresAt?: timestamp           // Opcional: expiración
}
```

### Uso del Link

1. El usuario accede al link: `/registro?token=XXXXX`
2. Si no está autenticado, se le pide iniciar sesión con Google
3. El sistema asigna automáticamente:
   - El rol especificado en el link
   - El grupo (si el link tiene `grupoId`)
   - Actualiza `grupoIds` en el usuario

## 🔄 Sincronización Automática

El sistema implementa sincronización automática de `grupoIds`:

### Cuándo se Sincroniza

1. **Al agregar usuario a grupo**: Se actualiza `grupoIds` del usuario
2. **Al remover usuario de grupo**: Se actualiza `grupoIds` del usuario
3. **Al cargar panel de fábrica**: Si detecta discrepancias, sincroniza automáticamente
4. **Al usar link de registro**: Se asigna el grupo y actualiza `grupoIds`

### Cómo Funciona

El hook `use-fabrica-pedidos.ts` incluye un `useEffect` que:
1. Detecta si el usuario está en `grupo.userIds` pero no tiene ese `grupoId` en `userData.grupoIds`
2. Si encuentra discrepancias, actualiza automáticamente el campo `grupoIds`
3. Esto asegura que los usuarios siempre tengan sus grupos sincronizados

## 📊 Estructura de Datos

### Usuario (User)

```typescript
interface UserData {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  role?: "admin" | "manager" | "factory" | "branch" | "invited" | "user"
  grupoIds?: string[]              // IDs de grupos a los que pertenece
  createdAt?: timestamp
  updatedAt?: timestamp
}
```

### Pedido (Pedido)

```typescript
interface Pedido {
  id: string
  nombre: string
  stockMinimoDefault: number
  formatoSalida: string
  estado?: "creado" | "processing" | "enviado" | "recibido" | "completado"
  assignedTo?: string              // userId de fábrica que lo está procesando
  assignedToNombre?: string         // Nombre de la fábrica
  userId: string                    // ID de la sucursal que creó el pedido
  createdAt?: timestamp
  updatedAt?: timestamp
}
```

### Remito

```typescript
interface Remito {
  id: string
  pedidoId: string
  sucursalId: string
  productos: Array<{
    nombre: string
    cantidad: number
    unidad?: string
  }>
  firmaEnvio?: string               // Firma digital de fábrica (base64)
  firmaRecepcion?: string           // Firma digital de sucursal (base64)
  fechaEnvio?: timestamp
  fechaRecepcion?: timestamp
  createdAt?: timestamp
}
```

## 🚀 Configuración Inicial

### 1. Crear Usuario Admin

1. Inicia sesión con tu cuenta de Google
2. En Firestore, edita el documento del usuario en `apps/horarios/users/{userId}`
3. Agrega el campo `role: "admin"`
4. Recarga la aplicación

### 2. Crear Grupos

1. Como admin, ve a `/dashboard/admin`
2. Pestaña "Grupos"
3. Crea grupos (ej: "Grupo Norte", "Grupo Sur")
4. Asigna un manager a cada grupo

### 3. Crear Usuarios Factory

1. Como admin o manager, crea un link de registro con rol `factory`
2. Comparte el link con el usuario de fábrica
3. El usuario se registra y se asigna automáticamente al grupo

### 4. Crear Usuarios Branch

1. Como admin o manager, crea un link de registro con rol `branch`
2. Comparte el link con el usuario de sucursal
3. El usuario se registra y se asigna automáticamente al grupo

## 🔍 Troubleshooting

### La fábrica no ve pedidos

**Problema**: El panel de fábrica muestra "No hay pedidos" aunque hay pedidos creados.

**Soluciones**:
1. Verifica que la fábrica tenga `grupoIds` asignados
2. Verifica que las sucursales estén en el mismo grupo que la fábrica
3. Revisa los logs de consola para ver mensajes de sincronización
4. El sistema sincroniza automáticamente, pero puedes forzar recargando la página

### Error "Missing or insufficient permissions"

**Problema**: Error al cargar usuarios o grupos.

**Soluciones**:
1. Verifica que las reglas de Firestore estén actualizadas
2. Verifica que el usuario tenga el rol correcto
3. Despliega las reglas actualizadas: `firebase deploy --only firestore:rules`

### Usuario no aparece en selector de grupos

**Problema**: Al intentar agregar usuarios a un grupo, el selector está vacío.

**Soluciones**:
1. Verifica que haya usuarios con rol `branch` o `factory` (o sin rol)
2. Verifica que el manager no esté en la lista (se excluye automáticamente)
3. Verifica que el usuario no esté ya en el grupo

## 📚 Referencias

- **Reglas de Firestore**: `rules/horarios.rules`
- **Tipos TypeScript**: `lib/types.ts`
- **Hook de Fábrica**: `hooks/use-fabrica-pedidos.ts`
- **Hook de Grupos**: `hooks/use-groups.ts`
- **Panel de Admin**: `app/dashboard/admin/page.tsx`
- **Panel de Gerente**: `app/dashboard/gerente/page.tsx`
- **Panel de Fábrica**: `app/dashboard/fabrica/page.tsx`

