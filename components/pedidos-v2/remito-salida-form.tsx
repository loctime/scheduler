"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { RemitoSalidaItem } from "@/src/modules/pedidos-v2/domain/types"

export type RemitoSalidaFormValues = {
  pedidoId: string
  pedidoNumero: string
  origen: { id: string; nombre: string }
  destino: { id: string; nombre: string }
  observaciones: string
  items: RemitoSalidaItem[]
  firmaEmisor: {
    firmado: boolean
    firmadoAt: Date
    firmadoBy: string
    firmadoByName: string
    firmadoByEmail: string
    firmaData: string
  }
}

interface RemitoSalidaFormProps {
  onSubmit: (payload: RemitoSalidaFormValues) => Promise<void> | void
  loading?: boolean
}

const emptyItem = (): RemitoSalidaItem => ({
  itemId: crypto.randomUUID(),
  pedidoItemId: "",
  productId: "",
  productNombre: "",
  unidad: "",
  cantidadPedida: 0,
  cantidadPreparada: 0,
  cantidadTransportada: 0,
  estadoLinea: "ok",
  motivo: "",
  observaciones: ""
})

export function RemitoSalidaForm({ onSubmit, loading = false }: RemitoSalidaFormProps) {
  const [pedidoId, setPedidoId] = useState("")
  const [pedidoNumero, setPedidoNumero] = useState("")
  const [origen, setOrigen] = useState({ id: "", nombre: "" })
  const [destino, setDestino] = useState({ id: "", nombre: "" })
  const [observaciones, setObservaciones] = useState("")
  const [firma, setFirma] = useState({ firmadoBy: "", firmadoByName: "", firmadoByEmail: "", firmaData: "" })
  const [items, setItems] = useState<RemitoSalidaItem[]>([emptyItem()])

  const updateItem = (index: number, field: keyof RemitoSalidaItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Emitir RemitoSalida V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="pedidoId" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} />
        <Input placeholder="pedidoNumero" value={pedidoNumero} onChange={(e) => setPedidoNumero(e.target.value)} />
        <Input placeholder="origen id" value={origen.id} onChange={(e) => setOrigen({ ...origen, id: e.target.value })} />
        <Input placeholder="origen nombre" value={origen.nombre} onChange={(e) => setOrigen({ ...origen, nombre: e.target.value })} />
        <Input placeholder="destino id" value={destino.id} onChange={(e) => setDestino({ ...destino, id: e.target.value })} />
        <Input placeholder="destino nombre" value={destino.nombre} onChange={(e) => setDestino({ ...destino, nombre: e.target.value })} />
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
          <div key={item.itemId} className="grid gap-2 sm:grid-cols-7">
            <Input placeholder="productId" value={item.productId} onChange={(e) => updateItem(index, "productId", e.target.value)} />
            <Input placeholder="producto" value={item.productNombre} onChange={(e) => updateItem(index, "productNombre", e.target.value)} />
            <Input placeholder="unidad" value={item.unidad} onChange={(e) => updateItem(index, "unidad", e.target.value)} />
            <Input type="number" placeholder="pedida" value={item.cantidadPedida} onChange={(e) => updateItem(index, "cantidadPedida", Number(e.target.value))} />
            <Input type="number" placeholder="preparada" value={item.cantidadPreparada} onChange={(e) => updateItem(index, "cantidadPreparada", Number(e.target.value))} />
            <Input type="number" placeholder="transportada" value={item.cantidadTransportada} onChange={(e) => updateItem(index, "cantidadTransportada", Number(e.target.value))} />
            <Button type="button" variant="outline" onClick={() => removeItem(index)}>Quitar</Button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Input placeholder="firmadoBy" value={firma.firmadoBy} onChange={(e) => setFirma({ ...firma, firmadoBy: e.target.value })} />
        <Input placeholder="firmadoByName" value={firma.firmadoByName} onChange={(e) => setFirma({ ...firma, firmadoByName: e.target.value })} />
        <Input placeholder="firmadoByEmail" value={firma.firmadoByEmail} onChange={(e) => setFirma({ ...firma, firmadoByEmail: e.target.value })} />
        <Input placeholder="firmaData" value={firma.firmaData} onChange={(e) => setFirma({ ...firma, firmaData: e.target.value })} />
      </div>

      <Button
        disabled={loading}
        onClick={() => onSubmit({
          pedidoId,
          pedidoNumero,
          origen,
          destino,
          observaciones,
          items,
          firmaEmisor: {
            firmado: true,
            firmadoAt: new Date(),
            firmadoBy: firma.firmadoBy,
            firmadoByName: firma.firmadoByName,
            firmadoByEmail: firma.firmadoByEmail,
            firmaData: firma.firmaData
          }
        })}
      >
        {loading ? "Emitiendo..." : "Emitir Remito"}
      </Button>
    </div>
  )
}
