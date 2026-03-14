import assert from "node:assert/strict"

import { buildPedidoOficial } from "../lib/build-pedido-oficial"
import {
  formatStockForDisplay,
  normalizeStockMinimoInput,
  packsToUnits,
  unitsToPacks,
} from "../lib/unidades-utils"

const productoUnidad = {
  id: "unidad",
  nombre: "Azucar",
  modoCompra: "unidad" as const,
  unidadBase: "unidades",
  stockMinimoUnits: 10,
}

const productoPack = {
  id: "pack",
  nombre: "Gaseosa",
  modoCompra: "pack" as const,
  cantidadPorPack: 12,
  unidadBase: "unidades",
  stockMinimoUnits: 24,
}

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "packsToUnits convierte packs a unidades base",
    run: () => {
      assert.equal(packsToUnits(2, 12), 24)
      assert.equal(packsToUnits(-3, 12), 0)
    },
  },
  {
    name: "unitsToPacks redondea hacia arriba para pedido por pack",
    run: () => {
      assert.equal(unitsToPacks(24, 12), 2)
      assert.equal(unitsToPacks(25, 12), 3)
      assert.equal(unitsToPacks(-5, 12), 0)
    },
  },
  {
    name: "normalizeStockMinimoInput mantiene unidades para producto unidad",
    run: () => {
      assert.equal(normalizeStockMinimoInput(productoUnidad, 7), 7)
    },
  },
  {
    name: "normalizeStockMinimoInput convierte packs a unidades para producto pack",
    run: () => {
      assert.equal(normalizeStockMinimoInput(productoPack, 3), 36)
    },
  },
  {
    name: "pedido engine calcula sugerido para producto unidad",
    run: () => {
      const resultado = buildPedidoOficial({
        pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
        productos: [productoUnidad],
        stockActual: { unidad: 4 },
      })

      assert.ok(resultado)
      assert.equal(resultado.cantidadesPedidas.unidad, 6)
      assert.equal(resultado.productosCalculados[0]?.cantidadUnidades, 6)
    },
  },
  {
    name: "pedido engine calcula sugerido para producto pack exacto",
    run: () => {
      const resultado = buildPedidoOficial({
        pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadPacks} packs" },
        productos: [productoPack],
        stockActual: { pack: 0 },
      })

      assert.ok(resultado)
      assert.equal(resultado.cantidadesPedidas.pack, 24)
      assert.equal(resultado.productosCalculados[0]?.cantidadPacks, 2)
    },
  },
  {
    name: "pedido engine no pide si el stock actual supera el minimo",
    run: () => {
      const resultado = buildPedidoOficial({
        pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
        productos: [productoUnidad],
        stockActual: { unidad: 15 },
      })

      assert.ok(resultado)
      assert.equal(resultado.totalProductos, 0)
    },
  },
  {
    name: "pedido engine trata stock negativo como faltante y no rompe el calculo",
    run: () => {
      const resultado = buildPedidoOficial({
        pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadUnidades}" },
        productos: [productoUnidad],
        stockActual: { unidad: -5 },
      })

      assert.ok(resultado)
      assert.equal(resultado.cantidadesPedidas.unidad, 10)
    },
  },
  {
    name: "pedido engine redondea a packs cuando hay resto de unidades",
    run: () => {
      const resultado = buildPedidoOficial({
        pedido: { nombre: "Sucursal", formatoSalida: "{nombre}: {cantidadPacks} packs" },
        productos: [{ ...productoPack, stockMinimoUnits: 25 }],
        stockActual: { pack: 0 },
      })

      assert.ok(resultado)
      assert.equal(resultado.cantidadesPedidas.pack, 25)
      assert.equal(resultado.productosCalculados[0]?.cantidadPacks, 3)
    },
  },
  {
    name: "formatStockForDisplay muestra equivalencia pack y resto",
    run: () => {
      const display = formatStockForDisplay(productoPack, 25)
      assert.equal(display.fullLabel, "2 packs + 1 unidades (25 unidades)")
    },
  },
]

let failures = 0

for (const testCase of tests) {
  try {
    testCase.run()
    console.log(`ok - ${testCase.name}`)
  } catch (error) {
    failures += 1
    console.error(`not ok - ${testCase.name}`)
    console.error(error)
  }
}

if (failures > 0) {
  process.exitCode = 1
} else {
  console.log(`\n${tests.length} tests passed`)
}
