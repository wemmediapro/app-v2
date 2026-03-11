#!/usr/bin/env node
/**
 * Vérifie que les fichiers de traduction (dashboard) ont les mêmes clés dans toutes les langues.
 * Usage: node scripts/verify-translations.cjs
 * Sortie: liste des clés manquantes par fichier de langue.
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const LOCALE_FILES = ['fr.json', 'en.json', 'es.json', 'it.json', 'ar.json'];

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys.push(fullKey);
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function main() {
  const allKeysByFile = {};

  for (const file of LOCALE_FILES) {
    const filePath = path.join(LOCALES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Fichier manquant: ${file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    allKeysByFile[file] = new Set(getAllKeys(data));
  }

  const refFile = 'fr.json';
  const refKeys = allKeysByFile[refFile];
  if (!refKeys) {
    console.error('Fichier de référence fr.json introuvable.');
    process.exit(1);
  }

  let hasMissing = false;
  for (const file of LOCALE_FILES) {
    if (file === refFile) continue;
    const keys = allKeysByFile[file];
    if (!keys) continue;
    const missing = [...refKeys].filter((k) => !keys.has(k));
    if (missing.length > 0) {
      hasMissing = true;
      console.log(`\n${file} — clés manquantes (référence: ${refFile}) :`);
      missing.sort().forEach((k) => console.log(`  - ${k}`));
    }
  }

  if (!hasMissing) {
    console.log('\nToutes les langues ont les mêmes clés que fr.json.');
  }
  process.exit(hasMissing ? 1 : 0);
}

main();
