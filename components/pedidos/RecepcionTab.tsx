"use client"

import { Package } from "lucide-react"
import { RecepcionForm } from "./recepcion-form"
import type { ProductoEnviado } from "@/hooks/pedidos/use-pedido-recepcion"

export interface RecepcionTabProps {
  productosEnviados: ProductoEnviado[]
  observacionesRemito: string | null
  loadingRecepcion: boolean
  onConfirmar: (recepcion: any) => void | Promise<void>
  legacyDisabled?: boolean
}

export function RecepcionTab({
  productosEnviados,
  observacionesRemito,
  loadingRecepcion,
  onConfirmar,
  legacyDisabled = false
}: RecepcionTabProps) {
  return (
    <div className="space-y-3 md:space-y-4">
      {legacyDisabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Recepción legacy deshabilitada. Usar flujo V2.
        </div>
      )}
      {loadingRecepcion ? (
        <div className="flex items-center justify-center h-64 md:h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : productosEnviados.length === 0 ? (
        <div className="rounded-lg border bg-card p-4 md:p-6 text-center">
          <Package className="h-8 w-8 md:h-10 md:w-10 mx-auto text-muted-foreground mb-2 md:mb-3" />
          <h3 className="text-sm md:text-base font-semibold mb-1">No hay productos para recibir</h3>
          <p className="text-muted-foreground text-xs md:text-sm">
            Primero debe generarse un remito de envío para poder registrar la recepción.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-2.5 md:p-4 space-y-3 md:space-y-4">
          {observacionesRemito && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-2.5 md:p-3">
              <h4 className="font-semibold text-xs mb-1.5 md:mb-2 text-blue-900 dark:text-blue-100">
                Observaciones del envío:
              </h4>
              <p className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {observacionesRemito}
              </p>
            </div>
          )}
          <RecepcionForm
            productosEnviados={productosEnviados as Array<{
              productoId: string
              productoNombre: string
              cantidadPedida: number
              cantidadEnviada: number
              observacionesEnvio?: string
              modoCompra?: "unidad" | "pack"
              cantidadPorPack?: number
            }>}
            onConfirmar={onConfirmar}
            loading={loadingRecepcion}
            esParcial={false}
          />
        </div>
      )}
    </div>
  )
}
