BASE PATH
/apps/horarios/

MODELO LOGICO Y COLECCIONES
Pedido -> /apps/horarios/pedidos
RemitoSalida (armado + transporte) -> /apps/horarios/remitos_salida
Recepcion -> /apps/horarios/recepciones
Consolidado -> /apps/horarios/pedidos_consolidados
Pendientes -> /apps/horarios/pedidos_pendientes
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

1) products
/apps/horarios/products/{productId}
Campos
id: string
nombre: string
unidad: string
stockMinimo: number
stockActual: number
orden: number
activo: boolean
createdAt: timestamp
updatedAt: timestamp

2) pedidos
/apps/horarios/pedidos/{pedidoId}
Campos
id: string
numeroPedido: string
estado: string
origen:
  tipo: string
  id: string
  nombre: string
destino:
  tipo: string
  id: string
  nombre: string
usaPendientes: boolean
pedidoOrigenPendienteIds: string[]
remitoSalidaId: string | null
recepcionId: string | null
observaciones: string
items: PedidoItem[]
totales:
  items: number
  cantidadPedida: number
  cantidadPendienteFinal: number
createdAt: timestamp
createdBy: string
createdByName: string
createdByEmail: string
updatedAt: timestamp

PedidoItem
itemId: string
productId: string
productNombre: string
unidad: string
stockMinimo: number
stockActual: number
cantidadPedida: number
cantidadSugerida: number
cantidadManual: number
observaciones: string

Estado (pedido.estado)
pendiente
preparado
en_transporte
recibido
cerrado
cancelado

3) remitos_salida (ARMADO + TRANSPORTE)
/apps/horarios/remitos_salida/{remitoSalidaId}
Campos
id: string
numero: string
pedidoId: string
pedidoNumero: string
estado: string
origen:
  id: string
  nombre: string
destino:
  id: string
  nombre: string
items: RemitoSalidaItem[]
totales:
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
observaciones: string
firmaEmisor:
  firmado: boolean
  firmadoAt: timestamp
  firmadoBy: string
  firmadoByName: string
  firmadoByEmail: string
  firmaData: string
firmaTransportista:
  firmado: boolean
  firmadoAt: timestamp
  firmadoBy: string
  firmadoByName: string
  firmadoByEmail: string
  firmaData: string
createdAt: timestamp
createdBy: string
createdByName: string
createdByEmail: string

RemitoSalidaItem
itemId: string
pedidoItemId: string
productId: string
productNombre: string
unidad: string
cantidadPedida: number
cantidadPreparada: number
cantidadTransportada: number
estadoLinea: string
motivo: string
observaciones: string

Estado (remitos_salida.estado)
emitido
en_transito
entregado
cerrado
anulado

EstadoLinea (remitos_salida.items.estadoLinea)
ok
parcial
no_hay
cancelado

4) recepciones
/apps/horarios/recepciones/{recepcionId}
Campos
id: string
numero: string
pedidoId: string
remitoSalidaId: string
pedidoNumero: string
remitoSalidaNumero: string
estado: string
items: RecepcionItem[]
totales:
  cantidadRecibida: number
  cantidadPendiente: number
observaciones: string
firma:
  firmado: boolean
  firmadoAt: timestamp
  firmadoBy: string
  firmadoByName: string
  firmadoByEmail: string
  firmaData: string
createdAt: timestamp
createdBy: string
createdByName: string
createdByEmail: string

RecepcionItem
itemId: string
pedidoItemId: string
productId: string
productNombre: string
unidad: string
cantidadPedida: number
cantidadPreparada: number
cantidadTransportada: number
cantidadRecibida: number
cantidadPendiente: number
cantidadDevuelta: number
cantidadDanada: number
estadoLinea: string
motivo: string
observaciones: string

Estado (recepciones.estado)
confirmada
cerrada
anulada

EstadoLinea (recepciones.items.estadoLinea)
ok
faltante
no_esta
danado
devuelto
excedente
parcial

5) pedidos_consolidados (DERIVADO MATERIALIZADO)
/apps/horarios/pedidos_consolidados/{pedidoId}
Campos
id: string
pedidoId: string
numeroPedido: string
estado: string
refs:
  remitoSalidaId: string
  recepcionId: string
resumen:
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
  cantidadRecibida: number
  cantidadPendiente: number
items: ConsolidadoItem[]
createdAt: timestamp
updatedAt: timestamp

ConsolidadoItem
productId: string
productNombre: string
cantidadPedida: number
cantidadPreparada: number
cantidadTransportada: number
cantidadRecibida: number
cantidadPendiente: number
estadoFinal: string

Estado (pedidos_consolidados.estado)
pendiente
preparado
en_transporte
recibido_parcial
recibido_completo
cerrado

6) pedidos_pendientes (DERIVADO MATERIALIZADO)
/apps/horarios/pedidos_pendientes/{pendienteId}
Campos
id: string
pedidoId: string
pedidoNumero: string
recepcionId: string
productId: string
productNombre: string
unidad: string
origenId: string
origenNombre: string
destinoId: string
destinoNombre: string
cantidadPendiente: number
estado: string
createdAt: timestamp
updatedAt: timestamp
resolvedAt: timestamp | null
resolvedBy: string | null
pedidoResolucionId: string | null

Estado (pedidos_pendientes.estado)
activo
usado_en_nuevo_pedido
resuelto
cancelado

7) audit_logs
/apps/horarios/audit_logs/{logId}
Campos
id: string
entityType: string
entityId: string
pedidoId: string
accion: string
descripcion: string
createdAt: timestamp
createdBy: string
createdByName: string
createdByEmail: string

EntityType
pedido
remito_salida
recepcion
consolidado
pendiente

Accion
created
updated
signed
confirmed
cancelled

8) counters
/apps/horarios/counters/{counterId}
Campos
id: string
prefix: string
nextNumber: number
updatedAt: timestamp

REGLAS
1. No borrar documentos de remitos ni recepciones.
2. Documento firmado no se edita.
3. Stock se actualiza solo en recepción.
4. Pendiente siempre se calcula como cantidadPedida - cantidadRecibida.
5. Consolidado siempre automático.
6. Firma siempre snapshot.
