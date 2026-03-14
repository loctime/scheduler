"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const build_pedido_oficial_1 = require("../lib/build-pedido-oficial");
const unidades_utils_1 = require("../lib/unidades-utils");
const productoUnidad = {
    id: "unidad",
    nombre: "Azucar",
    modoCompra: "unidad",
    unidadBase: "unidades",
    stockMinimoUnits: 10,
};
const productoPack = {
    id: "pack",
    nombre: "Gaseosa",
    modoCompra: "pack",
    cantidadPorPack: 12,
    unidadBase: "unidades",
    stockMinimoUnits: 24,
};
const tests = [
    {
        name: "packsToUnits convierte packs a unidades base",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.packsToUnits)(2, 12), 24);
            strict_1.default.equal((0, unidades_utils_1.packsToUnits)(-3, 12), 0);
        },
    },
    {
        name: "unitsToPacks redondea hacia arriba para pedido por pack",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.unitsToPacks)(24, 12), 2);
            strict_1.default.equal((0, unidades_utils_1.unitsToPacks)(25, 12), 3);
            strict_1.default.equal((0, unidades_utils_1.unitsToPacks)(-5, 12), 0);
        },
    },
    {
        name: "normalizeStockMinimoInput mantiene unidades para producto unidad",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.normalizeStockMinimoInput)(productoUnidad, 7), 7);
        },
    },
    {
        name: "normalizeStockMinimoInput convierte packs a unidades para producto pack",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.normalizeStockMinimoInput)(productoPack, 3), 36);
        },
    },
    {
        name: "pedido engine calcula sugerido para producto unidad",
        run: () => {
            const resultado = (0, build_pedido_oficial_1.buildPedidoOficial)({
                pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
                productos: [productoUnidad],
                stockActual: { unidad: 4 },
            });
            strict_1.default.ok(resultado);
            strict_1.default.equal(resultado.cantidadesPedidas.unidad, 6);
            strict_1.default.equal(resultado.productosCalculados[0]?.cantidadUnidades, 6);
        },
    },
    {
        name: "pedido engine calcula sugerido para producto pack exacto",
        run: () => {
            const resultado = (0, build_pedido_oficial_1.buildPedidoOficial)({
                pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadPacks} packs" },
                productos: [productoPack],
                stockActual: { pack: 0 },
            });
            strict_1.default.ok(resultado);
            strict_1.default.equal(resultado.cantidadesPedidas.pack, 24);
            strict_1.default.equal(resultado.productosCalculados[0]?.cantidadPacks, 2);
        },
    },
    {
        name: "pedido engine no pide si el stock actual supera el minimo",
        run: () => {
            const resultado = (0, build_pedido_oficial_1.buildPedidoOficial)({
                pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
                productos: [productoUnidad],
                stockActual: { unidad: 15 },
            });
            strict_1.default.ok(resultado);
            strict_1.default.equal(resultado.totalProductos, 0);
        },
    },
    {
        name: "pedido engine trata stock negativo como faltante y no rompe el calculo",
        run: () => {
            const resultado = (0, build_pedido_oficial_1.buildPedidoOficial)({
                pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
                productos: [productoUnidad],
                stockActual: { unidad: -5 },
            });
            strict_1.default.ok(resultado);
            strict_1.default.equal(resultado.cantidadesPedidas.unidad, 10);
        },
    },
    {
        name: "pedido engine redondea a packs cuando hay resto de unidades",
        run: () => {
            const resultado = (0, build_pedido_oficial_1.buildPedidoOficial)({
                pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadPacks} packs" },
                productos: [{ ...productoPack, stockMinimoUnits: 25 }],
                stockActual: { pack: 0 },
            });
            strict_1.default.ok(resultado);
            strict_1.default.equal(resultado.cantidadesPedidas.pack, 25);
            strict_1.default.equal(resultado.productosCalculados[0]?.cantidadPacks, 3);
        },
    },
    {
        name: "formatStockForDisplay muestra equivalencia pack y resto",
        run: () => {
            const display = (0, unidades_utils_1.formatStockForDisplay)(productoPack, 25);
            strict_1.default.equal(display.fullLabel, "2 packs + 1 unidades (25 unidades)");
        },
    },
    {
        name: "recalculateStockForPackChange mantiene unidades actuales",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.recalculateStockForPackChange)(48, 24, 12, "keep_units"), 48);
        },
    },
    {
        name: "recalculateStockForPackChange mantiene cantidad de packs",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.recalculateStockForPackChange)(48, 24, 12, "keep_packs"), 24);
        },
    },
    {
        name: "recalculateStockForPackChange limpia stock",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.recalculateStockForPackChange)(48, 24, 12, "clear_stock"), 0);
        },
    },
    {
        name: "recalculateStockForPackChange descarta resto al mantener packs",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.recalculateStockForPackChange)(50, 24, 12, "keep_packs"), 24);
        },
    },
    {
        name: "shouldPromptForPackChange no pide dialogo con stock 0",
        run: () => {
            strict_1.default.equal((0, unidades_utils_1.shouldPromptForPackChange)(0, 24, 12), false);
        },
    },
];
let failures = 0;
for (const testCase of tests) {
    try {
        testCase.run();
        console.log(`ok - ${testCase.name}`);
    }
    catch (error) {
        failures += 1;
        console.error(`not ok - ${testCase.name}`);
        console.error(error);
    }
}
if (failures > 0) {
    process.exitCode = 1;
}
else {
    console.log(`\n${tests.length} tests passed`);
}
