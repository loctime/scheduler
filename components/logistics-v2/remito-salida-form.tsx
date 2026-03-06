"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmitirRemitoSalidaRequest } from "@/types/logistics-v2"

export type RemitoSalidaFormValues = EmitirRemitoSalidaRequest

interface RemitoSalidaFormProps {
  defaultOwnerId: string
  defaultBranchId: string
  loading?: boolean
  onSubmit: (payload: RemitoSalidaFormValues) => Promise<void> | void
}

export function RemitoSalidaForm({ defaultOwnerId, defaultBranchId, loading = false, onSubmit }: RemitoSalidaFormProps) {
  const [origen, setOrigen] = useState("")
  const [destino, setDestino] = useState("")
  const [transportista, setTransportista] = useState("")
  const [vehiculo, setVehiculo] = useState("")
  const [productId, setProductId] = useState("")
  const [cantidad, setCantidad] = useState("0")
  const [observaciones, setObservaciones] = useState("")

  const canSubmit = useMemo(
    () => origen.trim() && destino.trim() && transportista.trim() && productId.trim() && Number(cantidad) > 0,
    [origen, destino, transportista, productId, cantidad]
  )

  const handleSubmit = async () => {
    if (!canSubmit) return

    await onSubmit({
      ownerId: defaultOwnerId,
      branchId: defaultBranchId,
      origen: origen.trim(),
      destino: destino.trim(),
      transportista: transportista.trim(),
      vehiculo: vehiculo.trim() || undefined,
      items: [
        {
          productId: productId.trim(),
          cantidadEnviadaUnidadesBase: Number(cantidad),
          observacionesEnvio: observaciones.trim() || undefined
        }
      ]
    })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Emitir Remito V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Origen</Label>
          <Input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Deposito Central" />
        </div>
        <div className="space-y-1">
          <Label>Destino</Label>
          <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Sucursal 01" />
        </div>
        <div className="space-y-1">
          <Label>Transportista</Label>
          <Input value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Nombre" />
        </div>
        <div className="space-y-1">
          <Label>Vehiculo (opcional)</Label>
          <Input value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} placeholder="AA123BB" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Product ID</Label>
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="product-123" />
        </div>
        <div className="space-y-1">
          <Label>Cantidad (unidad base)</Label>
          <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Observaciones item (opcional)</Label>
        <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
        {loading ? "Emitiendo..." : "Emitir Remito"}
      </Button>
    </div>
  )
}
