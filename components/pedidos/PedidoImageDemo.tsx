"use client"

import { PedidoImageTemplate } from "./PedidoImageTemplate"
import { PedidoImageExporter } from "./PedidoImageExporter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PedidoItem {
  nombre: string
  cantidad: number
}

const sampleItems: PedidoItem[] = [
  { nombre: "KRAFT 7 (100 und)", cantidad: 3 },
  { nombre: "LAMINA SATINADA FONDO CAJA", cantidad: 2 },
  { nombre: "FOLEX 20X25 (100 und)", cantidad: 1 },
  { nombre: "ESTUCHE CARTÓN PAPA FRITAS", cantidad: 30 },
  { nombre: "CINTA SCOTCH 24MM", cantidad: 6 },
  { nombre: "BOLSAS POLIPROPILENO 6X20", cantidad: 1 },
  { nombre: "SEPI (TRIPODE PIZZA)", cantidad: 3 }
]

export function PedidoImageDemo() {
  const pedidoProps = {
    local: "SANTA MUZZA",
    responsable: "DIEGO",
    fecha: "21/12",
    titulo: "PEDIDO INSUMOS PAPELERA",
    items: sampleItems
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa del Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <PedidoImageTemplate {...pedidoProps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportar Imagen</CardTitle>
        </CardHeader>
        <CardContent>
          <PedidoImageExporter {...pedidoProps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejemplo de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
{`import { PedidoImageTemplate } from "@/components/pedidos/PedidoImageTemplate"
import { PedidoImageExporter } from "@/components/pedidos/PedidoImageExporter"

// Solo para mostrar
<PedidoImageTemplate
  local="SANTA MUZZA"
  responsable="DIEGO"
  fecha="21/12"
  items={[
    { nombre: "KRAFT 7 (100 und)", cantidad: 3 },
    { nombre: "LAMINA SATINADA FONDO CAJA", cantidad: 2 },
  ]}
/>

// Con botón de exportación
<PedidoImageExporter
  local="SANTA MUZZA"
  responsable="DIEGO"
  fecha="21/12"
  items={[
    { nombre: "KRAFT 7 (100 und)", cantidad: 3 },
    { nombre: "LAMINA SATINADA FONDO CAJA", cantidad: 2 },
  ]}
/>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
