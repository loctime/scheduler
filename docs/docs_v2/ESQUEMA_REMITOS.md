📦 BASE PATH
/apps/horarios/
1. 📁 products
/apps/horarios/products/{productId}
{
  "id": "string",
  "nombre": "string",
  "unidad": "string",
  "stockMinimo": 0,
  "stockActual": 0,
  "orden": 0,

  "activo": true,

  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
2. 📁 pedidos
/apps/horarios/pedidos/{pedidoId}
{
  "id": "string",
  "numeroPedido": "PED-000001",

  "estado": "pendiente", 
  // pendiente | preparado | en_transporte | recibido | cerrado | cancelado

  "origen": {
    "tipo": "fabrica", 
    "id": "string",
    "nombre": "string"
  },

  "destino": {
    "tipo": "sucursal",
    "id": "string",
    "nombre": "string"
  },

  "usaPendientes": false,
  "pedidoOrigenPendienteIds": [],

  "remitoSalidaId": null,
  "remitoTransporteId": null,
  "recepcionId": null,

  "observaciones": "",

  "items": [
    {
      "itemId": "string",
      "productId": "string",
      "productNombre": "string",
      "unidad": "string",

      "stockMinimo": 0,
      "stockActual": 0,

      "cantidadPedida": 0,
      "cantidadSugerida": 0,
      "cantidadManual": 0,

      "observaciones": ""
    }
  ],

  "totales": {
    "items": 0,
    "cantidadPedida": 0,
    "cantidadPendienteFinal": 0
  },

  "createdAt": "timestamp",
  "createdBy": "userId",
  "createdByName": "string",
  "createdByEmail": "string",

  "updatedAt": "timestamp"
}
3. 📁 remitos_salida (ARMADO)
/apps/horarios/remitos_salida/{remitoSalidaId}
{
  "id": "string",
  "numero": "RS-000001",

  "pedidoId": "string",
  "pedidoNumero": "PED-000001",

  "estado": "emitido", 
  // emitido | anulado

  "origen": {
    "id": "string",
    "nombre": "string"
  },

  "destino": {
    "id": "string",
    "nombre": "string"
  },

  "items": [
    {
      "itemId": "string",
      "pedidoItemId": "string",

      "productId": "string",
      "productNombre": "string",
      "unidad": "string",

      "cantidadPedida": 0,
      "cantidadPreparada": 0,

      "estadoLinea": "ok",
      // ok | parcial | no_hay | cancelado

      "motivo": "",
      "observaciones": ""
    }
  ],

  "totales": {
    "cantidadPedida": 0,
    "cantidadPreparada": 0
  },

  "observaciones": "",

  "firma": {
    "firmado": true,
    "firmadoAt": "timestamp",
    "firmadoBy": "userId",
    "firmadoByName": "string",
    "firmadoByEmail": "string",
    "firmaData": "string"
  },

  "createdAt": "timestamp",
  "createdBy": "userId",
  "createdByName": "string",
  "createdByEmail": "string"
}
4. 📁 remitos_transporte (DELIVERY)
/apps/horarios/remitos_transporte/{remitoTransporteId}
{
  "id": "string",
  "numero": "RT-000001",

  "pedidoId": "string",
  "remitoSalidaId": "string",

  "pedidoNumero": "PED-000001",
  "remitoSalidaNumero": "RS-000001",

  "estado": "emitido", 
  // emitido | entregado | anulado

  "transportista": {
    "id": "string",
    "nombre": "string",
    "email": "string"
  },

  "items": [
    {
      "itemId": "string",
      "pedidoItemId": "string",
      "remitoSalidaItemId": "string",

      "productId": "string",
      "productNombre": "string",
      "unidad": "string",

      "cantidadPreparada": 0,
      "cantidadTransportada": 0,

      "estadoLinea": "ok",
      // ok | parcial | no_cargado | ajustado | perdido

      "motivo": "",
      "observaciones": ""
    }
  ],

  "totales": {
    "cantidadPreparada": 0,
    "cantidadTransportada": 0
  },

  "observaciones": "",

  "firma": {
    "firmado": true,
    "firmadoAt": "timestamp",
    "firmadoBy": "userId",
    "firmadoByName": "string",
    "firmadoByEmail": "string",
    "firmaData": "string"
  },

  "createdAt": "timestamp",
  "createdBy": "userId",
  "createdByName": "string",
  "createdByEmail": "string"
}
5. 📁 recepciones
/apps/horarios/recepciones/{recepcionId}
{
  "id": "string",
  "numero": "REC-000001",

  "pedidoId": "string",
  "remitoSalidaId": "string",
  "remitoTransporteId": "string",

  "pedidoNumero": "PED-000001",
  "remitoSalidaNumero": "RS-000001",
  "remitoTransporteNumero": "RT-000001",

  "estado": "confirmada", 
  // confirmada | cerrada | anulada

  "items": [
    {
      "itemId": "string",
      "pedidoItemId": "string",

      "productId": "string",
      "productNombre": "string",
      "unidad": "string",

      "cantidadPedida": 0,
      "cantidadPreparada": 0,
      "cantidadTransportada": 0,

      "cantidadRecibida": 0,

      "cantidadPendiente": 0,
      "cantidadDevuelta": 0,
      "cantidadDanada": 0,

      "estadoLinea": "ok",
      // ok | faltante | no_esta | danado | devuelto | excedente | parcial

      "motivo": "",
      "observaciones": ""
    }
  ],

  "totales": {
    "cantidadRecibida": 0,
    "cantidadPendiente": 0
  },

  "observaciones": "",

  "firma": {
    "firmado": true,
    "firmadoAt": "timestamp",
    "firmadoBy": "userId",
    "firmadoByName": "string",
    "firmadoByEmail": "string",
    "firmaData": "string"
  },

  "createdAt": "timestamp",
  "createdBy": "userId",
  "createdByName": "string",
  "createdByEmail": "string"
}
6. 📁 pedidos_consolidados
/apps/horarios/pedidos_consolidados/{pedidoId}
{
  "id": "pedidoId",
  "pedidoId": "string",
  "numeroPedido": "PED-000001",

  "estado": "recibido_completo",
  // pendiente | preparado | en_transporte | recibido_parcial | recibido_completo | cerrado

  "refs": {
    "remitoSalidaId": "string",
    "remitoTransporteId": "string",
    "recepcionId": "string"
  },

  "resumen": {
    "cantidadPedida": 0,
    "cantidadPreparada": 0,
    "cantidadTransportada": 0,
    "cantidadRecibida": 0,
    "cantidadPendiente": 0
  },

  "items": [
    {
      "productId": "string",
      "productNombre": "string",

      "cantidadPedida": 0,
      "cantidadPreparada": 0,
      "cantidadTransportada": 0,
      "cantidadRecibida": 0,
      "cantidadPendiente": 0,

      "estadoFinal": "ok"
    }
  ],

  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
7. 📁 pedidos_pendientes
/apps/horarios/pedidos_pendientes/{pendienteId}

👉 recomendado:

{pedidoId}_{productId}
{
  "id": "string",

  "pedidoId": "string",
  "pedidoNumero": "PED-000001",

  "recepcionId": "string",

  "productId": "string",
  "productNombre": "string",
  "unidad": "string",

  "origenId": "string",
  "origenNombre": "string",

  "destinoId": "string",
  "destinoNombre": "string",

  "cantidadPendiente": 0,

  "estado": "activo",
  // activo | usado_en_nuevo_pedido | resuelto | cancelado

  "createdAt": "timestamp",
  "updatedAt": "timestamp",

  "resolvedAt": null,
  "resolvedBy": null,
  "pedidoResolucionId": null
}
8. 📁 audit_logs
/apps/horarios/audit_logs/{logId}
{
  "id": "string",

  "entityType": "pedido",
  // pedido | remito_salida | remito_transporte | recepcion | consolidado | pendiente

  "entityId": "string",
  "pedidoId": "string",

  "accion": "created",
  // created | updated | signed | confirmed | cancelled

  "descripcion": "string",

  "createdAt": "timestamp",

  "createdBy": "userId",
  "createdByName": "string",
  "createdByEmail": "string"
}
9. 📁 counters
/apps/horarios/counters/{counterId}
{
  "id": "pedido",
  "prefix": "PED",
  "nextNumber": 17,
  "updatedAt": "timestamp"
}
🔥 REGLAS FINALES (NO NEGOCIABLES)
1. NO borrar documentos

Nunca borrar:

remitos
recepciones
2. NO editar después de firmar

Documento firmado = congelado

3. stock solo en recepción
product.stockActual += cantidadRecibida
4. pendiente SIEMPRE
pendiente = cantidadPedida - cantidadRecibida
5. consolidado SIEMPRE automático
6. firma SIEMPRE snapshot