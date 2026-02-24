"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type ActivityEventType =
  | "stock"
  | "pedido"
  | "recepcion"
  | "task"
  | "config"
  | "publication"
  | "user_action"

export type ActivitySeverity = "low" | "medium" | "high"

interface LogActivityParams {
  ownerId: string

  event: {
    type: ActivityEventType
    action: string
    severity?: ActivitySeverity
  }

  entity: {
    entityType: string
    entityId: string
    entityName?: string

    pedidoId?: string
    recepcionId?: string
    productId?: string
    taskId?: string
    companyId?: string
  }

  actor: {
    uid: string
    email?: string
    role?: string
  }

  metadata?: Record<string, any>

  source?: "pwa" | "web" | "admin"
}

export async function logActivity({
  ownerId,
  event,
  entity,
  actor,
  metadata,
  source = "web",
}: LogActivityParams) {
  try {
    if (!db) {
      console.error("Firestore no disponible para activity log")
      return
    }

    const logsRef = collection(
      db,
      "apps",
      "horarios",
      "owners",
      ownerId,
      "activity_logs"
    )

    await addDoc(logsRef, {
      ownerId,

      eventType: event.type,
      action: event.action,
      severity: event.severity ?? "low",

      entity,

      actor: {
        userId: actor.uid,
        userEmail: actor.email ?? null,
        role: actor.role ?? null,
      },

      metadata: metadata ?? null,

      source,

      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    })
  } catch (error) {
    console.error("Error registrando activity log:", error)
  }
}

// Función para logs de errores (seguridad)
interface LogErrorParams {
  ownerId: string
  error: {
    kind: "validation" | "permission" | "not_found" | "unexpected" | "network"
    message: string
    code?: string
    stack?: string
  }
  actor?: {
    uid?: string
    email?: string
  }
  context?: {
    source?: "pwa" | "web" | "admin"
    sessionId?: string
  }
  related?: {
    entityType?: string
    entityId?: string
    action?: string
  }
}

export async function logError({
  ownerId,
  error,
  actor,
  context,
  related,
}: LogErrorParams) {
  try {
    if (!db) {
      console.error("Firestore no disponible para error log")
      return
    }

    const errorLogsRef = collection(
      db,
      "apps",
      "horarios",
      "owners",
      ownerId,
      "error_logs"
    )

    await addDoc(errorLogsRef, {
      ownerId,

      error: {
        kind: error.kind,
        message: error.message,
        code: error.code ?? null,
        stack: error.stack ?? null,
      },

      actor: actor ?? null,

      context: {
        source: context?.source ?? "web",
        sessionId: context?.sessionId ?? null,
      },

      related: related ?? null,

      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    })
  } catch (error) {
    console.error("Error registrando error log:", error)
  }
}