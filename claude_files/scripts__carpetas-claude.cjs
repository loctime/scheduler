/**
 * Copia a ./claude_files/ solo los archivos con cambios según Git
 * (modificados + sin seguimiento), TODO EN UN SOLO NIVEL (sin subcarpetas).
 * El nombre en destino es la ruta con "__" en lugar de "/" p. ej.
 *   hooks/use-pedidos.ts → hooks__use-pedidos.ts
 *
 * Uso: node scripts/carpetas-claude.cjs
 *
 * Opcional: rutas extra en EXTRA_PATHS.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const DEST_DIR = path.join(ROOT_DIR, "claude_files");

/** Archivos o carpetas a incluir siempre (rutas relativas a la raíz del repo) */
const EXTRA_PATHS = [
  // ej: "app/dashboard/pedir/page.tsx",
];

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

/**
 * Lista rutas relativas: modificados (tracked) + untracked (respeta .gitignore).
 */
function getGitChangedFiles(root) {
  const out = execSync("git ls-files -m -o --exclude-standard", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function collectFilesFromPath(rel) {
  const abs = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isFile()) return [rel.replace(/\\/g, "/")];
  const out = [];
  function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (stat.isDirectory()) walk(full, relPath.replace(/\\/g, "/"));
      else out.push(relPath.replace(/\\/g, "/"));
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
if (!isGitRepo(ROOT_DIR)) {
  console.error("No hay repositorio Git en", ROOT_DIR);
  process.exit(1);
}

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

let files = [];
try {
  files = getGitChangedFiles(ROOT_DIR);
} catch (e) {
  console.error("Error ejecutando git:", e.message);
  process.exit(1);
}

for (const extra of EXTRA_PATHS) {
  files.push(...collectFilesFromPath(extra));
}

if (files.length === 0) {
  console.log("No hay archivos modificados ni sin seguimiento (según git ls-files).");
  console.log("Podés agregar rutas en EXTRA_PATHS dentro del script.");
  process.exit(0);
}

copyFlat(files);
