# LOGISTICS V2 Backend Contract (controlfile)

## Scope
Contrato funcional/técnico para implementar Logística V2 en backend `controlfile` (Firebase Admin).

Regla principal: el frontend no ejecuta operaciones críticas; solo consume endpoints HTTP.

## 1) Endpoints definitivos

### Write
- `POST /api/logistics/v2/pedidos-internos`
- `POST /api/logistics/v2/remitos-salida/emitir`
- `POST /api/logistics/v2/recepciones/confirmar`
- `POST /api/logistics/v2/devoluciones/crear`

### Read
- `GET /api/logistics/v2/remitos/:id`
- `GET /api/logistics/v2/recepciones/:id`
- `GET /api/logistics/v2/devoluciones/:id`
- `GET /api/logistics/v2/documentos`

## 2) Request / Response exactos

## 2.1 Headers comunes

### Requeridos (write)
- `Authorization: Bearer <firebase-id-token>`
- `x-idempotency-key: <string>`
- `x-request-id: <string>`

### Opcionales (read)
- `Authorization: Bearer <firebase-id-token>` (requerido para seguridad de negocio)
- `x-request-id: <string>`

## 2.2 POST /pedidos-internos

### Request body (exacto)
```ts
{
  ownerId: string
  branchId: string
  creadoPor: string
  origen: string
  destinoSugerido?: string
  observaciones?: string
  items: Array<{
    id: string
    productId: string
    nombreSnapshot: string
    unidadBaseSnapshot: string
    packSizeSnapshot?: number
    stockMinimoSnapshot: number
    stockActualSnapshot: number
    cantidadSugerida: number
    cantidadAjustada?: number
    cantidadFinalPedida: number
    observaciones?: string
  }>
}
```

### Response 201 (exacta)
```ts
{
  pedidoInterno: {
    id: string
    ownerId: string
    branchId: string
    estado: "borrador" | "confirmado" | "cancelado" | "usado_para_remito"
    createdAt: string
    confirmadoAt?: string
    creadoPor: string
    origen: string
    destinoSugerido?: string
    observaciones?: string
    items: PedidoInternoItem[]
  }
  correlationId: string
}
```

## 2.3 POST /remitos-salida/emitir

### Request body (exacto)
```ts
{
  ownerId: string
  branchId: string
  pedidoInternoId?: string
  origen: string
  destino: string
  transportista: string
  vehiculo?: string
  items: Array<{
    productId: string
    cantidadEnviadaUnidadesBase: number
    observacionesEnvio?: string
  }>
  metadata?: Record<string, string>
}
```

### Response 201 (exacta)
```ts
{
  remito: {
    id: string
    ownerId: string
    branchId: string
    numeroRemito: string
    estado: "emitido" | "en_transito" | "entregado" | "cerrado" | "anulado"
    emitidoAt: string
    emitidoPor: string
    origen: string
    destino: string
    transportista: string
    vehiculo?: string
    pedidoInternoId?: string
    pdfFileId?: string
    qrToken?: string
    firmaEmisorFileId?: string
    firmaTransportistaFileId?: string
    itemsSnapshot: Array<{
      id: string
      productId: string
      nombreSnapshot: string
      unidadBaseSnapshot: string
      packSizeSnapshot?: number
      cantidadPedidaOriginal?: number
      cantidadEnviada: number
      cantidadEnviadaUnidadesBase: number
      lote?: string
      vencimiento?: string
      observacionesEnvio?: string
    }>
  }
  correlationId: string
}
```

## 2.4 POST /recepciones/confirmar

### Request body (exacto)
```ts
{
  ownerId: string
  branchId: string
  remitoSalidaId: string
  recepcionadoPor: string
  resultadoGlobal: "total_ok" | "parcial" | "rechazada" | "con_observaciones"
  observacionesGenerales?: string
  items: Array<{
    productId: string
    cantidadRecibidaOk: number
    cantidadFaltante: number
    cantidadDanada: number
    cantidadPendiente: number
    cantidadDevuelta: number
    estadoRecepcion: "ok" | "faltante" | "danado" | "rechazado" | "pendiente" | "devuelto" | "mixto"
    comentario?: string
  }>
}
```

