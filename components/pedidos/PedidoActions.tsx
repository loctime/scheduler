"use client"

import { Button } from "@/components/ui/button"
import { Copy, FileText, Link as LinkIcon, ExternalLink, Bell, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PedidoActionsProps {
  productosAPedirCount: number
  productosAPedirLength: number
  resultadoEngine: { texto: string } | null
  selectedPedido: { estado?: string; sheetUrl?: string | null } | null
  enlaceActivo: { id: string } | null
  loadingEnlace: boolean
  onCopyPedido: () => void
  onCopyStock: () => void
  onLlevarPedidoASheet: () => void
  onGenerarEnlace: () => void
  onVerPedido: () => void
  hasSheetUrl: boolean
}

export function PedidoActions({
  productosAPedirCount,
  productosAPedirLength,
  resultadoEngine,
  selectedPedido,
  enlaceActivo,
  loadingEnlace,
  onCopyPedido,
  onCopyStock,
  onLlevarPedidoASheet,
  onGenerarEnlace,
  onVerPedido,
  hasSheetUrl
}: PedidoActionsProps) {
  return (
    <div className="flex flex-col gap-2 pt-1.5 border-t border-border">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
            productosAPedirCount > 0
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          )}
        >
          {productosAPedirLength > 0 ? `${productosAPedirCount} a pedir` : "✓ OK"}
        </span>
        <div className="flex-1" />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
        <Button
          size="sm"
          className="h-7 px-2 flex-1 sm:flex-initial"
          disabled={productosAPedirCount === 0}
          onClick={onCopyStock}
        >
          <Copy className="h-3.5 w-3.5 sm:mr-1" />
          <span className="text-xs">copiar stock</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 flex-1 sm:flex-initial"
          disabled={productosAPedirCount === 0}
          onClick={onCopyPedido}
        >
          <Copy className="h-3.5 w-3.5 sm:mr-1" />
          <span className="text-xs">copiar pedido</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 flex-1 sm:flex-initial"
          onClick={onLlevarPedidoASheet}
          disabled={!hasSheetUrl}
        >
          <FileText className="h-3.5 w-3.5 sm:mr-1" />
          <span className="text-xs">sheet</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 flex-1 sm:flex-initial"
          onClick={onGenerarEnlace}
          disabled={
            productosAPedirCount === 0 ||
            selectedPedido?.estado === "enviado" ||
            selectedPedido?.estado === "recibido" ||
            loadingEnlace
          }
          title="Generar nuevo enlace público"
        >
          {loadingEnlace ? (
            <>
              <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
              <span className="sm:hidden text-xs">Generando...</span>
              <span className="hidden sm:inline text-xs">Generando...</span>
            </>
          ) : (
            <>
              <LinkIcon className="h-3.5 w-3.5 sm:mr-1" />
              <span className="sm:hidden text-xs">enviar</span>
              <span className="hidden sm:inline text-xs">enviar pedido</span>
            </>
          )}
        </Button>
        {(enlaceActivo || selectedPedido?.estado === "enviado") && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 px-2 relative flex-1 sm:flex-initial",
              selectedPedido?.estado === "enviado" &&
                "bg-amber-50 border-amber-300 hover:bg-amber-100 dark:bg-amber-950 dark:border-amber-800"
            )}
            onClick={onVerPedido}
            title={
              selectedPedido?.estado === "enviado"
                ? "Controlar recepción del pedido enviado"
                : "Ver pedido público (solo lectura)"
            }
          >
            {selectedPedido?.estado === "enviado" && (
              <Bell className="h-3.5 w-3.5 sm:mr-1 text-amber-600 dark:text-amber-400 animate-pulse" />
            )}
            {selectedPedido?.estado !== "enviado" && <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />}
            <span className="hidden sm:inline text-xs">
              {selectedPedido?.estado === "enviado" ? "Controlar recepción" : "Ver pedido"}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
