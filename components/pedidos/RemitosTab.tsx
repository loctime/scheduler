"use client"

import { Button } from "@/components/ui/button"
import { FileText, Link as LinkIcon, Package, Download } from "lucide-react"
import { PedidoTimeline } from "./pedido-timeline"
import type { Pedido, Remito, Recepcion } from "@/lib/types"

export interface RemitosTabProps {
  selectedPedido: Pedido | null
  productosAPedirCount: number
  enlaceActivo: { id: string } | null
  remitos: Remito[]
  recepciones: Recepcion[]
  resultadoEngine: { texto: string } | null
  onGenerarRemitoEnvio: () => void
  onGenerarEnlacePublico: () => void
  onCopyEnlacePublico: () => void
  onRegistrarRecepcion: () => void
  onDownloadRemito: (remito: Remito) => void
  legacyDisabled?: boolean
}

export function RemitosTab({
  selectedPedido,
  productosAPedirCount,
  enlaceActivo,
  remitos,
  recepciones,
  resultadoEngine,
  onGenerarRemitoEnvio,
  onGenerarEnlacePublico,
  onCopyEnlacePublico,
  onRegistrarRecepcion,
  onDownloadRemito,
  legacyDisabled = false
}: RemitosTabProps) {
  return (
    <div className="space-y-4">
      {legacyDisabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Remitos y recepciones legacy deshabilitados. Usar flujo V2.
        </div>
      )}
      {selectedPedido && (
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold">Estado del Pedido</h3>
          </div>
          <div className="p-3">
            <PedidoTimeline pedido={selectedPedido} />
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {selectedPedido.estado === "creado" && productosAPedirCount > 0 && !legacyDisabled && (
                <Button onClick={onGenerarRemitoEnvio} size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Remito de Envío
                </Button>
              )}

              {selectedPedido.estado === "enviado" && !enlaceActivo && !legacyDisabled && (
                <Button onClick={onGenerarEnlacePublico} size="sm" variant="outline">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Generar Enlace Público
                </Button>
              )}

              {enlaceActivo && (
                <Button variant="outline" size="sm" onClick={onCopyEnlacePublico}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Copiar Enlace Público
                </Button>
              )}

              {(selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") && !legacyDisabled && (
                <Button size="sm" onClick={onRegistrarRecepcion}>
                  <Package className="h-4 w-4 mr-2" />
                  Registrar Recepción
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card space-y-3">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Remitos ({remitos.length})
            {remitos.some((r) => r.final) && (
              <span className="text-xs text-muted-foreground ml-2">(Completado)</span>
            )}
          </h3>
        </div>
        <div className="p-3">
          {remitos.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay remitos para este pedido</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...remitos]
                .sort((a, b) => {
                  if (a.final && !b.final) return -1
                  if (!a.final && b.final) return 1
                  return 0
                })
                .map((remito) => (
                  <div
                    key={remito.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {remito.tipo === "pedido"
                          ? "📋 Remito de Pedido"
                          : remito.tipo === "envio"
                            ? "📤 Remito de Envío"
                            : remito.tipo === "recepcion"
                              ? "📥 Remito de Recepción"
                              : "↩️ Remito de Devolución"}{" "}
                        - {remito.numero}
                        {remito.final && " (Final)"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {remito.fecha?.toDate
                          ? remito.fecha.toDate().toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric"
                            })
                          : "Sin fecha"}
                        {remito.desde && remito.hacia && ` • ${remito.desde} → ${remito.hacia}`}
                      </p>
                      {remito.productos && remito.productos.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {remito.productos.length} producto{remito.productos.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 ml-2 shrink-0"
                      onClick={() => onDownloadRemito(remito)}
                      title="Descargar PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {recepciones.length > 0 && (
        <div className="rounded-lg border bg-card space-y-3">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold">Recepciones</h3>
          </div>
          <div className="p-3">
            <div className="space-y-2">
              {recepciones.map((recepcion) => (
                <div key={recepcion.id} className="p-3 rounded-lg border bg-background">
                  <p className="text-xs font-medium">
                    Recepción {recepcion.esParcial ? "(Parcial)" : "(Completa)"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {recepcion.fecha?.toDate
                      ? recepcion.fecha.toDate().toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        })
                      : "Sin fecha"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Productos: {recepcion.productos.length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
