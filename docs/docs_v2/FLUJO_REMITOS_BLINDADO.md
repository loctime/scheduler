🔒 FLUJO BLINDADO Y SIMPLE
🧠 PRINCIPIO CLAVE

❗ El sistema no gira más alrededor del “pedido”.
Gira alrededor de documentos inmutables por etapa.

🧩 ENTIDADES MÍNIMAS (SIN OVERKILL)

Vamos a usar solo estas:

1. Pedido
intención de compra/transferencia
editable hasta enviar
2. RemitoSalida (ARMADO)
lo que realmente se preparó
lo crea quien arma (fábrica/sucursal)
3. RemitoTransporte (DELIVERY)
lo que el delivery efectivamente lleva
puede diferir del armado
4. Recepcion
lo que realmente se recibe
lo confirma la sucursal destino
5. Consolidado (derivado, no editable)
resumen automático final
6. Pendientes
lo no recibido → queda para futuro
🔁 FLUJO COMPLETO
1. CREAR PEDIDO

Sucursal crea pedido:

productos + cantidades
basado en stock mínimo (ya lo tenés ✔)

Estado:

pedido.estado = "pendiente"
2. ARMADO (ORIGEN)

Actor: fábrica o sucursal origen

Hace:

ve pedido
marca:
enviado completo
no tengo
envío menos
comentario

Genera:

👉 RemitoSalida

Contiene por producto:

cantidadPedida
cantidadPreparada
estado:
ok
no_hay
parcial
observaciones
firma

Estado pedido:

"preparado"
3. TRANSPORTE (DELIVERY)

Actor: delivery

Hace:

recibe remito de armado
puede:
aceptar todo
modificar cantidades (ej: carga mal, pierde, etc.)
agregar comentarios

Genera:

👉 RemitoTransporte

Contiene:

cantidadPreparada
cantidadTransportada
diferencias
observaciones
firma delivery

Estado pedido:

"en_transporte"
4. RECEPCIÓN (DESTINO)

Actor: sucursal destino

Hace:

ve lo transportado
marca por producto:
recibido ok
faltante
no está
dañado
excedente
devolución

Puede:

editar cantidad recibida
agregar comentarios
marcar devolución (con motivo obligatorio)
(futuro: fotos)

Genera:

👉 Recepcion

Contiene:

cantidadTransportada
cantidadRecibida
estado:
ok
faltante
no_esta
dañado
excedente
devolución si aplica
observaciones
firma receptor

Estado pedido:

"recibido"
5. CONSOLIDADO (AUTOMÁTICO)

No se edita.

Se calcula:

Por producto:

pedido
preparado
transportado
recibido
diferencia final

Sirve para:

auditoría
PDF final
historial
6. PENDIENTES (CLAVE)

Regla:

pendiente = cantidadPedida - cantidadRecibida

Si > 0:

se guarda como pendiente reutilizable

Ejemplo:

pedí 10
recibí 7
→ pendiente = 3

Esto NO se pierde.

🔐 REGLAS BLINDADAS (IMPORTANTÍSIMO)
1. DOCUMENTOS INMUTABLES

Una vez confirmados:

❌ NO se editan
✔ se crean nuevos eventos si hay cambios
2. NUNCA BORRAR REMITOS

Esto elimina el problema actual detectado por Codex.

3. CADA ACTOR SOLO EDITA SU ETAPA
Actor	Puede modificar
Origen	RemitoSalida
Delivery	RemitoTransporte
Destino	Recepción
4. STOCK SOLO SE ACTUALIZA EN RECEPCIÓN

✔ Correcto
❌ Nunca en envío

5. FIRMA = SNAPSHOT

Guardar:

nombre
email
firma
fecha

No depender de config futura.

6. CONSOLIDADO = DERIVADO

Nunca editable.

7. TODO ES TRAZABLE

Cada documento:

referencia al anterior
guarda diferencias
🧱 MODELO DE DATOS SIMPLE

Te lo dejo conceptual (sin código):

Pedido
id
estado
productos[]
RemitoSalida
pedidoId
productos[]
firmaOrigen
fecha
RemitoTransporte
remitoSalidaId
productos[]
firmaDelivery
fecha
Recepcion
remitoTransporteId
productos[]
firmaReceptor
fecha
Pendientes
productoId
cantidad
pedidoOrigenId

___________________________________________

Mi recomendación:

usar ambas en cálculo interno,
pero guardar al menos la que impacta negocio real del pedido.

Más abajo te digo cuál conviene usar.

E. /apps/horarios/pedidos_consolidados/{pedidoId}

Usaría el mismo pedidoId como ID del consolidado.

Es derivado. Nunca editable desde UI.

