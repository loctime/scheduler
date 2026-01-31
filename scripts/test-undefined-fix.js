/**
 * Test simple para verificar que la corrección de undefined funciona
 */

// Simular la función cleanAssignmentsForFirestore
function cleanAssignmentsForFirestore(assignments) {
  return assignments.map(assignment => {
    const cleaned = {}
    
    Object.entries(assignment).forEach(([key, value]) => {
      // Solo incluir el campo si no es undefined
      if (value !== undefined) {
        cleaned[key] = value
      }
    })
    
    return cleaned
  })
}

// Simular la función convertRuleToAssignments corregida
function convertRuleToAssignments(rule, shifts) {
  if (rule.type === "OFF") {
    return [{ type: "franco" }]
  }

  if (rule.type === "SHIFT" && rule.shiftId) {
    const shift = shifts.find(s => s.id === rule.shiftId)
    if (shift) {
      const assignment = {
        type: "shift",
        shiftId: rule.shiftId,
        startTime: shift.startTime || "",
        endTime: shift.endTime || ""
      }

      // Solo agregar segunda franja si existe en el turno
      if (shift.startTime2 && shift.endTime2) {
        assignment.startTime2 = shift.startTime2
        assignment.endTime2 = shift.endTime2
      }

      return [assignment]
    }
  }

  return []
}

// Test cases
console.log('🧪 Test: Corrección de valores undefined')

// Caso 1: Turno sin segunda franja (el problema original)
const shiftSinSegundaFranja = {
  id: 'shift1',
  name: 'Mañana',
  startTime: '08:00',
  endTime: '16:00'
  // No tiene startTime2 ni endTime2
}

const rule1 = {
  type: 'SHIFT',
  shiftId: 'shift1'
}

const assignments1 = convertRuleToAssignments(rule1, [shiftSinSegundaFranja])
const cleaned1 = cleanAssignmentsForFirestore(assignments1)

console.log('📋 Caso 1: Turno sin segunda franja')
console.log('Original:', JSON.stringify(assignments1, null, 2))
console.log('Limpiado:', JSON.stringify(cleaned1, null, 2))
console.log('¿Tiene undefined?', Object.values(cleaned1[0]).some(v => v === undefined))
console.log('')

// Caso 2: Turno con segunda franja
const shiftConSegundaFranja = {
  id: 'shift2',
  name: 'Partido',
  startTime: '08:00',
  endTime: '12:00',
  startTime2: '14:00',
  endTime2: '18:00'
}

const rule2 = {
  type: 'SHIFT',
  shiftId: 'shift2'
}

const assignments2 = convertRuleToAssignments(rule2, [shiftConSegundaFranja])
const cleaned2 = cleanAssignmentsForFirestore(assignments2)

console.log('📋 Caso 2: Turno con segunda franja')
console.log('Original:', JSON.stringify(assignments2, null, 2))
console.log('Limpiado:', JSON.stringify(cleaned2, null, 2))
console.log('¿Tiene undefined?', Object.values(cleaned2[0]).some(v => v === undefined))
console.log('')

// Caso 3: Regla OFF (franco)
const rule3 = {
  type: 'OFF'
}

const assignments3 = convertRuleToAssignments(rule3, [])
const cleaned3 = cleanAssignmentsForFirestore(assignments3)

console.log('📋 Caso 3: Regla OFF (franco)')
console.log('Original:', JSON.stringify(assignments3, null, 2))
console.log('Limpiado:', JSON.stringify(cleaned3, null, 2))
console.log('¿Tiene undefined?', Object.values(cleaned3[0]).some(v => v === undefined))
console.log('')

console.log('✅ Verificación completada')
console.log('📊 Resultados:')
console.log('  • Caso 1 (sin segunda franja):', Object.values(cleaned1[0]).some(v => v === undefined) ? '❌ Falló' : '✅ OK')
console.log('  • Caso 2 (con segunda franja):', Object.values(cleaned2[0]).some(v => v === undefined) ? '❌ Falló' : '✅ OK')
console.log('  • Caso 3 (franco):', Object.values(cleaned3[0]).some(v => v === undefined) ? '❌ Falló' : '✅ OK')

if (!Object.values(cleaned1[0]).some(v => v === undefined) && 
    !Object.values(cleaned2[0]).some(v => v === undefined) && 
    !Object.values(cleaned3[0]).some(v => v === undefined)) {
  console.log('🎉 Todos los tests pasaron - El error de Firestore debería estar solucionado')
} else {
  console.log('❌ Algunos tests fallaron - Revisar la implementación')
}
