"use client"

import { Button } from "@/components/ui/button"
import { PedidoImageTemplate } from "./PedidoImageTemplate"
import { exportPedidoImage } from "@/lib/exportPedidoImage"

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoImageExporterProps {
  local: string
  responsable: string
  fecha: string
  titulo?: string
  items: PedidoItem[]
}

export function PedidoImageExporter({
  local,
  responsable,
  fecha,
  titulo = "PEDIDO INSUMOS PAPELERA",
  items
}: PedidoImageExporterProps) {
  return (
    <div className="space-y-4">
      {/* Hidden template for image generation */}
      <div className="hidden">
        <PedidoImageTemplate
          local={local}
          responsable={responsable}
          fecha={fecha}
          titulo={titulo}
          items={items}
        />
      </div>

      {/* Export button */}
      <Button onClick={exportPedidoImage} className="w-full">
        Exportar Imagen
      </Button>
    </div>
  )
}
