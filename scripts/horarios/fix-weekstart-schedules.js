/**
 * Script para corregir weekStart incorrectos en schedules legacy
 * 
 * PROBLEMA:
 * - Schedules creados con weekStart incorrecto (ej: "2026-02-16" domingo cuando debería ser "2026-02-10" lunes)
 * - Esto causa que el lunes no se pueda editar porque el sistema busca el schedule con weekStart diferente
 * 
 * SOLUCIÓN:
 * - Recalcula el weekStart correcto basándose en la configuración del usuario (semanaInicioDia)
 * - Crea un nuevo schedule con el ID correcto
 * - Elimina el schedule viejo
 * 
 * USO:
 * 1. Asegúrate de tener Firebase CLI instalado y estar autenticado
 * 2. Ejecuta: node scripts/fix-weekstart-schedules.js
 * 
 * ADVERTENCIA: Este script modificará los schedules. Haz backup primero.
 */

const admin = require('firebase-admin');
const readline = require('readline');
const { startOfWeek, format, parseISO } = require('date-fns');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      const serviceAccount = require('../serviceAccountKey-controlfile.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.error('💡 Asegúrate de tener las credenciales configuradas.');
    process.exit(1);
  }
}

const db = admin.firestore();

// Normalizar IDs para Firestore (igual que en el código)
function normalizeFirestoreId(value) {
  return value.replace(/\//g, '_').replace(/#/g, '_').replace(/\$/g, '_').replace(/\[/g, '_').replace(/\]/g, '_');
}

// Construir paths de colección (igual que en el código)
function getCollectionPath(collectionName) {
  return `apps/horarios/${collectionName}`;
}

const COLLECTIONS = {
  SCHEDULES: getCollectionPath('schedules'),
  SETTINGS: getCollectionPath('config')
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Calcula el weekStart correcto basándose en la fecha y configuración
 */
function calculateCorrectWeekStart(dateStr, semanaInicioDia = 1) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  const weekStartsOn = semanaInicioDia;
  const weekStartDate = startOfWeek(dateObj, { weekStartsOn });
  return format(weekStartDate, 'yyyy-MM-dd');
}

/**
 * Obtiene la configuración de un usuario
 */
async function getUserConfig(ownerId) {
  try {
    const settingsRef = db.collection(COLLECTIONS.SETTINGS).doc(ownerId);
    const settingsDoc = await settingsRef.get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return data.semanaInicioDia || 1; // Default: lunes
    }
    return 1; // Default: lunes
  } catch (error) {
    console.error(`Error obteniendo config para ${ownerId}:`, error);
    return 1; // Default: lunes
  }
}

/**
 * Construye el ID del schedule (igual que en firestore-helpers.ts)
 */
function buildScheduleDocId(ownerId, weekStartStr) {
  const normalizedOwnerId = normalizeFirestoreId(ownerId);
  const normalizedWeekStart = normalizeFirestoreId(weekStartStr);
  return `${normalizedOwnerId}__${normalizedWeekStart}`;
}

