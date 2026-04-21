"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { useDespachoHoy } from "@/hooks/use-despacho-hoy"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Truck,
  LayoutList,
  Building2,
  BarChart2,
  Table,
  Loader2,
} from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"

// ─── types ────────────────────────────────────────────────────────────────────
type Vista = "producto" | "sucursal" | "resumen" | "tabla"

const VISTA_KEY = "despacho_vista_preferida"

// ─── helpers ──────────────────────────────────────────────────────────────────
function getProductos(pedidos: PedidoFabrica[]) {
  const map = new Map<string, string>()
  pedidos.forEach((p) =>
    p.items.forEach((i) => {
      if (!map.has(i.productoId)) map.set(i.productoId, i.productoNombre)
    })
  )
  return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
}

// ─── view props ───────────────────────────────────────────────────────────────
interface VistaProps {
  pedidos: PedidoFabrica[]
  modoDespacho: boolean
  cantidades: Record<string, number>
  onCantidadChange: (productoId: string, pedidoId: string, cantidad: number) => void
}

// ─── VistaProducto ────────────────────────────────────────────────────────────
function VistaProducto({ pedidos, modoDespacho, cantidades, onCantidadChange }: VistaProps) {
  const productos = useMemo(() => getProductos(pedidos), [pedidos])
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))

  const completarProducto = (productoId: string) => {
    pedidos.forEach((p) => {
      const item = p.items.find((i) => i.productoId === productoId)
      if (item) onCantidadChange(productoId, p.id, item.cantidadPedida)
    })
  }

  return (
    <div className="space-y-2">
      {productos.map(({ id, nombre }) => {
        const estaAbierto = abiertos[id] ?? true
        const totalPedido = pedidos.reduce(
          (acc, p) => acc + (p.items.find((i) => i.productoId === id)?.cantidadPedida ?? 0),
          0
        )
        const totalDespacho = modoDespacho
          ? pedidos.reduce((acc, p) => acc + (cantidades[`${id}_${p.id}`] ?? 0), 0)
          : null

        return (
          <div key={id} className="bg-white rounded-xl border border-[#ebebeb] overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => toggle(id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">{nombre}</span>
                {modoDespacho && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); completarProducto(id) }}
                    className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] font-medium"
                  >
                    OK
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {totalDespacho !== null && (
                  <span className="text-xs font-medium text-[#0F6E56]">{totalDespacho}</span>
                )}
                <span className="text-xs text-gray-400">/{totalPedido}</span>
                {estaAbierto
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {estaAbierto && (
              <div className="border-t border-[#ebebeb]">
                {pedidos.map((pedido) => {
                  const item = pedido.items.find((i) => i.productoId === id)
                  if (!item) return null
                  const cantidad = cantidades[`${id}_${pedido.id}`] ?? 0
                  return (
                    <div
                      key={pedido.id}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-[#f5f5f5] last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{pedido.origenNombre}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            pedido.controlado ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {pedido.controlado ? "C" : "A"}
                        </span>
                      </div>
                      {modoDespacho ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.cantidadPedida}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={cantidad}
                            onChange={(e) =>
                              onCantidadChange(id, pedido.id, Math.max(0, Number(e.target.value) || 0))
                            }
                            className={`w-16 h-9 text-center text-sm rounded-lg border ${
                              cantidad < item.cantidadPedida ? "border-red-400" : "border-green-400"
                            }`}
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{item.cantidadPedida}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── VistaSucursal ────────────────────────────────────────────────────────────
function VistaSucursal({ pedidos, modoDespacho, cantidades, onCantidadChange }: VistaProps) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="space-y-2">
      {pedidos.map((pedido) => {
        const estaAbierto = abiertos[pedido.id] ?? true
        const totalPedido = pedido.items.reduce((acc, i) => acc + i.cantidadPedida, 0)
        const totalDespacho = modoDespacho
          ? pedido.items.reduce((acc, i) => acc + (cantidades[`${i.productoId}_${pedido.id}`] ?? 0), 0)
          : null

        return (
          <div key={pedido.id} className="bg-white rounded-xl border border-[#ebebeb] overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => toggle(pedido.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{pedido.origenNombre}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    pedido.controlado ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {pedido.controlado ? "Controlado" : "Automático"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {totalDespacho !== null && (
                  <span className="text-xs font-medium text-[#0F6E56]">{totalDespacho}</span>
                )}
                <span className="text-xs text-gray-400">/{totalPedido}</span>
                {estaAbierto
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {estaAbierto && (
              <div className="border-t border-[#ebebeb]">
                {pedido.items.map((item) => {
                  const cantidad = cantidades[`${item.productoId}_${pedido.id}`] ?? 0
                  return (
                    <div
                      key={item.productoId}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-[#f5f5f5] last:border-b-0"
                    >
                      <span className="text-sm text-gray-700">{item.productoNombre}</span>
                      {modoDespacho ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.cantidadPedida}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={cantidad}
                            onChange={(e) =>
                              onCantidadChange(item.productoId, pedido.id, Math.max(0, Number(e.target.value) || 0))
                            }
                            className={`w-16 h-9 text-center text-sm rounded-lg border ${
                              cantidad < item.cantidadPedida ? "border-red-400" : "border-green-400"
                            }`}
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{item.cantidadPedida}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── VistaResumen ─────────────────────────────────────────────────────────────
function VistaResumen({ pedidos, modoDespacho, cantidades }: VistaProps) {
  const productos = useMemo(() => getProductos(pedidos), [pedidos])

  return (
    <div className="bg-white rounded-xl border border-[#ebebeb] overflow-hidden">
      {productos.length === 0 && (
        <p className="text-sm text-gray-400 text-center px-4 py-3">Sin productos</p>
      )}
      {productos.map(({ id, nombre }, idx) => {
        const totalPedido = pedidos.reduce(
          (acc, p) => acc + (p.items.find((i) => i.productoId === id)?.cantidadPedida ?? 0),
          0
        )
        const totalDespacho = modoDespacho
          ? pedidos.reduce((acc, p) => acc + (cantidades[`${id}_${p.id}`] ?? 0), 0)
          : null

        return (
          <div
            key={id}
            className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-[#f5f5f5]" : ""}`}
          >
            <span className="text-sm text-gray-700">{nombre}</span>
            <div className="flex items-center gap-3">
              {totalDespacho !== null && (
                <span className="text-sm font-semibold text-[#0F6E56]">{totalDespacho}</span>
              )}
              <span className={`text-sm font-medium ${modoDespacho ? "text-gray-400" : "text-gray-900"}`}>
                {totalPedido}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── VistaTabla ───────────────────────────────────────────────────────────────
function VistaTabla({ pedidos, modoDespacho, cantidades, onCantidadChange }: VistaProps) {
  const productos = useMemo(() => getProductos(pedidos), [pedidos])

  const completarProducto = (productoId: string) => {
    pedidos.forEach((p) => {
      const item = p.items.find((i) => i.productoId === productoId)
      if (item) onCantidadChange(productoId, p.id, item.cantidadPedida)
    })
  }

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 border-b border-[#ebebeb] sticky left-0 bg-gray-50 min-w-[110px]">
              Producto
            </th>
            {pedidos.map((p) => (
              <th key={p.id} className="px-3 py-2 border-b border-[#ebebeb] min-w-[72px]">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">{p.origenNombre}</span>
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded-full ${
                      p.controlado ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {p.controlado ? "C" : "A"}
                  </span>
                </div>
              </th>
            ))}
            <th className="px-3 py-2 border-b border-[#ebebeb] text-xs font-semibold text-blue-600 min-w-[52px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {productos.map(({ id, nombre }) => {
            const total = modoDespacho
              ? pedidos.reduce((acc, p) => acc + (cantidades[`${id}_${p.id}`] ?? 0), 0)
              : pedidos.reduce(
                  (acc, p) => acc + (p.items.find((i) => i.productoId === id)?.cantidadPedida ?? 0),
                  0
                )

            return (
              <tr key={id} className="border-b border-[#f5f5f5] last:border-b-0">
                <td className="px-4 py-2 sticky left-0 bg-white font-medium text-gray-800 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[90px]">{nombre}</span>
                    {modoDespacho && (
                      <button
                        type="button"
                        onClick={() => completarProducto(id)}
                        className="text-[10px] px-1 py-0.5 rounded bg-[#E1F5EE] text-[#0F6E56] font-medium shrink-0"
                      >
                        OK
                      </button>
                    )}
                  </div>
                </td>
                {pedidos.map((p) => {
                  const item = p.items.find((i) => i.productoId === id)
                  const cantidad = cantidades[`${id}_${p.id}`] ?? 0
                  return (
                    <td key={p.id} className="px-2 py-2 text-center">
                      {!item ? (
                        <span className="text-gray-300">—</span>
                      ) : modoDespacho ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={cantidad}
                          onChange={(e) =>
                            onCantidadChange(id, p.id, Math.max(0, Number(e.target.value) || 0))
                          }
                          className={`w-12 h-7 text-center text-xs rounded border ${
                            cantidad < item.cantidadPedida ? "border-red-400" : "border-green-400"
                          }`}
                        />
                      ) : (
                        <span className="text-gray-800 text-xs">{item.cantidadPedida}</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center font-semibold text-xs text-blue-600">{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
const VISTA_LABEL: Record<Vista, string> = {
  producto: "por producto",
  sucursal: "por sucursal",
  resumen: "resumen",
  tabla: "tabla",
}

const VISTA_ICONS: Array<{ id: Vista; icon: React.ReactNode; label: string }> = [
  { id: "producto", icon: <LayoutList className="w-4 h-4" />, label: "Producto" },
  { id: "sucursal", icon: <Building2 className="w-4 h-4" />, label: "Sucursal" },
  { id: "resumen", icon: <BarChart2 className="w-4 h-4" />, label: "Resumen" },
  { id: "tabla", icon: <Table className="w-4 h-4" />, label: "Tabla" },
]

export default function DespacharPage() {
  const router = useRouter()
  const { user } = useData()

  const {
    gruposVisibles,
    pedidosDeHoy,
    loading,
    gruposEnModoDespacho,
    cantidadesDespacho,
    setCantidadDespacho,
    tomarGrupo,
    despacharGrupo,
  } = useDespachoHoy(user)

  const [vistaActiva, setVistaActiva] = useState<Vista>(() => {
    if (typeof window === "undefined") return "producto"
    return (localStorage.getItem(VISTA_KEY) as Vista) ?? "producto"
  })

  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})
  const [tomarDialogGrupoId, setTomarDialogGrupoId] = useState<string | null>(null)
  const [opcionTomar, setOpcionTomar] = useState<"todos" | "confirmados" | "manual">("todos")
  const [sucursalesParaTomar, setSucursalesParaTomar] = useState<string[]>([])
  const [despachando, setDespachando] = useState<string | null>(null)

  useEffect(() => {
    const inicial: Record<string, boolean> = {}
    gruposVisibles.forEach((g) => {
      if (!(g.id in gruposAbiertos)) inicial[g.id] = true
    })
    if (Object.keys(inicial).length > 0) setGruposAbiertos((prev) => ({ ...prev, ...inicial }))
  }, [gruposVisibles])

  const cambiarVista = (v: Vista) => {
    setVistaActiva(v)
    if (typeof window !== "undefined") localStorage.setItem(VISTA_KEY, v)
  }

  const handleTomar = async (grupoId: string, pedidos: PedidoFabrica[]) => {
    await tomarGrupo(grupoId, pedidos, opcionTomar, sucursalesParaTomar)
    setTomarDialogGrupoId(null)
    setOpcionTomar("todos")
    setSucursalesParaTomar([])
  }

  const handleDespachar = async (grupoId: string, pedidos: PedidoFabrica[]) => {
    setDespachando(grupoId)
    await despacharGrupo(grupoId, pedidos)
    setDespachando(null)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPedidos = pedidosDeHoy.reduce(
    (acc, { pedidos, autoPedidos }) => acc + pedidos.length + autoPedidos.length,
    0
  )

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Despachar pedidos</h1>
        {totalPedidos > 0 && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            {totalPedidos} pedidos
          </span>
        )}
      </div>

      {/* View selector */}
      <div className="bg-white border-b border-gray-100 px-3 py-1.5 flex gap-1 shrink-0">
        {VISTA_ICONS.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => cambiarVista(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-colors ${
              vistaActiva === id ? "bg-[#E1F5EE] text-[#0F6E56]" : "text-gray-400"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando pedidos…</span>
          </div>
        )}

        {!loading && gruposVisibles.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Truck className="w-12 h-12" />
            <p className="text-sm text-center">No hay grupos asignados para hoy.</p>
          </div>
        )}

        {!loading &&
          pedidosDeHoy.map(({ grupo, pedidos, autoPedidos }) => {
            const todosLosPedidos: PedidoFabrica[] = [...pedidos, ...autoPedidos]
            const estaAbierto = gruposAbiertos[grupo.id] ?? true
            const modoDespacho = gruposEnModoDespacho[grupo.id] ?? false
            const cantidades = cantidadesDespacho[grupo.id] ?? {}

            // En modo despacho solo mostrar los pedidos que fueron tomados (tienen entrada en cantidades)
            const pedidosParaVista = modoDespacho
              ? todosLosPedidos.filter((p) => p.items.some((item) => `${item.productoId}_${p.id}` in cantidades))
              : todosLosPedidos

            const descripcion =
              todosLosPedidos.length === 0
                ? "Sin pedidos"
                : pedidos.length === 0
                ? `${autoPedidos.length} sin confirmar`
                : `${pedidos.length} confirmado(s)${autoPedidos.length > 0 ? ` · ${autoPedidos.length} auto` : ""}`

            return (
              <div
                key={grupo.id}
                className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden"
              >
                {/* Group header */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() =>
                    setGruposAbiertos((prev) => ({ ...prev, [grupo.id]: !prev[grupo.id] }))
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {grupo.nombre}
                      <span className="font-normal text-gray-400"> · {VISTA_LABEL[vistaActiva]}</span>
                    </p>
                    <p className="text-xs text-gray-400">{descripcion}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {modoDespacho && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        Armando
                      </span>
                    )}
                    {estaAbierto ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Group body */}
                {estaAbierto && (
                  <div className="border-t border-[#ebebeb] px-4 py-3 space-y-3">
                    {todosLosPedidos.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">
                        Sin pedidos ni diferencias de stock
                      </p>
                    ) : (
                      <>
                        {vistaActiva === "producto" && (
                          <VistaProducto
                            pedidos={pedidosParaVista}
                            modoDespacho={modoDespacho}
                            cantidades={cantidades}
                            onCantidadChange={(productoId, pedidoId, cantidad) =>
                              setCantidadDespacho(grupo.id, productoId, pedidoId, cantidad)
                            }
                          />
                        )}
                        {vistaActiva === "sucursal" && (
                          <VistaSucursal
                            pedidos={pedidosParaVista}
                            modoDespacho={modoDespacho}
                            cantidades={cantidades}
                            onCantidadChange={(productoId, pedidoId, cantidad) =>
                              setCantidadDespacho(grupo.id, productoId, pedidoId, cantidad)
                            }
                          />
                        )}
                        {vistaActiva === "resumen" && (
                          <VistaResumen
                            pedidos={pedidosParaVista}
                            modoDespacho={modoDespacho}
                            cantidades={cantidades}
                            onCantidadChange={(productoId, pedidoId, cantidad) =>
                              setCantidadDespacho(grupo.id, productoId, pedidoId, cantidad)
                            }
                          />
                        )}
                        {vistaActiva === "tabla" && (
                          <VistaTabla
                            pedidos={pedidosParaVista}
                            modoDespacho={modoDespacho}
                            cantidades={cantidades}
                            onCantidadChange={(productoId, pedidoId, cantidad) =>
                              setCantidadDespacho(grupo.id, productoId, pedidoId, cantidad)
                            }
                          />
                        )}

                        {/* Actions */}
                        {!modoDespacho ? (
                          <button
                            type="button"
                            onClick={() => setTomarDialogGrupoId(grupo.id)}
                            className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium"
                          >
                            Tomar pedidos
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDespachar(grupo.id, pedidosParaVista)}
                            disabled={despachando === grupo.id}
                            className="w-full py-3 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40"
                          >
                            {despachando === grupo.id ? "Despachando…" : "Despachar"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Tomar bottom sheet */}
      {tomarDialogGrupoId &&
        (() => {
          const grupoData = pedidosDeHoy.find((g) => g.grupo.id === tomarDialogGrupoId)
          if (!grupoData) return null
          const pedidos = [...grupoData.pedidos, ...grupoData.autoPedidos]

          return (
            <>
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setTomarDialogGrupoId(null)}
              />
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 px-4 pt-4 pb-8 space-y-4">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
                <p className="text-base font-semibold text-gray-900">Tomar pedidos</p>

                <div className="space-y-1">
                  {(["todos", "confirmados", "manual"] as const).map((op) => (
                    <label key={op} className="flex items-center gap-3 py-2 cursor-pointer">
                      <input
                        type="radio"
                        name="opcion-tomar"
                        value={op}
                        checked={opcionTomar === op}
                        onChange={() => setOpcionTomar(op)}
                        className="w-4 h-4 accent-[#1D9E75]"
                      />
                      <span className="text-sm text-gray-700">
                        {op === "todos" ? "Todos" : op === "confirmados" ? "Solo confirmados" : "Manual"}
                      </span>
                    </label>
                  ))}
                </div>

                {opcionTomar === "manual" && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Seleccionar sucursales
                    </p>
                    {pedidos.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 py-2 cursor-pointer rounded-lg px-2 ${
                          p.id.startsWith("auto_") ? "bg-amber-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={sucursalesParaTomar.includes(p.id)}
                          onChange={(e) => {
                            setSucursalesParaTomar((prev) =>
                              e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                            )
                          }}
                          className="w-4 h-4 accent-[#1D9E75]"
                        />
                        <span className="text-sm text-gray-700">
                          {p.origenNombre}
                          {p.id.startsWith("auto_") ? " (automático)" : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTomarDialogGrupoId(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTomar(tomarDialogGrupoId, pedidos)}
                    className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </>
          )
        })()}
    </div>
  )
}
