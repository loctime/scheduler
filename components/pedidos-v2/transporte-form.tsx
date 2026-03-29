"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RemitoSalidaItem } from "@/src/modules/pedidos-v2/domain/types"

export type TransporteFormValues = {
  remitoSalidaId: string
  pedidoId: string
  firmaTransportista: {
    firmado: boolean
    firmadoAt: Date
    firmadoBy: string
    firmadoByName: string
    firmadoByEmail: string
    firmaData: string
  }
  items?: RemitoSalidaItem[]
}

interface TransporteFormProps {
  onSubmit: (payload: TransporteFormValues) => Promise<void> | void
  loading?: boolean
}

export function TransporteForm({ onSubmit, loading = false }: TransporteFormProps) {
  const [remitoSalidaId, setRemitoSalidaId] = useState("")
  const [pedidoId, setPedidoId] = useState("")
  const [firma, setFirma] = useState({ firmadoBy: "", firmadoByName: "", firmadoByEmail: "", firmaData: "" })

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">Registrar Transporte</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="remitoSalidaId" value={remitoSalidaId} onChange={(e) => setRemitoSalidaId(e.target.value)} />
        <Input placeholder="pedidoId" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Firma transportista</Label>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="firmadoBy" value={firma.firmadoBy} onChange={(e) => setFirma({ ...firma, firmadoBy: e.target.value })} />
          <Input placeholder="firmadoByName" value={firma.firmadoByName} onChange={(e) => setFirma({ ...firma, firmadoByName: e.target.value })} />
          <Input placeholder="firmadoByEmail" value={firma.firmadoByEmail} onChange={(e) => setFirma({ ...firma, firmadoByEmail: e.target.value })} />
          <Input placeholder="firmaData" value={firma.firmaData} onChange={(e) => setFirma({ ...firma, firmaData: e.target.value })} />
        </div>
      </div>

      <Button
        disabled={loading}
        onClick={() => onSubmit({
          remitoSalidaId,
          pedidoId,
          firmaTransportista: {
            firmado: true,
            firmadoAt: new Date(),
            firmadoBy: firma.firmadoBy,
            firmadoByName: firma.firmadoByName,
            firmadoByEmail: firma.firmadoByEmail,
            firmaData: firma.firmaData
          }
        })}
      >
        {loading ? "Registrando..." : "Registrar Transporte"}
      </Button>
    </div>
  )
}
