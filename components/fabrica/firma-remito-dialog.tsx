"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FirmaDigital } from "@/components/remitos/firma-digital"
import type { Producto, EnlacePublico } from "@/lib/types"

interface FirmaRemitoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (firma: { nombre: string; firma?: string }) => void
  nombrePedido: string
  productos: Producto[]
  productosDisponibles: EnlacePublico["productosDisponibles"]
}

export function FirmaRemitoDialog({
  open,
  onOpenChange,
  onConfirm,
  nombrePedido,
  productos,
  productosDisponibles,
}: FirmaRemitoDialogProps) {
  const [firma, setFirma] = useState<{ nombre: string; firma?: string }>({ nombre: "" })

  const handleConfirm = () => {
    if (!firma.nombre.trim()) {
      alert("Debes ingresar tu nombre para firmar el remito")
      return
    }
    onConfirm(firma)
    setFirma({ nombre: "" })
  }

  // Calcular resumen de productos
  // Convertir array a Record para acceso rápido
  const productosDisponiblesMap = (productosDisponibles || []).reduce((acc, item) => {
    acc[item.productoId] = item
    return acc
  }, {} as Record<string, { productoId: string; disponible: boolean; cantidadEnviar?: number }>)

  const productosResumen = productos
    .filter((p) => {
      if (!productosDisponibles) return false
      const data = productosDisponiblesMap[p.id]
      return data?.disponible && (data.cantidadEnviar ?? 0) > 0
    })
    .map((p) => {
      const data = productosDisponiblesMap[p.id]
      return {
        nombre: p.nombre,
        cantidad: data?.cantidadEnviar ?? 0,
        unidad: p.unidad || "U",
      }
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Firmar remito de envío</DialogTitle>
          <DialogDescription>
            Confirma los productos a enviar y firma el remito para {nombrePedido}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resumen de productos */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Productos a enviar:</h3>
            <div className="space-y-2">
              {productosResumen.map((p, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{p.nombre}</span>
                  <span className="font-medium">
                    {p.cantidad} {p.unidad}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total de productos:</span>
                <span>{productosResumen.length}</span>
              </div>
            </div>
          </div>

          {/* Firma digital */}
          <div>
            <h3 className="font-semibold mb-3">Firma digital:</h3>
            <FirmaDigital
              nombre={firma.nombre}
              firma={firma.firma}
              onFirmaChange={setFirma}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!firma.nombre.trim()}>
            Confirmar y generar remito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

