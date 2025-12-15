const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icon.svg');
const outputDir = path.join(__dirname, '../public');

// Tamaños necesarios para los iconos
const sizes = [
  { size: 32, name: 'icon-light-32x32.png' },
  { size: 32, name: 'icon-dark-32x32.png' },
  { size: 180, name: 'apple-icon.png' },
];

// Generar versión basada en timestamp
function generateVersion() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}${minute}`;
}

// Actualizar versión en los service workers
function updateServiceWorkerVersion(version) {
  const swFiles = [
    path.join(__dirname, '../public/sw.js'),
    path.join(__dirname, '../public/sw-fabrica.js'),
    path.join(__dirname, '../public/sw-pedidos.js'),
  ];

  swFiles.forEach(swPath => {
    if (fs.existsSync(swPath)) {
      let content = fs.readFileSync(swPath, 'utf8');
      // Buscar y reemplazar la versión
      content = content.replace(
        /const APP_VERSION = ['"](.*?)['"]/,
        `const APP_VERSION = '${version}'`
      );
      fs.writeFileSync(swPath, content, 'utf8');
      console.log(`✓ Actualizado: ${path.basename(swPath)} (versión ${version})`);
    }
  });
}

async function generateIcons() {
  try {
    const svgBuffer = fs.readFileSync(svgPath);
    const version = generateVersion();
    
    // Generar iconos
    for (const { size, name } of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, name));
      console.log(`✓ Generado: ${name} (${size}x${size})`);
    }
    
    // Actualizar versión en service workers
    updateServiceWorkerVersion(version);
    
    console.log('\n✅ Todos los iconos han sido generados exitosamente!');
    console.log(`📦 Versión del PWA actualizada a: ${version}`);
    console.log('\n💡 Nota: Los usuarios recibirán una notificación de actualización');
    console.log('   la próxima vez que abran la aplicación.');
  } catch (error) {
    console.error('Error generando iconos:', error);
    process.exit(1);
  }
}

generateIcons();

