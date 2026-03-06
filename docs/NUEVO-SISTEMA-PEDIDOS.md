Diseño del sistema nuevo
1) Principio base

No usaría más un único “pedido” intentando representar todo.

Haría 4 agregados/documentos principales:

PedidoInterno

RemitoSalida

RecepcionRemito

DevolucionRemito

Y aparte un módulo de solo lectura/efectos:

MovimientosStock

Así evitás mezclar:

lo que querías pedir

lo que realmente salió

lo que realmente llegó

lo que volvió / faltó / llegó mal

2) Qué se conserva del sistema actual

Esto se mantiene casi igual:

Stock / catálogo

productos

stock mínimo

unidad base

compra por pack o unidad

conversión pack ↔ unidad

stock actual

texto para WhatsApp

lista rápida de reposición

Pedido interno

Sigue siendo tu herramienta de trabajo diaria para armar compras o reposiciones.

Estados:

borrador

confirmado

cancelado

usado_para_remito

Ese último estado no es obligatorio, pero ayuda a trazabilidad.

3) Flujo correcto nuevo
Flujo simple

Stock / mínimos
→ Pedido interno
→ Remito de salida / despacho
→ Recepción por ítem
→ Devolución / observación
→ Archivo PDF + firma + historial

Regla clave

El pedido interno no mueve stock.
El remito y la recepción sí generan movimientos, pero siempre como resultado de documentos confirmados.

4) Documento 1: PedidoInterno

Sirve para preparar.

Campos recomendados

id

ownerId

nombre

origen

destinoSugerido

estado

fechaCreacion

fechaConfirmacion

creadoPor

observaciones

items[]

Cada item

productId

nombreSnapshot

unidadBase

modoCompra = unidad | pack

packSize = cantidad de unidades por pack

stockMinimoSnapshot

stockActualSnapshot

cantidadSugerida

cantidadAjustada

cantidadFinalPedida

observaciones

Regla

Todo snapshot.
No depender luego del producto vivo para reconstruir qué se había pedido.

5) Documento 2: RemitoSalida

Este es el documento serio.

Se genera cuando realmente se despacha mercadería o insumos.

Estados

emitido

en_transito

entregado

cerrado

anulado

Campos

id

ownerId

numeroRemito

tipo = salida

origen

destino

pedidoInternoId opcional

estado

emitidoAt

emitidoPor

transportistaNombre

transportistaDocumento

vehiculo

firmaEmisor

firmaTransportista opcional

pdfUrl

qrToken

notasGenerales

items[]

Items del remito

productId

nombreSnapshot

unidadBase

packSize

cantidadPedidaOriginal opcional

cantidadEnviada

cantidadEnviadaUnidadesBase

lote opcional

vencimiento opcional

observacionesEnvio

estadoLineaInicial = pendiente_recepcion

Regla crítica

Una vez emitido, el remito queda congelado.
No se edita. Si hubo error, se anula y se emite otro.

Eso es clave para que sea confiable y auditable.

6) Documento 3: RecepcionRemito

Este documento responde a un remito puntual.

Estados

borrador

confirmada

cerrada

Campos

id

ownerId

remitoId

numeroRemitoSnapshot

recepcionAt

recepcionadoPor

destinatario

firmaReceptor

fotoEvidenciaUrls[]

resultadoGlobal

observacionesGenerales

pdfUrl

items[]

Resultado global

total_ok

parcial

rechazada

con_observaciones

Cada item recibido

productId

nombreSnapshot

cantidadEnviada

cantidadRecibidaOk

cantidadFaltante

cantidadDanada

cantidadPendiente

cantidadDevuelta

estadoRecepcion

estadoRecepcion por item

ok

faltante

danado

rechazado

pendiente

devuelto

mixto

Observaciones por item

motivo

comentario

evidenciaUrls[]

Regla funcional importante

cantidadEnviada = cantidadRecibidaOk + cantidadFaltante + cantidadDanada + cantidadPendiente + cantidadDevuelta

No puede cerrar si esa cuenta no da.

Eso solo ya evita muchos bugs.

7) Documento 4: DevolucionRemito

No lo escondería dentro de la recepción.

Lo haría como documento independiente, aunque pueda generarse desde una recepción.

Estados

abierta

autorizada

despachada

cerrada

cancelada

Campos

id

ownerId

remitoId

recepcionId

tipoDevolucion

motivoGeneral

creadaAt

