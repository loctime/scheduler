1. Estructura Firestore exacta
Colecciones principales

Dentro de /apps/horarios/:

/apps/horarios/products
/apps/horarios/pedidos
/apps/horarios/remitos_salida
/apps/horarios/remitos_transporte
/apps/horarios/recepciones
/apps/horarios/pedidos_consolidados
/apps/horarios/pedidos_pendientes
/apps/horarios/firmas_config
/apps/horarios/audit_logs
/apps/horarios/counters
Qué hace cada una
products

Ya existe o es equivalente a lo actual.
Queda para:

catálogo
stock mínimo
unidad
stock actual
orden
metadatos del producto
pedidos

Documento inicial.
Representa lo que una sucursal pidió.

remitos_salida

Documento del armado.
Lo crea quien prepara el pedido.

remitos_transporte

Documento del delivery.
Representa lo que efectivamente sale transportado.

recepciones

Documento de recepción final.
Lo crea quien recibe.

pedidos_consolidados

Documento derivado, solo lectura.
Resume pedido + salida + transporte + recepción.

pedidos_pendientes

Saldo pendiente por pedido y producto.
Sirve para arrastrar faltantes al próximo ciclo.

firmas_config

Configuración de firma del usuario.
Ya tienen algo parecido; esto puede mapearse o reutilizarse.

audit_logs

Historial de eventos.
No reemplaza documentos; registra acciones.

counters

Para numeración humana:

PED-000001
RS-000001
RT-000001
REC-000001
2. Modelo de documentos
A. /apps/horarios/pedidos/{pedidoId}

Este es el documento base.

Campos
id
numeroPedido
estado
origenTipo
origenId
origenNombre
destinoTipo
destinoId
destinoNombre
createdAt
createdBy
createdByName
createdByEmail
updatedAt
observaciones
stockSnapshotVersion opcional
usaPendientes boolean
pedidoOrigenPendienteIds []
totales
items []
estado

Valores:

pendiente
preparado
en_transporte
recibido
cerrado
cancelado
items[]

Cada item debe llevar snapshot, no depender del producto vivo.

itemId
productId
productNombreSnapshot
unidadSnapshot
stockMinimoSnapshot
stockActualSnapshot
cantidadPedida
cantidadSugerida
cantidadManual
observaciones
totales

Puede guardar algo simple:

cantidadItems
cantidadTotalPedida
cantidadPendienteFinal
B. /apps/horarios/remitos_salida/{remitoSalidaId}

Documento del armado real.

Campos
id
numeroRemitoSalida
pedidoId
pedidoNumeroSnapshot
estado
origenTipo
origenId
origenNombre
destinoTipo
destinoId
destinoNombre
createdAt
createdBy
createdByName
createdByEmail
observacionesGenerales
firma
totales
items []
estado
emitido
anulado
firma

Snapshot, no referencia viva:

firmado
firmadoAt
firmadoBy
firmadoByName
firmadoByEmail
firmaImageUrl o firmaData
firmaTexto opcional
items[]
itemId
pedidoItemId
productId
productNombreSnapshot
unidadSnapshot
cantidadPedida
cantidadPreparada
estadoLinea
motivo
observaciones
estadoLinea
ok
parcial
no_hay
reemplazado
cancelado
C. /apps/horarios/remitos_transporte/{remitoTransporteId}

Documento del delivery.

Campos
id
numeroRemitoTransporte
pedidoId
remitoSalidaId
pedidoNumeroSnapshot
remitoSalidaNumeroSnapshot
estado
origenTipo
origenId
origenNombre
destinoTipo
destinoId
destinoNombre
transportistaId
transportistaNombre
transportistaEmail
vehiculoId opcional
vehiculoDescripcion opcional
createdAt
createdBy
createdByName
createdByEmail
observacionesGenerales
firma
totales
items []
estado
emitido
entregado
anulado
items[]
itemId
pedidoItemId
remitoSalidaItemId
productId
productNombreSnapshot
unidadSnapshot
cantidadPreparada
cantidadTransportada
estadoLinea
motivo
observaciones
estadoLinea
ok
parcial
no_cargado
ajustado
perdido
D. /apps/horarios/recepciones/{recepcionId}

Documento de recepción.

Campos
id
numeroRecepcion
pedidoId
remitoSalidaId
remitoTransporteId
pedidoNumeroSnapshot
remitoSalidaNumeroSnapshot
remitoTransporteNumeroSnapshot
estado
origenTipo
origenId
origenNombre
destinoTipo
destinoId
destinoNombre
createdAt
createdBy
createdByName
createdByEmail
observacionesGenerales
firma
evidencias []
totales
items []
estado
confirmada
cerrada
anulada
evidencias[]

Aunque hoy no las implementes, dejá el campo listo:

evidenciaId
tipo
url
comentario
createdAt
createdBy
items[]

Acá está la parte fuerte.

itemId
pedidoItemId
remitoSalidaItemId
remitoTransporteItemId
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
estadoLinea
motivo
observaciones
evidencias []
estadoLinea
ok
faltante
no_esta
danado
devuelto
excedente
parcial
rechazado
regla importante

cantidadPendiente debe salir de una cuenta clara:

cantidadPendiente = max(0, cantidadPedida - cantidadRecibida)

Si querés ser más estricto contra transporte:

cantidadPendiente = max(0, cantidadTransportada - cantidadRecibida)
