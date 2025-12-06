"use client"

import { createContext, useContext, ReactNode } from "react"
import { useStockChat } from "@/hooks/use-stock-chat"

interface StockChatContextType {
  // Chat
  messages: ReturnType<typeof useStockChat>["messages"]
  isProcessing: ReturnType<typeof useStockChat>["isProcessing"]
  enviarMensaje: ReturnType<typeof useStockChat>["enviarMensaje"]
  limpiarChat: ReturnType<typeof useStockChat>["limpiarChat"]
  cancelarMensaje: ReturnType<typeof useStockChat>["cancelarMensaje"]
  ollamaStatus: ReturnType<typeof useStockChat>["ollamaStatus"]
  checkOllamaConnection: ReturnType<typeof useStockChat>["checkOllamaConnection"]
  accionPendiente: ReturnType<typeof useStockChat>["accionPendiente"]
  nombreAsistente: ReturnType<typeof useStockChat>["nombreAsistente"]
  modo: ReturnType<typeof useStockChat>["modo"]
  setModo: ReturnType<typeof useStockChat>["setModo"]
  
  // Stock
  productos: ReturnType<typeof useStockChat>["productos"]
  pedidos: ReturnType<typeof useStockChat>["pedidos"]
  stockActual: ReturnType<typeof useStockChat>["stockActual"]
  movimientos: ReturnType<typeof useStockChat>["movimientos"]
  loadingStock: ReturnType<typeof useStockChat>["loadingStock"]
  productosStockBajo: ReturnType<typeof useStockChat>["productosStockBajo"]
}

const StockChatContext = createContext<StockChatContextType | undefined>(undefined)

export function StockChatProvider({ 
  children, 
  user 
}: { 
  children: ReactNode
  user: any 
}) {
  const stockChat = useStockChat({
    userId: user?.uid,
    userName: user?.displayName || user?.email,
    user,
  })

  return (
    <StockChatContext.Provider value={stockChat}>
      {children}
    </StockChatContext.Provider>
  )
}

export function useStockChatContext() {
  const context = useContext(StockChatContext)
  if (context === undefined) {
    throw new Error("useStockChatContext must be used within a StockChatProvider")
  }
  return context
}

