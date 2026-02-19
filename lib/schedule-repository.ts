import { doc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { COLLECTIONS } from "@/lib/constants"
import type { Horario } from "@/lib/types"
import { updateSchedulePreservingFields } from "@/lib/utils"

export interface ScheduleRepository {
  createSchedule(data: any): Promise<string>
  updateSchedule(id: string, data: any): Promise<void>
  getSchedule(id: string): Promise<Horario | null>
  updateScheduleWithPreservation(id: string, current: Horario, updateData: any): Promise<void>
}

class FirestoreScheduleRepository implements ScheduleRepository {
  async createSchedule(data: any): Promise<string> {
    const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return scheduleRef.id
  }

  async updateSchedule(id: string, data: any): Promise<void> {
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, id)
    await updateDoc(scheduleRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async getSchedule(id: string): Promise<Horario | null> {
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, id)
    const scheduleSnap = await getDoc(scheduleRef)
    return scheduleSnap.exists() ? { id: scheduleSnap.id, ...scheduleSnap.data() } as Horario : null
  }

  async updateScheduleWithPreservation(id: string, current: Horario, updateData: any): Promise<void> {
    await updateSchedulePreservingFields(id, current, updateData)
  }
}

export const scheduleRepository = new FirestoreScheduleRepository()
