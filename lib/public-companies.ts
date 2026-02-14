import { doc, getDoc, runTransaction, serverTimestamp, Firestore, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

/**
 * Interfaz para la colección dedicada de empresas públicas
 */
export interface PublicCompany {
  ownerId: string
  companyName: string
  createdAt: any // Timestamp
  active: boolean
}

/**
 * Colección dedicada para lookup O(1) de empresas públicas
 * Path: apps/horarios/publicCompanies/{slug}
 */
const PUBLIC_COMPANIES_COLLECTION = "apps/horarios/publicCompanies"

/**
 * Validación estricta de formato de slug
 */
export function isValidSlugFormat(slug: string): boolean {
  // No vacío
  if (!slug || slug.trim().length === 0) return false
  
  // Longitud: 3-40 caracteres
  if (slug.length < 3 || slug.length > 40) return false
  
  // Solo letras minúsculas, números y guiones
  const slugRegex = /^[a-z0-9-]+$/
  if (!slugRegex.test(slug)) return false
  
  // No empezar ni terminar con guión
  if (slug.startsWith('-') || slug.endsWith('-')) return false
  
  // No guiones consecutivos
  if (slug.includes('--')) return false
  
  // No palabras reservadas
  const reservedWords = ['www', 'api', 'admin', 'app', 'pwa', 'public', 'settings']
  if (reservedWords.includes(slug)) return false
  
  return true
}

/**
 * Normalización mejorada de companySlug con validación estricta
 */
export function normalizeCompanySlug(input: string): string {
  if (!input) return ""
  
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover acentos
    .replace(/[^a-z0-9]+/g, "-") // Reemplazar caracteres inválidos con guión
    .replace(/-+/g, "-") // Múltiples guiones → uno solo
    .replace(/^-+|-+$/g, "") // Guiones al inicio/final
    .substring(0, 40) // Limitar longitud
}

/**
 * Generar sufijo único para slug duplicado
 */
function generateUniqueSlug(baseSlug: string, suffix: number): string {
  const maxBaseLength = 40 - (suffix?.toString()?.length || 0) - 1 // -1 por el guión
  const truncatedBase = baseSlug.substring(0, maxBaseLength)
  return `${truncatedBase}-${suffix}`
}

/**
 * Creación atómica de slug público único e inmutable
 * 
 * @param companyName Nombre de la empresa
 * @param ownerId ID del propietario
 * @returns Slug único creado
 * @throws Error si no puede generar slug único
 */
export async function createPublicCompanySlug(
  companyName: string, 
  ownerId: string
): Promise<string> {
  if (!db) {
    throw new Error("Firestore no disponible")
  }
  
  if (!companyName || companyName.trim().length === 0) {
    throw new Error("El nombre de la empresa es requerido")
  }
  
  const baseSlug = normalizeCompanySlug(companyName)
  
  if (!isValidSlugFormat(baseSlug)) {
    throw new Error(`El slug "${baseSlug}" no tiene un formato válido`)
  }
  
  return await runTransaction(db!, async (transaction) => {
    let finalSlug = baseSlug
    let suffix = 1
    
    // Intentar hasta 100 variaciones para evitar bucle infinito
    while (suffix <= 100) {
      const publicCompanyRef = doc(db!, PUBLIC_COMPANIES_COLLECTION, finalSlug)
      const publicCompanyDoc = await transaction.get(publicCompanyRef)
      
      // Si no existe, podemos usar este slug
      if (!publicCompanyDoc.exists()) {
        // Crear documento en publicCompanies
        const publicCompanyData: PublicCompany = {
          ownerId,
          companyName: companyName.trim(),
          createdAt: serverTimestamp(),
          active: true
        }
        
        transaction.set(publicCompanyRef, publicCompanyData)
        
        console.log(`✅ [createPublicCompanySlug] Slug único creado: ${finalSlug}`)
        return finalSlug
      }
      
      // Slug existe, intentar con sufijo
      finalSlug = generateUniqueSlug(baseSlug, suffix)
      suffix++
    }
    
    throw new Error("No se puede generar un slug único después de 100 intentos")
  })
}

/**
 * Resolución O(1) de companySlug a ownerId
 * 
 * @param companySlug Slug a resolver
 * @returns Documento de empresa pública o null si no existe
 */
export async function resolvePublicCompany(companySlug: string): Promise<PublicCompany | null> {
  if (!db || !companySlug) return null
  
  // Validar formato antes de consultar
  if (!isValidSlugFormat(companySlug)) return null
  
  try {
    const publicCompanyRef = doc(db!, PUBLIC_COMPANIES_COLLECTION, companySlug)
    const publicCompanyDoc = await getDoc(publicCompanyRef)
    
    if (!publicCompanyDoc.exists()) {
      return null
    }
    
    const data = publicCompanyDoc.data() as PublicCompany
    
    // Verificar que esté activo
    if (!data.active) {
      return null
    }
    
    return data
  } catch (error) {
    console.error(`❌ [resolvePublicCompany] Error resolviendo ${companySlug}:`, error)
    return null
  }
}

/**
 * @deprecated Esta función depende de settings/main que ya no se usa
 * Usar resolvePublicCompany() directamente para buscar por slug
 */
export async function getCurrentSlugForOwner(ownerId: string): Promise<string | null> {
  console.warn(`⚠️  [getCurrentSlugForOwner] Función deprecada que depende de settings/main`)
  return null
}

/**
 * Buscar slug actual de un owner en publicCompanies
 * 
 * @param ownerId ID del propietario
 * @returns Slug actual o null si no tiene
 */
export async function getCompanySlugFromOwnerId(ownerId: string | null): Promise<string | null> {
  if (!db || !ownerId) return null

  try {
    const publicCompaniesRef = collection(db!, PUBLIC_COMPANIES_COLLECTION)
    const q = query(publicCompaniesRef, where("ownerId", "==", ownerId), where("active", "==", true))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) return null
    return querySnapshot.docs[0].id
  } catch (error) {
    console.error(`❌ [getCompanySlugFromOwnerId] Error:`, error)
    return null
  }
}

