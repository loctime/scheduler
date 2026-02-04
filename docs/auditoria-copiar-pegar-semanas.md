# Auditoría de historial: copiar/pegar semanas

## Resumen

- En el commit **`2e8ce7f`** ("bueno veamos") aparece un sistema explícito de **copiar/pegar semanas** con un clipboard en memoria (`copiedWeekData`) y botones de UI separados (Copiar/Pegar). Ese sistema vivía principalmente en `components/schedule-calendar.tsx` y `components/schedule-calendar/week-schedule-actions.tsx`.
- En el commit **`ec65e40`** ("Simplify assignment handling and day status display") se **elimina** el clipboard y las acciones de copiar/pegar semana. Luego queda como única acción de copia la opción “Copiar semana anterior”.
- En el estado actual, solo quedan **referencias documentales** a “copiar/pegar” (por ejemplo en `docs/plan.md` y `docs/contrato.md`).

## Sistema anterior (clipboard de semana) — commit `2e8ce7f`

### Estado/clipboard

- Se introdujo un estado local en `ScheduleCalendar`:
  - `copiedWeekData` almacenaba `assignments`, `weekStartDate` y `copiedAt`.
  - Era un **clipboard temporal en memoria** (state de React), no persistido en Firestore ni en storage.

### Acción “Copiar semana”

- `copyCurrentWeek(weekStartDate)` leía el schedule de la semana en `getWeekSchedule` y guardaba en `copiedWeekData` los `assignments` junto a metadatos (`weekStartDate` y `copiedAt`).
- Si no existían assignments, mostraba error.

### Acción “Pegar semana”

- `pasteCopiedWeek(targetWeekStartDate)` aplicaba la copia **a cualquier semana objetivo** (no necesariamente contigua):
  - Construía dos arreglos de fechas de 7 días (semana copiada y semana destino).
  - Mapeaba los assignments por **índice de día de la semana** (0–6) y los pegaba en la semana objetivo.
  - Usaba `handleAssignmentUpdate` por cada `employeeId` y fecha, lo cual significaba que el pegado pasaba por el flujo normal de actualización de assignments (incluyendo validaciones y el control de edición en semanas completadas).

### UI/handlers involucrados

- `WeekScheduleActions` exponía botones **Copiar** y **Pegar**:
  - Recibía `copiedWeekData`, `onCopyCurrentWeek`, `onPasteCopiedWeek` y `weekStartDate` como props.
  - Mostraba un diálogo de confirmación para “Pegar semana”, avisando que reemplazaría todas las asignaciones de la semana destino.

### Alcance funcional del sistema anterior

- **Clipboard temporal**: en memoria, válido solo durante la sesión del navegador.
- **Pegado no contiguo**: permitía pegar en cualquier semana visible (no solo la anterior), ya que el target era arbitrario.
- **Semanas completadas**: el pegado no tenía un guard propio, pero al usar `handleAssignmentUpdate` heredaba el flujo de confirmación para semanas completadas.

## Eliminación/simplificación — commit `ec65e40`

- Se elimina `copiedWeekData` y los handlers `copyCurrentWeek` / `pasteCopiedWeek` de `ScheduleCalendar`.
- Se eliminan los botones **Copiar** y **Pegar** y sus props del componente `WeekScheduleActions`.
- Desde ese commit, la única acción de copia en la UI es **“Copiar semana anterior”**.

## Restos actuales / referencias parciales

- Quedaron referencias documentales a “Copiar/Pegar” en:
  - `docs/plan.md` (sección “Copiar / pegar”, criterios de tests).
  - `docs/contrato.md` (punto “Copiar / pegar assignments”).

## Notas de búsqueda (estado actual)

- No existen referencias activas a `copiedWeekData`, `onCopyCurrentWeek`, `onPasteCopiedWeek` o botones “Pegar” en el código actual.
- La acción vigente de copia en UI es “Copiar semana anterior”.

## Comandos consultados

- `git log --oneline -n 20`
- `git log -S "weekClipboard" --oneline --reverse`
- `git log -S "clipboard" --oneline --reverse`
- `git log -S "Copiar semana" --oneline --reverse`
- `git log -S "pegar" --oneline --reverse`
- `git log -S "copiedWeek" --oneline --reverse`
- `git show 2e8ce7f --stat`
- `git show 2e8ce7f:components/schedule-calendar/week-schedule-actions.tsx`
- `git show 2e8ce7f:components/schedule-calendar.tsx`
- `git show ec65e40 --stat`
- `git show ec65e40:components/schedule-calendar.tsx`
- `rg -n "Copiar|Pegar|copiar|pegar" docs`
