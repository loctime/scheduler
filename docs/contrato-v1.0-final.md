# Contrato v1.0 - Sistema de Horarios
## Versión Final - Declaración de Invariantes No Negociables

**Fecha de cierre:** $(date)  
**Estado:** ✅ IMPLEMENTADO Y CERRADO

---

## 📋 Declaración de Cierre

Este documento declara el **Contrato v1.0** como **FINAL** y **NO NEGOCIABLE**. Todos los invariantes aquí documentados son **obligatorios** y deben mantenerse en todas las futuras modificaciones del sistema.

---

## 🎯 Principio Central: Autosuficiencia

**REGLA FUNDAMENTAL:** Todo `ShiftAssignment` es una entidad completa, explícita y autosuficiente. Nunca depende implícitamente del turno base (`Turno`) para su estructura.

### Implicaciones:

1. ✅ **Creación**: Al asignar un turno, se copia TODA la estructura horaria al assignment
2. ✅ **Edición**: Se edita solo el assignment, sin consultar el turno base
3. ✅ **Persistencia**: Solo se guardan assignments completos y válidos
4. ✅ **Visualización**: Se muestran solo datos explícitos del assignment

---

## 🔒 Invariantes No Negociables

### 1. Assignment Autosuficiente

**Invariante:** Un assignment nunca depende del turno base para completar datos faltantes.

**Validación:**
- ❌ `assignment.startTime || shift.startTime` → **PROHIBIDO**
- ✅ `assignment.startTime` → **OBLIGATORIO**

**Bloqueo:** Si un assignment está incompleto, la edición está **BLOQUEADA** hasta normalizarlo.

---

### 2. Turnos Cortados - Preservación de Estructura

**Invariante:** Un turno cortado (dos franjas) siempre mantiene ambas franjas, salvo conversión explícita.

**Reglas:**
- ✅ Editar primera franja → segunda franja se mantiene
- ✅ Agregar horas extras → estructura se mantiene
- ✅ Conversión a turno simple → solo mediante acción explícita del usuario
- ❌ Nunca se pierde la segunda franja como efecto colateral

**Validación:** `validateTurnoCortado()` verifica que ambas franjas estén completas.

---

### 3. Horas Extras - Sin Colapso

**Invariante:** Agregar horas extras nunca colapsa un turno cortado a simple.

**Reglas:**
- ✅ Horas extras modifican tiempos, no estructura
- ✅ Usuario elige qué franja modificar (primera o segunda)
- ✅ Si las franjas se unen (`endTime >= startTime2`), se convierte explícitamente a turno simple

**Validación:** `validateNoOverlapBetweenSegments()` previene solapamientos.

---

### 4. Licencias - Coexistencia

**Invariante:** Las licencias conviven con los horarios, no los eliminan.

**Reglas:**
- ✅ Licencia se agrega como assignment adicional
- ✅ Turno original se divide en segmentos (antes/durante/después)
- ✅ No se muta el assignment original
- ✅ Se crean nuevos assignments derivados

**Validación:** `validateCellAssignments()` verifica que no haya solapamientos.

---

### 5. Persistencia - Solo Válidos

**Invariante:** Solo se persisten assignments completos y válidos.

**Reglas:**
- ❌ Nunca guardar assignment incompleto
- ❌ Nunca "limpiar" silenciosamente
- ❌ Nunca reconstruir desde turno base
- ✅ Bloquear guardado con mensaje claro

**Validación:** `validateBeforePersist()` ejecuta validación estricta antes de guardar.

---

### 6. Solapamientos - Prevención Global

**Invariante:** No puede haber solapamientos entre assignments en una celda.

**Reglas:**
- ✅ Validación global por celda antes de guardar
- ✅ Considera todos los tipos: shifts, licencias, medio_francos
- ✅ Maneja correctamente cruces de medianoche

**Validación:** `validateNoOverlaps()` y `validateCellAssignments()`.

---

### 7. Cruce de Medianoche - Manejo Correcto

**Invariante:** Los turnos que cruzan medianoche se validan usando línea de tiempo normalizada.

**Reglas:**
- ✅ Normalización a timeline expandida (0-2880 minutos)
- ✅ Detección correcta de solapamientos
- ✅ Validación entre segmentos de turno cortado

**Validación:** `hasTimeOverlap()` con normalización de medianoche.

---

### 8. Turnos Huérfanos - Visibilidad

**Invariante:** Un assignment con turno base eliminado sigue siendo visible y editable.

**Reglas:**
- ✅ Assignment mantiene sus datos propios
- ✅ Se muestra advertencia visual pero permite edición
- ✅ No se bloquea por falta de turno base

**Validación:** `isAssignmentIncomplete()` no requiere turno base existente.

---

### 9. Incompleto ≠ Inválido

**Invariante:** Distinción clara entre assignment incompleto (falta datos) e inválido (datos incorrectos).

**Reglas:**
- **Incompleto**: Faltan campos requeridos → Bloquea edición
- **Inválido**: Datos presentes pero incorrectos → Bloquea guardado

