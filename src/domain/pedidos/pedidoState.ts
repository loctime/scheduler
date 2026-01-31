import type { PedidoEstado, PedidoTransitionEvent, PedidoTransitionResult } from "./types"

export function transicionarEstadoPedido(
  estadoActual: PedidoEstado,
  evento: PedidoTransitionEvent
): PedidoTransitionResult {
  switch (evento.type) {
    case "GENERAR_ENVIO": {
      if (estadoActual === "creado" || estadoActual === "processing") {
        return {
          estado: "enviado",
          fechaEnvio: evento.fechaEnvio,
        }
      }
      return { estado: estadoActual }
    }
    case "REGISTRAR_RECEPCION": {
      if (estadoActual !== "enviado" && estadoActual !== "recibido") {
        return { estado: estadoActual }
      }

      return {
        estado: evento.esParcial ? "recibido" : "completado",
        fechaRecepcion: evento.fechaRecepcion,
      }
    }
    case "REINICIAR_ENVIO": {
      if (estadoActual !== "enviado") {
        return { estado: estadoActual }
      }

      return {
        estado: "creado",
        fechaEnvio: null,
        fechaRecepcion: null,
      }
    }
    default:
      return { estado: estadoActual }
  }
}
