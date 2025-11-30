import { logger } from "./logger"
import type { FirebaseError } from "firebase/app"

/**
 * Categorías de errores
 */
export enum ErrorCategory {
  FIRESTORE = "FIRESTORE",
  VALIDATION = "VALIDATION",
  NETWORK = "NETWORK",
  AUTH = "AUTH",
  UNKNOWN = "UNKNOWN",
}

/**
 * Interfaz para errores categorizados
 */
export interface CategorizedError {
  category: ErrorCategory
  message: string
  originalError?: any
  userMessage: string
}

/**
 * Categoriza y formatea errores para mostrar al usuario
 */
export function categorizeError(error: any): CategorizedError {
  // Errores de Firestore
  if (error?.code?.startsWith("firestore/") || error?.code?.startsWith("permission-denied")) {
    return {
      category: ErrorCategory.FIRESTORE,
      message: error.message || "Error de base de datos",
      originalError: error,
      userMessage: getFirestoreUserMessage(error),
    }
  }

  // Errores de validación
  if (error?.code === "validation-error" || error?.message?.includes("validación")) {
    return {
      category: ErrorCategory.VALIDATION,
      message: error.message || "Error de validación",
      originalError: error,
      userMessage: error.message || "Los datos ingresados no son válidos",
    }
  }

  // Errores de red
  if (error?.code === "unavailable" || error?.message?.includes("network")) {
    return {
      category: ErrorCategory.NETWORK,
      message: error.message || "Error de red",
      originalError: error,
      userMessage: "Error de conexión. Por favor, verifica tu conexión a internet.",
    }
  }

  // Errores de autenticación
  if (error?.code?.startsWith("auth/") || error?.code === "unauthenticated") {
    return {
      category: ErrorCategory.AUTH,
      message: error.message || "Error de autenticación",
      originalError: error,
      userMessage: "Error de autenticación. Por favor, inicia sesión nuevamente.",
    }
  }

  // Error desconocido
  return {
    category: ErrorCategory.UNKNOWN,
    message: error?.message || "Error desconocido",
    originalError: error,
    userMessage: error?.message || "Ocurrió un error inesperado",
  }
}

/**
 * Obtiene mensaje amigable para el usuario basado en código de error de Firestore
 */
function getFirestoreUserMessage(error: any): string {
  const code = error?.code || ""

  switch (code) {
    case "permission-denied":
      return "No tienes permiso para realizar esta acción"
    case "unavailable":
      return "El servicio no está disponible. Por favor, intenta más tarde"
    case "deadline-exceeded":
      return "La operación tardó demasiado. Por favor, intenta nuevamente"
    case "not-found":
      return "El recurso solicitado no fue encontrado"
    case "already-exists":
      return "El recurso ya existe"
    case "failed-precondition":
      return "La operación falló debido a una condición previa"
    case "resource-exhausted":
      return "Se alcanzó el límite de recursos. Por favor, intenta más tarde"
    case "invalid-argument":
      return "Los datos proporcionados no son válidos"
    default:
      return error?.message || "Ocurrió un error al acceder a la base de datos"
  }
}

/**
 * Maneja errores de manera centralizada
 * Loggea el error y retorna un mensaje amigable para el usuario
 */
export function handleError(error: any, context?: string): string {
  const categorized = categorizeError(error)
  
  // Log estructurado
  logger.error(`[Error Handler] ${context ? `[${context}] ` : ""}${categorized.category}:`, {
    message: categorized.message,
    originalError: categorized.originalError,
  })
  
  return categorized.userMessage
}

/**
 * Maneja errores de Firestore específicamente
 */
export function handleFirestoreError(error: any, operation: string): string {
  logger.firestore("error", operation, error)
  return handleError(error, `Firestore: ${operation}`)
}

