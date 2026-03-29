"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { RecepcionItem } from "@/src/modules/pedidos-v2/domain/types"

export type RecepcionFormValues = {
  pedidoId: string
  remitoSalidaId: string
  pedidoNumero: string
  remitoSalidaNumero: string
  observaciones: string
  items: RecepcionItem[]
  firma: {
    firmado: boolean
    firmadoAt: Date
    firmadoBy: string
    firmadoByName: string
    firmadoByEmail: string
    firmaData: string
  }
}

interface RecepcionFormProps {
  onSubmit: (payload: RecepcionFormValues) => Promise<void> | void
  loading?: boolean
}

const emptyItem = (): RecepcionItem => ({
  itemId: crypto.randomUUID(),
  pedidoItemId: "",
  productId: "",
  productNombre: "",
  unidad: "",
  cantidadPedida: 0,
  cantidadPreparada: 0,
  cantidadTransportada: 0,
  cantidadRecibida: 0,
  cantidadPendiente: 0,
  cantidadDevuelta: 0,
  cantidadDanada: 0,
  estadoLinea: "ok",
  motivo: "",
  observaciones: ""
})

export function RecepcionForm({ onSubmit, loading = false }: RecepcionFormProps) {
  const [pedidoId, setPedidoId] = useState("")
  const [remitoSalidaId, setRemitoSalidaId] = useState("")
  const [pedidoNumero, setPedidoNumero] = useState("")
  const [remitoSalidaNumero, setRemitoSalidaNumero] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [firma, setFirma] = useState({ firmadoBy: "", firmadoByName: "", firmadoByEmail: "", firmaData: "" })
  const [items, setItems] = useState<RecepcionItem[]>([emptyItem()])

  const updateItem = (index: number, field: keyof RecepcionItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Confirmar Recepcion V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="pedidoId" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} />
        <Input placeholder="remitoSalidaId" value={remitoSalidaId} onChange={(e) => setRemitoSalidaId(e.target.value)} />
        <Input placeholder="pedidoNumero" value={pedidoNumero} onChange={(e) => setPedidoNumero(e.target.value)} />
        <Input placeholder="remitoSalidaNumero" value={remitoSalidaNumero} onChange={(e) => setRemitoSalidaNumero(e.target.value)} />
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
          <div key={item.itemId} className="grid gap-2 sm:grid-cols-8">
            <Input placeholder="productId" value={item.productId} onChange={(e) => updateItem(index, "productId", e.target.value)} />
            <Input placeholder="producto" value={item.productNombre} onChange={(e) => updateItem(index, "productNombre", e.target.value)} />
            <Input placeholder="unidad" value={item.unidad} onChange={(e) => updateItem(index, "unidad", e.target.value)} />
            <Input type="number" placeholder="pedida" value={item.cantidadPedida} onChange={(e) => updateItem(index, "cantidadPedida", Number(e.target.value))} />
            <Input type="number" placeholder="prep" value={item.cantidadPreparada} onChange={(e) => updateItem(index, "cantidadPreparada", Number(e.target.value))} />
            <Input type="number" placeholder="transp" value={item.cantidadTransportada} onChange={(e) => updateItem(index, "cantidadTransportada", Number(e.target.value))} />
            <Input type="number" placeholder="recibida" value={item.cantidadRecibida} onChange={(e) => updateItem(index, "cantidadRecibida", Number(e.target.value))} />
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
          remitoSalidaId,
          pedidoNumero,
          remitoSalidaNumero,
          observaciones,
          items,
          firma: {
            firmado: true,
            firmadoAt: new Date(),
            firmadoBy: firma.firmadoBy,
            firmadoByName: firma.firmadoByName,
            firmadoByEmail: firma.firmadoByEmail,
            firmaData: firma.firmaData
          }
        })}
      >
        {loading ? "Confirmando..." : "Confirmar Recepcion"}
      </Button>
    </div>
  )
}
