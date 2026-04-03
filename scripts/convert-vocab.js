/**
 * Temp script: Convert vocab.txt → vocab.json
 *
 * Input :  assets/utils/vocab.txt   (one token per line, line index = token ID)
 * Output:  assets/utils/vocab.json  (object mapping token → id)
 *
 * Run:  node scripts/convert-vocab.js
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'assets', 'utils', 'vocab.txt');
const OUTPUT = path.join(__dirname, '..', 'assets', 'utils', 'vocab.json');

const raw = fs.readFileSync(INPUT, 'utf-8');
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);

// Build { token: id } map
const vocab = {};
lines.forEach((token, index) => {
  vocab[token] = index;
});

fs.writeFileSync(OUTPUT, JSON.stringify(vocab), 'utf-8');

console.log(`✔ Converted ${Object.keys(vocab).length} tokens`);
console.log(`  Input:  ${INPUT}`);
console.log(`  Output: ${OUTPUT}`);
console.log(`  Size:   ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
