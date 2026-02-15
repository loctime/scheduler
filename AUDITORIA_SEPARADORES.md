# Auditoría: Sistema de separadores del calendario de horarios

## 1. Qué son exactamente los separadores

- **Definición**: Son filas de agrupación visual en la grilla del horario. Cada uno tiene **nombre** (ej. "SEPARADOR", "Cocina", "Salón"), **color** opcional y **tipo** (`"puesto"` o `"personalizado"`).
- **Tipo en código**: `Separador` en `lib/types.ts` (id, nombre, tipo, color?, createdAt?, updatedAt?).
- **Uso**: Se intercalan en el orden de la grilla entre empleados para agrupar visualmente (por sección/puesto) y opcionalmente aplicar un color de fondo a las filas de empleados debajo hasta el siguiente separador.

---

## 2. ¿Son solo elementos visuales (UI) o tienen impacto funcional?

**Tienen impacto funcional limitado:**

| Área | ¿Impacto? | Detalle |
|------|-----------|--------|
| **Orden de la grilla** | ✅ Sí | Forman parte de `ordenEmpleados` / `orderedItemIds`. El orden es una lista de IDs que incluye tanto empleados como separadores; la posición del separador define dónde “corta” visualmente la lista. |
| **Estructura del grid** | ✅ Sí | Son filas reales del `<table>` ( `<tr>` ) generadas por `SeparatorRow`. No son un overlay ni una capa aparte. |
| **Cálculo de color de fila de empleado** | ✅ Sí | `getSeparatorColorForEmployee(itemIndex)` usa el último separador anterior a ese índice para dar color de fondo a la fila del empleado. |
| **Exportación Excel** | ✅ Sí | En `hooks/useExportSchedule/excel/`: se respeta orden empleados+separadores, se escriben filas de separador (`processSeparatorRow`, `applySeparatorStyles`), alturas de fila y color. |
| **Completar semana / snapshot** | ✅ Sí | Al marcar semana completada, `ordenEmpleadosSnapshot` se guarda con `config?.ordenEmpleados`, que **incluye IDs de separadores**. Ese array define el orden (empleados + separadores) congelado en el horario. |
| **Publicación pública** | ⚠️ Parcial | Se guarda `ordenEmpleadosSnapshot` en el doc público (puede contener IDs de separadores), pero **no** se guarda lista de separadores ni `separadoresSnapshot`. En la PWA no se carga config del owner (useConfig() sin usuario o distinto), por tanto `config?.separadores` es [] y la grilla pública **solo muestra empleados** en orden; los IDs de separador en el orden se ignoran porque no hay separadores en el mapa. Efecto: en vista pública los separadores **no se muestran**; el orden de empleados sí se respeta (orden relativo entre empleados). |
| **Asignaciones / turnos / validaciones** | ❌ No | No afectan asignaciones, cálculos de horas, validaciones ni reglas de negocio. |
| **Drag & drop** | ✅ Sí (indirecto) | No se arrastra el separador; se arrastra el **empleado**. Al soltar, se reordena `orderedItemIds` (que incluye IDs de empleados y separadores), así que la posición de los separadores en el array **sí** cambia al mover empleados. |

**Conclusión**: No son “solo UI”. Afectan **orden de la grilla**, **estructura del grid**, **color de filas**, **exportación Excel** y **snapshot al completar**. En **publicación pública** no se muestran (no hay datos de separadores en el doc público), pero el orden guardado puede contener sus IDs.

---

## 3. Dónde se definen

### Archivos

| Archivo | Rol |
|---------|-----|
| `lib/types.ts` | Interface `Separador` (id, nombre, tipo, color?, createdAt?, updatedAt?). `Configuracion` tiene `separadores?: Separador[]` y `ordenEmpleados?: string[]`. |
| `hooks/use-employee-order.ts` | Persistencia: `addSeparator`, `updateSeparator`, `deleteSeparator`; actualizan `config.separadores` y `config.ordenEmpleados` en Firestore (`COLLECTIONS.CONFIG`, doc por `ownerId`). |
| `components/schedule-grid/hooks/use-separators.ts` | Hook de UI: añadir en posición, editar nombre/color, guardar, cancelar, eliminar; llama a useEmployeeOrder y actualiza orden vía `onOrderUpdate`. |
| `components/schedule-grid/hooks/use-schedule-grid-data.ts` | Construye `separadorMap`, `orderedItemIds` (empleados + separadores), `orderedItems` (array de `GridItem`: employee | separator). |
| `components/schedule-grid/components/separator-row.tsx` | Componente que renderiza la fila visual del separador (una o dos `<tr>`, nombre, color, edición inline, botones editar/eliminar). |
| `components/schedule-grid/index.tsx` | Integra useScheduleGridData, useSeparators, useEmployeeOrder; renderiza `SeparatorRow` o `EmployeeRow` según `item.type`; aplica `getSeparatorColorForEmployee` a cada empleado. |
| `hooks/useExportSchedule/excel/excelHelpers.ts` | `createEmployeeMaps`, `getOrderedItemIds`, `processSeparatorRow` para Excel. |
| `hooks/useExportSchedule/excel/exportExcel.ts` | Usa separadores y orden para generar filas y estilos en la hoja. |
| `hooks/useExportSchedule/excel/excelStyles.ts` | `applySeparatorStyles`, `setupRowHeights` (separadores con altura distinta). |

### Componentes y hooks

