FLUJO BLINDADO Y SIMPLE

PRINCIPIO
El sistema se basa en documentos inmutables por etapa, no en un único pedido editable.

RELACION LOGICA Y COLECCIONES
Pedido -> /apps/horarios/pedidos
RemitoSalida (armado + transporte) -> /apps/horarios/remitos_salida
Recepcion -> /apps/horarios/recepciones
Consolidado (derivado materializado) -> /apps/horarios/pedidos_consolidados
Pendientes (derivado materializado) -> /apps/horarios/pedidos_pendientes
AuditLog -> /apps/horarios/audit_logs
Counter -> /apps/horarios/counters
Products -> /apps/horarios/products

ENTIDADES MINIMAS
1. Pedido
2. RemitoSalida (armado + transporte)
3. Recepcion
4. Consolidado (derivado materializado)
5. Pendientes (derivado materializado)

ACTORES
Sucursal solicitante
Origen (fábrica o sucursal origen)
Transportista
Destino (sucursal receptora)

FLUJO PASO A PASO
1. Crear pedido
- Actor: sucursal
- Documento: Pedido
- Coleccion: /apps/horarios/pedidos
- Estado: pendiente

2. Armado y transporte
- Actor: origen
- Acciones: confirma cantidades, marca no hay o parcial, agrega observaciones
- Documento generado: RemitoSalida
- Coleccion: /apps/horarios/remitos_salida
- Firma emisor: obligatoria
- Estado del pedido: preparado

3. Confirmación de transporte
- Actor: transportista
- Acciones: confirma cantidades transportadas y entrega
- Documento afectado: RemitoSalida
- Coleccion: /apps/horarios/remitos_salida
- Firma transportista: obligatoria
- Estado del pedido: en_transporte

4. Recepción
- Actor: destino
- Acciones: confirma cantidades recibidas, marca faltantes, no está, dañado, excedente o devolución
- Documento generado: Recepcion
- Coleccion: /apps/horarios/recepciones
- Estado del pedido: recibido

5. Consolidado
- Documento derivado automático
- Coleccion: /apps/horarios/pedidos_consolidados
- Resumen de pedido, salida y recepción

6. Pendientes
- Regla: pendiente = cantidadPedida - cantidadRecibida
- Coleccion: /apps/horarios/pedidos_pendientes
- Si pendiente > 0, se guarda como reutilizable

REGLAS BLINDADAS
1. Documentos inmutables una vez confirmados.
2. No borrar remitos ni recepciones.
3. Cada actor edita solo su etapa.
4. Stock solo se actualiza en recepción.
5. Firma siempre snapshot.
6. Consolidado siempre derivado y materializado.
7. Trazabilidad completa por documento.

MODELO DE DATOS SIMPLE
Pedido
- id
- estado
- productos[]

RemitoSalida
- pedidoId
- productos[]
- firmaEmisor
- firmaTransportista
- fecha

Recepcion
- remitoSalidaId
- productos[]
- firmaReceptor
- fecha

Pendientes
- productoId
- cantidad
- pedidoOrigenId

CONSOLIDADO
/apps/horarios/pedidos_consolidados/{pedidoId}
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
recepcionRef
resumen
items[]

EstadoGeneral
pendiente
preparado
en_transporte
recibido_parcial
recibido_completo
cerrado
cancelado

Resumen
cantidadItems
cantidadPedidaTotal
cantidadPreparadaTotal
cantidadTransportadaTotal
cantidadRecibidaTotal
cantidadPendienteTotal
cantidadDevueltaTotal
cantidadDanadaTotal

Items[]
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

PENDIENTES
/apps/horarios/pedidos_pendientes/{pendienteId}
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
resolvedAt
resolvedBy
pedidoResolucionId

Estado
activo
usado_en_nuevo_pedido
resuelto
cancelado

AUDIT_LOGS
/apps/horarios/audit_logs/{logId}
Campos
id
entityType
entityId
pedidoId
accion
descripcion
payloadResumen
createdAt
createdBy
createdByName
createdByEmail

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
closed
generated_consolidado
generated_pendiente

