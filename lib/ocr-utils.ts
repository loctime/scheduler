import type { Producto } from "@/lib/types"
import { OCRConfig, getProductAliases } from "./ocr-config"

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
  tokenScore?: number
  finalScore?: number
  matchedAlias?: string
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

// Token scoring function
export function tokenScore(detected: string, product: Producto): number {
  const detectedTokens = normalizeText(detected).split(/\s+/).filter(t => t.length >= 3)
  const productTokens = normalizeText(product.nombre).split(/\s+/).filter(t => t.length >= 3)
  
  if (detectedTokens.length === 0 || productTokens.length === 0) return 0
  
  const commonTokens = detectedTokens.filter(token => productTokens.includes(token))
  const score = commonTokens.length / Math.max(detectedTokens.length, productTokens.length)
  
  return score
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

// Match parsed items with existing products using hybrid scoring
export async function matchProducts(parsedItems: ParsedItem[], products: Producto[], config: OCRConfig): Promise<MatchedItem[]> {
  const results: MatchedItem[] = []
  
  for (const item of parsedItems) {
    const normalizedDetected = normalizeText(item.nombreDetectado)
    let bestMatch: {
      productId: string
      similarity: number
      tokenScore: number
      finalScore: number
      matchedAlias?: string
    } | null = null
    
    // Check each product with aliases support
    for (const product of products) {
      const normalizedProduct = normalizeText(product.nombre)
      const levenshteinScore = calculateSimilarity(normalizedDetected, normalizedProduct)
      const tokenScoreValue = tokenScore(item.nombreDetectado, product)
      
      // Load aliases for this product
      const aliases = product.aliases || []
      let bestAliasScore = 0
      let matchedAlias: string | undefined
      
      // Check against main name and all aliases
      for (const alias of [product.nombre, ...aliases]) {
        const normalizedAlias = normalizeText(alias)
        const aliasLevenshteinScore = calculateSimilarity(normalizedDetected, normalizedAlias)
        const aliasTokenScore = tokenScore(item.nombreDetectado, { ...product, nombre: alias })
        
        // Calculate final score for this alias
        const aliasFinalScore = (aliasTokenScore * 0.7) + (aliasLevenshteinScore * 0.3)
        
        if (aliasFinalScore > bestAliasScore) {
          bestAliasScore = aliasFinalScore
          matchedAlias = alias
        }
      }
      
      // Calculate final score for this product
      const finalScore = (tokenScoreValue * 0.7) + (levenshteinScore * 0.3)
      
      if (!bestMatch || finalScore > bestMatch.finalScore) {
        bestMatch = {
          productId: product.id,
          similarity: levenshteinScore,
          tokenScore: tokenScoreValue,
          finalScore,
          matchedAlias
        }
      }
    }
    
    // Determine status based on dynamic similarity threshold
    const status = bestMatch && bestMatch.finalScore >= config.similarityThreshold ? "ok" : "unknown"
    
    results.push({
      rawText: item.rawText,
      nombreDetectado: item.nombreDetectado,
      cantidad: item.cantidad,
      matchedProductId: bestMatch?.productId || null,
      status,
      similarity: bestMatch?.similarity,
      tokenScore: bestMatch?.tokenScore,
      finalScore: bestMatch?.finalScore,
      matchedAlias: bestMatch?.matchedAlias
    })
  }
  
  return results
}
