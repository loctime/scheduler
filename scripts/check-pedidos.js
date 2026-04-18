const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkPedidos() {
  console.log("=== REVISIÓN DE PEDIDOS EN FIRESTORE ===\n");

  try {
    // 1. Revisar colección PEDIDOS_FABRICA
    console.log("1. Revisando PEDIDOS_FABRICA...");
    const pedidosFabricaSnapshot = await db.collection("apps/horarios/pedidos_fabrica").get();
    
    if (pedidosFabricaSnapshot.empty) {
      console.log("   No hay documentos en PEDIDOS_FABRICA");
    } else {
      console.log(`   Encontrados ${pedidosFabricaSnapshot.size} documentos en PEDIDOS_FABRICA:`);
      
      // Agrupar por ownerId
      const pedidosPorOwner = {};
      pedidosFabricaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const ownerId = data.ownerId || 'SIN_OWNER';
        if (!pedidosPorOwner[ownerId]) {
          pedidosPorOwner[ownerId] = [];
        }
        pedidosPorOwner[ownerId].push({
          id: doc.id,
          estado: data.estado || 'SIN_ESTADO',
          origen: data.origenNombre || 'SIN_ORIGEN',
          destino: data.destinoNombre || 'SIN_DESTINO',
          creadoEn: data.creadoEn,
          items: data.items?.length || 0
        });
      });

      // Mostrar por ownerId
      Object.keys(pedidosPorOwner).forEach(ownerId => {
        console.log(`   \n   Owner ID: ${ownerId}`);
        pedidosPorOwner[ownerId].forEach(pedido => {
          console.log(`     - ${pedido.id} | ${pedido.estado} | ${pedido.origen} -> ${pedido.destino} | ${pedido.items} items`);
        });
      });
    }

    // 2. Revisar colección REMITOS_LOG
    console.log("\n2. Revisando REMITOS_LOG...");
    const remitosSnapshot = await db.collection("apps/horarios/remitos_log").get();
    
    if (remitosSnapshot.empty) {
      console.log("   No hay documentos en REMITOS_LOG");
    } else {
      console.log(`   Encontrados ${remitosSnapshot.size} documentos en REMITOS_LOG:`);
      
      const remitosPorOwner = {};
      remitosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const ownerId = data.ownerId || 'SIN_OWNER';
        if (!remitosPorOwner[ownerId]) {
          remitosPorOwner[ownerId] = [];
        }
        remitosPorOwner[ownerId].push({
          id: doc.id,
          numero: data.numero || 'SIN_NUMERO',
          estado: data.estado || 'SIN_ESTADO',
          origen: data.origenNombre || 'SIN_ORIGEN',
          destino: data.destinoNombre || 'SIN_DESTINO',
          items: data.items?.length || 0
        });
      });

      Object.keys(remitosPorOwner).forEach(ownerId => {
        console.log(`   \n   Owner ID: ${ownerId}`);
        remitosPorOwner[ownerId].forEach(remito => {
          console.log(`     - ${remito.numero} | ${remito.estado} | ${remito.origen} -> ${remito.destino} | ${remito.items} items`);
        });
      });
    }

    // 3. Revisar colección CATALOGO (productos)
    console.log("\n3. Revisando CATALOGO...");
    const catalogoSnapshot = await db.collection("apps/horarios/catalogo").get();
    
    if (catalogoSnapshot.empty) {
      console.log("   No hay documentos en CATALOGO");
    } else {
      console.log(`   Encontrados ${catalogoSnapshot.size} productos en CATALOGO:`);
      
      const productosPorOwner = {};
      catalogoSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const ownerId = data.ownerId || 'SIN_OWNER';
        if (!productosPorOwner[ownerId]) {
          productosPorOwner[ownerId] = [];
        }
        productosPorOwner[ownerId].push({
          id: doc.id,
          nombre: data.nombre || 'SIN_NOMBRE',
          stock: data.stock || 0
        });
      });

      Object.keys(productosPorOwner).forEach(ownerId => {
        console.log(`   \n   Owner ID: ${ownerId} (${productosPorOwner[ownerId].length} productos)`);
        productosPorOwner[ownerId].slice(0, 5).forEach(producto => {
          console.log(`     - ${producto.nombre} | Stock: ${producto.stock}`);
        });
        if (productosPorOwner[ownerId].length > 5) {
          console.log(`     ... y ${productosPorOwner[ownerId].length - 5} más`);
        }
      });
    }

    // 4. Revisar si hay datos de configuración
    console.log("\n4. Revisando CONFIG (settings)...");
    const configSnapshot = await db.collection("apps/horarios/config").get();
    
    if (configSnapshot.empty) {
      console.log("   No hay documentos en CONFIG");
    } else {
      console.log(`   Encontrados ${configSnapshot.size} documentos en CONFIG:`);
      configSnapshot.docs.forEach(doc => {
        console.log(`     - ${doc.id}`);
      });
    }

    console.log("\n=== RESUMEN ===");
    console.log(`PEDIDOS_FABRICA: ${pedidosFabricaSnapshot.size} documentos`);
    console.log(`REMITOS_LOG: ${remitosSnapshot.size} documentos`);
    console.log(`CATALOGO: ${catalogoSnapshot.size} productos`);
    console.log(`CONFIG: ${configSnapshot.size} documentos`);

  } catch (error) {
    console.error("Error al verificar pedidos:", error);
  }
}

// Ejecutar la verificación
checkPedidos().then(() => {
  console.log("\nVerificación completada.");
  process.exit(0);
}).catch(error => {
  console.error("Error en la verificación:", error);
  process.exit(1);
});
