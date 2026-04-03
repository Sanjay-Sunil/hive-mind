/**
 * BERT WordPiece Tokenizer
 *
 * A pure-JS implementation of the BERT WordPiece tokenization algorithm.
 * Works with the vocab.json generated from vocab.txt.
 *
 * Usage (Node):
 *   const { tokenize, encode, decode } = require('./tokenizer');
 *   const tokens = tokenize('Hello world!');
 *   const ids    = encode('Hello world!');
 *   const text   = decode(ids);
 */

const vocab = require('../assets/utils/vocab.json');

// Build reverse map: id → token
const idToToken = {};
for (const [token, id] of Object.entries(vocab)) {
  idToToken[id] = token;
}

// Special token IDs
const PAD_ID = vocab['[PAD]'] ?? 0;
const UNK_ID = vocab['[UNK]'] ?? 100;
const CLS_ID = vocab['[CLS]'] ?? 101;
const SEP_ID = vocab['[SEP]'] ?? 102;

const MAX_WORD_LEN = 200; // Words longer than this get [UNK]

/**
 * Basic pre-tokenization: lowercase, strip accents, split on whitespace & punctuation.
 * Mirrors BERT's BasicTokenizer (do_lower_case=true).
 */
function basicTokenize(text) {
  // Lowercase
  text = text.toLowerCase();

  // Insert spaces around punctuation so they become separate tokens
  text = text.replace(/([\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_\`\{\|\}\~])/g, ' $1 ');

  // Collapse whitespace and split
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
}

/**
 * WordPiece tokenization for a single pre-tokenized word.
 * Returns an array of sub-tokens (e.g. ["un", "##aff", "##able"]).
 */
function wordpieceTokenize(word) {
  if (word.length > MAX_WORD_LEN) return ['[UNK]'];

  const tokens = [];
  let start = 0;

  while (start < word.length) {
    let end = word.length;
    let found = null;

    // Greedy longest-match from current position
    while (start < end) {
      const substr = (start > 0 ? '##' : '') + word.slice(start, end);
      if (vocab[substr] !== undefined) {
        found = substr;
        break;
      }
      end--;
    }

    if (found === null) {
      // Character not in vocab at all → entire word is [UNK]
      return ['[UNK]'];
    }

    tokens.push(found);
    start = end;
  }

  return tokens;
}

/**
 * Full tokenization pipeline: text → sub-token strings.
 * Does NOT add [CLS]/[SEP].
 */
function tokenize(text) {
  const words = basicTokenize(text);
  const allTokens = [];

  for (const word of words) {
    const subTokens = wordpieceTokenize(word);
    allTokens.push(...subTokens);
  }

  return allTokens;
}

/**
 * Encode text into token IDs, with [CLS] and [SEP] wrapper.
 * Returns { inputIds, attentionMask, tokenTypeIds }.
 */
function encode(text, { maxLength = 128, addSpecialTokens = true } = {}) {
  let tokens = tokenize(text);

  // Truncate to fit maxLength (accounting for [CLS] + [SEP])
  const budget = addSpecialTokens ? maxLength - 2 : maxLength;
  if (tokens.length > budget) {
    tokens = tokens.slice(0, budget);
  }

  // Convert to IDs
  let inputIds = tokens.map((t) => vocab[t] ?? UNK_ID);

  if (addSpecialTokens) {
    inputIds = [CLS_ID, ...inputIds, SEP_ID];
  }

  // Pad to maxLength
  const attentionMask = inputIds.map(() => 1);
  while (inputIds.length < maxLength) {
    inputIds.push(PAD_ID);
    attentionMask.push(0);
  }

  const tokenTypeIds = new Array(maxLength).fill(0);

  return { inputIds, attentionMask, tokenTypeIds, tokens };
}

/**
 * Decode token IDs back to text. Strips special tokens and re-joins ## subwords.
 */
function decode(ids) {
  const specialIds = new Set([PAD_ID, UNK_ID, CLS_ID, SEP_ID]);

  const tokens = ids
    .map((id) => idToToken[id] || '[UNK]')
    .filter((t) => !t.startsWith('[') || !t.endsWith(']'));

  // Re-join: ## tokens merge into previous word
  let result = '';
  for (const token of tokens) {
    if (token.startsWith('##')) {
      result += token.slice(2);
    } else {
      result += (result.length > 0 ? ' ' : '') + token;
    }
  }

  return result;
}

module.exports = { tokenize, encode, decode, vocab, idToToken, UNK_ID, CLS_ID, SEP_ID, PAD_ID };
