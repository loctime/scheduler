// Script simple para verificar datos desde la app (sin serviceAccount)
// Ejecutarlo desde la consola del navegador en tu app

console.log("=== VERIFICACIÓN DE DATOS DESDE LA APP ===");

// Función para verificar si hay datos
async function verificarDatos() {
  try {
    // Importar funciones de Firebase (ya deberían estar disponibles en la app)
    const { collection, getDocs, query, where } = window.firebase || window.firestore;
    
    if (!collection || !getDocs) {
      console.error("Firebase no está disponible. Ejecuta esto en la consola de tu app.");
      return;
    }

    // Obtener ownerId del usuario actual
    const user = window.auth?.currentUser;
    if (!user) {
      console.error("Usuario no autenticado. Inicia sesión primero.");
      return;
    }
    
    console.log("Usuario actual:", user.uid);
    console.log("Email:", user.email);

    // 1. Verificar PEDIDOS_FABRICA
    console.log("\n1. Verificando PEDIDOS_FABRICA...");
    const pedidosQuery = query(
      collection(window.db, "apps/horarios/pedidos_fabrica"),
      where("ownerId", "==", user.uid)
    );
    const pedidosSnapshot = await getDocs(pedidosQuery);
    
    if (pedidosSnapshot.empty) {
      console.log("   No hay pedidos para tu usuario");
    } else {
      console.log(`   Encontrados ${pedidosSnapshot.size} pedidos:`);
      pedidosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${doc.id} | Estado: ${data.estado} | ${data.origenNombre} -> ${data.destinoNombre}`);
      });
    }

    // 2. Verificar REMITOS_LOG
    console.log("\n2. Verificando REMITOS_LOG...");
    const remitosQuery = query(
      collection(window.db, "apps/horarios/remitos_log"),
      where("ownerId", "==", user.uid)
    );
    const remitosSnapshot = await getDocs(remitosQuery);
    
    if (remitosSnapshot.empty) {
      console.log("   No hay remitos para tu usuario");
    } else {
      console.log(`   Encontrados ${remitosSnapshot.size} remitos:`);
      remitosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${data.numero} | Estado: ${data.estado} | ${data.origenNombre} -> ${data.destinoNombre}`);
      });
    }

    // 3. Verificar CATALOGO
    console.log("\n3. Verificando CATALOGO...");
    const catalogoQuery = query(
      collection(window.db, "apps/horarios/catalogo"),
      where("ownerId", "==", user.uid)
    );
    const catalogoSnapshot = await getDocs(catalogoQuery);
    
    if (catalogoSnapshot.empty) {
      console.log("   No hay productos en tu catálogo");
    } else {
      console.log(`   Encontrados ${catalogoSnapshot.size} productos:`);
      catalogoSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${data.nombre} | Stock: ${data.stock}`);
      });
    }

    console.log("\n=== RESUMEN ===");
    console.log(`Tus pedidos: ${pedidosSnapshot.size}`);
    console.log(`Tus remitos: ${remitosSnapshot.size}`);
    console.log(`Tus productos: ${catalogoSnapshot.size}`);

  } catch (error) {
    console.error("Error:", error);
  }
}

// Ejecutar la verificación
verificarDatos();

console.log("\nSi esto no funciona, abre la consola en tu app y ejecuta verificarDatos()");