async function fixWeekStartSchedules() {
  try {
    console.log('🔍 Buscando schedules con weekStart incorrecto...\n');
    
    const schedulesRef = db.collection(COLLECTIONS.SCHEDULES);
    const snapshot = await schedulesRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No se encontraron schedules.');
      rl.close();
      return;
    }
    
    console.log(`📊 Total de schedules encontrados: ${snapshot.size}\n`);
    
    const schedulesToFix = [];
    const ownerConfigs = new Map(); // Cache de configuraciones
    
    // Analizar cada schedule
    snapshot.forEach(doc => {
      const data = doc.data();
      const weekStart = data.weekStart;
      const ownerId = data.ownerId;
      
      if (!weekStart || !ownerId) {
        return; // Skip schedules sin weekStart o ownerId
      }
      
      // Obtener configuración del usuario (con cache)
      if (!ownerConfigs.has(ownerId)) {
        // Se obtendrá después
        ownerConfigs.set(ownerId, null);
      }
      
      schedulesToFix.push({
        id: doc.id,
        ownerId,
        weekStart,
        data
      });
    });
    
    // Obtener configuraciones de todos los usuarios únicos
    console.log('📋 Obteniendo configuraciones de usuarios...\n');
    const uniqueOwnerIds = [...new Set(schedulesToFix.map(s => s.ownerId))];
    for (const ownerId of uniqueOwnerIds) {
      const semanaInicioDia = await getUserConfig(ownerId);
      ownerConfigs.set(ownerId, semanaInicioDia);
    }
    
    // Recalcular weekStart correcto para cada schedule
    const schedulesNeedingFix = [];
    
    for (const schedule of schedulesToFix) {
      const semanaInicioDia = ownerConfigs.get(schedule.ownerId) || 1;
      const correctWeekStart = calculateCorrectWeekStart(schedule.weekStart, semanaInicioDia);
      
      if (schedule.weekStart !== correctWeekStart) {
        schedulesNeedingFix.push({
          ...schedule,
          correctWeekStart,
          semanaInicioDia
        });
      }
    }
    
    if (schedulesNeedingFix.length === 0) {
      console.log('✅ Todos los schedules tienen weekStart correcto.\n');
      rl.close();
      return;
    }
    
    console.log(`⚠️  Se encontraron ${schedulesNeedingFix.length} schedules con weekStart incorrecto:\n`);
    schedulesNeedingFix.slice(0, 10).forEach((schedule, index) => {
      console.log(`  ${index + 1}. ID: ${schedule.id}`);
      console.log(`     Owner: ${schedule.ownerId}`);
      console.log(`     WeekStart actual: ${schedule.weekStart}`);
      console.log(`     WeekStart correcto: ${schedule.correctWeekStart}`);
      console.log(`     Semana inicio día: ${schedule.semanaInicioDia}\n`);
    });
    
    if (schedulesNeedingFix.length > 10) {
      console.log(`  ... y ${schedulesNeedingFix.length - 10} más\n`);
    }
    
    // Permitir ejecución automática con --yes
    const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
    
    let answer = 'NO';
    if (autoConfirm) {
      answer = 'SI';
      console.log('✅ Modo automático activado (--yes), procediendo con la corrección...\n');
    } else {
      answer = await question('¿Deseas CORREGIR estos schedules? (escribe "SI" para confirmar): ');
    }
    
    if (answer.trim().toUpperCase() !== 'SI') {
      console.log('❌ Operación cancelada.');
      rl.close();
      return;
    }
    
    console.log('\n🔧 Corrigiendo schedules...\n');
    
    let fixedCount = 0;
    let errorCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const schedule of schedulesNeedingFix) {
      try {
        const oldScheduleRef = schedulesRef.doc(schedule.id);
        const newScheduleId = buildScheduleDocId(schedule.ownerId, schedule.correctWeekStart);
        const newScheduleRef = schedulesRef.doc(newScheduleId);
        
        // Verificar si ya existe un schedule con el ID correcto
        const existingDoc = await newScheduleRef.get();
        if (existingDoc.exists) {
          console.log(`  ⚠️  Ya existe schedule con ID ${newScheduleId}, eliminando el duplicado ${schedule.id}`);
          batch.delete(oldScheduleRef);
        } else {
          // Crear nuevo schedule con weekStart correcto
          const newScheduleData = {
            ...schedule.data,
            weekStart: schedule.correctWeekStart,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _migratedFrom: schedule.id, // Marcar como migrado
            _migratedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          batch.set(newScheduleRef, newScheduleData);
          batch.delete(oldScheduleRef);
        }
        
        fixedCount++;
        batchCount += 2; // set + delete
        
        // Firestore limita a 500 operaciones por batch
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ Procesados ${fixedCount} schedules...`);
          batchCount = 0;
        }
      } catch (error) {
        console.error(`  ❌ Error corrigiendo schedule ${schedule.id}:`, error.message);
        errorCount++;
      }
    }
    
    // Commit del batch final
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`\n✅ ¡Completado!`);
    console.log(`   Schedules corregidos: ${fixedCount}`);
    if (errorCount > 0) {
      console.log(`   Errores: ${errorCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Ejecutar
fixWeekStartSchedules()
  .then(() => {
    console.log('\n✨ Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
