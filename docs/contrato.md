📜 CONTRATO FINAL v1.0
Sistema de Horarios

Este documento define las reglas de oro globales del sistema de horarios.
Cualquier comportamiento que no cumpla estas reglas se considera BUG, no un caso especial.

1️⃣ Conceptos fundamentales
Assignment

Un assignment es una entidad que representa un horario, licencia o estado asignado a un empleado en un día determinado.

Regla 1 — Autosuficiencia (central)
Todo assignment es completo, explícito y autosuficiente.
Nunca depende implícitamente de un turno base para su estructura ni para completar datos faltantes.

2️⃣ Tipos de assignment

Todos los tipos cumplen el mismo contrato base y se diferencian solo por reglas específicas.

Tipos soportados

shift → horario laboral

medio_franco

franco

licencia

3️⃣ Estructuras válidas de assignment
3.1 Turno simple (shift)
type: "shift"
shiftId: string
startTime: string
endTime: string


Condiciones:

startTime < endTime

3.2 Turno cortado (shift)
type: "shift"
shiftId: string
startTime: string
endTime: string
startTime2: string
endTime2: string


Condiciones obligatorias:

startTime < endTime

startTime2 < endTime2

endTime <= startTime2

Las franjas no se solapan

Si alguna condición falla → assignment inválido

❌ Un turno cortado nunca puede existir con una sola franja.

3.3 Medio franco
type: "medio_franco"
startTime: string
endTime: string


Siempre requiere horarios

No usa shiftId

3.4 Licencia
type: "licencia"
licenciaType: "embarazo" | "vacaciones" | "otro"
startTime: string
endTime: string


No usa shiftId

Representa tiempo bloqueado

No puede solaparse con shift

4️⃣ Creación de assignments

Regla 2 — Inicialización explícita

Al crear un assignment desde un turno base:

Se copia toda la estructura horaria

Turno simple → 1 franja

Turno cortado → 2 franjas explícitas

El turno base:

solo se usa para inicializar

nunca para completar datos luego

5️⃣ Edición de horarios

Regla 3 — Edición granular

Cada franja es editable de forma independiente

Editar una franja:

❌ no afecta a la otra

Convertir turno cortado → simple:

requiere acción explícita del usuario

ejemplos válidos:

botón “Convertir a turno simple”

eliminación explícita de la segunda franja

Nunca ocurre como efecto colateral

Conversión

La conversión es irreversible a nivel assignment

Para volver a turno cortado:

se reasigna el turno base

se crea un nuevo assignment

6️⃣ Horas extras

Regla 4 — No alteran estructura

Las horas extras nunca agregan ni eliminan franjas

Solo modifican tiempos existentes

Turno simple

Opciones:

antes

después

Turno cortado

El usuario elige:

antes o después de la franja 1

antes o después de la franja 2

Unión de franjas

Si una hora extra provoca que:

endTime >= startTime2

El sistema debe:

bloquear la acción o

pedir confirmación explícita para convertir a turno simple

Nunca ocurre automáticamente

7️⃣ Licencias

Regla 5 — Licencias como assignments independientes

Las licencias no editan assignments existentes

No los reemplazan

No los eliminan

Solapamiento con turnos

Si una licencia se superpone a un turno:

El assignment original no se modifica

Se generan nuevos assignments shift derivados con los tramos válidos

La licencia ocupa su propio rango

Ejemplo:

Turno: 09–12 y 14–17

Licencia: 10–16

Resultado:

Shift: 09–10

Shift: 16–17

Licencia: 10–16

8️⃣ Múltiples assignments por celda

Una celda puede contener múltiples assignments

Pueden coexistir:

varios shift

licencia

Regla absoluta:

ningún assignment puede solaparse temporalmente con otro

La validación es global por celda, no individual.

9️⃣ Turnos que cruzan medianoche

Se permiten

Se validan sobre una línea de tiempo normalizada (+24h)

El cruce de día es explícito y válido

🔟 Validación y persistencia

Regla 6 — Validación estricta

Estados válidos:

Celda vacía → válido

Assignment completo → válido

Assignment incompleto → ❌ inválido

Ejemplos inválidos:

startTime sin endTime

startTime2 sin endTime2

Turno cortado con una sola franja

UI vs persistencia

La UI puede tener estados temporales incompletos

Al persistir:

validación estricta

bloqueo del guardado

mensaje claro de error

Nunca:

limpiar silenciosamente

reconstruir desde turno base

Valores faltantes

undefined, null o ausencia → equivalentes

Para ser válido, el campo debe existir y tener valor válido

1️⃣1️⃣ Turno base eliminado

El assignment sigue siendo válido

shiftId puede quedar huérfano

Se muestra advertencia

El assignment se edita con sus propios datos

1️⃣2️⃣ Copiar / pegar assignments

Copiar/pegar mantiene la estructura completa

No re-inicializa desde turno base

No viola la autosuficiencia

1️⃣3️⃣ Invariantes del sistema (nunca deben pasar)

❌ Perder una franja de un turno cortado

❌ Colapsar un turno sin acción explícita

❌ Guardar assignments incompletos

❌ Licencias que editen horarios

❌ Solapamientos temporales

❌ Dependencia implícita del turno base

Si ocurre → BUG.

1️⃣4️⃣ Alcance

Este contrato:

Aplica a todos los tipos de horario

Elimina los bugs actuales

Escala a futuro

Es la fuente única de verdad

Estado del contrato

Contrato FINAL v1.0 — Aprobado