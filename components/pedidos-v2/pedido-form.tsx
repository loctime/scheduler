"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { PedidoItem, PedidoOrigenDestino } from "@/src/modules/pedidos-v2/domain/types"

export type PedidoFormValues = {
  origen: PedidoOrigenDestino
  destino: PedidoOrigenDestino
  observaciones: string
  usaPendientes: boolean
  pedidoOrigenPendienteIds: string[]
  items: PedidoItem[]
}

interface PedidoFormProps {
  onSubmit: (payload: PedidoFormValues) => Promise<void> | void
  loading?: boolean
}

const emptyItem = (): PedidoItem => ({
  itemId: crypto.randomUUID(),
  productId: "",
  productNombre: "",
  unidad: "",
  stockMinimo: 0,
  stockActual: 0,
  cantidadPedida: 0,
  cantidadSugerida: 0,
  cantidadManual: 0,
  observaciones: ""
})

export function PedidoForm({ onSubmit, loading = false }: PedidoFormProps) {
  const [origen, setOrigen] = useState<PedidoOrigenDestino>({ tipo: "", id: "", nombre: "" })
  const [destino, setDestino] = useState<PedidoOrigenDestino>({ tipo: "", id: "", nombre: "" })
  const [observaciones, setObservaciones] = useState("")
  const [items, setItems] = useState<PedidoItem[]>([emptyItem()])

  const updateItem = (index: number, field: keyof PedidoItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Crear Pedido V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Origen tipo</Label>
          <Input value={origen.tipo} onChange={(e) => setOrigen({ ...origen, tipo: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Origen id</Label>
          <Input value={origen.id} onChange={(e) => setOrigen({ ...origen, id: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Origen nombre</Label>
          <Input value={origen.nombre} onChange={(e) => setOrigen({ ...origen, nombre: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Destino tipo</Label>
          <Input value={destino.tipo} onChange={(e) => setDestino({ ...destino, tipo: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Destino id</Label>
          <Input value={destino.id} onChange={(e) => setDestino({ ...destino, id: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Destino nombre</Label>
          <Input value={destino.nombre} onChange={(e) => setDestino({ ...destino, nombre: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Items</h3>
          <Button type="button" onClick={addItem} size="sm" variant="outline">Agregar item</Button>
        </div>
        {items.map((item, index) => (
          <div key={item.itemId} className="grid gap-2 sm:grid-cols-6">
            <Input placeholder="productId" value={item.productId} onChange={(e) => updateItem(index, "productId", e.target.value)} />
            <Input placeholder="producto" value={item.productNombre} onChange={(e) => updateItem(index, "productNombre", e.target.value)} />
            <Input placeholder="unidad" value={item.unidad} onChange={(e) => updateItem(index, "unidad", e.target.value)} />
            <Input type="number" placeholder="pedida" value={item.cantidadPedida} onChange={(e) => updateItem(index, "cantidadPedida", Number(e.target.value))} />
            <Input type="number" placeholder="sugerida" value={item.cantidadSugerida} onChange={(e) => updateItem(index, "cantidadSugerida", Number(e.target.value))} />
            <div className="flex gap-2">
              <Input type="number" placeholder="manual" value={item.cantidadManual} onChange={(e) => updateItem(index, "cantidadManual", Number(e.target.value))} />
              <Button type="button" variant="outline" onClick={() => removeItem(index)}>Quitar</Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        disabled={loading}
        onClick={() => onSubmit({ origen, destino, observaciones, usaPendientes: false, pedidoOrigenPendienteIds: [], items })}
      >
        {loading ? "Creando..." : "Crear Pedido"}
      </Button>
    </div>
  )
}
