/**
 * Sistema de logging centralizado
 * En desarrollo: usa console
 * En producción: puede enviar a servicio de logging o silenciar
 */

type LogLevel = "debug" | "info" | "warn" | "error"

const isDevelopment = process.env.NODE_ENV === "development"

/**
 * Logger configurado para el ambiente actual
 */
export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
    // En producción, podrías enviar warnings a un servicio de logging
  },
  
  error: (...args: any[]) => {
    // Siempre loggear errores, incluso en producción
    console.error(...args)
    // En producción, podrías enviar errores a un servicio de logging como Sentry
  },
  
  /**
   * Log estructurado para operaciones de Firestore
   */
  firestore: (level: LogLevel, operation: string, details?: any) => {
    const message = `[Firestore] ${operation}`
    if (details) {
      logger[level](message, details)
    } else {
      logger[level](message)
    }
  },
}

