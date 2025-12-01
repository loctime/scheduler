/**
 * Script para eliminar schedules antiguos que no tienen createdBy
 * 
 * USO:
 * 1. Asegúrate de tener Firebase CLI instalado y estar autenticado
 * 2. Ejecuta: node scripts/delete-old-schedules.js
 * 
 * ADVERTENCIA: Este script eliminará PERMANENTEMENTE todos los schedules
 * que no tengan el campo createdBy. No se puede deshacer.
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Inicializar Firebase Admin
// Necesitas tener las credenciales de servicio en un archivo o variable de entorno
if (!admin.apps.length) {
  try {
    // Intenta usar las credenciales de la variable de entorno
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      // O usa el archivo de credenciales
      const serviceAccount = require('../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('Error inicializando Firebase Admin:', error);
    console.error('\nNecesitas configurar las credenciales de Firebase Admin.');
    console.error('Opción 1: Crear archivo serviceAccountKey.json en la raíz del proyecto');
    console.error('Opción 2: Configurar variable de entorno FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }
}

const db = admin.firestore();
const COLLECTIONS = {
  SCHEDULES: 'apps/horarios/schedules'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteOldSchedules() {
  try {
    console.log('🔍 Buscando schedules antiguos sin createdBy...\n');
    
    const schedulesRef = db.collection(COLLECTIONS.SCHEDULES);
    const snapshot = await schedulesRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No se encontraron schedules en la base de datos.');
      rl.close();
      return;
    }
    
    const oldSchedules = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.createdBy || data.createdBy === null || data.createdBy === undefined) {
        oldSchedules.push({
          id: doc.id,
          weekStart: data.weekStart || 'N/A',
          nombre: data.nombre || 'N/A',
        });
      }
    });
    
    if (oldSchedules.length === 0) {
      console.log('✅ No se encontraron schedules antiguos sin createdBy.');
      console.log('Todos los schedules tienen el campo createdBy establecido.');
      rl.close();
      return;
    }
    
    console.log(`⚠️  Se encontraron ${oldSchedules.length} schedules antiguos sin createdBy:\n`);
    oldSchedules.slice(0, 10).forEach((schedule, index) => {
      console.log(`  ${index + 1}. ID: ${schedule.id}`);
      console.log(`     Semana: ${schedule.weekStart}`);
      console.log(`     Nombre: ${schedule.nombre}\n`);
    });
    
    if (oldSchedules.length > 10) {
      console.log(`  ... y ${oldSchedules.length - 10} más\n`);
    }
    
    const answer = await question('¿Deseas ELIMINAR estos schedules? (escribe "SI" para confirmar): ');
    
    if (answer.trim().toUpperCase() !== 'SI') {
      console.log('❌ Operación cancelada.');
      rl.close();
      return;
    }
    
    console.log('\n🗑️  Eliminando schedules...');
    
    const batch = db.batch();
    let deletedCount = 0;
    
    for (const schedule of oldSchedules) {
      const scheduleRef = schedulesRef.doc(schedule.id);
      batch.delete(scheduleRef);
      deletedCount++;
      
      // Firestore limita a 500 operaciones por batch
      if (deletedCount % 500 === 0) {
        await batch.commit();
        console.log(`  ✅ Eliminados ${deletedCount} schedules...`);
      }
    }
    
    // Commit del batch final
    if (deletedCount % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`\n✅ ¡Completado! Se eliminaron ${deletedCount} schedules antiguos.`);
    console.log('Los schedules con createdBy se mantienen intactos.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Ejecutar
deleteOldSchedules()
  .then(() => {
    console.log('\n✨ Proceso finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });

