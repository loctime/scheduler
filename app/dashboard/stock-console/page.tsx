"use client"

import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Plus, Check, X, Package } from "lucide-react"

export default function StockConsolePage() {
  const { user, userData } = useData()
  const stockConsole = useStockConsole(user)

  const {
    state,
    pedidos,
    productos,
    stockActual,
    movimientosPendientes,
    totalProductos,
    totalCantidad,
    setSelectedPedidoId,
    setTipo,
    incrementarCantidad,
    setCantidad,
    limpiarCantidades,
    confirmarMovimientos,
  } = stockConsole

  return (
    <DashboardLayout user={user}>
      <div className="min-h-screen bg-gray-50 p-4 pb-20">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Consola Rápida de Stock
          </h1>
          <p className="text-gray-600">
            Registra ingresos y egresos de stock de forma táctil
          </p>
        </div>

        {/* Selector de Pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Pedido (Opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPedidoId(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  !state.selectedPedidoId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Sin pedido
              </button>
              {pedidos.map((pedido) => (
                <button
                  key={pedido.id}
                  onClick={() => setSelectedPedidoId(pedido.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    state.selectedPedidoId === pedido.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {pedido.nombre}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Toggle INGRESO/EGRESO */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-lg font-medium ${
                state.tipo === "INGRESO" ? "text-green-600" : "text-gray-400"
              }`}>
                INGRESO
              </span>
              <Switch
                checked={state.tipo === "EGRESO"}
                onCheckedChange={(checked) => setTipo(checked ? "EGRESO" : "INGRESO")}
                className="scale-125"
              />
              <span className={`text-lg font-medium ${
                state.tipo === "EGRESO" ? "text-red-600" : "text-gray-400"
              }`}>
                EGRESO
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Productos */}
        {state.selectedPedidoId && productos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
                <Badge variant="secondary">
                  {productos.filter(p => stockActual[p.id] < (p.stockMinimo || 0)).length} bajos
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productos.map((producto) => {
                  const cantidad = state.cantidades[producto.id] || 0
                  const stock = stockActual[producto.id] || 0
                  const stockMinimo = producto.stockMinimo || 0
                  const isStockBajo = stock < stockMinimo

                  return (
                    <div
                      key={producto.id}
                      className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {producto.nombre}
                          </h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-600">
                              Stock: <span className={`font-medium ${isStockBajo ? "text-red-600" : ""}`}>
                                {stock}
                              </span>
                            </span>
                            <span className="text-sm text-gray-600">
                              Mínimo: {stockMinimo}
                            </span>
                            <span className="text-sm text-gray-500">
                              Unidad: {producto.unidad || "U"}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => incrementarCantidad(producto.id)}
                          className="flex-shrink-0 h-10 w-10 p-0"
                          disabled={state.loading}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        
                        <Input
                          type="number"
                          min="0"
                          value={cantidad}
                          onChange={(e) => setCantidad(producto.id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          placeholder="0"
                          disabled={state.loading}
                        />
                        
                        <div className="flex-1 text-right">
                          {cantidad > 0 && (
                            <Badge 
                              variant={state.tipo === "INGRESO" ? "default" : "destructive"}
                              className="text-sm"
                            >
                              {state.tipo === "INGRESO" ? "+" : "-"}{cantidad}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumen y Acciones */}
        {totalProductos > 0 && (
          <Card className="fixed bottom-0 left-0 right-0 rounded-t-2xl shadow-lg border-t-2 z-50">
            <CardContent className="pt-4 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-600">
                    {totalProductos} producto{totalProductos !== 1 ? "s" : ""}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    Total: {state.tipo === "INGRESO" ? "+" : "-"}{totalCantidad}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={limpiarCantidades}
                    disabled={state.loading}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </Button>
                  
                  <Button
                    onClick={confirmarMovimientos}
                    disabled={state.loading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    {state.loading ? "Procesando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
              
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{state.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Estado vacío */}
        {(!state.selectedPedidoId || productos.length === 0) && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {state.selectedPedidoId ? "No hay productos" : "Selecciona un pedido"}
              </h3>
              <p className="text-gray-600">
                {state.selectedPedidoId 
                  ? "Este pedido no tiene productos configurados"
                  : "Selecciona un pedido para ver sus productos y registrar movimientos"
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
