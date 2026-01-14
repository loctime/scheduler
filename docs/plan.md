✅ CHECKLIST TÉCNICO — IMPLEMENTACIÓN CONTRATO v1.0

Sistema de Horarios

Objetivo: implementar el contrato sin introducir nuevos supuestos implícitos y sin rehacer el sistema.

🧱 FASE 0 — Alineación (obligatoria)

 El contrato v1.0 está versionado y guardado como documento oficial

 Todo el equipo entiende:

qué es un assignment

qué significa autosuficiencia

 Se acuerda que:

cualquier excepción al contrato = bug

 No se escribe código sin pasar este checklist

🧩 FASE 1 — Modelo de datos
Assignment (global)

 Todos los assignments tienen:

type

estructura completa según su tipo

 No existe lógica que:

complete datos desde turno base en runtime

 undefined, null y ausencia se tratan igual para validación

Tipos

 shift simple: startTime + endTime

 shift cortado: startTime + endTime + startTime2 + endTime2

 medio_franco: siempre con horarios

 licencia: licenciaType + startTime + endTime

 Se elimina el uso de type: "licencia_embarazo" (se migra a licencia)

🏗️ FASE 2 — Creación de assignments

 Al asignar un turno:

se copia toda la estructura horaria

 Turno cortado:

las dos franjas quedan explícitas desde el inicio

 No se crean assignments con solo shiftId

 No se permite crear assignments incompletos ni “placeholder”

✏️ FASE 3 — Edición de horarios

 La UI permite editar:

franja 1

franja 2 (si existe)

 Editar una franja:

no toca la otra

 No hay lógica que:

reemplace el assignment completo por uno parcial

 Convertir turno cortado → simple:

requiere acción explícita (botón / acción clara)

no ocurre por edición ni por extras

 La conversión crea un nuevo estado válido, no un híbrido

⏱️ FASE 4 — Horas extras

 Horas extras no cambian estructura

 Turno simple:

opciones: antes / después

 Turno cortado:

opciones:

antes/después franja 1

antes/después franja 2

 La lógica:

solo ajusta startTime o endTime de la franja elegida

 Si extras unen franjas:

se bloquea o

se solicita confirmación explícita de conversión

 Nunca colapsa automáticamente

🧾 FASE 5 — Licencias

 Licencias son assignments independientes

 No editan assignments existentes

 No se superponen con shifts

 Si hay solapamiento:

se crean nuevos assignments derivados

el original no se muta

 No existe estado implícito “inactivo”

 Se valida que:

ningún assignment se solape en la celda

🧱 FASE 6 — Múltiples assignments por celda

 Una celda puede tener múltiples assignments

 Validación global por celda:

ningún solapamiento temporal

 Validación se ejecuta:

antes de persistir

no solo por assignment individual

🌙 FASE 7 — Casos especiales
Cruce de medianoche

 Se permite

 Validación usa línea de tiempo normalizada (+24h)

 Orden temporal consistente

Turno base eliminado

 Assignment sigue siendo válido

 shiftId huérfano muestra advertencia

 No se bloquea edición

Copiar / pegar

 Copia mantiene estructura completa

 No re-inicializa desde turno base

💾 FASE 8 — Validación y persistencia

 Validación estricta al guardar

 Assignment incompleto:

❌ no se guarda

muestra error claro

 UI puede tener estado temporal incompleto

 Nunca:

limpiar silenciosamente

reconstruir desde turno base

 Persistencia guarda solo assignments válidos

🔄 FASE 9 — Migración de datos existentes

 Identificar assignments incompletos actuales

 Elegir estrategia:

híbrida (marcar + completar explícitamente)

 No completar silenciosamente

 Bloquear edición hasta migrar

 Script o flujo de normalización documentado

🧪 FASE 10 — Tests de regresión (mínimos)

 Editar turno cortado → no pierde franja

 Horas extras → no colapsan

 Licencia → no borra horarios

 No se guarda assignment parcial

 No hay solapamientos

 Turno base eliminado → assignment visible

 Copiar/pegar mantiene estructura

🚦 Criterio de finalización

La implementación se considera correcta cuando:

 Todos los checks están cumplidos

 No hay lógica implícita dependiente del turno base

 El sistema es predecible

 Los bugs actuales no pueden volver a ocurrir