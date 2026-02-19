import { doc, addDoc, updateDoc, collection, serverTimestamp, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { COLLECTIONS } from "@/lib/firebase"
import type { Horario } from "@/lib/types"
import { updateSchedulePreservingFields, createScheduleIfMissing } from "@/lib/firestore-helpers"

export interface ScheduleRepository {
  createSchedule(data: any): Promise<string>
  updateSchedule(id: string, data: any): Promise<void>
  getSchedule(id: string): Promise<Horario | null>
  updateScheduleWithPreservation(id: string, current: Horario, updateData: any): Promise<void>
}

class FirestoreScheduleRepository implements ScheduleRepository {
  async createSchedule(data: any): Promise<string> {
    if (!db) throw new Error("Firestore not initialized")

    const payload = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (data?.ownerId && data?.weekStart) {
      const result = await createScheduleIfMissing(data.ownerId, data.weekStart, payload)
      return result.id
    }

    const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), payload)
    return scheduleRef.id
  }

  async updateSchedule(id: string, data: any): Promise<void> {
    if (!db) throw new Error("Firestore not initialized")
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, id)
    await updateDoc(scheduleRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async getSchedule(id: string): Promise<Horario | null> {
    if (!db) throw new Error("Firestore not initialized")
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, id)
    const scheduleSnap = await getDoc(scheduleRef)
    return scheduleSnap.exists() ? { id: scheduleSnap.id, ...scheduleSnap.data() } as Horario : null
  }

  async updateScheduleWithPreservation(id: string, current: Horario, updateData: any): Promise<void> {
    await updateSchedulePreservingFields(id, current, updateData)
  }
}

export const scheduleRepository = new FirestoreScheduleRepository()