### Response 201 (exacta)
```ts
{
  recepcion: {
    id: string
    ownerId: string
    branchId: string
    remitoSalidaId: string
    numeroRemitoSnapshot: string
    estado: "borrador" | "confirmada" | "cerrada"
    recepcionAt: string
    recepcionadoPor: string
    firmaReceptorFileId?: string
    evidenciasFileIds?: string[]
    resultadoGlobal: "total_ok" | "parcial" | "rechazada" | "con_observaciones"
    observacionesGenerales?: string
    items: Array<{
      id: string
      productId: string
      nombreSnapshot: string
      cantidadEnviada: number
      cantidadRecibidaOk: number
      cantidadFaltante: number
      cantidadDanada: number
      cantidadPendiente: number
      cantidadDevuelta: number
      estadoRecepcion: "ok" | "faltante" | "danado" | "rechazado" | "pendiente" | "devuelto" | "mixto"
      motivo?: string
      comentario?: string
      evidenciaFileIds?: string[]
    }>
  }
  correlationId: string
}
```

## 2.5 POST /devoluciones/crear

### Request body (exacto)
```ts
{
  ownerId: string
  branchId: string
  remitoSalidaId: string
  recepcionRemitoId?: string
  tipoDevolucion: "a_proveedor" | "interna" | "ajuste_stock" | "reposicion_pendiente"
  motivoGeneral: string
  creadaPor: string
  destinoDevolucion: string
  items: Array<{
    productId: string
    cantidad: number
    motivo: string
    accionEsperada: "reponer" | "cambiar" | "aceptar_nota_credito" | "descartar" | "reingresar_stock"
  }>
}
```

### Response 201 (exacta)
```ts
{
  devolucion: {
    id: string
    ownerId: string
    branchId: string
    remitoSalidaId: string
    recepcionRemitoId?: string
    estado: "abierta" | "autorizada" | "despachada" | "cerrada" | "cancelada"
    tipoDevolucion: "a_proveedor" | "interna" | "ajuste_stock" | "reposicion_pendiente"
    motivoGeneral: string
    creadaAt: string
    creadaPor: string
    destinoDevolucion: string
    items: Array<{
      id: string
      productId: string
      nombreSnapshot: string
      cantidad: number
      motivo: string
      accionEsperada: "reponer" | "cambiar" | "aceptar_nota_credito" | "descartar" | "reingresar_stock"
    }>
    pdfFileId?: string
    firmaEntregaFileId?: string
    firmaRecepcionProveedorFileId?: string
  }
  correlationId: string
}
```

## 2.6 GET /remitos/:id

### Response 200 (exacta)
`RemitoSalida` (sin wrapper)

## 2.7 GET /recepciones/:id

### Response 200 (exacta)
`RecepcionRemito` (sin wrapper)

## 2.8 GET /devoluciones/:id

### Query params
- `ownerId` (opcional pero recomendado)
- `branchId` (opcional)

### Response 200 (exacta)
`DevolucionRemito` (sin wrapper)

## 2.9 GET /documentos

### Query params (exactos)
- `ownerId: string` (requerido)
- `branchId?: string`
- `tipo?: "remito" | "recepcion" | "devolucion"`
- `estado?: string`
- `from?: string` (ISO)
- `to?: string` (ISO)
- `page?: number` (default 1)
- `pageSize?: number` (default 50, max 200)

### Response 200 (exacta)
```ts
{
  items: Array<RemitoSalida | RecepcionRemito | DevolucionRemito>
  total: number
}
```

## 3) Validaciones backend

Regla general: validar payload, pertenencia `ownerId/branchId`, estado de documentos y compatibilidad de unidades antes de escribir.

## 3.1 Comunes
- Token Firebase válido.
- Usuario autenticado autorizado para `ownerId/branchId`.
- `ownerId` y `branchId` obligatorios en writes.
- `items.length > 0` en writes.
- Rechazar números negativos o cero donde aplique.
- Rechazar campos string vacíos en identificadores críticos.

