"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus } from "lucide-react"
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
  items: initialItems
}: PedidoImageExportDialogProps) {
  const { exportPedidoImage } = usePedidoImageExport()
  const [isExporting, setIsExporting] = useState(false)
  const [editableLocal, setEditableLocal] = useState(local)
  const [editableResponsable, setEditableResponsable] = useState(responsable)
  const [editableFecha, setEditableFecha] = useState(fecha)
  const [editableItems, setEditableItems] = useState(initialItems)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      exportPedidoImage({
        local: editableLocal,
        responsable: editableResponsable,
        fecha: editableFecha,
        titulo,
        items: editableItems.filter(item => item.nombre.trim() && item.cantidad > 0)
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error exporting image:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const updateItem = (index: number, field: 'nombre' | 'cantidad', value: string | number) => {
    const newItems = [...editableItems]
    if (field === 'nombre') {
      newItems[index].nombre = value as string
    } else {
      newItems[index].cantidad = Math.max(0, Number(value) || 0)
    }
    setEditableItems(newItems)
  }

  const removeItem = (index: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== index))
  }

  const addItem = () => {
    setEditableItems([...editableItems, { nombre: "", cantidad: 1 }])
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Exportar Pedido como Imagen</AlertDialogTitle>
          <AlertDialogDescription>
            Revisa y edita los datos del pedido antes de exportar la imagen PNG:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Datos básicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="local">Local</Label>
              <Input
                id="local"
                value={editableLocal}
                onChange={(e) => setEditableLocal(e.target.value)}
                placeholder="Nombre del local"
              />
            </div>
            <div>
              <Label htmlFor="responsable">Responsable</Label>
              <Input
                id="responsable"
                value={editableResponsable}
                onChange={(e) => setEditableResponsable(e.target.value)}
                placeholder="Nombre del responsable"
              />
            </div>
            <div>
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                value={editableFecha}
                onChange={(e) => setEditableFecha(e.target.value)}
                placeholder="DD/MM"
              />
            </div>
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Productos a incluir ({editableItems.filter(item => item.nombre.trim() && item.cantidad > 0).length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="h-7 px-2"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar
              </Button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              {editableItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      value={item.nombre}
                      onChange={(e) => updateItem(index, 'nombre', e.target.value)}
                      placeholder="Nombre del producto"
                      className="h-8"
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                      placeholder="Cant."
                      min="0"
                      className="h-8 text-center"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              
              {editableItems.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No hay productos. Agrega productos para exportar.
                </div>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExporting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleExport} 
            disabled={isExporting || editableItems.filter(item => item.nombre.trim() && item.cantidad > 0).length === 0}
          >
            {isExporting ? "Exportando..." : "Exportar Imagen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
