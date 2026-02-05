"use client"

import { useEffect, useState } from "react"
import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, X, Package } from "lucide-react"

export default function StockConsolePage() {
  const { user, userData } = useData()
  
  // Validar permisos antes de renderizar la página
  const tienePermisoPedidos = userData?.permisos?.paginas?.includes("pedidos")
  
  // Si no tiene permisos, mostrar mensaje de acceso denegado
  if (!tienePermisoPedidos) {
    return (
      <DashboardLayout user={user}>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h2 className="text-xl font-semibold text-red-800 mb-2">Acceso Denegado</h2>
              <p className="text-red-600">
                No tienes permisos para acceder a Stock Console.
                <br />
                Esta función requiere el permiso "pedidos".
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }
  
  const stockConsole = useStockConsole(user)
  const [isPWA, setIsPWA] = useState(false)

  // Detectar si estamos corriendo como PWA y registrar service worker
  useEffect(() => {
    // Registrar service worker solo en stock-console
    if (typeof window !== "undefined" && window.location.pathname === "/dashboard/stock-console") {
      // Detectar PWA
      setIsPWA(window.matchMedia("(display-mode: standalone)").matches || 
               (window.navigator as any).standalone === true)
      
      // Registrar service worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw-stock-console.js")
          .then((registration) => {
            console.log("Stock Console SW registrado:", registration)
          })
          .catch((error) => {
            console.error("Stock Console SW error:", error)
          })
      }
    }
  }, [])

  // Redirección si no está autenticado (ya manejado por DashboardLayout)
  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      // DashboardLayout ya maneja la redirección al login
      console.log("Usuario no autenticado, DashboardLayout redirigirá al login")
    }
  }, [user])

  const {
    state,
    pedidos,
    productos,
    stockActual,
    movimientosPendientes,
    totalProductos,
    totalCantidad,
    totalIngresos,
    totalEgresos,
    setSelectedPedidoId,
    incrementarCantidad,
    decrementarCantidad,
    setCantidad,
    limpiarCantidades,
    confirmarMovimientos,
  } = stockConsole

  // El total ya está calculado correctamente en el hook (totalCantidad)
  // No necesitamos recalcular aquí

  return (
    <DashboardLayout user={user}>
      {/* Meta tags para PWA */}
      {!isPWA && (
        <>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <meta name="theme-color" content="#3b82f6" />
          <link rel="manifest" href="/manifest-stock-console.json" />
        </>
      )}
      
      <div className={`min-h-screen bg-gray-100 ${isPWA ? "pb-20" : "pb-24"}`}>
        {/* Header simple */}
        <div className="bg-blue-500 text-white p-4 shadow-lg">
          <h1 className="text-xl font-bold">Stock Rápido</h1>
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
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900">{producto.nombre}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-600">Stock: <span className={`font-medium ${isStockBajo ? "text-red-600" : ""}`}>{stock}</span></span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-600">Mín: {stockMinimo}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-600">{producto.unidad || "U"}</span>
                    </div>
                  </div>

                  {/* Zonas de interacción */}
                  <div className="flex h-20">
                    {/* Zona IZQUIERDA (rojo) */}
                    <div 
                      className="flex-[0.46] bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center cursor-pointer"
                      onClick={() => decrementarCantidad(producto.id)}
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

                    {/* Zona DERECHA (verde) */}
                    <div 
                      className="flex-[0.46] bg-green-500 hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center cursor-pointer"
                      onClick={() => incrementarCantidad(producto.id)}
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
          <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-50 ${isPWA ? "p-2" : "p-3"}`}>
            <div className={`max-w-md mx-auto flex items-center justify-between ${isPWA ? "gap-1" : ""}`}>
              <Button
                variant="outline"
                onClick={limpiarCantidades}
                disabled={state.loading}
                className={`h-10 ${isPWA ? "px-2 text-xs" : "px-4"}`}
              >
                <X className={`w-4 h-4 ${isPWA ? "mr-1" : "mr-2"}`} />
                {isPWA ? "Limpiar" : "Limpiar"}
              </Button>
              
              <div className={`flex items-center ${isPWA ? "gap-0.5" : "gap-1"}`}>
                <span className={`font-bold text-red-600 ${isPWA ? "text-lg" : "text-2xl"}`}>
                  -{totalEgresos}
                </span>
                <span className={`text-gray-500 ${isPWA ? "text-sm" : "text-xl"}`}>|</span>
                <span className={`font-bold text-green-600 ${isPWA ? "text-lg" : "text-2xl"}`}>
                  +{totalIngresos}
                </span>
              </div>
              
              <Button
                onClick={confirmarMovimientos}
                disabled={state.loading}
                className={`h-10 bg-blue-600 hover:bg-blue-700 ${isPWA ? "px-2 text-xs" : "px-4"}`}
              >
                <Check className={`w-4 h-4 ${isPWA ? "mr-1" : "mr-2"}`} />
                {state.loading ? "Procesando..." : (isPWA ? "Confirmar" : "Confirmar")}
              </Button>
            </div>

            {/* Error */}
            {state.error && (
              <div className="mt-2 max-w-md mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="text-sm text-red-600">{state.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