- **Componente**: `SeparatorRow` (`components/schedule-grid/components/separator-row.tsx`).
- **Hooks**: `useSeparators` (UI de separadores), `useScheduleGridData` (datos del grid, incl. separadores), `useEmployeeOrder` (Firestore: separadores + orden), `useDragAndDrop` (reordena `orderedItemIds`, que incluye separadores).

### Ubicación en el grid

- Los separadores están **dentro del grid principal**: son filas del mismo `<table>` que las filas de empleados, en `<tbody>`, intercaladas según `orderedItems` (cada item es `employee` o `separator`). No hay capa aparte ni overlay.

---

## 4. Qué hacen realmente

| Pregunta | Respuesta |
|----------|-----------|
| ¿Solo renderizan una fila visual? | No. Renderizan fila(s) y además participan en orden, color de filas de empleados, Excel y snapshot. |
| ¿Afectan el orden de empleados? | Sí. El orden es único para empleados **y** separadores (`ordenEmpleados` / `orderedItemIds`). La posición del separador define el orden relativo (quién queda “arriba” o “abajo” del separador). |
| ¿Modifican la estructura del grid? | Sí. Son nodos reales del DOM (filas de tabla); sin ellos la tabla tendría menos filas y otro orden. |
| ¿Se guardan en Firestore? | Sí. En `config` (doc por ownerId): `separadores` (array de objetos Separador) y `ordenEmpleados` (array de IDs que incluye IDs de separadores). |
| ¿Tienen ID propio? | Sí. `id: \`separador-${Date.now()}-${random}\`` en use-employee-order al crear. |
| ¿Se pueden mover (drag & drop)? | No hay drag directo del separador. Solo las filas de empleado son draggables. Al mover un empleado se reordena todo `orderedItemIds`, así que la posición relativa de los separadores cambia. |
| ¿Afectan cálculos, exportaciones o publicación pública? | **Cálculos**: no. **Exportación Excel**: sí (filas y estilos). **Publicación pública**: el orden guardado puede contener IDs de separadores, pero en la PWA no se cargan separadores (no hay `separadoresSnapshot`), así que solo afectan el orden de empleados, no la visualización de filas separador. |

---

## 5. Qué permiten

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se pueden crear dinámicamente? | Sí. Botón “Agregar separador” en cada fila de empleado (EmployeeRow); `handleAddSeparator(position)` inserta un nuevo separador en esa posición y actualiza orden en config. |
| ¿Se pueden editar? | Sí. Nombre y color; edición inline en SeparatorRow con guardar/cancelar; persiste con `updateSeparator` en config. |
| ¿Se pueden eliminar? | Sí. Botón eliminar en SeparatorRow; `deleteSeparator` quita el separador de config y `onOrderUpdate` lo quita de `ordenEmpleados`. |
| ¿Persisten por semana o son globales? | **Globales a la empresa**: viven en `config` (un doc por ownerId), no en cada horario/semana. Todas las semanas usan el mismo `config.separadores` y `config.ordenEmpleados`. Al completar una semana se copia ese orden a `ordenEmpleadosSnapshot` del horario de esa semana. |
| ¿Están asociados a un ownerId o empresa? | Sí. Se guardan en `COLLECTIONS.CONFIG` con documento identificado por `ownerId` (empresa/usuario propietario). |

---

## 6. Dependencias

- **useSeparators**: Depende de `orderedItemIds`, `separadorMap`, `addSeparator`, `updateSeparator`, `deleteSeparator`, `onOrderUpdate` (updateEmployeeOrder). No hay un “useSeparators” que lea de Firestore; la lectura es vía config (useConfig) y useScheduleGridData.
- **useScheduleGridData**: Recibe `separadores` y `ordenEmpleados`; construye `separadorMap`, `orderedItemIds`, `orderedItems`. Los separadores influyen directamente en la forma del grid y en el color de filas.
- **Publicación pública (publicSchedules)**: Se escribe `ordenEmpleadosSnapshot` del horario (puede incluir IDs de separadores). No se escribe lista de separadores. La PWA no muestra filas separador porque no tiene `config.separadores` cargada para ese owner en ese contexto.

---

## 7. Conclusión explícita

- **¿Solo sirven para separación visual?**  
  **No.** Tienen impacto funcional: orden de la grilla, estructura del grid, color de filas de empleados, exportación Excel y snapshot al completar semana. En publicación pública no se muestran como filas, pero el orden guardado sí puede contener sus IDs.

- **¿Eliminarlos rompería algo?**  
  **Sí**, si se eliminan sin ajustar el resto:
  - **Grid**: `orderedItemIds` y `orderedItems` incluyen IDs de separadores; si se quitan del modelo pero el orden sigue guardando esos IDs, habría IDs “huérfanos” (filas que no se renderizan o fallos al buscar en `separadorMap`). Habría que dejar de guardar IDs de separadores en `ordenEmpleados` y en `ordenEmpleadosSnapshot`, y filtrar los existentes al leer.
  - **Excel**: el export asume orden con separadores y escribe filas y estilos para ellos; habría que dejar de escribir filas separador y de usar su color en filas de empleados.
  - **UI**: SeparatorRow, useSeparators, botón “Agregar separador” en EmployeeRow y `getSeparatorColorForEmployee` dejarían de tener sentido y deberían retirarse o adaptarse.

Si se quisiera **solo ocultarlos** (mantener datos pero no mostrar filas), habría que seguir filtrando por tipo en el render y no rompería la lógica de orden ni de export; si se quisiera **eliminarlos del sistema**, hace falta un refactor que limpie orden, snapshot, export y UI como se indicó arriba.

---

*Auditoría estructural y funcional. Sin refactor realizado.*
