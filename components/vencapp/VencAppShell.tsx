"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useVencAppFirestore } from "@/hooks/use-vencapp-firestore"
import { BottomNav } from "@/components/vencapp/BottomNav"
import { ProductsScreen } from "@/components/vencapp/ProductsScreen"
import { WorkPanelScreen } from "@/components/vencapp/WorkPanelScreen"
import { MapScreen } from "@/components/vencapp/MapScreen"
import { DashboardScreen } from "@/components/vencapp/DashboardScreen"

type VencAppTab = "products" | "work" | "map" | "dashboard"

export function VencAppShell() {
  const vencapp = useVencAppFirestore()
  const [activeTab, setActiveTab] = useState<VencAppTab>("products")
  const [focusProductId, setFocusProductId] = useState<string | null>(null)

  const screenProps = useMemo(() => ({
    ...vencapp,
    onOpenWorkPanel: (productId: string | null) => {
      setFocusProductId(productId)
      setActiveTab("work")
    },
  }), [vencapp])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="pb-20">
        <AnimatePresence mode="wait">
          {activeTab === "products" && (
            <motion.div key="products" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ProductsScreen {...screenProps} />
            </motion.div>
          )}
          {activeTab === "work" && (
            <motion.div key="work" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <WorkPanelScreen {...screenProps} focusProductId={focusProductId} />
            </motion.div>
          )}
          {activeTab === "map" && (
            <motion.div key="map" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <MapScreen {...screenProps} />
            </motion.div>
          )}
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DashboardScreen {...screenProps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav value={activeTab} onChange={setActiveTab} />
    </div>
  )
}
