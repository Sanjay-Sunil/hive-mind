import { createWorkletRuntime, runOnRuntime, runOnJS } from 'react-native-worklets';
import { getDB } from '../database/database';
import AIEngine from './AIEngine';

// ─── Helper: Convert SQLite BLOB → regular JS number array ───
function blobToFloatArray(blob) {
  if (!blob) return [];
  let uint8;
  if (blob instanceof ArrayBuffer) {
    uint8 = new Uint8Array(blob);
  } else if (blob instanceof Uint8Array) {
    uint8 = blob;
  } else {
    try { uint8 = new Uint8Array(blob); } catch { return []; }
  }
  if (uint8.byteLength === 0) return [];
  const float32 = new Float32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength / 4);
  return Array.from(float32);
}

// ─── SearchEngine ────────────────────────────────────────────
class SearchEngine {
  constructor() {
    this.runtime = null;
    this.cacheLoaded = false;
    this.cachedSpaceId = null;
    this.cacheSize = 0;
  }

  /** Create the dedicated background worklet runtime (once). */
  _ensureRuntime() {
    if (!this.runtime) {
      this.runtime = createWorkletRuntime('HiveSearch');
      console.log('[SearchEngine] Background worklet runtime created.');
    }
  }

  // ─── Cache Loading ──────────────────────────────────────────

  /**
   * Loads all embedded chunk vectors for a space into the worklet
   * runtime's global memory. This is called once when the user
   * enters a space — vectors are NOT re-queried on every search.
   */
  async loadCache(spaceId) {
    this._ensureRuntime();

    const database = getDB();
    if (!database) throw new Error('DB not initialized');

    console.log(`[SearchEngine] Loading vector cache for space ${spaceId}…`);

    const rows = await database.getAllAsync(
      `SELECT chunks.id, chunks.text_content, chunks.vector_blob, documents.file_name
       FROM chunks
       INNER JOIN documents ON chunks.document_id = documents.id
       WHERE documents.space_id = ? AND length(chunks.vector_blob) > 0
       ORDER BY chunks.id ASC`,
      [spaceId]
    );

    // Convert BLOBs to plain arrays (worklet-serialisable)
    const vectors = [];
    for (const row of rows) {
      const v = blobToFloatArray(row.vector_blob);
      if (v.length === 0) continue;
      vectors.push({ id: row.id, t: row.text_content, f: row.file_name, v });
    }

    console.log(`[SearchEngine] Prepared ${vectors.length} vectors → pushing to worklet…`);

    // Push into the worklet runtime's global scope (serialised once)
    const rt = this.runtime;
    await new Promise((resolve) => {
      runOnRuntime(rt, () => {
        'worklet';
        globalThis.__hiveCache = vectors;
        runOnJS(resolve)();
      })();
    });

    this.cachedSpaceId = spaceId;
    this.cacheLoaded = true;
    this.cacheSize = vectors.length;
    console.log(`[SearchEngine] Cache ready — ${vectors.length} chunks in worklet memory.`);
    return vectors.length;
  }

  // ─── Main Search Entry Point ────────────────────────────────

  /**
   * Hybrid search: semantic (worklet) + keyword (SQLite) → merged ranking.
   * @returns {Promise<Array<{id,score,text,fileName,source}>>}
   */
  async search(queryText, spaceId) {
    if (!this.cacheLoaded || this.cachedSpaceId !== spaceId) {
      await this.loadCache(spaceId);
    }
    await AIEngine.initialize();

    console.log(`[SearchEngine] Searching: "${queryText}"`);

    // Generate 384-D query vector
    const queryFloat32 = await AIEngine.getEmbedding(queryText);
    const queryVector = Array.from(queryFloat32);

    // Run both searches in parallel
    const [semantic, keyword] = await Promise.all([
      this._vectorSearch(queryVector),
      this._keywordSearch(queryText, spaceId),
    ]);

    console.log(`[SearchEngine] Semantic: ${semantic.length}  Keyword: ${keyword.length}`);
    return this._mergeResults(semantic, keyword);
  }

  // ─── Vector Search (Worklet) ────────────────────────────────

  /**
   * Cosine similarity over ALL cached vectors, executed on the
   * background worklet runtime so the UI thread stays unblocked.
   */
  _vectorSearch(queryVector) {
    const rt = this.runtime;
    return new Promise((resolve) => {
      runOnRuntime(rt, () => {
        'worklet';
        const cache = globalThis.__hiveCache || [];
        const qVec = queryVector;           // closure-captured (384 floats)
        const dim = qVec.length;
        const results = [];

        // Pre-compute query norm
        let qNormSq = 0;
        for (let j = 0; j < dim; j++) qNormSq += qVec[j] * qVec[j];
        const qNorm = Math.sqrt(qNormSq);

        if (qNorm === 0) { runOnJS(resolve)([]); return; }

        for (let i = 0; i < cache.length; i++) {
          const cv = cache[i].v;
          let dot = 0, cNormSq = 0;
          for (let j = 0; j < dim; j++) {
            dot    += qVec[j] * cv[j];
            cNormSq += cv[j] * cv[j];
          }
          const denom = qNorm * Math.sqrt(cNormSq);
          const score = denom > 0 ? dot / denom : 0;

          if (score > 0.25) {
            results.push({
              id:       cache[i].id,
              score:    Math.round(score * 10000) / 10000,
              text:     cache[i].t,
              fileName: cache[i].f,
              source:   'semantic',
            });
          }
        }

        results.sort((a, b) => b.score - a.score);
        runOnJS(resolve)(results.slice(0, 15));
      })();
    });
  }

  // ─── Keyword Search (SQLite) ────────────────────────────────

  async _keywordSearch(queryText, spaceId) {
    const database = getDB();
    if (!database) return [];

    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const clauses = words.map(() => 'LOWER(chunks.text_content) LIKE ?');
    const params  = words.map(w => `%${w}%`);

    try {
      const rows = await database.getAllAsync(
        `SELECT chunks.id, chunks.text_content, documents.file_name
         FROM chunks
         INNER JOIN documents ON chunks.document_id = documents.id
         WHERE documents.space_id = ? AND (${clauses.join(' OR ')})
         ORDER BY chunks.id ASC
         LIMIT 10`,
        [spaceId, ...params]
      );
      return rows.map(r => ({
        id: r.id, text: r.text_content, fileName: r.file_name, source: 'keyword',
      }));
    } catch (err) {
      console.warn('[SearchEngine] Keyword search failed:', err);
      return [];
    }
  }

  // ─── Merge & Rank ───────────────────────────────────────────

  _mergeResults(semantic, keyword) {
    const merged = new Map();

    // Keyword matches get a boosted "perfect" score
    keyword.forEach(item => {
      merged.set(item.id, { ...item, score: 1.1, source: 'keyword' });
    });

    // Semantic results (don't overwrite keyword entries)
    semantic.forEach(item => {
      if (!merged.has(item.id)) merged.set(item.id, item);
    });

    const arr = Array.from(merged.values());
    arr.sort((a, b) => b.score - a.score);
    return arr;
  }

  // ─── Cleanup ────────────────────────────────────────────────

  clearCache() {
    if (this.runtime) {
      const rt = this.runtime;
      runOnRuntime(rt, () => {
        'worklet';
        globalThis.__hiveCache = null;
      })();
    }
    this.cacheLoaded = false;
    this.cachedSpaceId = null;
    this.cacheSize = 0;
    console.log('[SearchEngine] Cache cleared.');
  }
}

export default new SearchEngine();