COUNTERS
/apps/horarios/counters/{counterId}
IDs
pedido
remito_salida
recepcion
Campos
nextNumber
prefix
updatedAt

RELACIONES
Pedido -> RemitoSalida -> Recepcion
Pedido -> Consolidado
Recepcion -> Pendientes

REGLAS DE NEGOCIO
1. El pedido es editable solo antes del remito de salida.
2. RemitoSalida y Recepcion son inmutables tras confirmación.
3. El stock se actualiza solo al confirmar recepción.
4. Cada etapa firma su documento.
5. El consolidado se recalcula automáticamente y se materializa.
6. Todo faltante real genera pendiente materializado.
7. Los pendientes se pueden arrastrar a un nuevo pedido bajo control explícito.

CALCULO DE PENDIENTES
Opcion A
pendiente = cantidadPedida - cantidadRecibida

Opcion B
pendiente = cantidadTransportada - cantidadRecibida

Recomendacion
Guardar ambas métricas internas:
- cantidadNoPreparada = max(0, cantidadPedida - cantidadPreparada)
- cantidadNoTransportada = max(0, cantidadPreparada - cantidadTransportada)
- cantidadNoRecibida = max(0, cantidadTransportada - cantidadRecibida)
- cantidadPendienteFinal = max(0, cantidadPedida - cantidadRecibida)

El pendiente reutilizable se calcula desde cantidadPendienteFinal.

ESTADOS POR DOCUMENTO
Pedido
pendiente
preparado
en_transporte
recibido
cerrado
cancelado

RemitoSalida
emitido
en_transito
entregado
cerrado
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

FLUJO EXACTO DE ESCRITURA
Paso 1
/pedidos
/audit_logs

Paso 2
/remitos_salida
/pedidos.estado = preparado
/audit_logs

Paso 3
/remitos_salida (transporte)
/pedidos.estado = en_transporte
/audit_logs

Paso 4
/recepciones
/products (stock)
/pedidos_pendientes
/pedidos.estado = recibido o cerrado
/pedidos_consolidados
/audit_logs

INDICES RECOMENDADOS
pedidos
- destinoId + createdAt desc
- estado + createdAt desc
- origenId + createdAt desc

remitos_salida
- pedidoId
- createdAt desc

recepciones
- pedidoId
- createdAt desc

pedidos_pendientes
- destinoId + estado
- productId + estado
- pedidoId

MIGRACION DESDE LEGACY
Fase 0
Deshabilitar generación legacy de remitos, recepción y consolidado.

Fase 1
Mantener activos productos, cálculo de pedido, stock actual y configuración de firma.

Fase 2
Crear nuevas colecciones documentales.

Fase 3
Ampliar pedidos existentes con campos nuevos sin romper compatibilidad.

Fase 4
Reutilizar firmas configuradas como snapshot al firmar documentos nuevos.

Fase 5
Mantener legacy en modo consulta.

Fase 6
Decidir archivado o limpieza de datos legacy.

ESTRUCTURA DE CODIGO RECOMENDADA
src/modules/pedidos-v2/
- domain/types.ts
- domain/enums.ts
- domain/rules.ts
- infrastructure/firestore-pedidos-repository.ts
- infrastructure/firestore-remitos-salida-repository.ts
- infrastructure/firestore-recepciones-repository.ts
- infrastructure/firestore-consolidados-repository.ts
- infrastructure/firestore-pendientes-repository.ts
- application/create-pedido.ts
- application/create-remito-salida.ts
- application/confirm-recepcion.ts
- application/rebuild-consolidado.ts
- application/resolve-pendientes.ts

COLECCIONES EN CODIGO
/apps/horarios/products
/apps/horarios/pedidos
/apps/horarios/remitos_salida
/apps/horarios/recepciones
/apps/horarios/pedidos_consolidados
/apps/horarios/pedidos_pendientes
/apps/horarios/audit_logs
/apps/horarios/counters
