OBJETIVO
Mantener una única documentación coherente con el modelo simple actual sin entidad RemitoTransporte.

RELACION LOGICA Y COLECCIONES
Pedido -> /apps/horarios/pedidos
RemitoSalida (armado + transporte) -> /apps/horarios/remitos_salida
Recepcion -> /apps/horarios/recepciones
Consolidado (derivado materializado) -> /apps/horarios/pedidos_consolidados
Pendientes (derivado materializado) -> /apps/horarios/pedidos_pendientes
AuditLog -> /apps/horarios/audit_logs
Counter -> /apps/horarios/counters
Products -> /apps/horarios/products

COLECCIONES
/apps/horarios/products
/apps/horarios/pedidos
/apps/horarios/remitos_salida
/apps/horarios/recepciones
/apps/horarios/pedidos_consolidados
/apps/horarios/pedidos_pendientes
/apps/horarios/audit_logs
/apps/horarios/counters

MODELO DE DOCUMENTOS

A) /apps/horarios/pedidos/{pedidoId}
Campos
id
numeroPedido
estado
origen.tipo
origen.id
origen.nombre
destino.tipo
destino.id
destino.nombre
createdAt
createdBy
createdByName
createdByEmail
updatedAt
observaciones
usaPendientes
pedidoOrigenPendienteIds
remitoSalidaId
recepcionId
items[]
totales

Estado
pendiente
preparado
en_transporte
recibido
cerrado
cancelado

items[]
itemId
productId
productNombre
unidad
stockMinimo
stockActual
cantidadPedida
cantidadSugerida
cantidadManual
observaciones

B) /apps/horarios/remitos_salida/{remitoSalidaId}
Campos
id
numero
pedidoId
pedidoNumero
estado
origen.id
origen.nombre
destino.id
destino.nombre
createdAt
createdBy
createdByName
createdByEmail
observaciones
totales
firmaEmisor
firmaTransportista
items[]

Estado
emitido
en_transito
entregado
cerrado
anulado

items[]
itemId
pedidoItemId
productId
productNombre
unidad
cantidadPedida
cantidadPreparada
cantidadTransportada
estadoLinea
motivo
observaciones

EstadoLinea
ok
parcial
no_hay
cancelado

firmaEmisor
firmado
firmadoAt
firmadoBy
firmadoByName
firmadoByEmail
firmaData

firmaTransportista
firmado
firmadoAt
firmadoBy
firmadoByName
firmadoByEmail
firmaData

C) /apps/horarios/recepciones/{recepcionId}
Campos
id
numero
pedidoId
remitoSalidaId
pedidoNumero
remitoSalidaNumero
estado
createdAt
createdBy
createdByName
createdByEmail
observaciones
totales
firma
items[]

Estado
confirmada
cerrada
anulada

items[]
itemId
pedidoItemId
productId
productNombre
unidad
cantidadPedida
cantidadPreparada
cantidadTransportada
cantidadRecibida
cantidadPendiente
cantidadDevuelta
cantidadDanada
estadoLinea
motivo
observaciones

EstadoLinea
ok
faltante
no_esta
danado
devuelto
excedente
parcial

D) /apps/horarios/pedidos_consolidados/{pedidoId}
Documento derivado materializado.
Campos
id
pedidoId
numeroPedido
estado
refs.remitoSalidaId
refs.recepcionId
resumen
items[]
createdAt
updatedAt

Estado
pendiente
preparado
en_transporte
recibido_parcial
recibido_completo
cerrado

items[]
productId
productNombre
cantidadPedida
cantidadPreparada
cantidadTransportada
cantidadRecibida
cantidadPendiente
estadoFinal

E) /apps/horarios/pedidos_pendientes/{pendienteId}
Documento derivado materializado.
Campos
id
pedidoId
pedidoNumero
recepcionId
productId
productNombre
unidad
origenId
origenNombre
destinoId
destinoNombre
cantidadPendiente
estado
createdAt
updatedAt
resolvedAt
resolvedBy
pedidoResolucionId

Estado
activo
usado_en_nuevo_pedido
resuelto
cancelado

F) /apps/horarios/audit_logs/{logId}
Campos
id
entityType
entityId
pedidoId
accion
descripcion
createdAt
createdBy
createdByName
createdByEmail

entityType
pedido
remito_salida
recepcion
consolidado
pendiente

accion
created
updated
signed
confirmed
cancelled

G) /apps/horarios/counters/{counterId}
Campos
id
prefix
nextNumber
updatedAt

REGLAS
1. No borrar documentos de remitos ni recepciones.
2. Documento firmado no se edita.
3. Stock se actualiza solo en recepción.
4. Pendiente siempre se calcula como cantidadPedida - cantidadRecibida.
5. Consolidado siempre automático y materializado.
6. Firma siempre snapshot.
