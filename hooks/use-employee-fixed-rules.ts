import { useState, useEffect, useMemo } from "react"
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { EmployeeFixedRule } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface UseEmployeeFixedRulesProps {
  ownerId?: string
  employeeId?: string
}

export function useEmployeeFixedRules({ ownerId, employeeId }: UseEmployeeFixedRulesProps = {}) {
  const [rules, setRules] = useState<EmployeeFixedRule[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Suscribirse a cambios en reglas fijas
  useEffect(() => {
    if (!ownerId || !db) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    let q = query(collection(db, COLLECTIONS.EMPLOYEE_FIXED_RULES), where("ownerId", "==", ownerId))
    
    if (employeeId) {
      q = query(collection(db, COLLECTIONS.EMPLOYEE_FIXED_RULES), where("ownerId", "==", ownerId), where("employeeId", "==", employeeId))
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rulesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmployeeFixedRule[]
      
      setRules(rulesData)
      setLoading(false)
    }, (error) => {
      console.error("Error loading fixed rules:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reglas fijas",
        variant: "destructive"
      })
      setLoading(false)
    })

    return unsubscribe
  }, [ownerId, employeeId, toast])

  // Obtener reglas por empleado
  const getRulesByEmployee = useMemo(() => {
    return (employeeId: string) => {
      return rules.filter(rule => rule.employeeId === employeeId)
    }
  }, [rules])

  // Obtener regla para un empleado y día específico
  const getRuleForDay = useMemo(() => {
    return (employeeId: string, dayOfWeek: number) => {
      return rules.find(rule => 
        rule.employeeId === employeeId && 
        rule.dayOfWeek === dayOfWeek
      )
    }
  }, [rules])

  // Crear o actualizar regla fija
  const createOrUpdateRule = async (ruleData: Omit<EmployeeFixedRule, "id" | "createdAt" | "updatedAt">) => {
    if (!ownerId || !db) {
      toast({
        title: "Error",
        description: "No se puede crear la regla sin usuario o conexión a base de datos",
        variant: "destructive"
      })
      return null
    }

    try {
      // Verificar si ya existe una regla para este empleado y día
      const existingRule = getRuleForDay(ruleData.employeeId, ruleData.dayOfWeek)
      
      const ruleDataWithTimestamps = {
        ...ruleData,
        ownerId,
        updatedAt: serverTimestamp()
      }

      if (existingRule) {
        // Actualizar regla existente
        await updateDoc(doc(db, COLLECTIONS.EMPLOYEE_FIXED_RULES, existingRule.id), ruleDataWithTimestamps)
        toast({
          title: "Regla actualizada",
          description: "La regla fija se ha actualizado correctamente"
        })
        return { ...existingRule, ...ruleDataWithTimestamps }
      } else {
        // Crear nueva regla
        const newRuleRef = doc(collection(db, COLLECTIONS.EMPLOYEE_FIXED_RULES))
        const newRule = {
          ...ruleDataWithTimestamps,
          id: newRuleRef.id,
          createdAt: serverTimestamp()
        }
        
        await setDoc(newRuleRef, newRule)
        toast({
          title: "Regla creada",
          description: "La regla fija se ha creado correctamente"
        })
        return newRule
      }
    } catch (error) {
      console.error("Error creating/updating rule:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la regla fija",
        variant: "destructive"
      })
      return null
    }
  }

  // Eliminar regla
  const deleteRule = async (ruleId: string) => {
    if (!db) {
      toast({
        title: "Error",
        description: "No hay conexión a la base de datos",
        variant: "destructive"
      })
      return false
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.EMPLOYEE_FIXED_RULES, ruleId))
      toast({
        title: "Regla eliminada",
        description: "La regla fija se ha eliminado correctamente"
      })
      return true
    } catch (error) {
      console.error("Error deleting rule:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la regla fija",
        variant: "destructive"
      })
      return false
    }
  }

  // Obtener todas las reglas para un día específico (todos los empleados)
  const getRulesForDay = useMemo(() => {
    return (dayOfWeek: number) => {
      return rules.filter(rule => rule.dayOfWeek === dayOfWeek)
    }
  }, [rules])

  // Verificar si una celda tiene una regla fija
  const hasFixedRule = useMemo(() => {
    return (employeeId: string, dayOfWeek: number) => {
      return !!getRuleForDay(employeeId, dayOfWeek)
    }
  }, [getRuleForDay])

  return {
    rules,
    loading,
    getRulesByEmployee,
    getRuleForDay,
    getRulesForDay,
    hasFixedRule,
    createOrUpdateRule,
    deleteRule
  }
}
