"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Upload, AlertTriangle, Package } from "lucide-react"
import { Pedido } from "@/lib/types"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"

interface PedidoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  name: string
  onNameChange: (value: string) => void
  onSubmit: () => void
  submitLabel: string
}

export function PedidoFormDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  onNameChange,
  onSubmit,
  submitLabel,
}: PedidoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pedidoName">Nombre del pedido *</Label>
            <Input
              id="pedidoName"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej: Proveedor Bebidas, Almacén, etc."
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  onSubmit()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importText: string
  onImportTextChange: (value: string) => void
  onImport: () => void
  stockMinimoDefault?: number
}

export function ImportDialog({
  open,
  onOpenChange,
  importText,
  onImportTextChange,
  onImport,
  stockMinimoDefault,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Productos</DialogTitle>
          <DialogDescription>
            Pega una lista de productos (uno por línea)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            value={importText}
            onChange={(e) => onImportTextChange(e.target.value)}
            placeholder="Leche&#10;Pan&#10;Huevos&#10;..."
            className="min-h-48 font-mono text-sm"
          />
          {stockMinimoDefault !== undefined && (
            <p className="text-xs text-muted-foreground">
              Stock mínimo por defecto: <strong>{stockMinimoDefault}</strong>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onImportTextChange("") }}>
            Cancelar
          </Button>
          <Button onClick={onImport} disabled={!importText.trim()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeletePedidoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidoName?: string
  productsCount: number
  onDelete: () => void
}

export function DeletePedidoDialog({
  open,
  onOpenChange,
  pedidoName,
  productsCount,
  onDelete,
}: DeletePedidoDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-2 border-destructive">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Pedido
          </AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar <strong>"{pedidoName}"</strong> y todos sus productos ({productsCount})?
            <br />Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface ClearStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClear: () => void
}

export function ClearStockDialog({
  open,
  onOpenChange,
  onClear,
}: ClearStockDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Limpiar Stock Actual?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrarán todos los valores de stock actual ingresados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onClear}>Limpiar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface ConfirmarNuevoEnlaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ConfirmarNuevoEnlaceDialog({
  open,
  onOpenChange,
  onConfirm,
}: ConfirmarNuevoEnlaceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Generar nuevo enlace
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ya existe un enlace activo para este pedido. Si generas un nuevo enlace, el anterior quedará obsoleto y no podrá ser usado.
            <br />
            <strong>¿Deseas continuar?</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Generar nuevo enlace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface ConfirmarEnvioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  productos: Array<{
    nombre: string
    cantidadPedida: number
    cantidadEnviada: number
    unidad: string
  }>
}

export function ConfirmarEnvioDialog({
  open,
  onOpenChange,
  onConfirm,
  productos,
}: ConfirmarEnvioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Package className="h-5 w-5" />
            Confirmar Envío
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Revisa los detalles del envío antes de confirmar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-3 sm:p-4 space-y-2">
            <h4 className="font-semibold text-sm sm:text-base mb-3">Resumen del envío:</h4>
            <div className="space-y-3">
              {productos.map((producto, index) => (
                <div key={index} className="space-y-1.5 py-2 border-b last:border-0">
                  <div className="font-medium text-sm sm:text-base">{producto.nombre}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground pl-2 sm:pl-0">
                    <span>Pedido: <strong className="text-foreground">{producto.cantidadPedida} {producto.unidad}</strong></span>
                    <span className="hidden sm:inline">→</span>
                    <span className="sm:font-semibold text-foreground">Envío: {producto.cantidadEnviada} {producto.unidad}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            Confirmar Envío
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmarEdicionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ConfirmarEdicionDialog({
  open,
  onOpenChange,
  onConfirm,
}: ConfirmarEdicionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Editar pedido confirmado
          </AlertDialogTitle>
          <AlertDialogDescription>
            Este pedido ya fue confirmado. Si editas las cantidades, se cancelará el pedido confirmado y deberás volver a confirmarlo.
            <br />
            <strong>¿Deseas continuar?</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Sí, editar y cancelar pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DEFAULT_FORMAT }