## 3.2 Remito emitir
- `origen`, `destino`, `transportista` requeridos.
- Para cada ítem: `cantidadEnviadaUnidadesBase > 0`.
- `productId` debe existir y pertenecer a `ownerId`.
- Si viene `pedidoInternoId`, validar pertenencia y estado permitido.
- Construir `itemsSnapshot` desde catálogo actual (no confiar snapshots del cliente).

## 3.3 Recepción confirmar
- `remitoSalidaId` debe existir, pertenecer a owner/branch, no anulado.
- No permitir doble confirmación de recepción para el mismo remito si modelo es 1:1.
- Cada item de recepción debe mapear a item enviado.
- Balance por ítem obligatorio:
  - `cantidadRecibidaOk + cantidadFaltante + cantidadDanada + cantidadPendiente + cantidadDevuelta == cantidadEnviada`.
- Si hay faltante/dañado/pendiente, `resultadoGlobal != total_ok`.

## 3.4 Devolución crear
- `remitoSalidaId` requerido y existente.
- `recepcionRemitoId` opcional, pero si existe debe corresponder al mismo remito.
- `cantidad > 0` por item.
- `motivoGeneral` y `motivo` por item obligatorios.
- `accionEsperada` dentro del enum.
- Evitar doble impacto de stock por misma devolución + ítem + idempotency key.

## 4) Transacciones Firestore necesarias

Implementar con `runTransaction` en Firebase Admin.

## 4.1 `POST /remitos-salida/emitir`
Transacción única:
- Leer/validar `counters/{owner_branch_year}`.
- Incrementar secuencia remito.
- Crear `remitos_salida/{id}` con snapshot inmutable.
- Actualizar estado de `pedido_interno` (si aplica).
- Crear `audit_logs` mínimo de emisión.

Nota: si generación de PDF/firma es asíncrona, el documento se crea en transacción y luego se adjunta `pdfFileId` con write controlado por backend.

## 4.2 `POST /recepciones/confirmar`
Transacción única:
- Leer `remitos_salida/{id}` + validar estado.
- Verificar no confirmada previamente (o versionado optimista).
- Crear `recepciones_remito/{id}`.
- Crear `stock_movements_v2` de entrada por ítem confirmado.
- Actualizar estado de remito (por ejemplo `entregado`/`cerrado`, según regla de negocio).
- Crear `audit_logs`.

## 4.3 `POST /devoluciones/crear`
Transacción única cuando impacta stock:
- Leer remito/recepción origen.
- Crear `devoluciones_remito/{id}`.
- Crear `stock_movements_v2` correspondientes según `tipoDevolucion`.
- Crear `audit_logs`.

## 4.4 `POST /pedidos-internos`
Puede ser write simple; usar transacción si se necesita garantizar unicidad de nombre o secuencia interna.

## 5) Manejo de idempotency-key

## 5.1 Política
- Obligatorio en endpoints write.
- Ventana de deduplicación recomendada: 24h.
- Scope de idempotencia: `ownerId + endpoint + x-idempotency-key`.

## 5.2 Almacenamiento
Colección recomendada: `apps/horarios/idempotency_keys/{scopeHash}` con:
- `ownerId`, `branchId`, `endpoint`, `idempotencyKey`, `requestHash`, `status`, `responseSnapshot`, `resourceId`, `createdAt`, `expiresAt`, `correlationId`.

