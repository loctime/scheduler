/**
 * Copia a ./claude_files/ el código y config relevantes, TODO EN UN SOLO NIVEL (sin subcarpetas).
 * El nombre en destino es la ruta con "__" en lugar de "/" p. ej.
 *   hooks/use-pedidos.ts → hooks__use-pedidos.ts
 *
 * Incluye:
 * - Todos los archivos bajo las carpetas listadas en SOURCE_DIRS (recursivo).
 * - Archivos en la raíz cuyo nombre está en ROOT_IMPORTANT_BASENAMES (si existen).
 *
 * Uso: node scripts/carpetas-claude.cjs
 *
 * Opcional: rutas extra en EXTRA_PATHS.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DEST_DIR = path.join(ROOT_DIR, "claude_files");

/** Carpetas a volcar por completo (relativas a la raíz del repo) */
const SOURCE_DIRS = [
  "app",
  "components",
  "contexts",
  "docs",
  "hooks",
  "lib",
  "src",
  "styles",
  "types",
];

/**
 * Archivos sueltos en la raíz a copiar si existen (sin secretos: no .env*, no serviceAccount*).
 */
const ROOT_IMPORTANT_BASENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "tsconfig.stock-tests.json",
  "tsconfig.base.json",
  "next-env.d.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "middleware.ts",
  "instrumentation.ts",
  "components.json",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  ".gitignore",
  "dom-to-image-more.d.ts",
  "README.md",
]);

/** Al recorrer carpetas, no entrar en estos directorios */
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
]);

/** Archivos o carpetas a incluir siempre además de lo anterior */
const EXTRA_PATHS = [
  // ej: "hooks/use-pedidos.ts",
];

function collectRootImportantFiles() {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (ROOT_IMPORTANT_BASENAMES.has(ent.name)) {
      out.push(ent.name.replace(/\\/g, "/"));
    }
  }
  return out;
}

function collectFilesFromPath(rel) {
  const abs = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isFile()) return [rel.replace(/\\/g, "/")];
  const out = [];
  function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      const relPath = prefix ? `${prefix}/${name}` : name;
      const relNorm = relPath.replace(/\\/g, "/");
      if (stat.isDirectory()) walk(full, relNorm);
      else out.push(relNorm);
    }
  }
  walk(abs, rel.replace(/\\/g, "/"));
  return out;
}

/** Ruta relativa → nombre único en carpeta plana */
function flatFileName(rel) {
  return rel.replace(/\\/g, "/").split("/").join("__");
}

function copyFlat(relPaths) {
  const seenRel = new Set();
  const usedDestNames = new Set();
  let n = 0;
  for (let rel of relPaths) {
    rel = rel.replace(/\\/g, "/");
    if (seenRel.has(rel)) continue;
    seenRel.add(rel);
    const src = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(src)) {
      console.log("Omitido (no existe):", rel);
      continue;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) continue;

    let base = flatFileName(rel);
    let destName = base;
    let suffix = 1;
    while (usedDestNames.has(destName)) {
      const ext = path.extname(base);
      const stem = ext ? base.slice(0, -ext.length) : base;
      destName = `${stem}__dup${suffix}${ext}`;
      suffix++;
    }
    usedDestNames.add(destName);

    const dest = path.join(DEST_DIR, destName);
    fs.copyFileSync(src, dest);
    console.log("Copiado:", rel, "→", destName);
    n++;
  }
  console.log("\nTotal:", n, "archivo(s) en", DEST_DIR);
}

// --- main ---
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

const files = [];

for (const dir of SOURCE_DIRS) {
  files.push(...collectFilesFromPath(dir));
}

files.push(...collectRootImportantFiles());

for (const extra of EXTRA_PATHS) {
  files.push(...collectFilesFromPath(extra));
}

if (files.length === 0) {
  console.log(
    "No se encontraron archivos (revisá que existan las carpetas en SOURCE_DIRS)."
  );
  process.exit(0);
}

copyFlat(files);
