"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ConfirmarRecepcionRemitoRequest, RecepcionResultadoGlobal } from "@/types/logistics-v2"

interface RecepcionRemitoFormProps {
  defaultOwnerId: string
  defaultBranchId: string
  loading?: boolean
  onSubmit: (payload: ConfirmarRecepcionRemitoRequest) => Promise<void> | void
}

export function RecepcionRemitoForm({ defaultOwnerId, defaultBranchId, loading = false, onSubmit }: RecepcionRemitoFormProps) {
  const [remitoSalidaId, setRemitoSalidaId] = useState("")
  const [recepcionadoPor, setRecepcionadoPor] = useState("")
  const [productId, setProductId] = useState("")
  const [okQty, setOkQty] = useState("0")
  const [faltanteQty, setFaltanteQty] = useState("0")
  const [danadaQty, setDanadaQty] = useState("0")
  const [pendienteQty, setPendienteQty] = useState("0")
  const [devueltaQty, setDevueltaQty] = useState("0")
  const [estadoItem, setEstadoItem] = useState<ConfirmarRecepcionRemitoRequest["items"][number]["estadoRecepcion"]>("ok")
  const [resultadoGlobal, setResultadoGlobal] = useState<RecepcionResultadoGlobal>("total_ok")
  const [observaciones, setObservaciones] = useState("")

  const total = useMemo(
    () => Number(okQty) + Number(faltanteQty) + Number(danadaQty) + Number(pendienteQty) + Number(devueltaQty),
    [okQty, faltanteQty, danadaQty, pendienteQty, devueltaQty]
  )

  const canSubmit = useMemo(
    () => remitoSalidaId.trim() && recepcionadoPor.trim() && productId.trim() && total > 0,
    [remitoSalidaId, recepcionadoPor, productId, total]
  )

  const handleSubmit = async () => {
    if (!canSubmit) return

    await onSubmit({
      ownerId: defaultOwnerId,
      branchId: defaultBranchId,
      remitoSalidaId: remitoSalidaId.trim(),
      recepcionadoPor: recepcionadoPor.trim(),
      resultadoGlobal,
      observacionesGenerales: observaciones.trim() || undefined,
      items: [
        {
          productId: productId.trim(),
          cantidadRecibidaOk: Number(okQty),
          cantidadFaltante: Number(faltanteQty),
          cantidadDanada: Number(danadaQty),
          cantidadPendiente: Number(pendienteQty),
          cantidadDevuelta: Number(devueltaQty),
          estadoRecepcion: estadoItem,
          comentario: observaciones.trim() || undefined
        }
      ]
    })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Recepcionar Remito V2</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Remito ID</Label>
          <Input value={remitoSalidaId} onChange={(e) => setRemitoSalidaId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Recepcionado por</Label>
          <Input value={recepcionadoPor} onChange={(e) => setRecepcionadoPor(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Product ID</Label>
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Estado item</Label>
          <Select value={estadoItem} onValueChange={(value) => setEstadoItem(value as typeof estadoItem)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ok">ok</SelectItem>
              <SelectItem value="faltante">faltante</SelectItem>
              <SelectItem value="danado">danado</SelectItem>
              <SelectItem value="rechazado">rechazado</SelectItem>
              <SelectItem value="pendiente">pendiente</SelectItem>
              <SelectItem value="devuelto">devuelto</SelectItem>
              <SelectItem value="mixto">mixto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <Input type="number" min={0} value={okQty} onChange={(e) => setOkQty(e.target.value)} placeholder="ok" />
        <Input type="number" min={0} value={faltanteQty} onChange={(e) => setFaltanteQty(e.target.value)} placeholder="faltante" />
        <Input type="number" min={0} value={danadaQty} onChange={(e) => setDanadaQty(e.target.value)} placeholder="danado" />
        <Input type="number" min={0} value={pendienteQty} onChange={(e) => setPendienteQty(e.target.value)} placeholder="pendiente" />
        <Input type="number" min={0} value={devueltaQty} onChange={(e) => setDevueltaQty(e.target.value)} placeholder="devuelto" />
      </div>

      <div className="space-y-1">
        <Label>Resultado global</Label>
        <Select value={resultadoGlobal} onValueChange={(value) => setResultadoGlobal(value as RecepcionResultadoGlobal)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total_ok">total_ok</SelectItem>
            <SelectItem value="parcial">parcial</SelectItem>
            <SelectItem value="rechazada">rechazada</SelectItem>
            <SelectItem value="con_observaciones">con_observaciones</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
        {loading ? "Confirmando..." : "Confirmar Recepcion"}
      </Button>
    </div>
  )
}