Campos
id
pedidoId
numeroPedido
estadoGeneral
origenId
origenNombre
destinoId
destinoNombre
createdAt
updatedAt
pedidoRef
remitoSalidaRef
remitoTransporteRef
recepcionRef
resumen
items []
estadoGeneral
pendiente
preparado
en_transporte
recibido_parcial
recibido_completo
cerrado
cancelado
resumen
cantidadItems
cantidadPedidaTotal
cantidadPreparadaTotal
cantidadTransportadaTotal
cantidadRecibidaTotal
cantidadPendienteTotal
cantidadDevueltaTotal
cantidadDanadaTotal
items[]
itemId
productId
productNombreSnapshot
unidadSnapshot
cantidadPedida
cantidadPreparada
cantidadTransportada
cantidadRecibida
cantidadPendiente
cantidadDevuelta
cantidadDanada
estadoFinal
F. /apps/horarios/pedidos_pendientes/{pendienteId}

Esta colección es clave para no perder lo no recibido.

ID recomendado

Podés usar automático, o mejor:

{pedidoId}_{productId}

si querés un pendiente activo único por pedido-producto.

Campos
id
pedidoId
pedidoNumeroSnapshot
recepcionId
productId
productNombreSnapshot
unidadSnapshot
origenId
origenNombre
destinoId
destinoNombre
cantidadPendiente
estado
createdAt
updatedAt
createdBy
resolvedAt opcional
resolvedBy opcional
pedidoResolucionId opcional
estado
activo
usado_en_nuevo_pedido
resuelto
cancelado
G. /apps/horarios/audit_logs/{logId}
Campos
id
entityType
entityId
pedidoId opcional
accion
descripcion
payloadResumen
createdAt
createdBy
createdByName
createdByEmail
entityType
pedido
remito_salida
remito_transporte
recepcion
consolidado
pendiente
accion
created
updated
signed
confirmed
cancelled
closed
generated_consolidado
generated_pendiente
H. /apps/horarios/counters/{counterId}
IDs sugeridos
pedido
remito_salida
remito_transporte
recepcion
Campos
nextNumber
prefix
updatedAt

Ejemplo:

counterId: pedido
nextNumber: 17
prefix: PED
3. Relaciones entre documentos
Relación lineal principal
Pedido
  -> RemitoSalida
      -> RemitoTransporte
          -> Recepcion
              -> Consolidado
              -> Pendientes
Relaciones exactas
Pedido

Tiene:

0 o 1 remitoSalidaId
0 o 1 remitoTransporteId
0 o 1 recepcionId
RemitoSalida

Pertenece a:

1 pedidoId
RemitoTransporte

Pertenece a:

1 pedidoId
1 remitoSalidaId
Recepcion

Pertenece a:

1 pedidoId
1 remitoSalidaId
1 remitoTransporteId
Consolidado

Resume:

1 pedidoId
Pendientes

Nacen de:

1 pedidoId
1 recepcionId
1 productId
4. Reglas de negocio exactas
Regla 1

El pedido es editable solo antes del remito de salida.

Cuando existe remitoSalida, el pedido ya no se edita libremente.

Regla 2

RemitoSalida, RemitoTransporte y Recepción son inmutables una vez confirmados.

Si algo está mal:

se anula,
o se genera otro documento complementario,
pero no se pisa el histórico.
Regla 3

El stock se actualiza solo al confirmar recepción.

Nunca en pedido.
Nunca en armado.
Nunca en transporte.

Regla 4

Cada etapa firma su propio documento.

origen firma remito_salida
delivery firma remito_transporte
destino firma recepcion
Regla 5

El consolidado se recalcula automáticamente.

No lo toca ningún usuario.

Regla 6

Todo faltante real genera pendiente.

Si al cerrar recepción queda saldo, ese saldo crea o actualiza pedidos_pendientes.

Regla 7

Los pendientes se pueden arrastrar al próximo pedido, pero no automáticamente sin control.

Recomendación:

al crear un nuevo pedido para una sucursal, mostrar:
“Tenés pendientes activos. ¿Querés agregarlos?”
con un click se agregan como renglones sugeridos.

Eso es más simple y evita líos.

5. Qué conviene usar para calcular el pendiente

Hay dos opciones:

Opción A
pendiente = cantidadPedida - cantidadRecibida
Ventaja

Refleja la deuda real del pedido original.

Desventaja

Si origen preparó menos a propósito, igual queda deuda.

Opción B
pendiente = cantidadTransportada - cantidadRecibida
Ventaja

Refleja solo lo que faltó en entrega.

Desventaja

No contempla lo no preparado.

Recomendación correcta para tu negocio

Guardar ambos conceptos:

cantidadNoPreparada
max(0, cantidadPedida - cantidadPreparada)
cantidadNoTransportada
max(0, cantidadPreparada - cantidadTransportada)
cantidadNoRecibida
max(0, cantidadTransportada - cantidadRecibida)
cantidadPendienteFinal
max(0, cantidadPedida - cantidadRecibida)

Y el pendiente reutilizable debe salir de:

