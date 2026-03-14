"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPedidoOficial = buildPedidoOficial;
const pedido_engine_1 = require("./pedido-engine");
function buildPedidoOficial(options) {
    const { pedido, productos, stockActual, ajustesPedido = {}, cantidadesManuales = {}, usarCantidadesManuales = false, } = options;
    if (!pedido?.nombre) {
        return null;
    }
    return (0, pedido_engine_1.ejecutarPedidoEngine)({
        pedido: {
            nombre: pedido.nombre,
            formatoSalida: pedido.formatoSalida || "{nombre}: {cantidad} {unidad}",
            mensajePrevio: pedido.mensajePrevio,
        },
        productos,
        stockActual,
        ajustesPedido,
        cantidadesManuales,
        usarCantidadesManuales,
    });
}