async function findCurrentSlugForOwner(ownerId: string): Promise<string | null> {
  return getCompanySlugFromOwnerId(ownerId)
}

/**
 * Cambiar explícitamente el slug (operación de admin)
 * 
 * @param newSlug Nuevo slug deseado
 * @param ownerId ID del propietario
 * @param companyName Nombre de la empresa
 * @throws Error si el nuevo slug ya existe o es inválido
 */
export async function changePublicCompanySlug(
  newSlug: string,
  ownerId: string,
  companyName: string
): Promise<void> {
  if (!db) {
    throw new Error("Firestore no disponible")
  }
  
  const normalizedSlug = normalizeCompanySlug(newSlug)
  
  if (!isValidSlugFormat(normalizedSlug)) {
    throw new Error(`El slug "${normalizedSlug}" no tiene un formato válido`)
  }
  
  await runTransaction(db!, async (transaction) => {
    // Verificar que el nuevo slug no exista
    const newPublicCompanyRef = doc(db!, PUBLIC_COMPANIES_COLLECTION, normalizedSlug)
    const newPublicCompanyDoc = await transaction.get(newPublicCompanyRef)
    
    if (newPublicCompanyDoc.exists()) {
      throw new Error(`El slug "${normalizedSlug}" ya está en uso`)
    }
    
    // Obtener slug actual
    const currentSlug = await findCurrentSlugForOwner(ownerId)
    
    if (currentSlug) {
      // Desactivar slug anterior
      const oldPublicCompanyRef = doc(db!, PUBLIC_COMPANIES_COLLECTION, currentSlug)
      transaction.update(oldPublicCompanyRef, { active: false })
    }
    
    // Crear nuevo slug
    const newPublicCompanyData: PublicCompany = {
      ownerId,
      companyName: companyName.trim(),
      createdAt: serverTimestamp(),
      active: true
    }
    
    transaction.set(newPublicCompanyRef, newPublicCompanyData)
    
    console.log(`✅ [changePublicCompanySlug] Slug cambiado: ${currentSlug} → ${normalizedSlug}`)
  })
}
