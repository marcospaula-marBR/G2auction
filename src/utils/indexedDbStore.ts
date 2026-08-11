/**
 * Utilitário de Persistência Ultra-rápida via IndexedDB NATIVO do Navegador.
 * Elimina os limites de 5MB do localStorage, permitindo armazenar 50.000+ imóveis
 * e centenas de cidades sem erros de cota (QuotaExceededError).
 */

const DB_NAME = 'G2AuctionDB';
const DB_VERSION = 1;
const STORE_PROPERTIES = 'properties';
const STORE_IMPORTS = 'imports';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB não é suportado neste ambiente.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROPERTIES)) {
        db.createObjectStore(STORE_PROPERTIES, { keyPath: 'compositeKey' });
      }
      if (!db.objectStoreNames.contains(STORE_IMPORTS)) {
        db.createObjectStore(STORE_IMPORTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePropertiesToIndexedDB(propertiesMap: Map<string, any>): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PROPERTIES, 'readwrite');
    const store = tx.objectStore(STORE_PROPERTIES);

    // Limpa registros antigos e insere os atuais
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    propertiesMap.forEach((val, key) => {
      store.put({ compositeKey: key, ...val });
    });

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IndexedDB Save Error]', err);
    return false;
  }
}

export async function loadPropertiesFromIndexedDB(): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PROPERTIES, 'readonly');
    const store = tx.objectStore(STORE_PROPERTIES);

    const allRecords = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    allRecords.forEach((item) => {
      const key = item.compositeKey || `${item.source}_${item.source_property_id}`;
      map.set(key, item);
    });
  } catch (err) {
    console.warn('[IndexedDB Load Error]', err);
  }
  return map;
}
