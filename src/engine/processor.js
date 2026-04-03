import { extractText } from 'expo-pdf-text-extract';
import { saveChunk } from '../database/database';

// ─── Dummy Vector Generator ──────────────────────────────
// Simulates an AI embedding model — returns a zeroed 384-dim float vector as BLOB.
// Replace this with a real on-device model call later.
const dummyGenerateVector = () => {
  return new Uint8Array(384).fill(0);
};

// ─── Text Sanitizer ──────────────────────────────────────
// Strips junk: multiple whitespace, isolated digits (page numbers, table cells), etc.
const sanitizeText = (rawText) => {
  return rawText
    .replace(/\r\n/g, ' ')      // Windows line endings → space
    .replace(/\n/g, ' ')        // Unix line endings → space
    .replace(/\s+/g, ' ')       // Collapse multiple spaces/tabs
    .replace(/\b\d{1,3}\b/g, '') // Remove isolated numbers (page nums, etc.)
    .trim();
};

// ─── Sliding Window Chunker ──────────────────────────────
// size: number of words per chunk, overlap: words carried into next chunk
const chunkText = (text, size = 150, overlap = 30) => {
  const words = text.split(' ').filter((w) => w.length > 0);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    i += size - overlap;

    // Guard: if advancing puts us past the end, break
    if (i >= words.length) break;
  }

  return chunks;
};

// ─── Main Pipeline ───────────────────────────────────────
/**
 * Extracts text from a PDF, chunks it, generates dummy vectors,
 * and saves everything to the SQLite `chunks` table.
 *
 * @param {string} localUri  - The permanent local file URI from the DB
 * @param {number} documentId - The document's primary key in the DB
 */
export const processDocument = async (localUri, documentId) => {
  // expo-pdf-text-extract expects a clean file path without the file:// prefix
  const cleanPath = localUri.replace(/^file:\/\//, '');

  let rawText;
  try {
    rawText = await extractText(cleanPath);
  } catch (extractErr) {
    console.error('[processor] PDF text extraction failed:', extractErr);
    throw new Error(`Failed to extract text from PDF: ${extractErr.message}`);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('PDF appears to be empty or contains no extractable text (scanned image?).');
  }

  const sanitized = sanitizeText(rawText);
  const chunks = chunkText(sanitized, 150, 30);

  console.log(`[processor] Extracted ${chunks.length} chunks from document ${documentId}`);

  let savedCount = 0;
  for (const chunkText of chunks) {
    try {
      const vectorBlob = dummyGenerateVector();
      await saveChunk(documentId, chunkText, vectorBlob);
      savedCount++;
    } catch (saveErr) {
      console.warn(`[processor] Failed to save chunk ${savedCount}:`, saveErr);
      // Continue processing remaining chunks even if one fails
    }
  }

  console.log(`[processor] Done. Saved ${savedCount}/${chunks.length} chunks.`);
  return { totalChunks: chunks.length, savedChunks: savedCount };
};
