"use client"

import type { ReactNode } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

export function WarehouseCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      <TransformWrapper minScale={0.6} maxScale={2} initialScale={1}>
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div className="relative h-[500px] w-[800px] bg-white">
            {children}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

