/**
 * Test du calcul automatique Heure début / Heure fin (programmation radio).
 * Exécuter : node scripts/test-radio-heure-calc.js
 */

function computeEndTimeFromStartAndDuration(startTime, durationSeconds) {
  if (!startTime || durationSeconds == null || durationSeconds <= 0) return '';
  const parts = startTime.trim().split(':').map(Number);
  const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;
  let total = h * 3600 + m * 60 + s + Math.round(durationSeconds);
  const outH = Math.floor(total / 3600) % 24;
  const outM = Math.floor((total % 3600) / 60);
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

function getProgramEndTime(prog) {
  if (!prog) return '';
  if (prog.endTime) return prog.endTime;
  const dur = prog.duration || 0;
  if (dur <= 0) return '';
  const start = prog.startTime && prog.startTime.trim() ? prog.startTime.trim() : '00:00';
  return computeEndTimeFromStartAndDuration(start, dur);
}

function getStartTimeFromPreviousProgram(radioPrograms, order) {
  if (order < 1) return '';
  const sorted = [...radioPrograms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (sorted.length === 0) return '';
  const prevIndex = Math.min(order - 1, sorted.length - 1);
  return getProgramEndTime(sorted[prevIndex]);
}

let ok = 0;
let ko = 0;

function assert(condition, msg) {
  if (condition) { ok++; console.log('  ✅', msg); }
  else { ko++; console.log('  ❌', msg); }
}

console.log('\n--- Calcul Heure fin (début + durée) ---\n');
assert(computeEndTimeFromStartAndDuration('00:00', 300) === '00:05', '00:00 + 5min = 00:05');
assert(computeEndTimeFromStartAndDuration('00:30', 600) === '00:40', '00:30 + 10min = 00:40');
assert(computeEndTimeFromStartAndDuration('08:00', 3600) === '09:00', '08:00 + 1h = 09:00');
assert(computeEndTimeFromStartAndDuration('23:50', 600) === '00:00', '23:50 + 10min = 00:00 (mod 24h)');
assert(computeEndTimeFromStartAndDuration('', 300) === '', 'pas de début => vide');
assert(computeEndTimeFromStartAndDuration('00:00', 0) === '', 'durée 0 => vide');

console.log('\n--- Heure fin d\'un programme (avec ou sans heure début) ---\n');
assert(getProgramEndTime({ endTime: '01:00' }) === '01:00', 'endTime présent => retourné');
assert(getProgramEndTime({ startTime: '00:00', duration: 300 }) === '00:05', 'début + durée => 00:05');
assert(getProgramEndTime({ duration: 300 }) === '00:05', 'seulement durée => 00:00 + durée = 00:05');
assert(getProgramEndTime({ startTime: '08:30', duration: 600 }) === '08:40', '08:30 + 10min = 08:40');
assert(getProgramEndTime({}) === '', 'programme vide => vide');

console.log('\n--- Heure début du programme N (fin du programme N-1) ---\n');
const oneProgram = [
  { order: 0, startTime: '08:00', duration: 600, endTime: '' }
];
oneProgram[0].endTime = getProgramEndTime(oneProgram[0]) || computeEndTimeFromStartAndDuration(oneProgram[0].startTime, oneProgram[0].duration);
assert(getStartTimeFromPreviousProgram(oneProgram, 1) === '08:10', 'Ordre 1 : début = fin du programme 0 (08:00+10min=08:10)');

const twoPrograms = [
  { order: 0, startTime: '08:00', duration: 600 },
  { order: 1, startTime: '', duration: 300 }
];
twoPrograms[0].endTime = getProgramEndTime(twoPrograms[0]);
twoPrograms[1].startTime = getStartTimeFromPreviousProgram(twoPrograms, 1);
assert(twoPrograms[1].startTime === '08:10', '2e programme : début auto = 08:10');
const end2 = computeEndTimeFromStartAndDuration(twoPrograms[1].startTime, twoPrograms[1].duration);
assert(end2 === '08:15', '2e programme : fin = 08:10 + 5min = 08:15');

const firstOnlyDuration = [{ order: 0, duration: 300 }];
assert(getStartTimeFromPreviousProgram(firstOnlyDuration, 1) === '00:05', '1er sans heure début, durée 5min => 2e commence à 00:05');

console.log('\n--- Résumé ---\n');
console.log(`Réussis: ${ok}, Échecs: ${ko}`);
process.exit(ko > 0 ? 1 : 0);
