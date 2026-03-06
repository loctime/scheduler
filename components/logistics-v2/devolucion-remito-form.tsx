"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CrearDevolucionRemitoRequest, TipoDevolucion } from "@/types/logistics-v2"

interface DevolucionRemitoFormProps {
  defaultOwnerId: string
  defaultBranchId: string
  loading?: boolean
  onSubmit: (payload: CrearDevolucionRemitoRequest) => Promise<void> | void
}

export function DevolucionRemitoForm({ defaultOwnerId, defaultBranchId, loading = false, onSubmit }: DevolucionRemitoFormProps) {
  const [remitoSalidaId, setRemitoSalidaId] = useState("")
  const [recepcionRemitoId, setRecepcionRemitoId] = useState("")
  const [creadaPor, setCreadaPor] = useState("")
  const [motivoGeneral, setMotivoGeneral] = useState("")
  const [destinoDevolucion, setDestinoDevolucion] = useState("")
  const [tipoDevolucion, setTipoDevolucion] = useState<TipoDevolucion>("a_proveedor")
  const [productId, setProductId] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [motivoItem, setMotivoItem] = useState("")

  const canSubmit = useMemo(
    () =>
      remitoSalidaId.trim() &&
      creadaPor.trim() &&
      motivoGeneral.trim() &&
      destinoDevolucion.trim() &&
      productId.trim() &&
      Number(cantidad) > 0 &&
      motivoItem.trim(),
    [remitoSalidaId, creadaPor, motivoGeneral, destinoDevolucion, productId, cantidad, motivoItem]
  )

  const handleSubmit = async () => {
    if (!canSubmit) return

    await onSubmit({
      ownerId: defaultOwnerId,
      branchId: defaultBranchId,
      remitoSalidaId: remitoSalidaId.trim(),
      recepcionRemitoId: recepcionRemitoId.trim() || undefined,
      tipoDevolucion,
      motivoGeneral: motivoGeneral.trim(),
      creadaPor: creadaPor.trim(),
      destinoDevolucion: destinoDevolucion.trim(),
      items: [
        {
          productId: productId.trim(),
          cantidad: Number(cantidad),
          motivo: motivoItem.trim(),
          accionEsperada: "reponer"
        }
      ]
    })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Crear Devolucion V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Remito salida ID</Label>
          <Input value={remitoSalidaId} onChange={(e) => setRemitoSalidaId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Recepcion ID (opcional)</Label>
          <Input value={recepcionRemitoId} onChange={(e) => setRecepcionRemitoId(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Creada por</Label>
          <Input value={creadaPor} onChange={(e) => setCreadaPor(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Tipo devolucion</Label>
          <Select value={tipoDevolucion} onValueChange={(value) => setTipoDevolucion(value as TipoDevolucion)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_proveedor">a_proveedor</SelectItem>
              <SelectItem value="interna">interna</SelectItem>
              <SelectItem value="ajuste_stock">ajuste_stock</SelectItem>
              <SelectItem value="reposicion_pendiente">reposicion_pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Destino devolucion</Label>
        <Input value={destinoDevolucion} onChange={(e) => setDestinoDevolucion(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label>Motivo general</Label>
        <Textarea value={motivoGeneral} onChange={(e) => setMotivoGeneral(e.target.value)} rows={2} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="productId" />
        <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="cantidad" />
        <Input value={motivoItem} onChange={(e) => setMotivoItem(e.target.value)} placeholder="motivo item" />
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
        {loading ? "Creando..." : "Crear Devolucion"}
      </Button>
    </div>
  )
}