creadaPor

destinoDevolucion

pdfUrl

firmaEntrega

firmaRecepcionProveedor opcional

items[]

tipoDevolucion

a_proveedor

interna

ajuste_stock

reposicion_pendiente

Cada item

productId

nombreSnapshot

cantidad

motivo

accionEsperada

accionEsperada

reponer

cambiar

aceptar_nota_credito

descartar

reingresar_stock

Esto está alineado con procesos de retorno a proveedor y logística de devolución que documentan SAP y Oracle.

8) Movimientos de stock

No usaría el remito ni la recepción como “stock actual”.
Usaría una colección separada de movimientos.

stockMovements

Cada documento confirmado genera asientos.

Tipos:

salida_por_remito

entrada_por_recepcion

ajuste_por_danado

devolucion_a_proveedor

reingreso_por_devolucion

ajuste_manual

Campos

id

ownerId

productId

fecha

tipo

cantidad

signo = +1 | -1

unidadBase

documentType

documentId

lineId

motivo

createdBy

Regla

El stock visible puede surgir de:

snapshot materializado

o suma de movimientos

Pero la fuente de verdad documental son los movimientos derivados de documentos cerrados.

9) Colecciones Firestore sugeridas
products
pedidosInternos
remitos
recepciones
devoluciones
stockMovements
documentFiles
auditLogs
counters
counters

Para numeración de remitos:

REM-000001

por empresa / sucursal si hace falta

documentFiles

Para PDFs, firmas e imágenes vinculadas

auditLogs

Para eventos:

remito emitido

recepción confirmada

devolución creada

anulación

firma agregada

10) Reglas de negocio

Estas son las que más valor te van a dar.

Regla 1

Un remito emitido no se edita.

Regla 2

Una recepción siempre referencia a un remito existente.

Regla 3

Una recepción no puede registrar más cantidad total clasificada que la enviada.

Regla 4

Si hay faltante, dañado o pendiente, el resultado global no puede ser total_ok.

Regla 5

La devolución nace de una recepción o remito concreto, nunca “suelta”.

Regla 6

Los movimientos de stock se crean solo al confirmar un documento.

Regla 7

Toda firma y PDF se archivan como snapshot inalterable.

Regla 8

Toda operación crítica debe correr en runTransaction o writeBatch.

11) Pantallas del sistema nuevo
A. Pantalla actual que conservás

/dashboard/pedidos

productos

mínimos

unidad/pack

sugerencia de pedido

copiar a WhatsApp

guardar pedido interno

B. Nueva pantalla: Emitir Remito

/dashboard/remitos/nuevo

seleccionar pedido interno opcional

ajustar cantidades realmente enviadas

completar origen/destino

transportista

observaciones

emitir remito

generar PDF

QR

C. Nueva pantalla: Ver Remito

/dashboard/remitos/[id]

detalle congelado

PDF

firma

QR

historial

estado

D. Nueva pantalla: Recepcionar Remito

/dashboard/recepciones/nueva?remito=...

escanear QR o abrir remito

por cada item:

recibido OK

faltante

dañado

pendiente

devuelto

comentario

foto

firma receptor

confirmar recepción

E. Nueva pantalla: Devoluciones

/dashboard/devoluciones/nueva?recepcion=...

prellenada con ítems observados

motivo

destino

acción esperada

emitir documento

F. Archivo / biblioteca

/dashboard/documentos-logistica

filtros por remito, recepción, devolución, estado, fecha, proveedor, sucursal

12) Qué haría primero

No iría por todo de una.

Fase 1

conservar pedidos actuales

crear PedidoInterno bien tipado

crear RemitoSalida nuevo

generar PDF + QR

sin flujo público todavía

Fase 2

crear RecepcionRemito

diferencias por item

firma + evidencias

movimiento de stock automático

Fase 3

crear DevolucionRemito

archivo histórico

reportes

Fase 4

enlace público / QR externo

aprobación externa

firma externa más robusta

13) Mi recomendación práctica sobre confiabilidad

Para vos, hoy lo confiable es:

catálogo de productos

mínimos

pack/unidad

preparación del pedido

copia para WhatsApp

Lo no confiable todavía es:

flujo documental completo de remitos/recepciones

Entonces la refactorización no debería ser “arreglar todo lo viejo”.
Debería ser:

encapsular lo útil
y
reemplazar el flujo documental con una arquitectura nueva y cerrada