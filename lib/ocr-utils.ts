import type { Producto } from "@/lib/types"
import { OCRConfig } from "./ocr-config"

// Types for the OCR processing
export interface ParsedItem {
  rawText: string
  nombreDetectado: string
  cantidad: number
}

export interface MatchedItem {
  rawText: string
  nombreDetectado: string
  cantidad: number
  matchedProductId: string | null
  status: "ok" | "unknown"
  similarity?: number
}

// Normalization function for text matching
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(x\d+|pack|unidad|unidades|uds)\b/g, '') // Remove irrelevant words
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim()
}

// Calculate string similarity (Levenshtein distance based)
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Parse invoice text to extract products and quantities
export function parseFactura(text: string, config: OCRConfig): ParsedItem[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const excludeWords = config.excludeWords
  
  const items: ParsedItem[] = []
  
  // Find the start of product table
  let productTableStart = -1
  let foundHeader = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase()
    
    // Look for product table headers
    if (line.includes('DESCRIPCIÓN') || line.includes('COD') || line.includes('CANT')) {
      productTableStart = i
      foundHeader = true
      break
    }
  }
  
  // If no product table found, use all lines
  const startIdx = productTableStart >= 0 ? productTableStart + 1 : 0
  
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    
    // Skip lines with exclude words
    if (excludeWords.some(word => line.toUpperCase().includes(word))) {
      continue
    }
    
    // Structural filter: Only process lines that start with product code
    // Real products typically start with numeric codes (4-6 digits)
    const codeMatch = line.match(/^(\d{4,6})\s+(.+)/)
    if (!codeMatch) {
      continue
    }
    
    const fullLine = codeMatch[0]
    const productInfo = codeMatch[2]
    
    // Find all numbers in the product line
    const numbers = fullLine.match(/\b(\d+)\b/g)
    if (!numbers || numbers.length < 2) {
      continue // Require at least 2 numbers (code + quantity/price)
    }
    
    // Convert all numbers to integers and filter reasonable quantities
    const quantities = numbers
      .map(n => parseInt(n, 10))
      .filter(n => n > 0 && n <= config.maxCantidadPermitida)
    
    if (quantities.length === 0) {
      continue
    }
    
    // Choose the smallest number as likely quantity (prices are usually larger)
    const cantidad = Math.min(...quantities)
    
    // Remove only the chosen quantity number, keep other numbers in product name
    const nombreDetectado = productInfo
      .replace(new RegExp(`\\b${cantidad}\\b`, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (cantidad > 0 && nombreDetectado.length > 0) {
      items.push({
        rawText: fullLine,
        nombreDetectado,
        cantidad
      })
    }
  }
  
  return items
}

// Match parsed items with existing products
export function matchProducts(parsedItems: ParsedItem[], products: Producto[], config: OCRConfig): MatchedItem[] {
  return parsedItems.map(item => {
    const normalizedDetected = normalizeText(item.nombreDetectado)
    let bestMatch: { productId: string; similarity: number } | null = null
    
    // Always calculate similarity for all products
    for (const product of products) {
      const normalizedProduct = normalizeText(product.nombre)
      const similarity = calculateSimilarity(normalizedDetected, normalizedProduct)
      
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { productId: product.id, similarity }
      }
    }
    
    // Determine status based on dynamic similarity threshold
    const status = bestMatch && bestMatch.similarity >= config.similarityThreshold ? "ok" : "unknown"
    
    return {
      rawText: item.rawText,
      nombreDetectado: item.nombreDetectado,
      cantidad: item.cantidad,
      matchedProductId: bestMatch?.productId || null,
      status,
      similarity: bestMatch?.similarity
    }
  })
}
