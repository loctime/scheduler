// components/logistica/pedidos-hoy-view.tsx
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_CONFIRMADOS = new Set(["enviado", "en_preparacion", "despachado", "recibido"])

function isToday(timestamp: unknown): boolean {
  if (!timestamp || typeof timestamp !== "object") return false
  const ts = timestamp as { toDate?: () => Date }
  const date = ts.toDate?.()
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function PedidosHoyView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const toggle = (grupoId: string) =>
    setAbiertos((prev) => ({ ...prev, [grupoId]: !prev[grupoId] }))

  // Grupos únicos derivados de toda la colección
  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (!map.has(p.grupoPedidoId)) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  // Pedidos de hoy confirmados (todos los grupos)
  const pedidosHoyConfirmados = useMemo(
    () => pedidos.filter((p) => isToday(p.creadoEn) && ESTADOS_CONFIRMADOS.has(p.estado)),
    [pedidos]
  )

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pedidos registrados aún.</p>
  }

  return (
    <div className="space-y-3">
      {grupos.map(({ id: grupoId, nombre: grupoNombre }) => {
        // Sucursales que ALGUNA VEZ pidieron este grupo (columnas)
        const sucursalesMap = new Map<string, string>()
        for (const p of pedidos) {
          if (p.grupoPedidoId === grupoId && !sucursalesMap.has(p.origenLocationId)) {
            sucursalesMap.set(p.origenLocationId, p.origenNombre)
          }
        }
        const sucursales = Array.from(sucursalesMap.entries())
          .map(([id, nombre]) => ({ id, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        // Pedidos de HOY confirmados para este grupo
        const pedidosGrupoHoy = pedidosHoyConfirmados.filter(
          (p) => p.grupoPedidoId === grupoId
        )

        // Sucursales que ya confirmaron hoy
        const confirmadas = new Set(pedidosGrupoHoy.map((p) => p.origenLocationId))

        // Productos únicos de hoy (unión de items de pedidos confirmados)
        const productosMap = new Map<string, string>()
        for (const p of pedidosGrupoHoy) {
          for (const item of p.items) {
            if (!productosMap.has(item.productoId))
              productosMap.set(item.productoId, item.productoNombre)
          }
        }
        const productos = Array.from(productosMap.entries()).map(([id, nombre]) => ({
          id,
          nombre,
        }))

        const nConfirmadas = confirmadas.size
        const nTotal = sucursales.length
        const estaAbierto = abiertos[grupoId] ?? false

        return (
          <Card key={grupoId}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => toggle(grupoId)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{grupoNombre}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {nTotal === 0
                        ? "Sin sucursales registradas"
                        : `${nConfirmadas} de ${nTotal} confirmadas`}
                    </p>
                  </div>
                  {estaAbierto ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </button>

            {estaAbierto && (
              <CardContent>
                {productos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pedidos confirmados hoy.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border bg-muted font-medium">Producto</th>
                          {sucursales.map((s) => (
                            <th
                              key={s.id}
                              className="text-center p-2 border bg-muted font-medium min-w-[110px]"
                            >
                              {s.nombre}
                            </th>
                          ))}
                          <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[70px]">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map(({ id: productoId, nombre: productoNombre }) => {
                          const total = sucursales.reduce((acc, s) => {
                            if (!confirmadas.has(s.id)) return acc
                            const pedido = pedidosGrupoHoy.find(
                              (p) => p.origenLocationId === s.id
                            )
                            const item = pedido?.items.find((i) => i.productoId === productoId)
                            return acc + (item?.cantidadPedida ?? 0)
                          }, 0)

                          return (
                            <tr key={productoId}>
                              <td className="p-2 border font-medium">{productoNombre}</td>
                              {sucursales.map((s) => {
                                if (!confirmadas.has(s.id)) {
                                  return (
                                    <td key={s.id} className="p-2 border text-center">
                                      <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs">
                                        Pendiente
                                      </Badge>
                                    </td>
                                  )
                                }
                                const pedido = pedidosGrupoHoy.find(
                                  (p) => p.origenLocationId === s.id
                                )
                                const item = pedido?.items.find(
                                  (i) => i.productoId === productoId
                                )
                                return (
                                  <td key={s.id} className="p-2 border text-center">
                                    {item?.cantidadPedida ?? 0}
                                  </td>
                                )
                              })}
                              <td className="p-2 border text-center font-semibold text-blue-600">
                                {total}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
