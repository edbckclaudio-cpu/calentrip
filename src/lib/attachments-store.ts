export type AttachmentRecord = {
  id: string;
  name: string;
  type: string;
  size: number;
  data: Blob;
};

const DB_NAME = "calentrip-db";
const STORE = "attachments";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFromFile(file: File): Promise<{ id: string; name: string; type: string; size: number }> {
  const db = await openDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rec: AttachmentRecord = { id, name: file.name, type: file.type, size: file.size, data: file.slice(0, file.size, file.type) };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    store.put(rec);
  });
  return { id, name: rec.name, type: rec.type, size: rec.size };
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result as AttachmentRecord | undefined;
      resolve(rec ? rec.data : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getObjectUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    store.delete(id);
  });
}

