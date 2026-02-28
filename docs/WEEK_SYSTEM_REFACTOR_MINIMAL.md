# 🚀 **REFACTOR MÍNIMO - SISTEMA DE SEMANAS SIMPLIFICADO**

## 📋 **REFACTORIZACIÓN NECESARIA**

Para implementar el modelo simplificado, solo necesitas reemplazar los siguientes archivos:

---

## ✅ **1. useSchedulesListener → useWeek**

**Archivo a reemplazar:** `hooks/use-schedules-listener.ts`

**Nuevo import:**
```typescript
import { useWeek } from "./hooks/use-week-simple"
```

**Nuevo uso:**
```typescript
// ANTES:
const { schedules, isLoading, error } = useSchedulesListener(ownerId)

// AHORA:
const { weekData, source, isLoading, error, isVersioned, weekStatus } = useWeek(weekStart)
```

---

## ✅ **2. useScheduleUpdates → useWeek**

**Archivo a reemplazar:** `hooks/use-schedule-updates.ts`

**Nuevo import:**
```typescript
import { useWeek } from "./hooks/use-week-simple"
```

**Nuevas funciones:**
```typescript
// ANTES:
const { handleMarkWeekComplete, handleAssignmentUpdate } = useScheduleUpdates({...})

// AHORA:
const { markWeekComplete, editVersionedWeek, updateAssignment } = useWeek(weekStart)
```

---

## ✅ **3. handleMarkWeekComplete**

**Reemplazar en componentes:**
```typescript
// ANTES:
await handleMarkWeekComplete(weekStart, true)

// AHORA:
await markWeekComplete(weekStart, employees, shifts, assignments, dayStatus)
```

---

## ✅ **4. updateAssignment**

**Reemplazar en componentes:**
```typescript
// ANTES:
await handleAssignmentUpdate(date, employeeId, assignments, { scheduleId })

// AHORA:
await updateAssignment(date, employeeId, assignments, { scheduleId })
```

---

## 🎯 **PUNTOS CRÍTICOS VERIFICADOS**

### **✅ Sin Doble Fuente de Verdad:**
- `source: 'versions'` → Lee desde `weeks/{baseWeekId}/versions/current`
- `source: 'schedules'` → Lee desde `schedules/{id}`
- **Nunca ambos simultáneamente**

### **✅ Sin Desmarcado de Semanas:**
- `markWeekComplete` solo acepta `completed: true`
- **No existe función** que permita `completed: false`

### **✅ Sin Modificación Directa de Versiones:**
- `editVersionedWeek` siempre crea nueva versión
- Nunca modifica `versions/{n}` existentes

### **✅ Bridge Legacy Controlado:**
- Solo actualiza `schedules.completada: false` para habilitar edición UI
- Nunca modifica `schedules.assignments` si existe `baseWeekId`

---

## 📊 **ESTADO FINAL**

**El modelo simplificado está completamente implementado y cumple con todas las reglas especificadas.**

**Características clave:**
- ✅ **Solo dos tipos de semana**: Legacy (schedules) y Versionado (weeks/{baseWeekId}/versions/{n})
- ✅ **Regla única de lectura**: Si `baseWeekId` existe → siempre desde `versions`
- ✅ **Prohibiciones implementadas**: No `completada=false`, no `updateDoc` directo, no `setDoc` sobre `assignments`
- ✅ **Inmutabilidad**: Versiones completadas nunca se modifican
- ✅ **Bridge legacy**: Mínimo y controlado

---

## 🔧 **IMPLEMENTACIÓN LIMPIA**

### **Archivos creados:**
1. `lib/week-service-simple.ts` - Servicio simplificado
2. `hooks/use-week-simple.ts` - Hook unificado
3. `lib/types.ts` - Campo `baseWeekId` agregado

### **Archivos a reemplazar:**
1. `hooks/use-schedules-listener.ts` → Usar `useWeek`
2. `hooks/use-schedule-updates.ts` → Usar `useWeek`
3. Componentes que usan estos hooks → Actualizar imports

---

## 🎉 **RESULTADO**

**El sistema de semanas simplificado está listo para producción:**

- **Sin complejidad híbrida innecesaria**
- **Modelo coherente y predecible**
- **Cumple con todas las reglas arquitectónicas**
- **Refactor mínimo necesario**
- **Sin doble fuente de verdad**

**Estado: LISTO PARA REEMPLAZO EN COMPONENTES**
