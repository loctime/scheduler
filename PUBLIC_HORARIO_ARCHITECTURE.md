# Arquitectura del Horario Público

## 🎯 Objetivo

Crear un sistema de horarios público que funcione sin autenticación, separado completamente del dashboard privado.

## 📋 Estructura Definitiva

### 1️⃣ Dashboard Privado - `/dashboard`

**Responsabilidades**:
- ✅ Editar horarios en `apps/horarios_weeks/{ownerId}_{weekId}`
- ✅ Publicar horarios a `apps/horarios/published/{ownerId}`
- ✅ Usa autenticación y validación de roles
- ✅ Solo accesible para administradores

**Paths Firestore**:
```
apps/horarios_weeks/{ownerId}_{weekId}  // Edición
apps/horarios/published/{ownerId}       // Publicación
```

---

### 2️⃣ Página Pública - `/horario/[ownerId]`

**Responsabilidades**:
- ✅ **SIN AUTENTICACIÓN** - completamente pública
- ✅ Leer desde `apps/horarios/published/{ownerId}`
- ✅ El `ownerId` viene de la URL, no de auth
- ✅ Compartible: `https://app.com/horario/{ownerId}`

**Características**:
- 📱 Mobile-friendly
- 🔄 Botón compartir (Web Share API + clipboard)
- 📅 Formato argentino DD/MM/AAAA
- 🚫 Solo lectura - sin edición posible

---

### 3️⃣ Redirect - `/horario`

**Responsabilidades**:
- ✅ Redirigir automáticamente a `/horario/{ownerId}`
- ✅ Usa `useOwnerId()` para obtener el ID del usuario autenticado
- ✅ Compatibilidad con enlaces antiguos

---

## 🔧 Implementación Técnica

### Hooks Públicos

#### `usePublicHorario(ownerId: string)`
```typescript
// SIN dependencia de auth
const { horario, isLoading, error } = usePublicHorario(ownerId)

// Lee desde: apps/horarios/published/{ownerId}
const horarioRef = doc(db, "apps", "horarios", "published", ownerId)
```

#### `usePublicPublisher()`
```typescript
// Publica directamente a: apps/horarios/published/{ownerId}
const publicRef = doc(db, "apps", "horarios", "published", ownerId)
await setDoc(publicRef, publicScheduleData)

return ownerId // Para generar URL pública
```

### Paths Firestore Válidos

| Colección | Path | Segmentos | Uso |
|-----------|------|-----------|-----|
| `apps/horarios_weeks` | `{ownerId}_{weekId}` | 3 ✅ | Edición dashboard |
| `apps/horarios/published` | `{ownerId}` | 3 ✅ | Lectura pública |

**✅ Todos los paths tienen 3 segmentos (válido)**

---

## 🚀 Flujo Completo

```mermaid
graph TD
    A[Admin en Dashboard] --> B[Edita en apps/horarios_weeks/*]
    B --> C[Publica horario]
    C --> D[Escribe en apps/horarios/published/{ownerId}]
    
    E[Empleado accede /horario/{ownerId}] --> F[Lee sin auth]
    F --> G[Obtiene ownerId de URL]
    G --> H[Lee apps/horarios/published/{ownerId}]
    H --> I[Muestra horario + compartir]
    
    J[Usuario accede /horario] --> K[Redirige a /horario/{ownerId}]
```

---

## 📁 Archivos Clave

### Nuevos
- `hooks/use-public-horario.ts` - Hook público sin auth
- `app/horario/[ownerId]/page.tsx` - Página pública

### Modificados
- `hooks/use-public-publisher.ts` - Publica a path correcto
- `app/horario/page.tsx` - Ahora es redirect

---

## 🛡️ Seguridad

### Acceso Público
- `apps/horarios/published/{ownerId}` - Lectura pública
- Sin datos sensibles
- Solo información del horario

### Acceso Privado
- `apps/horarios_weeks/*` - Solo usuarios autenticados
- Validación por roles
- Datos completos de edición

---

## 🌐 URLs

### Dashboard (Privado)
```
https://app.com/dashboard/horarios
```
- Requiere login
- Solo administradores

### Página Pública
```
https://app.com/horario/{ownerId}
```
- Sin login requerido
- Compartible directamente

### Redirect (Compatibilidad)
```
https://app.com/horario
```
- Redirige a página pública del usuario

---

## ✅ Resultado Esperado

1. **Dashboard funciona sin cambios** - Edición privada intacta
2. **Página pública funciona sin auth** - Empleados pueden ver horarios
3. **URLs compartibles** - Enlaces directos funcionan
4. **Sin errores de permisos** - Paths válidos y separados
5. **Arquitectura limpia** - Privado vs Público claramente separados

---

## 🚨 Errores Evitados

### Antes
- ❌ `/horario` dependía de auth
- ❌ Paths inválidos con segmentos impares
- ❌ Mezcla de lógica privada/pública
- ❌ Errores "permission-denied" falsos

### Ahora
- ✅ `/horario/[ownerId]` completamente público
- ✅ Paths válidos con 3 segmentos
- ✅ Separación clara dashboard/público
- ✅ Sin errores de permisos

---

## 🔄 Compatibilidad

- Enlaces antiguos a `/horario` redirigen automáticamente
- Dashboard sin cambios funcionales
- Nueva estructura compatible con PWA futuro
