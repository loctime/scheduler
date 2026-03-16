"use client"

import { useState } from "react"
import { PedidoActions, PedidoActionsProps } from "./PedidoActions"
import { PedidoImageExportDialog } from "./PedidoImageExportDialog"
import { Pedido } from "@/lib/types"

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoActionsWithImageExportProps extends Omit<PedidoActionsProps, 'onExportImage'> {
  selectedPedido: Pedido | null
  productosAPedirActualizados: Array<{
    id: string
    nombre: string
    stockMinimo: number
    cantidadUnidades: number
  }>
  user?: any
}

export function PedidoActionsWithImageExport({
  selectedPedido,
  productosAPedirActualizados,
  user,
  ...pedidoActionsProps
}: PedidoActionsWithImageExportProps) {
  const [showExportDialog, setShowExportDialog] = useState(false)

  const handleExportImage = () => {
    setShowExportDialog(true)
  }

  // Preparar datos para la exportación
  const pedidoData = {
    local: selectedPedido?.destinoDefault || "LOCAL",
    responsable: selectedPedido?.assignedToNombre || user?.displayName || "RESPONSABLE",
    fecha: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }).replace('/', '/'),
    titulo: `PEDIDO ${selectedPedido?.nombre?.toUpperCase() || 'INSUMOS PAPELERA'}`,
    items: productosAPedirActualizados.map(item => ({
      nombre: item.nombre,
      cantidad: item.cantidadUnidades
    }))
  }

  return (
    <>
      <PedidoActions
        selectedPedido={selectedPedido}
        {...pedidoActionsProps}
        onExportImage={handleExportImage}
      />
      
      <PedidoImageExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        local={pedidoData.local}
        responsable={pedidoData.responsable}
        fecha={pedidoData.fecha}
        titulo={pedidoData.titulo}
        items={pedidoData.items}
      />
    </>
  )
}
