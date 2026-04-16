// components/logistica/pedidos-historial-view.tsx
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_CONFIRMADOS = new Set(["enviado", "en_preparacion", "despachado", "recibido"])
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const RANGOS = [7, 14, 30] as const
type Rango = (typeof RANGOS)[number]

function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== "object") return null
  const obj = ts as { toDate?: () => Date }
  return obj.toDate?.() ?? null
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDia(date: Date): string {
  return `${DIAS_CORTOS[date.getDay()]} ${date.getDate()}`
}

function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function PedidosHistorialView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const [grupoId, setGrupoId] = useState<string>("")
  const [sucursalId, setSucursalId] = useState<string>("")
  const [rango, setRango] = useState<Rango>(7)

  // Grupos únicos de toda la colección
  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (!map.has(p.grupoPedidoId)) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  // Sucursales para el grupo seleccionado
  const sucursales = useMemo(() => {
    if (!grupoId) return []
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (p.grupoPedidoId === grupoId && !map.has(p.origenLocationId)) {
        map.set(p.origenLocationId, p.origenNombre)
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos, grupoId])

  // Array de días del rango (incluyendo hoy, de más antiguo a hoy)
  const dias = useMemo(() => {
    const result: Date[] = []
    const hoy = startOfDay(new Date())
    for (let i = rango - 1; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      result.push(d)
    }
    return result
  }, [rango])

  // Pedidos filtrados por grupo + sucursal + rango
  const pedidosFiltrados = useMemo(() => {
    if (!grupoId || !sucursalId) return []
    const desde = dias[0]
    return pedidos.filter((p) => {
      if (p.grupoPedidoId !== grupoId) return false
      if (p.origenLocationId !== sucursalId) return false
      if (!ESTADOS_CONFIRMADOS.has(p.estado)) return false
      const date = timestampToDate(p.creadoEn)
      if (!date) return false
      return startOfDay(date) >= desde
    })
  }, [pedidos, grupoId, sucursalId, dias])

  // Productos únicos de los pedidos filtrados, ordenados alfabéticamente
  const productos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidosFiltrados) {
      for (const item of p.items) {
        if (!map.has(item.productoId)) map.set(item.productoId, item.productoNombre)
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidosFiltrados])

  // Mapa de pedido por día (key = "YYYY-MM-DD")
  const pedidoPorDia = useMemo(() => {
    const map = new Map<string, PedidoFabrica>()
    for (const p of pedidosFiltrados) {
      const date = timestampToDate(p.creadoEn)
      if (!date) continue
      const k = dayKey(date)
      if (!map.has(k)) map.set(k, p)
    }
    return map
  }, [pedidosFiltrados])

  const handleGrupoChange = (val: string) => {
    setGrupoId(val)
    setSucursalId("")
  }

  const grupoNombre = grupos.find((g) => g.id === grupoId)?.nombre ?? ""
  const sucursalNombre = sucursales.find((s) => s.id === sucursalId)?.nombre ?? ""

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={grupoId} onValueChange={handleGrupoChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Grupo de productos" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sucursalId} onValueChange={setSucursalId} disabled={!grupoId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {sucursales.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(rango)} onValueChange={(v) => setRango(Number(v) as Rango)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGOS.map((r) => (
              <SelectItem key={r} value={String(r)}>
                Últimos {r} días
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estado vacío */}
      {(!grupoId || !sucursalId) && (
        <p className="text-sm text-muted-foreground">
          Seleccioná un grupo y una sucursal para ver el historial.
        </p>
      )}

      {/* Tabla */}
      {grupoId && sucursalId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {grupoNombre} — {sucursalNombre}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Últimos {rango} días</p>
          </CardHeader>
          <CardContent>
            {productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos en este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border bg-muted font-medium">Producto</th>
                      {dias.map((d) => (
                        <th
                          key={dayKey(d)}
                          className="text-center p-2 border bg-muted font-medium min-w-[70px]"
                        >
                          {formatDia(d)}
                        </th>
                      ))}
                      <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[60px]">
                        Prom
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map(({ id: productoId, nombre: productoNombre }) => {
                      const cantidades: (number | null)[] = dias.map((d) => {
                        const pedido = pedidoPorDia.get(dayKey(d))
                        if (!pedido) return null
                        const item = pedido.items.find((i) => i.productoId === productoId)
                        return item != null ? item.cantidadPedida : null
                      })
                      const conDatos = cantidades.filter((c): c is number => c !== null)
                      const prom =
                        conDatos.length > 0
                          ? Math.round(
                              conDatos.reduce((a, b) => a + b, 0) / conDatos.length
                            )
                          : null

                      return (
                        <tr key={productoId}>
                          <td className="p-2 border font-medium">{productoNombre}</td>
                          {dias.map((d, i) => (
                            <td key={dayKey(d)} className="p-2 border text-center">
                              {cantidades[i] !== null ? (
                                cantidades[i]
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          ))}
                          <td className="p-2 border text-center font-semibold text-blue-600">
                            {prom !== null ? (
                              prom
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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
      )}
    </div>
  )
}
