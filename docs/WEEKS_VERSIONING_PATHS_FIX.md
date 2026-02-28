# 🔧 CORRECCIÓN DE PATHS - SISTEMA DE VERSIONADO INMUTABLE

## 📋 **PROBLEMA RESUELTO**

### **Error Original**: 403 Permission Denied
- **Causa**: `WeekVersioningService` usaba `WEEKS_COLLECTION = "weeks"` (raíz)
- **Firestore Rules**: Solo permiten `apps/horarios/weeks/*`
- **Solución**: Cambiar todos los paths a `apps/horarios/weeks`

## ✅ **ARCHIVOS MODIFICADOS**

### **1) lib/week-versioning-service-immutable.ts**
```typescript
// ANTES
const WEEKS_COLLECTION = "weeks"

// AHORA  
const WEEKS_COLLECTION = "apps/horarios/weeks"
```

### **2) lib/week-versioning-service-fixed.ts**
```typescript
// ANTES
const WEEKS_COLLECTION = "weeks"

// AHORA
const WEEKS_COLLECTION = "apps/horarios/weeks"
```

### **3) scripts/migrate-to-immutable-versioning.ts**
```typescript
// ANTES
const WEEKS_COLLECTION = "weeks"

// AHORA
const WEEKS_COLLECTION = "apps/horarios/weeks"
```

## 🔍 **VERIFICACIÓN DE PATHS**

### **✅ Paths Correctos Verificados**
- `collection(db, "apps/horarios/weeks")` → Semana principal
- `collection(weekRef, "versions")` → Subcolección de versiones
- `doc(db, "apps/horarios/weeks", baseWeekId)` → Documento semana
- `doc(versionsRef, versionNumber.toString())` → Documento versión

### **✅ Paths Públicos Verificados** (sin cambios)
- `apps/horarios/publicSchedules/{slug}/weeks/{weekId}` ✅
- `apps/horarios/enlaces_publicos/{ownerId}` ✅

### **✅ Sin Referencias a Raíz**
- ❌ `collection(db, "weeks")` - Eliminado
- ❌ `doc(db, "weeks", ...)` - Eliminado  
- ❌ `"weeks"` como string literal - Eliminado

## 🚀 **FLUJO DE CREACIÓN DE VERSIÓN**

### **Paths Firestore Generados:**
```
1. Documento semana: apps/horarios/weeks/{baseWeekId}
2. Versión actual: apps/horarios/weeks/{baseWeekId}/versions/{currentVersion}
3. Nueva versión: apps/horarios/weeks/{baseWeekId}/versions/{newVersionNumber}
```

### **Estructura Final:**
```
apps/
└── horarios/
    └── weeks/
        └── {baseWeekId}/
            ├── currentVersionNumber: 3
            ├── status: "draft" | "completed"
            └── versions/
                ├── 1/ (completed, inmutable)
                ├── 2/ (completed, inmutable)  
                └── 3/ (draft, editable)
```

## 🎯 **CONFIRMACIÓN DE FUNCIONALIDAD**

### **✅ Click en "Crear nueva versión para editar"**
1. **Lee**: `apps/horarios/weeks/{baseWeekId}` ✅
2. **Lee**: `apps/horarios/weeks/{baseWeekId}/versions/{current}` ✅
3. **Crea**: `apps/horarios/weeks/{baseWeekId}/versions/{current+1}` ✅
4. **Actualiza**: `apps/horarios/weeks/{baseWeekId}.currentVersionNumber` ✅
5. **Resultado**: ✅ **Sin 403, versión creada correctamente**

### **✅ Bridge Legacy (si es necesario)**
```typescript
// use-schedule-updates.ts - LÍNEA 80-88
const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, baseWeekId)
await setDoc(scheduleRef, { completada: false }, { merge: true })
```

## 📊 **ESTADO FINAL**

### **✅ Paths Firestore**: 100% alineados con rules
### **✅ Sin 403**: Sistema de versionado funcional
### **✅ Estructura correcta**: `apps/horarios/weeks/{id}/versions/{n}`
### **✅ Bridge legacy**: Mínimo y controlado
### **✅ UI intacta**: Sin cambios necesarios

## 🎉 **RESULTADO**

**El sistema de versionado inmutable ahora funciona correctamente dentro de `apps/horarios/*` y ya no genera errores 403.**

**Al hacer click en "Crear nueva versión para editar":**
- ✅ No hay 403 permission-denied
- ✅ Se crea documento en `apps/horarios/weeks/{baseWeekId}`
- ✅ Se crea versión en `apps/horarios/weeks/{baseWeekId}/versions/{n}`
- ✅ La UI queda editable vía bridge legacy (si es necesario)

**Estado: LISTO PARA PRODUCCIÓN**
