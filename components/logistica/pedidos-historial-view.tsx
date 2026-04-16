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

function toDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== "object") return null
  return (ts as { toDate?: () => Date }).toDate?.() ?? null
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function PedidosHistorialView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const [grupoId, setGrupoId] = useState("")
  const [sucursalId, setSucursalId] = useState("")
  const [rango, setRango] = useState<Rango>(7)

  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos)
      if (p.grupoPedidoId) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  const sucursales = useMemo(() => {
    if (!grupoId) return []
    const map = new Map<string, string>()
    for (const p of pedidos)
      if (p.grupoPedidoId === grupoId && p.origenLocationId)
        map.set(p.origenLocationId, p.origenNombre)
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos, grupoId])

  // Columnas = días del rango (oldest → today)
  const dias = useMemo(() => {
    const result: Date[] = []
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    for (let i = rango - 1; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      result.push(d)
    }
    return result
  }, [rango])

  const pedidosFiltrados = useMemo(() => {
    if (!grupoId || !sucursalId) return []
    const desde = dias[0]
    return pedidos.filter((p) => {
      if (p.grupoPedidoId !== grupoId || p.origenLocationId !== sucursalId) return false
      if (!ESTADOS_CONFIRMADOS.has(p.estado)) return false
      const d = toDate(p.creadoEn)
      if (!d) return false
      const dd = new Date(d)
      dd.setHours(0, 0, 0, 0)
      return dd >= desde
    })
  }, [pedidos, grupoId, sucursalId, dias])

  // Un pedido por día (primer encontrado si hay duplicados)
  const pedidoPorDia = useMemo(() => {
    const map = new Map<string, PedidoFabrica>()
    for (const p of pedidosFiltrados) {
      const d = toDate(p.creadoEn)
      if (!d) continue
      const k = dayKey(d)
      if (!map.has(k)) map.set(k, p)
    }
    return map
  }, [pedidosFiltrados])

  const productos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidosFiltrados)
      for (const item of p.items)
        if (!map.has(item.productoId)) map.set(item.productoId, item.productoNombre)
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidosFiltrados])

  const grupoNombre = grupos.find((g) => g.id === grupoId)?.nombre ?? ""
  const sucursalNombre = sucursales.find((s) => s.id === sucursalId)?.nombre ?? ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={grupoId} onValueChange={(v) => { setGrupoId(v); setSucursalId("") }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sucursalId} onValueChange={setSucursalId} disabled={!grupoId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {sucursales.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(rango)} onValueChange={(v) => setRango(Number(v) as Rango)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGOS.map((r) => (
              <SelectItem key={r} value={String(r)}>Últimos {r} días</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!grupoId || !sucursalId ? (
        <p className="text-sm text-muted-foreground">Seleccioná un grupo y una sucursal.</p>
      ) : productos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin pedidos en este período.</p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {grupoNombre} — {sucursalNombre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr>
                    <th className="text-left p-2 border bg-muted">Producto</th>
                    {dias.map((d) => (
                      <th key={dayKey(d)} className="text-center p-2 border bg-muted min-w-[70px]">
                        {DIAS_CORTOS[d.getDay()]} {d.getDate()}
                      </th>
                    ))}
                    <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[60px]">
                      Prom
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map(({ id: prodId, nombre: prodNombre }) => {
                    const vals = dias.map((d) => {
                      const p = pedidoPorDia.get(dayKey(d))
                      if (!p) return null
                      return p.items.find((i) => i.productoId === prodId)?.cantidadPedida ?? null
                    })
                    const conDatos = vals.filter((v): v is number => v !== null)
                    const prom =
                      conDatos.length > 0
                        ? Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length)
                        : null
                    return (
                      <tr key={prodId}>
                        <td className="p-2 border font-medium">{prodNombre}</td>
                        {vals.map((v, i) => (
                          <td key={dayKey(dias[i])} className="p-2 border text-center">
                            {v !== null ? v : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                        <td className="p-2 border text-center font-semibold text-blue-600">
                          {prom !== null ? prom : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
