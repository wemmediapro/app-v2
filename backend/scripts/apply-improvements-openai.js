/**
 * Utilise OpenAI pour générer les modifications de code issues de l'analyse UI/UX,
 * puis les applique aux fichiers. Rapport d'analyse : docs/ANALYSE-GRAPHIQUE-ERGONOMIE-OPENAI.md
 *
 * Usage: cd backend && node scripts/apply-improvements-openai.js
 * Prérequis: OPENAI_API_KEY dans backend/.env ou config.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').default;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ROOT = path.join(__dirname, '..', '..');

function readSafe(filePath) {
  const full = path.join(ROOT, filePath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (e) {
    return null;
  }
}

function applyChange(filePath, oldContent, newContent, log) {
  const full = path.join(ROOT, filePath);
  let content;
  try {
    content = fs.readFileSync(full, 'utf8');
  } catch (e) {
    log.push({ file: filePath, status: 'error', message: e.message });
    return false;
  }
  if (!content.includes(oldContent)) {
    log.push({ file: filePath, status: 'skip', message: 'OLD not found (exact match)' });
    return false;
  }
  const newFull = content.replace(oldContent, newContent);
  if (newFull === content) {
    log.push({ file: filePath, status: 'skip', message: 'No change after replace' });
    return false;
  }
  fs.writeFileSync(full, newFull, 'utf8');
  log.push({ file: filePath, status: 'applied' });
  return true;
}

function parseModifications(text) {
  const blocks = [];
  const fileRegex = /=== FILE:\s*([^\n=]+?)===/g;
  const oldRegex = /=== OLD ===\s*([\s\S]*?)=== NEW ===/g;
  let match;
  const fileMatches = [];
  while ((match = fileRegex.exec(text)) !== null) {
    fileMatches.push({ index: match.index, path: match[1].trim() });
  }
  for (let i = 0; i < fileMatches.length; i++) {
    const start = fileMatches[i].index;
    const end = i + 1 < fileMatches.length ? fileMatches[i + 1].index : text.length;
    const section = text.slice(start, end);
    const pathMatch = /=== FILE:\s*([^\n=]+?)===/.exec(section);
    const filePath = pathMatch ? pathMatch[1].trim() : '';
    const oldNewMatch = /=== OLD ===\s*([\s\S]*?)=== NEW ===\s*([\s\S]*?)(?=== FILE:|$)/.exec(section);
    if (oldNewMatch) {
      const oldContent = oldNewMatch[1].trimEnd();
      const newContent = oldNewMatch[2].trimEnd();
      if (oldContent && (filePath.startsWith('dashboard/') || filePath.startsWith('src/'))) {
        blocks.push({ filePath, oldContent, newContent });
      }
    }
  }
  return blocks;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant. Définissez-le dans backend/.env ou config.env');
    process.exit(1);
  }

  const analysisPath = path.join(ROOT, 'docs', 'ANALYSE-GRAPHIQUE-ERGONOMIE-OPENAI.md');
  let analysisText = '';
  try {
    analysisText = fs.readFileSync(analysisPath, 'utf8');
  } catch (e) {
    console.error('Fichier d’analyse introuvable:', analysisPath);
    process.exit(1);
  }

  const dashboardContent = readSafe('dashboard/src/pages/Dashboard.jsx');
  const headerContent = readSafe('dashboard/src/components/Header.jsx');
  const sidebarContent = readSafe('dashboard/src/components/Sidebar.jsx');
  if (!dashboardContent || !headerContent || !sidebarContent) {
    console.error('Impossible de lire les fichiers dashboard.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = `Tu es un développeur. Voici le rapport d'analyse UI/UX de l'application GNV OnBoard et le contenu actuel de 3 fichiers.

RAPPORT D'ANALYSE (extrait des améliorations à appliquer):
${analysisText.slice(0, 4000)}

---

FICHIER 1 — dashboard/src/pages/Dashboard.jsx:
\`\`\`
${dashboardContent}
\`\`\`

FICHIER 2 — dashboard/src/components/Header.jsx:
\`\`\`
${headerContent}
\`\`\`

FICHIER 3 — dashboard/src/components/Sidebar.jsx:
\`\`\`
${sidebarContent}
\`\`\`

---

À faire :
1. Dashboard : les classes Tailwind dynamiques \`bg-\${stat.color}-100\` et \`text-\${stat.color}-600\` ne fonctionnent pas (purge). Remplace par des classes complètes selon stat.color (blue, violet, green, cyan, purple, indigo, pink, amber, emerald, orange). Utilise un objet de mapping ou des classes explicites.
2. Header : ajoute aria-label sur le bouton de déconnexion (LogOut) pour l'accessibilité, en plus du title.
3. Sidebar : ajoute aria-label sur les boutons de navigation (icône + texte) pour les lecteurs d'écran.

Pour chaque modification, écris exactement le bloc suivant (sans commentaire avant/après le OLD/NEW) :

=== FILE: chemin/relatif/depuis/racine/du/projet ===
=== OLD ===
(le code exact à remplacer, tel qu'il apparaît dans le fichier ci-dessus)
=== NEW ===
(le nouveau code)

Important : OLD doit être une copie exacte du code actuel (indentation, sauts de ligne). Un seul bloc par fichier si tu regroupes les changements, ou plusieurs blocs si plusieurs remplacements par fichier.`;

  console.log('Appel à OpenAI pour générer les modifications...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Tu génères des modifications de code précises. Tu réponds uniquement par des blocs === FILE ===, === OLD ===, === NEW ===. Pas de texte avant ou après les blocs.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature: 0.2,
  });

  const response = completion.choices[0]?.message?.content || '';
  const logPath = path.join(ROOT, 'docs', 'AMELIORATIONS-OPENAI-LOG.txt');
  const rawPath = path.join(ROOT, 'docs', 'AMELIORATIONS-OPENAI-REPONSE-OPENAI.md');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(rawPath, response, 'utf8');
  console.log('Réponse OpenAI enregistrée dans docs/AMELIORATIONS-OPENAI-REPONSE-OPENAI.md');

  const modifications = parseModifications(response);
  const log = [];
  let applied = 0;
  for (const { filePath, oldContent, newContent } of modifications) {
    if (applyChange(filePath, oldContent, newContent, log)) {
      applied++;
    }
  }

  const logText = [
    `Date: ${new Date().toISOString()}`,
    `Modifications parsées: ${modifications.length}`,
    `Appliquées: ${applied}`,
    '',
    ...log.map((l) => `[${l.status}] ${l.file}${l.message ? ' - ' + l.message : ''}`),
  ].join('\n');
  fs.writeFileSync(logPath, logText, 'utf8');
  console.log(logText);
  console.log('\nLog écrit dans docs/AMELIORATIONS-OPENAI-LOG.txt');

  if (applied === 0 && modifications.length > 0) {
    console.log(
      '\nAucune modification appliquée (OLD non trouvé). Vérifiez docs/AMELIORATIONS-OPENAI-REPONSE-OPENAI.md et appliquez à la main si besoin.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
