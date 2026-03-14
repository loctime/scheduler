"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockStatus = getStockStatus;
const unidades_utils_1 = require("./unidades-utils");
function getStockStatus(producto, stockActualUnits) {
    const stockMinimoUnits = (0, unidades_utils_1.getStockMinimoUnits)(producto);
    const actual = Math.max(0, Math.floor(stockActualUnits));
    if (stockMinimoUnits <= 0) {
        return "OK";
    }
    if (actual <= 0) {
        return "CRITICAL";
    }
    if (actual < stockMinimoUnits) {
        return "LOW";
    }
    return "OK";
}
