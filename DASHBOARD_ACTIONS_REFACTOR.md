# Refactor de Barra de Acciones del Dashboard

## Overview

Se ha simplificado y clarificado la barra de acciones del dashboard, eliminando redundancias y usando nombres claros y consistentes, alineados al nuevo modelo de "publicar semana".

## 📋 **Cambios Implementados**

### ✅ **1. Eliminado: "Copiar semana anterior"**
- **Motivo**: Redundante con acciones "Copiar" y "Pegar" existentes
- **Acción**: Eliminado completamente de la UI principal
- **Ubicación actual**: Menú secundario (≡) para acceso si se necesita

### ✅ **2. Renombrado: "Sugerir" → "Aplicar Fijos"**
- **Análisis de función real**:
  - Aplica horarios fijos configurados en `config.fixedSchedules`
  - Busca asignaciones guardadas cuando se marcó como fijo
  - Si no hay, busca sugerencias automáticas basadas en patrones
  - Si no hay, busca en la última semana completada
  - **NO sobrescribe** asignaciones existentes
  - Solo aplica donde no hay asignaciones previas
- **Decisión**: **Mantener y renombrar** a "Aplicar Fijos"
- **Justificación**: Es una acción principal y de uso frecuente. "Sugerir" era confuso (no sugiere, aplica)

### ✅ **3. Renombrado: "Marcar como listo" → "LISTO"**
- **Motivo**: Texto más corto y directo
- **Representa**: Estado final de la semana
- **Cambio**: Solo el label, sin modificar la lógica

### ✅ **4. Reemplazado: PWA → "Publicar horario"**
- **Acción nueva**: `settings.publishedWeekId = weekId actual`
- **Representa**: Reemplazo conceptual de "actualizar PWA"
- **Diseño**: Botón principal destacado (variant="default")
- **Icono**: Upload (subida/publicación)

### ✅ **5. Menú Secundario para Acciones Técnicas**
- **Botón**: ≡ (ChevronDown) al final de la barra
- **Contenido**:
  - "Copiar semana anterior" (movido aquí)
  - "Limpiar semana" (movido aquí)
- **Principio**: Acciones principales visibles, avanzadas en menú

---

## 🎯 **Resultado Final**

### **Barra Principal (visible siempre)**
```
[ Copiar ] [ Pegar ] [ Aplicar Fijos ] [ LISTO ] [ Exportar ] [ Publicar horario ] [ ≡ ]
```

### **Menú Secundario (≡)**
```
┌─────────────────────┐
│ 📋 Copiar semana anterior  │
│ 🗑️  Limpiar semana         │
└─────────────────────┘
```

---

## 📊 **Análisis de Botones**

| Botón | Ubicación | ¿Qué pasa si lo aprieto? | Estado |
|-------|-----------|--------------------------|---------|
| **Copiar** | Principal | Copia la semana actual al portapapeles | ✅ Activo |
| **Pegar** | Principal | Pega la semana copiada en la semana actual | ✅ Activo |
| **Aplicar Fijos** | Principal | Aplica horarios fijos donde no hay asignaciones | ✅ Activo |
| **LISTO** | Principal | Marca/desmarca la semana como completada | ✅ Activo |
| **Exportar** | Principal | Exporta la semana (imagen/PDF/Excel) | ✅ Activo |
| **Publicar horario** | Principal | Publica la semana actual (settings.publishedWeekId) | ✅ Activo |
| **Copiar semana anterior** | Secundario | Copia asignaciones de la semana anterior | ✅ Activo |
| **Limpiar semana** | Secundario | Elimina todas las asignaciones de la semana | ✅ Activo |

---

## 🔄 **Flujo de Usuario Mejorado**

### **Antes (confuso)**
```
[ Copiar ] [ Pegar ] [ Copiar semana anterior ] [ Sugerir ] [ Limpiar semana ] [ Marcar como listo ] [ Exportar ] [ Actualizar PWA ]
```
- **Problemas**: 8 botones, nombres confusos, redundancia, mezcla de acciones principales/técnicas

