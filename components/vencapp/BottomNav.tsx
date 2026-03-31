"use client"

import { cn } from "@/lib/utils"

type VencAppTab = "products" | "work" | "map" | "dashboard"

const TABS: Array<{ id: VencAppTab; label: string }> = [
  { id: "products", label: "Inventario" },
  { id: "work", label: "Trabajo" },
  { id: "map", label: "Mapa" },
  { id: "dashboard", label: "Dashboard" },
]

export function BottomNav({ value, onChange }: { value: VencAppTab; onChange: (tab: VencAppTab) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex h-12 min-w-[70px] items-center justify-center rounded-lg text-sm font-medium transition-colors",
              value === tab.id ? "text-black" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

