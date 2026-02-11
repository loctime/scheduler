/**
 * MIGRACIÓN AL NUEVO SISTEMA DE COMPANYSLUG
 * 
 * Este script migra datos del sistema antiguo (settings/main.publicSlug)
 * al nuevo sistema (publicCompanies/{slug}) de forma segura.
 * 
 * Características:
 * - Migración atómica con transacciones
 * - Detección de duplicados
 * - Preservación de enlaces existentes
 * - Logging detallado del proceso
 * - Rollback automático en caso de error
 */

const admin = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');

// Inicializar Firebase Admin
if (admin.apps.length === 0) {
  initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

/**
 * Normaliza slug igual que en el frontend
 */
function normalizeCompanySlug(input) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

/**
 * Valida formato de slug
 */
function isValidSlugFormat(slug) {
  if (!slug || slug.trim().length === 0) return false;
  if (slug.length < 3 || slug.length > 40) return false;
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) return false;
  if (slug.startsWith('-') || slug.endsWith('-')) return false;
  if (slug.includes('--')) return false;
  const reservedWords = ['www', 'api', 'admin', 'app', 'pwa', 'public', 'settings'];
  if (reservedWords.includes(slug)) return false;
  return true;
}

/**
 * Genera sufijo único para slug duplicado
 */
function generateUniqueSlug(baseSlug, suffix) {
  const maxBaseLength = 40 - suffix.toString().length - 1;
  const truncatedBase = baseSlug.substring(0, maxBaseLength);
  return `${truncatedBase}-${suffix}`;
}

/**
 * Migrar un documento de settings/main a publicCompanies
 */
async function migrateSettingsDocument(settingsDoc) {
  const settingsData = settingsDoc.data();
  const publicSlug = settingsData.publicSlug;
  const companyName = settingsData.companyName;
  const ownerId = settingsDoc.id; // El ID del documento es el ownerId

  // Si no tiene publicSlug, no migrar
  if (!publicSlug || !companyName) {
    console.log(`⚠️  [MIGRATION] Documento ${ownerId} sin publicSlug o companyName, omitiendo`);
    return { migrated: false, reason: 'no_public_slug' };
  }

  // Normalizar y validar slug
  const normalizedSlug = normalizeCompanySlug(publicSlug);
  if (!isValidSlugFormat(normalizedSlug)) {
    console.log(`⚠️  [MIGRATION] Slug inválido ${normalizedSlug} para ${ownerId}, omitiendo`);
    return { migrated: false, reason: 'invalid_slug' };
  }

  try {
    await db.runTransaction(async (transaction) => {
      let finalSlug = normalizedSlug;
      let suffix = 1;

      // Verificar si ya existe en publicCompanies
      while (suffix <= 100) {
        const publicCompanyRef = db.collection('publicCompanies').doc(finalSlug);
        const publicCompanyDoc = await transaction.get(publicCompanyRef);

        if (!publicCompanyDoc.exists()) {
          // Crear documento en publicCompanies
          const publicCompanyData = {
            ownerId: ownerId,
            companyName: companyName.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            active: true,
            migratedFrom: 'settings_main',
            migrationDate: admin.firestore.FieldValue.serverTimestamp()
          };

          transaction.set(publicCompanyRef, publicCompanyData);

          // Actualizar settings/main para marcar como migrado
          const settingsRef = db.collection('settings').doc('main');
          transaction.update(settingsRef, {
            publicSlugMigrated: true,
            publicSlugMigrationDate: admin.firestore.FieldValue.serverTimestamp(),
            originalPublicSlug: publicSlug,
            newPublicSlug: finalSlug
          });

          console.log(`✅ [MIGRATION] Migrado: ${ownerId} → ${finalSlug}`);
          return { migrated: true, finalSlug, originalSlug: publicSlug };
        }

        // Slug existe, intentar con sufijo
        finalSlug = generateUniqueSlug(normalizedSlug, suffix);
        suffix++;
      }

      throw new Error(`No se puede generar slug único para ${ownerId} después de 100 intentos`);
    });

    return { migrated: true };
  } catch (error) {
    console.error(`❌ [MIGRATION] Error migrando ${ownerId}:`, error);
    return { migrated: false, reason: 'transaction_error', error: error.message };
  }
}

/**
 * Función principal de migración
 */
