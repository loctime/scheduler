"use client"

import type { DocumentoLogisticoViewModel } from "@/src/modules/logistics-v2/ui/view-models"

interface DocumentosLogisticaTableProps {
  items: DocumentoLogisticoViewModel[]
}

export function DocumentosLogisticaTable({ items }: DocumentosLogisticaTableProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No hay documentos para los filtros aplicados.</p>
  }

  return (
    <div className="rounded-lg border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Numero</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Origen/Destino</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.tipo}-${item.id}`} className="border-t">
              <td className="p-2">{item.tipo}</td>
              <td className="p-2">{item.numero || "-"}</td>
              <td className="p-2">{item.estado}</td>
              <td className="p-2">{item.fecha}</td>
              <td className="p-2">{item.origenDestino || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
