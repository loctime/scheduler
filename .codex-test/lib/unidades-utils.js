"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCantidadPorPack = getCantidadPorPack;
exports.esModoPack = esModoPack;
exports.packsToUnits = packsToUnits;
exports.unitsToPacks = unitsToPacks;
exports.getStockMinimoUnits = getStockMinimoUnits;
exports.getStockActualUnits = getStockActualUnits;
exports.normalizeStockMinimoInput = normalizeStockMinimoInput;
exports.normalizeStockActualInput = normalizeStockActualInput;
exports.recalculateStockForPackChange = recalculateStockForPackChange;
exports.shouldPromptForPackChange = shouldPromptForPackChange;
exports.formatStockForDisplay = formatStockForDisplay;
exports.unidadesToPacks = unidadesToPacks;
exports.packsToUnidades = packsToUnidades;
exports.calcularPedidoBaseEnPacks = calcularPedidoBaseEnPacks;
exports.unidadesToPacksFloor = unidadesToPacksFloor;
exports.unidadesSignedToPacksFloor = unidadesSignedToPacksFloor;
exports.packsSignedToUnidades = packsSignedToUnidades;
function sanitizeInteger(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.floor(value));
}
function getCantidadPorPack(producto) {
    if (!producto || producto.modoCompra !== "pack") {
        return 1;
    }
    const cantidad = Number(producto.cantidadPorPack);
    if (!Number.isFinite(cantidad) || cantidad < 2) {
        return 1;
    }
    return Math.floor(cantidad);
}
function esModoPack(producto) {
    return !!producto && producto.modoCompra === "pack" && getCantidadPorPack(producto) > 1;
}
function packsToUnits(packs, cantidadPorPack) {
    return sanitizeInteger(packs) * Math.max(1, sanitizeInteger(cantidadPorPack));
}
function unitsToPacks(units, cantidadPorPack) {
    const normalizedUnits = sanitizeInteger(units);
    const normalizedPackSize = Math.max(1, sanitizeInteger(cantidadPorPack));
    if (normalizedUnits === 0) {
        return 0;
    }
    return Math.ceil(normalizedUnits / normalizedPackSize);
}
function getStockMinimoUnits(producto) {
    if (!producto)
        return 0;
    const value = producto.stockMinimoUnits ?? producto.stockMinimo ?? 0;
    return sanitizeInteger(Number(value));
}
function getStockActualUnits(producto) {
    if (!producto)
        return 0;
    const value = producto.stockActualUnits ?? producto.stockActual ?? 0;
    return sanitizeInteger(Number(value));
}
function normalizeStockMinimoInput(producto, valorUI) {
    if (esModoPack(producto)) {
        return packsToUnits(valorUI, getCantidadPorPack(producto));
    }
    return sanitizeInteger(valorUI);
}
function normalizeStockActualInput(producto, valorUI) {
    if (esModoPack(producto)) {
        return packsToUnits(valorUI, getCantidadPorPack(producto));
    }
    return sanitizeInteger(valorUI);
}
function recalculateStockForPackChange(stockActualUnits, oldPack, newPack, mode) {
    const currentUnits = sanitizeInteger(stockActualUnits);
    const previousPack = Math.max(1, sanitizeInteger(oldPack));
    const nextPack = Math.max(1, sanitizeInteger(newPack));
    switch (mode) {
        case "keep_units":
            return currentUnits;
        case "keep_packs": {
            const packsActuales = Math.floor(currentUnits / previousPack);
            return packsActuales * nextPack;
        }
        case "clear_stock":
            return 0;
        default:
            return currentUnits;
    }
}
function shouldPromptForPackChange(stockActualUnits, oldPack, newPack) {
    return sanitizeInteger(stockActualUnits) > 0 && Math.max(1, sanitizeInteger(oldPack)) !== Math.max(1, sanitizeInteger(newPack));
}
function formatStockForDisplay(producto, units) {
    const normalizedUnits = sanitizeInteger(units);
    if (!esModoPack(producto)) {
        const primaryLabel = `${normalizedUnits} ${producto.unidadBase || producto.unidad || "unidades"}`;
        return {
            units: normalizedUnits,
            packs: normalizedUnits,
            remainderUnits: 0,
            primaryLabel,
            equivalenceLabel: primaryLabel,
            fullLabel: primaryLabel,
        };
    }
    const cantidadPorPack = getCantidadPorPack(producto);
    const packs = Math.floor(normalizedUnits / cantidadPorPack);
    const remainderUnits = normalizedUnits % cantidadPorPack;
    const unidadesLabel = producto.unidadBase || producto.unidad || "unidades";
    const packLabel = `${packs} pack${packs === 1 ? "" : "s"}`;
    const remainderLabel = remainderUnits > 0
        ? `${remainderUnits} ${unidadesLabel}${remainderUnits === 1 ? "" : ""}`
        : "";
    const primaryLabel = remainderLabel ? `${packLabel} + ${remainderLabel}` : packLabel;
    const equivalenceLabel = `${normalizedUnits} ${unidadesLabel}`;
    return {
        units: normalizedUnits,
        packs,
        remainderUnits,
        primaryLabel,
        equivalenceLabel,
        fullLabel: `${primaryLabel} (${equivalenceLabel})`,
    };
}
function unidadesToPacks(producto, unidades) {
    return unitsToPacks(unidades, getCantidadPorPack(producto));
}
function packsToUnidades(producto, packs) {
    return packsToUnits(packs, getCantidadPorPack(producto));
}
function calcularPedidoBaseEnPacks(producto, pedidoEnUnidades) {
    return unidadesToPacks(producto, pedidoEnUnidades);
}
function unidadesToPacksFloor(producto, unidades) {
    const normalizedUnits = sanitizeInteger(unidades);
    const cantidadPorPack = getCantidadPorPack(producto);
    if (normalizedUnits === 0)
        return 0;
    return Math.floor(normalizedUnits / cantidadPorPack);
}
function unidadesSignedToPacksFloor(producto, unidades) {
    if (!Number.isFinite(unidades) || unidades === 0)
        return 0;
    const sign = unidades >= 0 ? 1 : -1;
    return unidadesToPacksFloor(producto, Math.abs(unidades)) * sign;
}
function packsSignedToUnidades(producto, packs) {
    if (!Number.isFinite(packs) || packs === 0)
        return 0;
    const sign = packs >= 0 ? 1 : -1;
    return packsToUnidades(producto, Math.abs(packs)) * sign;
}
