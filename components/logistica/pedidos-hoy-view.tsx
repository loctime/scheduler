"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_CONFIRMADOS = new Set(["enviado", "en_preparacion", "despachado", "recibido"])

function isToday(ts: unknown): boolean {
  if (!ts || typeof ts !== "object") return false
  const date = (ts as { toDate?: () => Date }).toDate?.()
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function PedidosHoyView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos)
      if (p.grupoPedidoId) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  if (grupos.length === 0)
    return <p className="text-sm text-muted-foreground">Sin pedidos registrados aún.</p>

  return (
    <div className="space-y-4">
      {grupos.map(({ id: grupoId, nombre: grupoNombre }) => {
        // Columnas = sucursales históricas del grupo
        const sucMap = new Map<string, string>()
        for (const p of pedidos)
          if (p.grupoPedidoId === grupoId && p.origenLocationId)
            sucMap.set(p.origenLocationId, p.origenNombre)
        const sucursales = Array.from(sucMap.entries())
          .map(([id, nombre]) => ({ id, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        // Pedidos de hoy confirmados para este grupo
        const pedidosHoy = pedidos.filter(
          (p) =>
            p.grupoPedidoId === grupoId &&
            isToday(p.creadoEn) &&
            ESTADOS_CONFIRMADOS.has(p.estado)
        )
        const pedidoPorSucursal = new Map(pedidosHoy.map((p) => [p.origenLocationId, p]))

        // Filas = productos que aparecen en al menos un pedido de hoy
        const prodMap = new Map<string, string>()
        for (const p of pedidosHoy)
          for (const item of p.items)
            if (!prodMap.has(item.productoId)) prodMap.set(item.productoId, item.productoNombre)
        const productos = Array.from(prodMap.entries())
          .map(([id, nombre]) => ({ id, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        return (
          <Card key={grupoId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{grupoNombre}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {sucursales.length === 0
                  ? "Sin sucursales"
                  : `${pedidoPorSucursal.size} de ${sucursales.length} confirmadas`}
              </p>
            </CardHeader>
            <CardContent>
              {productos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pedidos confirmados hoy.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr>
                        <th className="text-left p-2 border bg-muted">Producto</th>
                        {sucursales.map((s) => (
                          <th key={s.id} className="text-center p-2 border bg-muted min-w-[110px]">
                            {s.nombre}
                          </th>
                        ))}
                        <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[70px]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map(({ id: prodId, nombre: prodNombre }) => {
                        const total = sucursales.reduce((acc, s) => {
                          const p = pedidoPorSucursal.get(s.id)
                          return acc + (p?.items.find((i) => i.productoId === prodId)?.cantidadPedida ?? 0)
                        }, 0)
                        return (
                          <tr key={prodId}>
                            <td className="p-2 border font-medium">{prodNombre}</td>
                            {sucursales.map((s) => {
                              const pedido = pedidoPorSucursal.get(s.id)
                              if (!pedido)
                                return (
                                  <td key={s.id} className="p-2 border text-center">
                                    <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs">
                                      Pendiente
                                    </Badge>
                                  </td>
                                )
                              const cant =
                                pedido.items.find((i) => i.productoId === prodId)?.cantidadPedida ?? 0
                              return (
                                <td key={s.id} className="p-2 border text-center">
                                  {cant}
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
          </Card>
        )
      })}
    </div>
  )
}
