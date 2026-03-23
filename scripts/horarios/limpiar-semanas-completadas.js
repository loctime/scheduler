const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey-controlfile.json');

// Inicializar Firebase Admin SDK con service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'controlstorage-eb796'
});

const db = admin.firestore();

async function limpiarSemanasCompletadas() {
  console.log('🧹 Iniciando limpieza de semanas completadas...');
  
  try {
    // Obtener todos los schedules
    const schedulesRef = collection(db, 'apps', 'horarios', 'schedules');
    const q = query(schedulesRef, where('completada', '==', true));
    
    const querySnapshot = await getDocs(q);
    console.log(`📊 Encontradas ${querySnapshot.docs.length} semanas completadas`);
    
    if (querySnapshot.docs.length === 0) {
      console.log('✅ No hay semanas completadas para limpiar');
      return;
    }
    
    // Procesar en lotes de 500 (límite de Firestore)
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = querySnapshot.docs.slice(i, i + batchSize);
      
      chunk.forEach((docSnapshot) => {
        console.log(`🔄 Limpiando semana: ${docSnapshot.id} (weekStart: ${docSnapshot.data().weekStart})`);
        batch.update(docSnapshot.ref, { completada: false });
      });
      
      batches.push(batch.commit());
    }
    
    // Ejecutar todos los lotes
    console.log(`⚡ Procesando ${batches.length} lotes...`);
    await Promise.all(batches);
    
    console.log('✅ ¡Limpieza completada! Todas las semanas ahora son editables');
    console.log(`📈 Se limpiaron ${querySnapshot.docs.length} semanas`);
    
  } catch (error) {
    console.error('❌ Error al limpiar semanas:', error);
    process.exit(1);
  }
}

// Ejecutar la limpieza
limpiarSemanasCompletadas().then(() => {
  console.log('🎉 Script finalizado correctamente');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
