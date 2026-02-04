"use client"

import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Plus, Minus, Check, X, Package } from "lucide-react"

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

  const isIngreso = state.tipo === "INGRESO"
  const headerColor = isIngreso ? "bg-green-500" : "bg-red-500"
  const buttonColor = isIngreso ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"

  return (
    <DashboardLayout user={user}>
      <div className="min-h-screen bg-gray-100 pb-24">
        {/* Header con modo */}
        <div className={`${headerColor} text-white p-4 shadow-lg`}>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">Stock Rápido</h1>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${!isIngreso ? "opacity-50" : ""}`}>
                INGRESO
              </span>
              <Switch
                checked={!isIngreso}
                onCheckedChange={(checked) => setTipo(checked ? "EGRESO" : "INGRESO")}
                className="scale-110"
              />
              <span className={`text-sm font-medium ${isIngreso ? "opacity-50" : ""}`}>
                EGRESO
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Pedido (compacto) */}
        <div className="bg-white border-b">
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-2">Pedido (opcional)</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPedidoId(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !state.selectedPedidoId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Sin pedido
              </button>
              {pedidos.map((pedido) => (
                <button
                  key={pedido.id}
                  onClick={() => setSelectedPedidoId(pedido.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    state.selectedPedidoId === pedido.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {pedido.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Productos */}
        {state.selectedPedidoId && productos.length > 0 && (
          <div className="p-4 space-y-4">
            {productos.map((producto) => {
              const cantidad = state.cantidades[producto.id] || 0
              const stock = stockActual[producto.id] || 0
              const stockMinimo = producto.stockMinimo || 0
              const isStockBajo = stock < stockMinimo

              return (
                <Card 
                  key={producto.id} 
                  className="overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                >
                  {/* Header del producto */}
                  <div className="bg-white p-3 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {producto.nombre}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>
                        Stock: <span className={`font-medium ${isStockBajo ? "text-red-600" : ""}`}>
                          {stock}
                        </span>
                      </span>
                      <span>Mín: {stockMinimo}</span>
                      <span>{producto.unidad || "U"}</span>
                    </div>
                  </div>

                  {/* Zonas de interacción */}
                  <div className="flex h-20">
                    {/* Zona INGRESO (verde) */}
                    <div 
                      className="flex-[0.46] bg-green-500 hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center cursor-pointer"
                      onClick={() => incrementarCantidad(producto.id)}
                    >
                    </div>

                    {/* Zona CENTRO (neutro - mínima) */}
                    <div 
                      className="flex-[0.08] bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer"
                      onClick={() => {
                        const input = document.getElementById(`input-${producto.id}`) as HTMLInputElement
                        input?.focus()
                        input?.click()
                      }}
                    >
                      <Input
                        id={`input-${producto.id}`}
                        type="number"
                        min="0"
                        value={cantidad}
                        onChange={(e) => {
                          e.stopPropagation()
                          setCantidad(producto.id, parseInt(e.target.value) || 0)
                        }}
                        className="text-3xl font-bold text-center border-0 bg-transparent h-auto w-full p-0 focus:ring-0"
                        placeholder="0"
                        disabled={state.loading}
                      />
                    </div>

                    {/* Zona EGRESO (rojo) */}
                    <div 
                      className="flex-[0.46] bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center cursor-pointer"
                      onClick={() => setCantidad(producto.id, Math.max(0, cantidad - 1))}
                    >
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Estado vacío */}
        {(!state.selectedPedidoId || productos.length === 0) && (
          <div className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {state.selectedPedidoId ? "No hay productos" : "Selecciona un pedido"}
            </h3>
            <p className="text-gray-600 text-lg">
              {state.selectedPedidoId 
                ? "Este pedido no tiene productos configurados"
                : "Selecciona un pedido para ver sus productos"
              }
            </p>
          </div>
        )}

        {/* Botón de confirmación sticky */}
        {totalProductos > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
            <div className="max-w-md mx-auto">
              {/* Resumen */}
              <div className="text-center mb-3">
                <div className="text-sm text-gray-600">
                  {totalProductos} producto{totalProductos !== 1 ? "s" : ""}
                </div>
                <div className={`text-2xl font-bold ${isIngreso ? "text-green-600" : "text-red-600"}`}>
                  {isIngreso ? "+" : "-"}{totalCantidad}
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={limpiarCantidades}
                  disabled={state.loading}
                  className="flex-1 h-12 text-lg"
                >
                  <X className="w-5 h-5 mr-2" />
                  Limpiar
                </Button>
                
                <Button
                  onClick={confirmarMovimientos}
                  disabled={state.loading}
                  className={`flex-1 h-12 text-lg ${buttonColor}`}
                >
                  <Check className="w-5 h-5 mr-2" />
                  {state.loading ? "Procesando..." : `Confirmar ${isIngreso ? "ingreso" : "egreso"}`}
                </Button>
              </div>

              {/* Error */}
              {state.error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{state.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
