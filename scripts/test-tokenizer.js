/**
 * Interactive tokenizer test
 *
 * Run:  node scripts/test-tokenizer.js
 *
 * Lets you type any string and see the tokenized output.
 * Type "exit" or press Ctrl+C to quit.
 */

const readline = require('readline');
const { tokenize, encode, decode } = require('./tokenizer');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('');
console.log('╔═══════════════════════════════════════════╗');
console.log('║     HIVE  —  WordPiece Tokenizer Test     ║');
console.log('╚═══════════════════════════════════════════╝');
console.log('');
console.log('Type any text to tokenize. Type "exit" to quit.\n');

function prompt() {
  rl.question('> ', (input) => {
    if (!input || input.trim().toLowerCase() === 'exit') {
      console.log('\nGoodbye!\n');
      rl.close();
      return;
    }

    const text = input.trim();

    // Tokenize
    const tokens = tokenize(text);
    const { inputIds, attentionMask, tokens: encodedTokens } = encode(text, { maxLength: 64 });

    // Only show non-padded IDs
    const realLength = attentionMask.filter((m) => m === 1).length;
    const activeIds = inputIds.slice(0, realLength);

    console.log('');
    console.log(`  Input:      "${text}"`);
    console.log(`  Tokens:     [${tokens.map((t) => `"${t}"`).join(', ')}]`);
    console.log(`  Token IDs:  [${activeIds.join(', ')}]`);
    console.log(`  Count:      ${tokens.length} tokens (+ CLS/SEP = ${realLength})`);
    console.log(`  Decoded:    "${decode(activeIds)}"`);
    console.log('');

    prompt();
  });
}

prompt();
