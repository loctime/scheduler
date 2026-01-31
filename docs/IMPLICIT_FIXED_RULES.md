# Generación Implícita de Horarios Fijos

## Overview

Esta implementación añade generación automática e implícita de horarios fijos cuando los usuarios navegan a semanas que aún no tienen asignaciones.

## Comportamiento Principal

### 🎯 Objetivo
Aplicar automáticamente reglas fijas existentes cuando un usuario entra a una semana vacía, sin sobrescribir nunca ediciones manuales.

### 📋 Reglas de Negocio

1. **Detección de Semana Vacía**: Una semana está "vacía" para un empleado si no existe ninguna asignación guardada para ese employeeId en esa semana.

2. **Aplicación Condicional**:
   - ✅ **Semana vacía** → Aplicar reglas fijas existentes
   - ❌ **Semana con datos** → No hacer nada, no sobrescribir

3. **Por Empleado**: La evaluación es individual por empleado, no por semana completa.

## Arquitectura

### 📁 Archivos Principales

```
hooks/
├── use-implicit-fixed-rules.ts    # Hook principal de generación implícita
├── use-employee-fixed-rules.ts    # Hook existente para reglas fijas
└── use-fixed-rules-application.ts # Hook existente para aplicación de reglas

components/
└── schedule-calendar.tsx          # Integración con navegación de semanas

scripts/
└── verify-implicit-fixed-rules.js # Verificación manual del comportamiento
```

### 🔧 Hook Principal: `useImplicitFixedRules`

Centraliza toda la lógica de generación implícita:

```typescript
const {
  applyFixedRulesIfWeekEmpty,      // Aplica reglas si semana está vacía
  applyFixedRulesForMultipleEmployees, // Aplica para múltiples empleados
  isWeekEmptyForEmployee,          // Detecta si semana está vacía
  generateAssignmentsFromRules,    // Genera asignaciones desde reglas
  hasFixedRules                    // Verifica si existen reglas configuradas
} = useImplicitFixedRules({...})
```

### 🔄 Flujo de Integración

1. **Navegación de Semana**: Usuario cambia a nueva semana
2. **Detección Automática**: `useEffect` detecta cambio en `monthWeeks`
3. **Evaluación por Empleado**: Para cada empleado, verifica si semana está vacía
4. **Aplicación Selectiva**: Solo aplica reglas donde no hay datos
5. **Notificación**: Muestra toast informando las reglas aplicadas

## Características Clave

### 🛡️ Protección Contra Sobrescritura

```typescript
// Verificación estricta antes de aplicar cualquier regla
const isEmpty = isWeekEmptyForEmployee(weekSchedule, employeeId, weekStartDate)

if (!isEmpty) {
  // NO hacer nada - proteger ediciones manuales
  return weekSchedule
}
```

### 📊 Generación Eficiente

```typescript
// Solo generar para días que tienen reglas configuradas
for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
  const rule = getRuleForDay(employeeId, dayOfWeek)
  
  if (rule) {
    // Convertir regla a asignación con horarios completos
    const assignments = convertRuleToAssignments(rule, shifts)
  }
}
```

### 🎛️ Integración Transparente

El hook se integra sin cambios en el flujo existente:

```typescript
// En schedule-calendar.tsx
const { applyFixedRulesIfWeekEmpty, hasFixedRules } = useImplicitFixedRules({
  user,
  employees,
  shifts,
  weekStartsOn,
  getWeekSchedule
})

// Efecto automático al navegar semanas
useEffect(() => {
  if (!hasFixedRules) return
  
  // Aplicar reglas para semanas visibles
  applyRulesForVisibleWeeks()
}, [monthWeeks, hasFixedRules])
```

## Estados del Sistema

### 📋 Escenarios Comunes

| Escenario | Estado Semana | Acción | Resultado |
|-----------|---------------|--------|-----------|
| **Semana Nueva** | Vacía | Aplicar reglas | ✅ Horarios generados |
| **Semana Editada** | Con datos | No hacer nada | ✅ Datos protegidos |
| **Semana Parcial** | Mixto | Aplicar solo donde falta | ✅ Completación selectiva |
| **Sin Reglas** | Vacía | No hacer nada | ✅ Sin cambios |

### 🔄 Ciclo de Vida

1. **Creación de Regla**: Usuario configura regla fija en `employee_fixed_rules`
2. **Navegación**: Usuario entra a semana futura
3. **Detección**: Sistema identifica semana vacía
4. **Aplicación**: Reglas se aplican automáticamente
5. **Edición Posterior**: Usuario puede modificar, creando override

