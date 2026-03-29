OBJETIVO
Definir el sistema documental de pedidos y remitos con trazabilidad por etapa, firma por actor y consolidado derivado.

RELACION LOGICA Y COLECCIONES
Pedido -> /apps/horarios/pedidos
RemitoSalida (armado + transporte) -> /apps/horarios/remitos_salida
Recepcion -> /apps/horarios/recepciones
Consolidado (derivado materializado) -> /apps/horarios/pedidos_consolidados
Pendientes (derivado materializado) -> /apps/horarios/pedidos_pendientes
AuditLog -> /apps/horarios/audit_logs
Counter -> /apps/horarios/counters
Products -> /apps/horarios/products

ENTIDADES
Pedido
RemitoSalida
Recepcion
Consolidado
Pendiente
AuditLog
Counter
Products

PRINCIPIOS
1. El sistema opera por documentos inmutables por etapa.
2. Cada actor registra su propia etapa.
3. El stock se actualiza solo en recepción.
4. La firma es un snapshot del momento de la confirmación.
5. El consolidado es derivado y no editable.
6. El pendiente es obligatorio cuando hay faltantes.

RESPONSABILIDADES POR ACTOR
Sucursal
- Crea el pedido.
- Define productos y cantidades.

Origen (fábrica o sucursal origen)
- Emite remito de salida.
- Firma el remito de salida.

Transportista
- Confirma transporte dentro del remito de salida.
- Firma como transportista.

Destino
- Confirma recepción.
- Registra diferencias y devoluciones.
- Firma la recepción.

REGLAS DE NEGOCIO
1. El pedido es editable solo antes del remito de salida.
2. RemitoSalida y Recepcion no se editan luego de confirmados.
3. Ante errores se anula o se genera un documento nuevo, sin sobrescribir históricos.
4. El stock se actualiza solo al confirmar recepción.
5. Cada etapa debe quedar firmada por su actor.
6. El consolidado se recalcula automáticamente y se materializa.
7. Todo faltante genera pendiente reutilizable y se materializa.

INVARIANTES
1. Documento firmado implica congelamiento del contenido.
2. No se borran remitos ni recepciones.
3. Cada actor solo modifica su etapa.
4. Pendiente = cantidadPedida - cantidadRecibida.
5. Consolidado siempre automático.

RELACIONES ENTRE DOCUMENTOS
Pedido
- remitoSalidaId
- recepcionId

RemitoSalida
- pedidoId

Recepcion
- pedidoId
- remitoSalidaId

Consolidado
- pedidoId

Pendiente
- pedidoId
- recepcionId
- productId

FIRMAS
- Se registran como snapshot con nombre, email, firma y fecha.
- No dependen de configuraciones futuras.

AUDITORIA
- audit_logs registra acciones por entidad y evento.
- No reemplaza los documentos principales.

NUMERACION
- counters mantiene prefijos y nextNumber para PED, RS y REC.
