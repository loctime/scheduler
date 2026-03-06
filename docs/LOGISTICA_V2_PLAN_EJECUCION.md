# Logistica V2 - Plan de Ejecucion Implementado

## Estado
- Infraestructura base V2 creada en frontend.
- Feature flags incorporados para convivencia legacy/V2.
- Cliente HTTP tipado contra backend `controlfile` agregado.
- Pantallas V2 creadas en modo incremental:
  - `/dashboard/remitos/nuevo`
  - `/dashboard/remitos/[id]`
  - `/dashboard/recepciones/nueva`
  - `/dashboard/devoluciones/nueva`
  - `/dashboard/documentos-logistica`

## Alcance de esta implementacion
- Se mantiene el flujo legacy operando.
- No se elimino codigo legacy en esta etapa.
- No se implementaron transacciones en cliente.
- Las operaciones criticas se consumen por API backend.

## Variables de entorno sugeridas
- `NEXT_PUBLIC_CONTROLFILE_API_URL`
- `NEXT_PUBLIC_LOGISTICS_V2_ENABLED`
- `NEXT_PUBLIC_LOGISTICS_V2_REMITOS`
- `NEXT_PUBLIC_LOGISTICS_V2_RECEPCIONES`
- `NEXT_PUBLIC_LOGISTICS_V2_DEVOLUCIONES`
- `NEXT_PUBLIC_LEGACY_PUBLIC_LINK_READ_ONLY`

## Proximo paso recomendado
- Activar `NEXT_PUBLIC_LOGISTICS_V2_ENABLED=true` en ambiente de QA y validar contratos reales de backend.