## 5.3 Reglas
- Si misma key + mismo hash: devolver misma respuesta (200/201 idempotente).
- Si misma key + hash distinto: `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- Si request en curso para esa key: `409 IDEMPOTENCY_IN_PROGRESS`.

## 6) Manejo de correlationId

## 6.1 Entrada
- Si llega `x-request-id`, usarlo como `correlationId`.
- Si no llega, generar UUID v4.

## 6.2 Salida
- Incluir en body de todos los POST según contrato existente.
- Incluir header `x-correlation-id` en todas las respuestas (GET y POST, éxito/error).

## 6.3 Uso
- Persistir en `audit_logs`.
- Incluir en `ApiError`.
- Usar para trazar request -> transacción -> archivos -> auditoría.

## 7) Estructura de auditoría

Colección: `apps/horarios/audit_logs`

Documento mínimo:
```ts
{
  id: string
  ownerId: string
  branchId: string
  action: string
  documentType?: string
  documentId?: string
  actorId: string
  actorEmail?: string
  correlationId: string
  beforeHash?: string
  afterHash?: string
  createdAt: string
  metadata?: Record<string, string>
}
```

Acciones sugeridas:
- `pedido_interno_creado`
- `remito_emitido`
- `recepcion_confirmada`
- `devolucion_creada`
- `archivo_vinculado`

## 8) Estrategia de numeración de remitos

## 8.1 Formato
`REM-{BRANCH}-{YYYY}-{NNNNNN}`

Ejemplo: `REM-SUC01-2026-000123`

## 8.2 Counter
Colección: `apps/horarios/counters`
- key: `remito_{ownerId}_{branchId}_{year}`
- campos: `ownerId`, `branchId`, `year`, `nextValue`, `updatedAt`

## 8.3 Garantía
- Incremento dentro de transacción de emisión.
- Nunca recalcular fuera de transacción.
- No reutilizar números ante rollback lógico; si se reservó número, queda consumido.

## 9) Archivos PDF / firmas / evidencias

## 9.1 Almacenamiento
- Binarios en Cloud Storage (ruta por owner/branch/documento).
- Metadata en `apps/horarios/document_files`.

## 9.2 Metadata mínima
```ts
{
  id: string
  ownerId: string
  branchId: string
  documentType: "remito_salida" | "recepcion_remito" | "devolucion_remito" | "ajuste_manual"
  documentId: string
  fileType: "pdf" | "signature" | "evidence"
  storagePath: string
  checksum?: string
  metadata?: Record<string, string>
  createdAt: string
  createdBy: string
}
```

## 9.3 Regla operativa
- El backend genera/sube y vincula archivos.
- El frontend no escribe `document_files` directo.
- Vínculos (`pdfFileId`, `firma*FileId`, `evidenciasFileIds`) se actualizan solo por backend.

## 10) Errores estándar del API

Formato único:
```ts
{
  code: string
  message: string
  details?: unknown
  correlationId?: string
}
```

## 10.1 Tabla de errores recomendada
- `400 VALIDATION_ERROR`: payload inválido.
- `400 INVALID_STATE_TRANSITION`: transición de estado no permitida.
- `401 UNAUTHENTICATED`: token ausente/inválido.
- `403 FORBIDDEN_OWNER_BRANCH`: actor sin permiso sobre owner/branch.
- `404 DOCUMENT_NOT_FOUND`: remito/recepción/devolución no existe.
- `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- `409 IDEMPOTENCY_IN_PROGRESS`.
- `409 DOCUMENT_ALREADY_CONFIRMED`: doble confirmación.
- `409 REMITO_NUMBER_CONFLICT`: conflicto de numeración.
- `422 UNIT_PACK_MISMATCH`: inconsistencia unidad/pack.
- `500 INTERNAL_ERROR`: error no controlado.

## 10.2 Respuesta de error
Siempre incluir `x-correlation-id` y `correlationId` en body.

## Colecciones esperadas (backend)
- `apps/horarios/pedidos_internos`
- `apps/horarios/remitos_salida`
- `apps/horarios/recepciones_remito`
- `apps/horarios/devoluciones_remito`
- `apps/horarios/stock_movements_v2`
- `apps/horarios/document_files`
- `apps/horarios/audit_logs`
- `apps/horarios/counters`
- `apps/horarios/idempotency_keys`

## Compatibilidad con frontend ya implementado
- Mantener exactos los body de `POST` y respuestas actuales usadas por `hooks/use-logistics-v2.ts`.
- En `GET` por id, responder objeto plano (`RemitoSalida`, `RecepcionRemito`, `DevolucionRemito`) sin wrapper.
- En `GET /documentos`, responder `{ items, total }`.

