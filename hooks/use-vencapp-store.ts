import { create } from "zustand"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

interface VencAppState {
  productos: Producto[]
  lots: Lot[]
  zones: WarehouseZone[]
  loading: boolean
  setProductos: (productos: Producto[]) => void
  setLots: (lots: Lot[]) => void
  setZones: (zones: WarehouseZone[]) => void
  setLoading: (loading: boolean) => void
}

export const useVencAppStore = create<VencAppState>((set) => ({
  productos: [],
  lots: [],
  zones: [],
  loading: true,
  setProductos: (productos) => set({ productos }),
  setLots: (lots) => set({ lots }),
  setZones: (zones) => set({ zones }),
  setLoading: (loading) => set({ loading }),
}))

