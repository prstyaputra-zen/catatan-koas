// Penyimpanan lokal di perangkat (IndexedDB). Catatan dan media tidak pernah dikirim ke server.

const DB_NAME = 'catatan-koas';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) {
        const s = db.createObjectStore('media', { keyPath: 'id' });
        s.createIndex('noteId', 'noteId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; }, reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
  });
}

export const db = {
  allNotes: () => tx(['notes'], 'readonly', (t) => wrap(t.objectStore('notes').getAll())),
  // Metadata media tanpa blob besar, untuk indeks pencarian dan daftar.
  allMediaMeta: () => tx(['media'], 'readonly', (t) => new Promise((resolve, reject) => {
    const out = [];
    const req = t.objectStore('media').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      const { blob, ...meta } = c.value;
      out.push(meta);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  })),
  getMedia: (id) => tx(['media'], 'readonly', (t) => wrap(t.objectStore('media').get(id))),
  mediaForNote: (noteId) => tx(['media'], 'readonly', (t) => wrap(t.objectStore('media').index('noteId').getAll(noteId))),

  // Simpan catatan beserta perubahan medianya dalam satu transaksi.
  saveNote: (note, addMedia = [], updateMedia = [], removeMediaIds = []) =>
    tx(['notes', 'media'], 'readwrite', (t) => {
      t.objectStore('notes').put(note);
      const ms = t.objectStore('media');
      addMedia.forEach((m) => ms.put(m));
      updateMedia.forEach((m) => {
        const r = ms.get(m.id);
        r.onsuccess = () => { if (r.result) ms.put({ ...r.result, ...m }); };
      });
      removeMediaIds.forEach((id) => ms.delete(id));
    }),

  deleteNote: (noteId) => tx(['notes', 'media'], 'readwrite', (t) => {
    t.objectStore('notes').delete(noteId);
    const ms = t.objectStore('media');
    const r = ms.index('noteId').getAllKeys(noteId);
    r.onsuccess = () => r.result.forEach((k) => ms.delete(k));
  }),

  putRaw: (notes, media) => tx(['notes', 'media'], 'readwrite', (t) => {
    notes.forEach((n) => t.objectStore('notes').put(n));
    media.forEach((m) => t.objectStore('media').put(m));
  }),

  getMeta: (key) => tx(['meta'], 'readonly', (t) => wrap(t.objectStore('meta').get(key))).then((r) => r && r.value),
  setMeta: (key, value) => tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ key, value })),
};
