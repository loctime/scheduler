import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface OCRConfig {
  similarityThreshold: number
  maxCantidadPermitida: number
  excludeWords: string[]
}

export const DEFAULT_OCR_CONFIG: OCRConfig = {
  similarityThreshold: 0.7,
  maxCantidadPermitida: 200,
  excludeWords: ['TOTAL', 'IVA', 'CUIT', 'FECHA', 'SUBTOTAL', '$', 'IMPORTE', 'PRECIO']
}

export async function getOCRConfig(): Promise<OCRConfig> {
  try {
    if (!db) return DEFAULT_OCR_CONFIG
    const configDoc = await getDoc(doc(db, "apps/horarios/config", "ocrConfig"))
    if (configDoc.exists()) {
      return configDoc.data() as OCRConfig
    }
  } catch (error) {
    console.error("Error loading OCR config:", error)
  }
  
  return DEFAULT_OCR_CONFIG
}

export async function saveOCRConfig(config: OCRConfig): Promise<void> {
  try {
    if (!db) throw new Error("Firestore not available")
    await setDoc(doc(db, "apps/horarios/config", "ocrConfig"), config)
  } catch (error) {
    console.error("Error saving OCR config:", error)
    throw error
  }
}

// Product alias training functions
export async function getProductAliases(productId: string): Promise<string[]> {
  try {
    if (!db) return []
    const productDoc = await getDoc(doc(db, "products", productId))
    if (productDoc.exists()) {
      const product = productDoc.data()
      return (product.aliases as string[]) || []
    }
    return []
  } catch (error) {
    console.error("Error loading product aliases:", error)
    return []
  }
}

export async function saveProductAliases(productId: string, aliases: string[]): Promise<void> {
  try {
    if (!db) throw new Error("Firestore not available")
    await setDoc(doc(db, "products", productId), { aliases })
  } catch (error) {
    console.error("Error saving product aliases:", error)
    throw error
  }
}
