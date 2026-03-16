"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { usePedidoImageExport } from "@/hooks/usePedidoImageExport"

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoImageExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  local: string
  responsable: string
  fecha: string
  titulo?: string
  items: PedidoItem[]
}

export function PedidoImageExportDialog({
  open,
  onOpenChange,
  local,
  responsable,
  fecha,
  titulo = "PEDIDO INSUMOS PAPELERA",
  items
}: PedidoImageExportDialogProps) {
  const { exportPedidoImage } = usePedidoImageExport()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      exportPedidoImage({
        local,
        responsable,
        fecha,
        titulo,
        items
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error exporting image:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exportar Pedido como Imagen</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro que quieres exportar este pedido como una imagen PNG?
            <br />
            <br />
            <strong>Local:</strong> {local}<br />
            <strong>Responsable:</strong> {responsable}<br />
            <strong>Fecha:</strong> {fecha}<br />
            <strong>Productos:</strong> {items.length}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExporting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exportando..." : "Exportar Imagen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
