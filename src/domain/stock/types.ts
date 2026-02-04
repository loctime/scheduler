export type MovimientoStockTipo = "INGRESO" | "EGRESO"

export type MovimientoStock = {
  id: string
  tipo: MovimientoStockTipo
  productoId: string
  productoNombre: string
  cantidad: number
  stockAntes: number
  stockDespues: number
  ownerId: string
  userId: string
  fecha: Date
  pedidoId?: string
  origen: "stock_console"
}

export type MovimientoInput = {
  productoId: string
  productoNombre: string
  cantidad: number
  tipo: MovimientoStockTipo
  pedidoId?: string
}

export type StockConsoleState = {
  selectedPedidoId: string | null
  cantidades: Record<string, number>
  loading: boolean
  error: string | null
}

export type ConfirmarMovimientoResult = {
  ok: true
  movimientos: MovimientoStock[]
  stockActualizado: Record<string, number>
} | {
  ok: false
  error: string
}
