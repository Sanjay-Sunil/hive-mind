import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

let db = null;

// ─── Boot ───────────────────────────────────────────────

export const initDB = async () => {
  try {
    db = await SQLite.openDatabaseAsync('outpost.db');

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS spaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        space_id INTEGER,
        file_name TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        text_content TEXT NOT NULL,
        vector_blob BLOB NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        space_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE
      );
    `);

    console.log('Database initialized successfully with Chat History!');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const getDB = () => db;

// ─── Spaces ─────────────────────────────────────────────

export const getSpaces = async () => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const rows = await database.getAllAsync(
    'SELECT * FROM spaces ORDER BY created_at DESC'
  );
  return rows;
};

export const createSpace = async (title) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.runAsync(
    'INSERT INTO spaces (title) VALUES (?)',
    [title]
  );
  return result.lastInsertRowId;
};

export const deleteSpace = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  // Explicit cascade: delete chunks → documents → messages → space
  // This guarantees a clean DB even if PRAGMA foreign_keys was off in a prior session.
  await database.runAsync(
    `DELETE FROM chunks WHERE document_id IN (
       SELECT id FROM documents WHERE space_id = ?
     )`,
    [spaceId]
  );
  await database.runAsync('DELETE FROM documents WHERE space_id = ?', [spaceId]);
  await database.runAsync('DELETE FROM messages WHERE space_id = ?', [spaceId]);
  await database.runAsync('DELETE FROM spaces WHERE id = ?', [spaceId]);
};

// ─── Documents ──────────────────────────────────────────

export const getDocuments = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const rows = await database.getAllAsync(
    'SELECT * FROM documents WHERE space_id = ? ORDER BY id ASC',
    [spaceId]
  );
  return rows;
};

export const saveDocument = async (spaceId, fileName, localUri) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.runAsync(
    'INSERT INTO documents (space_id, file_name, local_uri) VALUES (?, ?, ?)',
    [spaceId, fileName, localUri]
  );
  return result.lastInsertRowId;
};

export const deleteDocument = async (docId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  // Get the URI first so we can clean up the file
  const doc = await database.getFirstAsync(
    'SELECT local_uri FROM documents WHERE id = ?',
    [docId]
  );
  if (doc && doc.local_uri) {
    try {
      await FileSystem.deleteAsync(doc.local_uri, { idempotent: true });
    } catch (e) {
      console.warn('Could not delete file from disk:', e);
    }
  }

  await database.runAsync('DELETE FROM documents WHERE id = ?', [docId]);
};

/**
 * Pick a PDF, copy it to permanent storage, and save to DB.
 * Returns { id, file_name, local_uri } or null if cancelled.
 */
export const pickAndSaveDocument = async (spaceId, pickedAsset) => {
  const permanentDir = FileSystem.documentDirectory + 'hive_pdfs/';

  // Ensure the directory exists
  const dirInfo = await FileSystem.getInfoAsync(permanentDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
  }

  const permanentUri = permanentDir + pickedAsset.name;

  // Copy from temp cache to permanent location
  await FileSystem.copyAsync({
    from: pickedAsset.uri,
    to: permanentUri,
  });

  const docId = await saveDocument(spaceId, pickedAsset.name, permanentUri);
  return { id: docId, file_name: pickedAsset.name, local_uri: permanentUri };
};

// ─── Messages / Chat History ────────────────────────────

export const getMessages = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const rows = await database.getAllAsync(
    'SELECT * FROM messages WHERE space_id = ? ORDER BY created_at ASC',
    [spaceId]
  );
  return rows;
};

export const saveMessage = async (spaceId, role, content) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.runAsync(
    'INSERT INTO messages (space_id, role, content) VALUES (?, ?, ?)',
    [spaceId, role, content]
  );
  return result.lastInsertRowId;
};

export const getDocumentCountForSpace = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM documents WHERE space_id = ?',
    [spaceId]
  );
  return result?.count || 0;
};

// ─── Chunks ──────────────────────────────────────────────

/**
 * Saves a single text chunk + its vector BLOB to the chunks table.
 * @param {number} documentId - FK to documents.id
 * @param {string} textContent - The raw chunk text
 * @param {Uint8Array} vectorBlob - The embedding vector as a BLOB
 */
export const saveChunk = async (documentId, textContent, vectorBlob) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.runAsync(
    'INSERT INTO chunks (document_id, text_content, vector_blob) VALUES (?, ?, ?)',
    [documentId, textContent, vectorBlob]
  );
  return result.lastInsertRowId;
};

/**
 * Debug function: returns all text chunks for every document in a given space.
 * Uses INNER JOIN to traverse: space → documents → chunks.
 * @param {number} spaceId - The space's primary key
 */
export const getChunksForSpace = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const rows = await database.getAllAsync(
    `SELECT chunks.id, chunks.text_content, documents.file_name
     FROM chunks
     INNER JOIN documents ON chunks.document_id = documents.id
     WHERE documents.space_id = ?
     ORDER BY chunks.id ASC`,
    [spaceId]
  );
  return rows;
};

/**
 * Returns the number of chunks for a specific document.
 * Used to determine if a document has already been processed.
 */
export const getChunkCountForDocument = async (documentId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM chunks WHERE document_id = ?',
    [documentId]
  );
  return result?.count || 0;
};

/**
 * Updates an existing chunk with its generated 384-D vector embedding.
 */
export const updateChunkEmbedding = async (chunkId, vectorBlob) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  await database.runAsync(
    'UPDATE chunks SET vector_blob = ? WHERE id = ?',
    [vectorBlob, chunkId]
  );
};

/**
 * Returns all chunks for a specific space that have a null or empty vector blob (needs embedding).
 */
export const getUnembeddedChunks = async (spaceId) => {
  const database = getDB();
  if (!database) throw new Error('DB not initialized');

  const rows = await database.getAllAsync(
    `SELECT chunks.id, chunks.text_content
     FROM chunks
     INNER JOIN documents ON chunks.document_id = documents.id
     WHERE documents.space_id = ? AND (chunks.vector_blob IS NULL OR length(chunks.vector_blob) = 0)
     ORDER BY chunks.id ASC`,
    [spaceId]
  );
  return rows;
};
