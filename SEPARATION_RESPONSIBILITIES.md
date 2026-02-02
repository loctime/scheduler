# Separación de Responsabilidades - Horarios System

## 🎯 Objetivo

Separar definitivamente las responsabilidades para evitar errores de permisos y mantener el sistema estable.

## 📋 Arquitectura Definitiva

### 1️⃣ `/dashboard` - EDICIÓN PRIVADA

**Responsabilidades**:
- ✅ Crear y editar semanas
- ✅ Generar schedules
- ✅ Aplicar reglas fijas (`ImplicitFixedRules`)
- ✅ Publicar horarios a colección pública
- ✅ Escribir en `apps/horarios/weeks/{ownerId}_{weekId}`

**Hooks Permitidos**:
- `useWeekDataDashboard` - Lectura + ESCRITURA
- `useImplicitFixedRules` - Solo en dashboard
- `usePublicPublisher` - Publicación a pública

**Restricciones**:
- Solo usuarios admin/manager
- Paths: `apps/horarios/weeks/{ownerId}_{weekId}`
- Puede crear documentos automáticamente

---

### 2️⃣ `/horario` - VISUALIZACIÓN AUTENTICADA

**Responsabilidades**:
- ✅ Solo lectura del horario publicado
- ✅ Mostrar estado "Publicado"
- ✅ Botón "Compartir horario" (copia URL)
- ✅ Leer desde `public/horarios/{publicScheduleId}`

**Hooks Permitidos**:
- `usePublishedSchedule` - Solo lectura pública
- `useSettings` - Para obtener `publishedScheduleId`

**Hooks PROHIBIDOS**:
- ❌ `useWeekData` - Deshabilitado para escritura
- ❌ `useImplicitFixedRules` - Bloqueado por guard
- ❌ `usePublicPublisher` - No publica desde acá

**Restricciones**:
- Solo lectura total
- No crear documentos
- Si no hay datos → mostrar estado vacío

---

### 3️⃣ `/pwa/horario/[id]` - VISTA PÚBLICA

**Responsabilidades**:
- ✅ Lectura sin autenticación
- ✅ Mobile-first
- ✅ Formato argentino DD/MM/AAAA
- ✅ Leer desde `public/horarios/{id}`

**Hooks Permitidos**:
- `usePublicSchedule` - Lectura pública
- `usePublicWeekNavigation` - Navegación visual

**Restricciones**:
- Sin autenticación
- Solo lectura
- UI simple para empleados

---

## 🔧 Implementación Técnica

### Guards de Seguridad

#### `useWeekData` (Solo Lectura)
```typescript
const saveWeekData = async (data: Partial<WeekDocument>) => {
  console.error("saveWeekData called in READ-ONLY mode")
  throw new Error("saveWeekData is disabled in READ-ONLY mode")
}
```

#### `useImplicitFixedRules` (Dashboard Only)
```typescript
const isDashboardContext = useMemo(() => {
  const isDashboardPage = window.location.pathname.startsWith('/dashboard')
  const hasValidUser = user && user.uid
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  
  return isDashboardPage && hasValidUser && isAdmin
}, [user])
```

### Paths Firestore

| Vista | Path | Permisos |
|-------|------|----------|
| Dashboard | `apps/horarios/weeks/{ownerId}_{weekId}` | Lectura + Escritura |
| /horario | `public/horarios/{publicScheduleId}` | Solo lectura |
| PWA | `public/horarios/{publicScheduleId}` | Solo lectura |

### Flujo de Publicación

```mermaid
graph TD
    A[Dashboard] --> B[Edita en apps/horarios/weeks/*]
    B --> C[Publica]
    C --> D[Copia a public/horarios/{id}]
    C --> E[Guarda publishedScheduleId]
    
    F[/horario] --> G[Lee publishedScheduleId]
    G --> H[Lee desde public/horarios/{id}]
    H --> I[Muestra + botón compartir]
    
    J[PWA] --> K[Lee directamente public/horarios/{id}]
```

## 🚨 Errores Comunes Evitados

### Antes
- ❌ `/horario` intentaba escribir en `apps/horarios/weeks/*`
- ❌ `ImplicitFixedRules` se ejecutaba fuera del dashboard
- ❌ Permisos denegados por paths incorrectos
- ❌ Mezcla de lógica de edición y visualización

### Ahora
- ✅ `/horario` solo lee desde `public/horarios/*`
- ✅ `ImplicitFixedRules` bloqueado fuera de dashboard
- ✅ Paths correctos y consistentes
- ✅ Separación clara de responsabilidades

## 📁 Archivos Clave

### Hooks Específicos
- `useWeekDataDashboard.ts` - Dashboard (lectura + escritura)
- `useWeekData.ts` - General (solo lectura)
- `usePublishedSchedule.ts` - Lectura pública
- `useImplicitFixedRules.ts` - Con guards de dashboard

### Componentes
- `share-schedule-button.tsx` - Botón compartir (no escribe)
- `public-schedule-publisher.tsx` - Publicación (dashboard only)

## 🔒 Seguridad

### Firestore Rules (Sin cambios)
- `apps/horarios/*` - Solo usuarios autenticados
- `public/horarios/*` - Lectura pública
- Validación por `ownerId` y roles

### Guards de Aplicación
- Verificación de ruta (`/dashboard` vs `/horario`)
- Validación de rol (admin/manager)
- Bloqueo de escritura fuera de contexto

## ✅ Resultado Esperado

1. **Dashboard funciona sin errores de permisos**
2. **/horario muestra horario correctamente**
3. **No se dispara ImplicitFixedRules fuera de dashboard**
4. **PWA público funciona sin login**
5. **Firestore estable, sin loops ni writes indebidos**

## 🚨 Checklist de Verificación

- [ ] Dashboard usa `useWeekDataDashboard`
- [ ] /horario usa `usePublishedSchedule`
- [ ] `useWeekData` está en modo solo lectura
- [ ] `ImplicitFixedRules` tiene guards
- [ ] Botón compartir no escribe en Firestore
- [ ] Publicación solo desde dashboard
- [ ] Paths consistentes en toda la app
- [ ] Sin errores de permisos en producción
