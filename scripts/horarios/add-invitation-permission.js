/**
 * Script para agregar permiso de crear links de invitado a un usuario
 * 
 * USO:
 * 1. Asegúrate de tener Firebase Admin configurado
 * 2. Ejecuta: node scripts/add-invitation-permission.js
 * 3. Ingresa el UID del usuario cuando se solicite
 * 
 * Este script agregará el campo permisos.crearLinks = true al documento del usuario
 * en la colección apps/horarios/users/{userId}
 */

const admin = require('firebase-admin');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local si existe
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remover comillas si existen
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Reemplazar \n con saltos de línea reales
        value = value.replace(/\\n/g, '\n');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (error) {
  // Ignorar errores al cargar .env.local
}

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    // Opción 1: Usar objeto completo desde variable de entorno
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } 
    // Opción 2: Construir desde variables de entorno individuales
    else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL
      };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    // Opción 3: Usar archivo de credenciales
    else {
      const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        throw new Error('No se encontraron credenciales de Firebase Admin');
      }
    }
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.error('\nNecesitas configurar las credenciales de Firebase Admin.');
    console.error('Opción 1: Variables de entorno FIREBASE_ADMIN_PRIVATE_KEY y FIREBASE_ADMIN_CLIENT_EMAIL');
    console.error('Opción 2: Variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON completo)');
    console.error('Opción 3: Archivo serviceAccountKey.json en la raíz del proyecto');
    process.exit(1);
  }
}

const db = admin.firestore();
const COLLECTIONS = {
  USERS: 'apps/horarios/users'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function addInvitationPermission(userId, soloVer = false) {
  try {
    console.log(`\n🔍 Buscando usuario con UID: ${userId}...\n`);
    
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ Error: No se encontró un usuario con UID: ${userId}`);
      console.error('Verifica que el UID sea correcto y que el usuario exista en la base de datos.');
      rl.close();
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Usuario encontrado:');
    console.log(`   Email: ${userData.email || 'No disponible'}`);
    console.log(`   Nombre: ${userData.name || userData.displayName || 'No disponible'}`);
    console.log(`   Rol: ${userData.role || 'No disponible'}`);
    console.log(`   Grupo IDs: ${userData.grupoIds ? JSON.stringify(userData.grupoIds) : 'No disponible'}`);
    console.log(`   Owner ID: ${userData.ownerId || 'No disponible'}`);
    console.log(`   Creado en: ${userData.createdAt ? userData.createdAt.toDate().toLocaleString() : 'No disponible'}`);
    console.log(`   Actualizado en: ${userData.updatedAt ? userData.updatedAt.toDate().toLocaleString() : 'No disponible'}`);
    
    // Mostrar permisos actuales
    console.log('\n📋 Permisos actuales:');
    if (userData.permisos) {
      console.log(`   permisos.crearLinks: ${userData.permisos.crearLinks === true ? '✅ true' : '❌ false o no existe'}`);
      console.log(`   permisos.paginas: ${userData.permisos.paginas ? JSON.stringify(userData.permisos.paginas) : 'No disponible'}`);
      console.log(`   Objeto permisos completo:`, JSON.stringify(userData.permisos, null, 2));
    } else {
      console.log('   ❌ No tiene objeto permisos');
    }
    
    // Comparar con lo que debería tener si hubiera sido creado desde link de gerente
    console.log('\n🔍 Comparación con usuario creado desde link de gerente:');
    console.log('   Un usuario creado desde link de gerente con permiso de crear links debería tener:');
    console.log('   - permisos.crearLinks = true');
    console.log('   - permisos.paginas = [array de páginas permitidas]');
    
    const tienePermisoCrearLinks = userData.permisos && userData.permisos.crearLinks === true;
    const faltaPermiso = !tienePermisoCrearLinks;
    
    console.log('\n📊 Estado actual:');
    if (tienePermisoCrearLinks) {
      console.log('   ✅ Ya tiene permisos.crearLinks = true');
    } else {
      console.log('   ❌ NO tiene permisos.crearLinks = true');
      console.log('   ⚠️  Este usuario necesita el permiso para poder crear links de invitado.');
    }
    
    if (soloVer) {
      console.log('\n👀 Modo solo lectura - No se realizarán cambios.');
      rl.close();
      return;
    }
    
    // Verificar si ya tiene el permiso
    if (tienePermisoCrearLinks) {
      console.log('\n⚠️  El usuario ya tiene el permiso crearLinks activado.');
      const answer = await question('¿Deseas continuar de todas formas? (s/n): ');
      if (answer.trim().toLowerCase() !== 's') {
        console.log('❌ Operación cancelada.');
        rl.close();
        return;
      }
    }
    
    console.log('\n📝 Actualizando permisos...');
    
    // Preparar la actualización
    // Si ya tiene permisos, solo actualizamos crearLinks
    // Si no tiene permisos, creamos el objeto completo
    const updateData = userData.permisos 
      ? {
          'permisos.crearLinks': true
        }
      : {
          permisos: {
            crearLinks: true
          }
        };
    
    await userRef.update(updateData);
    
    console.log('✅ Permiso agregado exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   UID: ${userId}`);
    console.log(`   Permiso agregado: permisos.crearLinks = true`);
    console.log('\n✨ El usuario ahora puede crear links de invitado.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code === 'permission-denied') {
      console.error('\n⚠️  Error de permisos. Verifica que las credenciales de Firebase Admin tengan los permisos necesarios.');
    }
  } finally {
    rl.close();
  }
}

// Función principal
async function main() {
  try {
    console.log('🔧 Script para agregar permiso de crear links de invitado\n');
    console.log('Este script mostrará la información del usuario y puede agregar');
    console.log('el campo permisos.crearLinks = true al documento del usuario\n');
    
    // Verificar si se pasa --solo-ver o -v
    const soloVer = process.argv.includes('--solo-ver') || process.argv.includes('-v');
    
    // Obtener UID desde argumentos de línea de comandos
    // process.argv[0] = node, process.argv[1] = script path, process.argv[2+] = argumentos
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
    const userId = args[0] || await question('Ingresa el UID del usuario: ');
    
    if (!userId || userId.trim() === '') {
      console.error('❌ Error: Debes proporcionar un UID válido.');
      rl.close();
      process.exit(1);
    }
    
    await addInvitationPermission(userId.trim(), soloVer);
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
main()
  .then(() => {
    console.log('\n✨ Proceso finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });

