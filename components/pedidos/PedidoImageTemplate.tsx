"use client"

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoImageProps {
  local: string
  responsable: string
  fecha: string
  titulo?: string
  items: PedidoItem[]
}

export function PedidoImageTemplate({
  local,
  responsable,
  fecha,
  titulo = "PEDIDO INSUMOS PAPELERA",
  items
}: PedidoImageProps) {

  return (
    <div
      id="pedido-image"
      style={{
        width: 700,
        background: "#ffffff",
        fontFamily: "Arial",
        border: "1px solid #ccc"
      }}
    >

      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px" }}>

        <div
          style={{
            background: "#d8d2e5",
            padding: "12px",
            fontWeight: "bold",
            textAlign: "center"
          }}
        >
          {titulo}
        </div>

        <div style={{ borderLeft: "1px solid #ccc" }}>
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            FECHA
          </div>
          <div style={{ textAlign: "center" }}>
            {fecha}
          </div>
        </div>

      </div>

      {/* local */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px" }}>

        <div
          style={{
            background: "#e4cfd3",
            padding: "12px",
            fontWeight: "bold",
            textAlign: "center"
          }}
        >
          LOCAL: {local}
        </div>

        <div style={{ borderLeft: "1px solid #ccc" }}>
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            RESPONSABLE
          </div>
          <div style={{ textAlign: "center" }}>
            {responsable}
          </div>
        </div>

      </div>

      {/* header tabla */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px",
          background: "#ead28a",
          fontWeight: "bold",
          textAlign: "center",
          padding: "8px"
        }}
      >
        <div>INSUMO</div>
        <div>CANTIDAD</div>
      </div>

      {/* items */}
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px",
            padding: "6px 8px",
            borderTop: "1px solid #ddd",
            alignItems: "center"
          }}
        >
          <div style={{ textAlign: "center" }}>
            {item.nombre}
          </div>

          <div
            style={{
              textAlign: "center",
              fontWeight: "bold"
            }}
          >
            {item.cantidad}
          </div>

        </div>
      ))}

    </div>
  )
}
