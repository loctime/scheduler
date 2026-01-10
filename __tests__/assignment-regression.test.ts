/**
 * Tests de regresión para el sistema de horarios
 * 
 * Estos tests verifican que los invariantes del contrato v1.0 se mantengan:
 * - Editar turno cortado → no pierde franja
 * - Horas extras → no colapsan turnos cortados
 * - Licencia → no borra horarios
 * - No se guarda assignment parcial
 * - No hay solapamientos
 * - Turno base eliminado → assignment visible
 * - Copiar/pegar mantiene estructura
 */

import {
  validateAssignmentComplete,
  validateTurnoCortado,
  validateNoOverlaps,
  validateCellAssignments,
} from "../lib/assignment-validators"
import { isAssignmentIncomplete } from "../lib/assignment-utils"
import { ShiftAssignment, Turno } from "../lib/types"

describe("Regresión: Invariantes del Contrato v1.0", () => {
  describe("1. Editar turno cortado → no pierde franja", () => {
    it("debe preservar ambas franjas al editar un turno cortado", () => {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Simular edición: cambiar solo la primera franja
      const edited: ShiftAssignment = {
        ...assignment,
        startTime: "09:00",
        endTime: "13:00",
        // Segunda franja debe mantenerse
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Validar que sigue siendo un turno cortado válido
      const validation = validateTurnoCortado(edited)
      expect(validation.valid).toBe(true)
      expect(edited.startTime2).toBe("14:00")
      expect(edited.endTime2).toBe("18:00")
    })

    it("debe permitir convertir explícitamente a turno simple", () => {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Conversión explícita: eliminar segunda franja
      const converted: ShiftAssignment = {
        ...assignment,
      }
      delete converted.startTime2
      delete converted.endTime2

      // Debe ser válido como turno simple
      const validation = validateAssignmentComplete(converted)
      expect(validation.valid).toBe(true)
      expect(converted.startTime2).toBeUndefined()
      expect(converted.endTime2).toBeUndefined()
    })
  })

  describe("2. Horas extras → no colapsan turnos cortados", () => {
    it("debe preservar segunda franja al agregar horas extras a primera franja", () => {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Agregar 30 min antes a la primera franja
      const withExtra: ShiftAssignment = {
        ...assignment,
        startTime: "07:30", // 30 min antes
        // Segunda franja debe mantenerse
        startTime2: "14:00",
        endTime2: "18:00",
      }

      const validation = validateTurnoCortado(withExtra)
      expect(validation.valid).toBe(true)
      expect(withExtra.startTime2).toBe("14:00")
      expect(withExtra.endTime2).toBe("18:00")
    })

    it("debe detectar unión de franjas y convertir a turno simple", () => {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Si endTime se extiende hasta startTime2, deben unirse
      const extended: ShiftAssignment = {
        ...assignment,
        endTime: "14:00", // Ahora coincide con startTime2
      }

      // Validar solapamiento entre segmentos
      const cellValidation = validateCellAssignments([extended])
      // Debe detectar que las franjas se unen (no es válido como turno cortado)
      expect(cellValidation.valid).toBe(false)
    })
  })

  describe("3. Licencia → no borra horarios", () => {
    it("debe mantener assignments de turno al agregar licencia", () => {
      const shiftAssignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
      }

      const licenciaAssignment: ShiftAssignment = {
        type: "licencia",
        licenciaType: "embarazo",
        startTime: "10:00",
        endTime: "11:00",
      }

      // Ambos assignments deben coexistir
      const cellAssignments = [shiftAssignment, licenciaAssignment]
      const validation = validateCellAssignments(cellAssignments)

      // Debe ser válido (licencia dentro del turno)
      expect(validation.valid).toBe(true)
      expect(cellAssignments.length).toBe(2)
      expect(cellAssignments[0].type).toBe("shift")
      expect(cellAssignments[1].type).toBe("licencia")
    })
  })

  describe("4. No se guarda assignment parcial", () => {
    it("debe detectar assignment incompleto (falta startTime)", () => {
      const incomplete: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        // Falta startTime
        endTime: "12:00",
      }

      expect(isAssignmentIncomplete(incomplete)).toBe(true)
    })

    it("debe detectar assignment incompleto (falta shiftId)", () => {
      const incomplete: ShiftAssignment = {
        type: "shift",
        // Falta shiftId
        startTime: "08:00",
        endTime: "12:00",
      }

      expect(isAssignmentIncomplete(incomplete)).toBe(true)
    })

    it("debe detectar turno cortado incompleto (falta endTime2)", () => {
      const incomplete: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        // Falta endTime2
      }

      expect(isAssignmentIncomplete(incomplete)).toBe(true)
    })

    it("debe validar assignment completo", () => {
      const complete: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
      }

      expect(isAssignmentIncomplete(complete)).toBe(false)
      const validation = validateAssignmentComplete(complete)
      expect(validation.valid).toBe(true)
    })
  })

  describe("5. No hay solapamientos", () => {
    it("debe detectar solapamiento entre dos turnos", () => {
      const assignment1: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
      }

      const assignment2: ShiftAssignment = {
        type: "shift",
        shiftId: "shift2",
        startTime: "10:00", // Se solapa con assignment1
        endTime: "14:00",
      }

      const validation = validateNoOverlaps([assignment1, assignment2])
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })

    it("debe permitir turnos no solapados", () => {
      const assignment1: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
      }

      const assignment2: ShiftAssignment = {
        type: "shift",
        shiftId: "shift2",
        startTime: "13:00", // No se solapa
        endTime: "17:00",
      }

      const validation = validateNoOverlaps([assignment1, assignment2])
      expect(validation.valid).toBe(true)
    })

    it("debe detectar solapamiento en turno cortado con cruce de medianoche", () => {
      const assignment1: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "22:00",
        endTime: "02:00", // Cruza medianoche
      }

      const assignment2: ShiftAssignment = {
        type: "shift",
        shiftId: "shift2",
        startTime: "01:00", // Se solapa con assignment1
        endTime: "05:00",
      }

      const validation = validateNoOverlaps([assignment1, assignment2])
      expect(validation.valid).toBe(false)
    })
  })

  describe("6. Turno base eliminado → assignment visible", () => {
    it("debe permitir assignment con shiftId aunque el turno base no exista", () => {
      const orphanAssignment: ShiftAssignment = {
        type: "shift",
        shiftId: "turno-eliminado",
        startTime: "08:00",
        endTime: "12:00",
      }

      // El assignment debe ser válido aunque el turno base no exista
      expect(isAssignmentIncomplete(orphanAssignment)).toBe(false)
      const validation = validateAssignmentComplete(orphanAssignment)
      expect(validation.valid).toBe(true)
    })

    it("debe mantener datos propios del assignment sin turno base", () => {
      const orphanAssignment: ShiftAssignment = {
        type: "shift",
        shiftId: "turno-eliminado",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Debe mantener ambas franjas aunque el turno base no exista
      expect(orphanAssignment.startTime).toBe("08:00")
      expect(orphanAssignment.endTime).toBe("12:00")
      expect(orphanAssignment.startTime2).toBe("14:00")
      expect(orphanAssignment.endTime2).toBe("18:00")
    })
  })

  describe("7. Copiar/pegar mantiene estructura", () => {
    it("debe preservar estructura completa al copiar assignment", () => {
      const original: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "08:00",
        endTime: "12:00",
        startTime2: "14:00",
        endTime2: "18:00",
      }

      // Simular copia (deep copy)
      const copied: ShiftAssignment = JSON.parse(JSON.stringify(original))

      // Debe mantener toda la estructura
      expect(copied.type).toBe(original.type)
      expect(copied.shiftId).toBe(original.shiftId)
      expect(copied.startTime).toBe(original.startTime)
      expect(copied.endTime).toBe(original.endTime)
      expect(copied.startTime2).toBe(original.startTime2)
      expect(copied.endTime2).toBe(original.endTime2)

      // Debe ser válido
      const validation = validateTurnoCortado(copied)
      expect(validation.valid).toBe(true)
    })
  })

  describe("8. Validación de cruce de medianoche", () => {
    it("debe validar correctamente turnos que cruzan medianoche", () => {
      const assignment: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "22:00",
        endTime: "02:00", // Cruza medianoche
      }

      const validation = validateAssignmentComplete(assignment)
      expect(validation.valid).toBe(true)
    })

    it("debe detectar solapamiento correctamente con cruce de medianoche", () => {
      const assignment1: ShiftAssignment = {
        type: "shift",
        shiftId: "shift1",
        startTime: "22:00",
        endTime: "02:00",
      }

      const assignment2: ShiftAssignment = {
        type: "shift",
        shiftId: "shift2",
        startTime: "03:00",
        endTime: "06:00",
      }

      // No deben solaparse aunque ambos crucen medianoche
      const validation = validateNoOverlaps([assignment1, assignment2])
      expect(validation.valid).toBe(true)
    })
  })

  describe("9. Licencia con licenciaType", () => {
    it("debe requerir licenciaType en assignments de tipo licencia", () => {
      const incompleteLicencia: ShiftAssignment = {
        type: "licencia",
        // Falta licenciaType
        startTime: "10:00",
        endTime: "11:00",
      }

      expect(isAssignmentIncomplete(incompleteLicencia)).toBe(true)
    })

    it("debe validar licencia completa con licenciaType", () => {
      const completeLicencia: ShiftAssignment = {
        type: "licencia",
        licenciaType: "embarazo",
        startTime: "10:00",
        endTime: "11:00",
      }

      expect(isAssignmentIncomplete(completeLicencia)).toBe(false)
      const validation = validateAssignmentComplete(completeLicencia)
      expect(validation.valid).toBe(true)
    })
  })
})
