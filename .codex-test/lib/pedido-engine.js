"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularPedidoSugerido = calcularPedidoSugerido;
exports.getPedidoSugeridoUnits = getPedidoSugeridoUnits;
exports.ejecutarPedidoEngine = ejecutarPedidoEngine;
const unidades_utils_1 = require("./unidades-utils");
function calcularPedidoSugerido(stockMinimoUnits, stockActualUnits) {
    return Math.max(0, Math.floor(stockMinimoUnits) - Math.max(0, Math.floor(stockActualUnits)));
}
function getPedidoSugeridoUnits(producto, stockActualUnits) {
    return calcularPedidoSugerido((0, unidades_utils_1.getStockMinimoUnits)(producto), stockActualUnits);
}
function ejecutarPedidoEngine({ pedido, productos, stockActual, ajustesPedido = {}, cantidadesManuales = {}, usarCantidadesManuales = false, }) {
    const productosCalculados = [];
    const cantidadesPedidas = {};
    for (const producto of productos) {
        const stockMinimoUnits = (0, unidades_utils_1.getStockMinimoUnits)(producto);
        const stockActualUnits = Math.max(0, Math.floor(stockActual[producto.id] ?? 0));
        const baseUnits = usarCantidadesManuales
            ? Math.max(0, Math.floor(cantidadesManuales[producto.id] ?? 0))
            : getPedidoSugeridoUnits(producto, stockActualUnits);
        const ajusteUnits = usarCantidadesManuales ? 0 : Math.floor(ajustesPedido[producto.id] ?? 0);
        const cantidadUnidades = Math.max(0, baseUnits + ajusteUnits);
        if (cantidadUnidades <= 0) {
            continue;
        }
        const unidad = producto.unidadBase || producto.unidad || "U";
        const cantidadPacks = (0, unidades_utils_1.esModoPack)(producto)
            ? (0, unidades_utils_1.unitsToPacks)(cantidadUnidades, producto.cantidadPorPack ?? 1)
            : cantidadUnidades;
        const calculado = {
            productoId: producto.id,
            nombre: producto.nombre,
            cantidadUnidades,
            cantidadPacks,
            unidad,
            stockMinimoUnits,
            stockActualUnits,
            display: (0, unidades_utils_1.formatStockForDisplay)(producto, cantidadUnidades),
        };
        productosCalculados.push(calculado);
        cantidadesPedidas[producto.id] = cantidadUnidades;
    }
    const lineas = productosCalculados.map((producto) => {
        let texto = pedido.formatoSalida;
        texto = texto.replace(/{nombre}/g, producto.nombre);
        texto = texto.replace(/{cantidad}/g, producto.cantidadUnidades.toString());
        texto = texto.replace(/{cantidadUnidades}/g, producto.cantidadUnidades.toString());
        texto = texto.replace(/{cantidadPacks}/g, producto.cantidadPacks.toString());
        texto = texto.replace(/{unidad}/g, producto.unidad);
        return texto.trim();
    });
    const encabezado = pedido.mensajePrevio?.trim() || `[Pedido] ${pedido.nombre}`;
    const texto = lineas.length > 0
        ? `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosCalculados.length} productos`
        : `${encabezado}\n\nTotal: 0 productos`;
    return {
        productosCalculados,
        cantidadesPedidas,
        texto,
        totalProductos: productosCalculados.length,
    };
}