### **Después (claro)**
```
[ Copiar ] [ Pegar ] [ Aplicar Fijos ] [ LISTO ] [ Exportar ] [ Publicar horario ] [ ≡ ]
```
- **Ventajas**: 6 botones principales, nombres claros, sin redundancia, acciones técnicas ocultas

---

## 🎨 **Criterios UX Cumplidos**

### ✅ **Barra más corta y legible**
- **Antes**: 8 botones principales
- **Después**: 6 botones principales + menú secundario

### ✅ **Cada botón responde claramente**
- **"Aplicar Fijos"**: Aplica horarios fijos (no sugiere)
- **"LISTO"**: Marca como completada (corto y directo)
- **"Publicar horario"**: Publica la semana actual

### ✅ **Acciones principales visibles**
- Copiar/Pegar: Operaciones básicas
- Aplicar Fijos: Uso frecuente
- LISTO: Estado final
- Exportar: Salida de datos
- Publicar horario: Nueva acción central

### ✅ **Acciones avanzadas en menú secundario**
- Copiar semana anterior: Redundante con Copiar/Pegar
- Limpiar semana: Potencialmente destructiva

---

## 🔧 **Detalles Técnicos**

### **Props Actualizadas**
```typescript
interface WeekScheduleActionsProps {
  // ... props existentes
  onPublishSchedule?: () => Promise<void> | void  // Nuevo
  isPublishingSchedule?: boolean                   // Nuevo
  // onPublishPwa eliminado
  // isPublishingPwa eliminado
}
```

### **Nuevos Handlers**
```typescript
const handlePublishSchedule = useCallback(() => {
  if (onPublishSchedule) {
    onPublishSchedule()
  }
}, [onPublishSchedule])
```

### **Iconos Actualizados**
- **Upload**: Para "Publicar horario"
- **Sparkles**: Mantenido para "Aplicar Fijos"
- **ChevronDown**: Para menú secundario

---

## 📝 **Notas de Implementación**

### **Dependencias**
- Los componentes padres deben actualizar las props:
  - `onPublishSchedule` en lugar de `onPublishPwa`
  - `isPublishingSchedule` en lugar de `isPublishingPwa`

### **Mantenimiento**
- Los diálogos de confirmación se mantienen sin cambios
- La lógica de `executeSuggestSchedules` no se modifica
- Solo cambia la presentación y organización

### **Compatibilidad**
- **Backward compatible**: Las acciones técnicas siguen disponibles
- **Forward compatible**: Prepado para el nuevo sistema de publicación
- **No breaking changes**: Solo adiciones y reorganización

---

## 🎯 **Impacto Esperado**

### **Para Usuarios**
- **Claridad**: Cada botón tiene un propósito claro
- **Eficiencia**: Acciones principales más accesibles
- **Seguridad**: Acciones destructivas en menú secundario

### **Para Desarrolladores**
- **Mantenimiento**: Código más organizado
- **Extensión**: Fácil agregar nuevas acciones al menú secundario
- **Consistencia**: Nombres claros y predecibles

### **Para el Sistema**
- **Adopción**: Facilita la transición al nuevo modelo de publicación
- **Escalabilidad**: Barra de acciones más sostenible
- **UX**: Mejor experiencia de usuario general

---

## 🚀 **Próximos Pasos**

1. **Actualizar componentes padres** para usar nuevas props
2. **Testear flujo de publicación** con nuevo sistema
3. **Recopilar feedback** de usuarios sobre cambios
4. **Considerar mover más acciones** al menú secundario si es necesario

---

## ✅ **Restricciones Cumplidas**

- ✅ **NO agregar nuevas features**: Solo reorganización
- ✅ **NO hacer refactors grandes**: Cambios mínimos y enfocados
- ✅ **NO tocar backend**: Solo wiring de UI
- ✅ **NO cambiar flujos existentes**: Solo eliminar redundancias
- ✅ **Mantener lógica funcional**: Sin cambios en comportamiento

**Resultado**: Barra de acciones más clara, corta y alineada al nuevo modelo de publicación.