**Validación:**
- `isAssignmentIncomplete()` → Detección temprana (UI)
- `validateAssignmentComplete()` → Validación estricta (persistencia)

---

### 10. Migración Explícita

**Invariante:** La normalización de datos existentes es explícita y auditada.

**Reglas:**
- ✅ Scripts de migración documentados
- ✅ Modo dry-run para previsualizar cambios
- ✅ Logs de todas las normalizaciones

**Scripts:**
- `scripts/detect-incomplete-assignments.ts` → Detección
- `scripts/normalize-assignments.ts` → Normalización

---

## 🛡️ Guard Rails Implementados

### Bloqueo Visual
- ✅ Indicador visual en celdas con assignments incompletos
- ✅ Opacidad reducida y borde rojo
- ✅ Tooltip con razones de incompletitud

### Bloqueo Funcional
- ✅ Context menu deshabilitado para edición
- ✅ Toast con mensaje claro y acción sugerida
- ✅ Validación antes de abrir diálogos

### Observabilidad
- ✅ Logs centralizados de intentos bloqueados
- ✅ Logs de normalizaciones automáticas
- ✅ Logs de validaciones fallidas

---

## 📊 Validaciones Centralizadas

### `lib/assignment-validators.ts`
- `validateAssignmentComplete()` → Validación de completitud y corrección
- `validateTurnoCortado()` → Validación de turno cortado
- `validateNoOverlaps()` → Validación de solapamientos
- `validateCellAssignments()` → Validación global por celda
- `validateBeforePersist()` → Validación antes de persistir

### `lib/assignment-utils.ts`
- `isAssignmentIncomplete()` → Detección de incompletitud
- `detectIncompleteAssignments()` → Escaneo de schedule
- `getIncompletenessReason()` → Razón legible
- `normalizeAssignmentFromShift()` → Normalización explícita

---

## 🧪 Tests de Regresión

**Archivo:** `__tests__/assignment-regression.test.ts`

**Cobertura:**
1. ✅ Editar turno cortado → no pierde franja
2. ✅ Horas extras → no colapsan
3. ✅ Licencia → no borra horarios
4. ✅ No se guarda assignment parcial
5. ✅ No hay solapamientos
6. ✅ Turno base eliminado → assignment visible
7. ✅ Copiar/pegar mantiene estructura
8. ✅ Validación de cruce de medianoche
9. ✅ Licencia con licenciaType

---

## 🚫 Prohibiciones Absolutas

### ❌ NUNCA:
1. Completar datos desde turno base en tiempo de ejecución
2. Perder segunda franja como efecto colateral
3. Guardar assignments incompletos
4. "Limpiar" silenciosamente datos faltantes
5. Reconstruir assignments desde turno base
6. Permitir solapamientos entre assignments
7. Mutar assignments originales al crear licencias
8. Bloquear edición por falta de turno base (solo por incompletitud)

---

## ✅ Checklist de Cumplimiento

- [x] Assignment autosuficiente desde creación
- [x] Preservación de estructura en turnos cortados
- [x] Horas extras sin colapso
- [x] Licencias coexisten sin mutar originales
- [x] Persistencia solo de assignments válidos
- [x] Validación global de solapamientos
- [x] Manejo correcto de cruce de medianoche
- [x] Turnos huérfanos visibles y editables
- [x] Distinción incompleto/inválido
- [x] Migración explícita y auditada
- [x] Guard rails visuales y funcionales
- [x] Observabilidad centralizada
- [x] Tests de regresión completos

---

## 📝 Notas de Implementación

### Archivos Críticos:
- `lib/assignment-validators.ts` → Validaciones centralizadas
- `lib/assignment-utils.ts` → Utilidades de detección y normalización
- `components/schedule-grid/components/schedule-cell.tsx` → UI con guard rails
- `hooks/use-schedule-updates.ts` → Persistencia con validación
- `scripts/detect-incomplete-assignments.ts` → Detección de incompletos
- `scripts/normalize-assignments.ts` → Normalización explícita
- `__tests__/assignment-regression.test.ts` → Tests de invariantes

### Logging:
- `lib/logger.ts` → Sistema centralizado
- Logs de bloqueos de edición
- Logs de normalizaciones automáticas
- Logs de validaciones fallidas

---

## 🎯 Criterio de Finalización

El sistema cumple el Contrato v1.0 cuando:

1. ✅ Todos los invariantes están implementados
2. ✅ Todas las validaciones están activas
3. ✅ Todos los guard rails están funcionando
4. ✅ Todos los tests pasan
5. ✅ La documentación está completa

**ESTADO ACTUAL:** ✅ **CERRADO Y COMPLETO**

---

## 📌 Versión del Contrato

**Contrato v1.0** - Final  
**Última actualización:** $(date)  
**Estado:** ✅ IMPLEMENTADO

**Este contrato es FINAL y NO NEGOCIABLE. Cualquier modificación futura debe mantener estos invariantes.**

---

*Fin del Contrato v1.0*