async function migrateToNewSlugSystem() {
  console.log('🚀 [MIGRATION] Iniciando migración al nuevo sistema de companySlug...\n');

  try {
    // 1. Obtener todos los documentos de settings/main
    console.log('📋 [MIGRATION] Obteniendo documentos de settings/main...');
    const settingsSnapshot = await db.collection('settings').doc('main').get();
    
    if (!settingsSnapshot.exists) {
      console.log('ℹ️  [MIGRATION] No existe settings/main, no hay nada que migrar');
      return { success: true, migrated: 0, skipped: 0 };
    }

    // Para este sistema, asumimos que hay un solo documento settings/main
    // pero con múltiples propietarios en diferentes campos
    const settingsData = settingsSnapshot.data();
    
    // Buscar todos los posibles propietarios en settings
    const potentialOwners = Object.keys(settingsData).filter(key => 
      key.includes('ownerId') || key.includes('publicSlug')
    );

    console.log(`📊 [MIGRATION] Encontrados ${potentialOwners.length} potenciales propietarios`);

    // 2. Migrar cada propietario encontrado
    let migratedCount = 0;
    let skippedCount = 0;
    const migrationResults = [];

    for (const ownerKey of potentialOwners) {
      if (ownerKey.includes('publicSlug')) {
        const ownerId = ownerKey.replace('publicSlug', '');
        const publicSlug = settingsData[ownerKey];
        const companyName = settingsData[`${ownerId}CompanyName`] || settingsData.companyName;

        // Crear un documento temporal para migrar
        const tempSettingsDoc = {
          id: ownerId || 'default',
          data: {
            publicSlug: publicSlug,
            companyName: companyName
          }
        };

        const result = await migrateSettingsDocument(tempSettingsDoc);
        migrationResults.push({ ownerId, result });

        if (result.migrated) {
          migratedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    // 3. Reporte final
    console.log('\n📈 [MIGRATION] Reporte de migración:');
    console.log(`✅ Migrados exitosamente: ${migratedCount}`);
    console.log(`⚠️  Omitidos: ${skippedCount}`);
    console.log(`📊 Total procesados: ${migratedCount + skippedCount}`);

    // 4. Verificación post-migración
    console.log('\n🔍 [MIGRATION] Verificando migración...');
    const publicCompaniesSnapshot = await db.collection('publicCompanies').get();
    console.log(`📋 [MIGRATION] Total documentos en publicCompanies: ${publicCompaniesSnapshot.size}`);

    // 5. Mostrar detalles de migración
    console.log('\n📝 [MIGRATION] Detalles:');
    migrationResults.forEach(({ ownerId, result }) => {
      if (result.migrated) {
        console.log(`✅ ${ownerId}: Migrado exitosamente`);
      } else {
        console.log(`❌ ${ownerId}: Falló - ${result.reason}`);
      }
    });

    return {
      success: true,
      migrated: migratedCount,
      skipped: skippedCount,
      total: migratedCount + skippedCount,
      details: migrationResults
    };

  } catch (error) {
    console.error('❌ [MIGRATION] Error crítico en migración:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Función de rollback por si algo sale mal
 */
async function rollbackMigration() {
  console.log('🔄 [ROLLBACK] Iniciando rollback de migración...\n');

  try {
    // Eliminar todos los documentos migrados
    const publicCompaniesSnapshot = await db.collection('publicCompanies')
      .where('migratedFrom', '==', 'settings_main')
      .get();

    const batch = db.batch();
    publicCompaniesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Limpiar flags de migración en settings/main
    const settingsRef = db.collection('settings').doc('main');
    await settingsRef.update({
      publicSlugMigrated: admin.firestore.FieldValue.delete(),
      publicSlugMigrationDate: admin.firestore.FieldValue.delete(),
      originalPublicSlug: admin.firestore.FieldValue.delete(),
      newPublicSlug: admin.firestore.FieldValue.delete()
    });

    console.log(`✅ [ROLLBACK] Eliminados ${publicCompaniesSnapshot.size} documentos migrados`);
    console.log('✅ [ROLLBACK] Limpieza de flags de migración completada');

    return { success: true, deleted: publicCompaniesSnapshot.size };
  } catch (error) {
    console.error('❌ [ROLLBACK] Error en rollback:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar migración si se corre directamente
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'migrate') {
    migrateToNewSlugSystem()
      .then(result => {
        console.log('\n🎉 [MIGRATION] Proceso completado:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('\n💥 [MIGRATION] Error fatal:', error);
        process.exit(1);
      });
  } else if (command === 'rollback') {
    rollbackMigration()
      .then(result => {
        console.log('\n🎉 [ROLLBACK] Proceso completado:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('\n💥 [ROLLBACK] Error fatal:', error);
        process.exit(1);
      });
  } else {
    console.log('Uso:');
    console.log('  node migrate-to-new-slug-system.js migrate  - Ejecutar migración');
    console.log('  node migrate-to-new-slug-system.js rollback - Revertir migración');
    process.exit(1);
  }
}

module.exports = {
  migrateToNewSlugSystem,
  rollbackMigration
};