## Configuración

### 📛 Colección Firestore

```javascript
// apps/horarios/employee_fixed_rules
{
  id: "rule123",
  employeeId: "emp456",
  ownerId: "company789",
  createdBy: "user101",
  dayOfWeek: 1,              // 0=Domingo, 1=Lunes, ...
  type: "SHIFT" | "OFF",
  shiftId: "shift456",       // Solo si type="SHIFT"
  startDate: "2024-01-01",   // Opcional
  endDate: "2024-12-31",     // Opcional
  priority: 1,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 🎛️ Parámetros del Hook

```typescript
useImplicitFixedRules({
  user,                    // Usuario actual
  employees,              // Lista de empleados
  shifts,                 // Turnos disponibles
  weekStartsOn,           // Configuración de inicio de semana
  getWeekSchedule,        // Función para obtener schedule
  onWeekScheduleCreated   // Callback cuando se crea schedule
})
```

## Verificación

### 🧪 Script de Verificación

Ejecutar script para verificar comportamiento:

```bash
node scripts/verify-implicit-fixed-rules.js
```

### 📊 Casos de Prueba

1. **Protección de Datos**: Semana con asignaciones existentes
2. **Generación Automática**: Semana completamente vacía
3. **Aplicación Parcial**: Semana con algunos empleados sin datos
4. **Múltiples Empleados**: Evaluación individual correcta

## Consideraciones Técnicas

### ⚡ Performance

- **Evaluación Lazy**: Solo se ejecuta cuando hay reglas configuradas
- **Procesamiento Asíncrono**: No bloquea el UI durante la aplicación
- **Memoización**: Evita renders innecesarios

### 🔐 Seguridad

- **Validación de Usuario**: Solo aplica reglas del usuario actual
- **Verificación de Permisos**: Respeta roles y permisos existentes
- **Logging Completo**: Toda acción queda registrada

### 🔄 Compatibilidad

- **Mantiene Formato**: Usa misma estructura `ShiftAssignment`
- **Reserva Candadito**: Celdas generadas marcan como fixed
- **Compatible con Sugerencias**: No interfiere con botón "Sugerir"

## Troubleshooting

### 🐛 Problemas Comunes

**Reglas no se aplican:**
- Verificar que `hasFixedRules` sea true
- Confirmar que `employeeId` coincida exactamente
- Revisar configuración de `dayOfWeek` (0=Domingo)

**Sobrescribe datos existentes:**
- Revisar implementación de `isWeekEmptyForEmployee`
- Verificar que no haya asignaciones ocultas
- Chequear formato de fechas

**Performance lento:**
- Limitar número de empleados procesados
- Usar debounce en navegación rápida
- Optimizar queries de Firestore

### 📝 Logs Importantes

```typescript
logger.info("[ImplicitFixedRules] Aplicando regla fija", {
  employeeId,
  date: dateStr,
  dayOfWeek,
  ruleType: rule.type
})

logger.debug("[ImplicitFixedRules] Verificando semana vacía", {
  weekStart,
  employeeId,
  isEmpty,
  hasSchedule: !!weekSchedule
})
```

## Futuras Mejoras

### 🚀 Roadmap

1. **Batch Processing**: Procesar múltiples empleados en paralelo
2. **Preview Mode**: Mostrar preview antes de aplicar
3. **Undo Integration**: Deshacer aplicación automática
4. **Conflict Resolution**: Manejar conflictos entre reglas
5. **Analytics**: Estadísticas de uso de reglas fijas

### 💡 Ideas Adicionales

- **Reglas Condicionales**: Aplicar basado en carga de trabajo
- **Reglas Temporales**: Con validación por fechas
- **Reglas Anidadas**: Prioridad y herencia
- **Import/Export**: Migración de reglas entre empresas

---

## Conclusión

Esta implementación proporciona generación implícita de horarios fijos que:

✅ **Protege ediciones manuales** - Nunca sobrescribe datos existentes  
✅ **Es transparente al usuario** - Funciona automáticamente en segundo plano  
✅ **Mantiene compatibilidad** - No rompe flujos existentes  
✅ **Es predecible** - Comportamiento claro y documentado  
✅ **Es eficiente** - Optimizado para rendimiento y UX  

El sistema cumple con todos los requisitos especificados y mantiene la integridad de los datos del usuario.