cantidadPendienteFinal

Porque lo que a vos te importa de negocio es: qué quedó sin resolver del pedido original.

6. Estados por documento
Pedido
pendiente
preparado
en_transporte
recibido
cerrado
cancelado
RemitoSalida
emitido
anulado
RemitoTransporte
emitido
entregado
anulado
Recepcion
confirmada
cerrada
anulada
Pendiente
activo
usado_en_nuevo_pedido
resuelto
cancelado
7. Flujo exacto de escritura
Paso 1. Crear pedido

Escribe:

/pedidos
/audit_logs
Paso 2. Confirmar armado

Escribe:

/remitos_salida
actualiza /pedidos.estado = preparado
/audit_logs
Paso 3. Confirmar transporte

Escribe:

/remitos_transporte
actualiza /pedidos.estado = en_transporte
/audit_logs
Paso 4. Confirmar recepción

Escribe en una misma transacción o batch:

/recepciones
actualiza stock en /products
crea/actualiza /pedidos_pendientes
actualiza /pedidos.estado = recibido o cerrado
crea/actualiza /pedidos_consolidados
/audit_logs
8. Índices lógicos que te van a servir

No puedo crear índices desde acá, pero te recomiendo planificarlos así:

pedidos
por destinoId + createdAt desc
por estado + createdAt desc
por origenId + createdAt desc
remitos_salida
por pedidoId
por createdAt desc
remitos_transporte
por pedidoId
por remitoSalidaId
recepciones
por pedidoId
por createdAt desc
pedidos_pendientes
por destinoId + estado
por productId + estado
por pedidoId
9. Migración desde legacy sin romper nada

Como dijiste que lo legacy de remitos no importa y se puede deshabilitar, mejor todavía.

Estrategia correcta

No migrar toda la basura histórica.
Solo conservar:

productos
stock
pedidos útiles
firmas configuradas

Y arrancar el nuevo flujo documental limpio.

Fase 0. Congelar lo viejo

Hacer esto:

Deshabilitar en UI
generación legacy de remitos
recepción legacy
consolidado legacy
borrado de remitos legacy

No hace falta borrar colecciones viejas todavía.

Fase 1. Mantener vivos solo estos módulos actuales
products
cálculo de pedido
stock actual
configuración de firma
creación base de pedido si te sirve
Fase 2. Crear nuevas colecciones

Crear:

remitos_salida
remitos_transporte
recepciones
pedidos_consolidados
pedidos_pendientes
audit_logs
counters
Fase 3. Adaptar pedidos

Si la colección pedidos actual ya existe, no hace falta cambiar el path.
Solo conviene ampliar el documento para el nuevo modelo.

Mantener compatibilidad

Podés agregar campos nuevos sin romper lo anterior:

numeroPedido
origenTipo
destinoTipo
remitoSalidaId
remitoTransporteId
recepcionId
usaPendientes
pedidoOrigenPendienteIds
Fase 4. Migración de firmas

Si hoy la firma está en otra colección/config, hacé un mapeo de lectura y dejá el snapshot en cada documento nuevo al firmar.

No migres firmas a documentos viejos.
Solo usalas en los nuevos.

Fase 5. Legacy coexistiendo apagado

Durante un tiempo:

UI nueva trabaja con colecciones nuevas
legacy queda solo accesible para consulta histórica si hace falta
Fase 6. Limpieza posterior

Cuando ya todo funcione:

ocultás totalmente pantallas legacy
decidís si borrás o archivás remitos y recepciones viejas
10. Cómo no romper nada en la implementación
Regla práctica 1

No tocar products al principio salvo para actualizar stock en recepción.

Regla práctica 2

No modificar pedido viejo al confirmar recepción más allá de:

estado
referencias a nuevos documentos
Regla práctica 3

Toda lógica de documentos nuevos va en hooks/servicios nuevos, no mezclada con legacy.

11. Estructura de código recomendada

Para que quede ordenado:

src/modules/pedidos-v2/
  domain/
    types.ts
    enums.ts
    rules.ts
  infrastructure/
    firestore-pedidos-repository.ts
    firestore-remitos-salida-repository.ts
    firestore-remitos-transporte-repository.ts
    firestore-recepciones-repository.ts
    firestore-consolidados-repository.ts
    firestore-pendientes-repository.ts
  application/
    create-pedido.ts
    create-remito-salida.ts
    create-remito-transporte.ts
    confirm-recepcion.ts
    rebuild-consolidado.ts
    resolve-pendientes.ts

Y en lib/collections.ts o similar:

/apps/horarios/products
/apps/horarios/pedidos
/apps/horarios/remitos_salida
/apps/horarios/remitos_transporte
/apps/horarios/recepciones
/apps/horarios/pedidos_consolidados
/apps/horarios/pedidos_pendientes
/apps/horarios/audit_logs
/apps/horarios/counters
