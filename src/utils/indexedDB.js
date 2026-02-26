// Native IndexedDB Wrapper
const DB_NAME = 'DigitalTwinDB';
const DB_VERSION = 1; // Increment if schema changes
const STORE_NAME = 'custom_assets';

// Helper to open DB
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// 保存单个资产
export const saveCustomAssetToDB = async (asset) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(asset);

        request.onsuccess = () => resolve(asset);
        request.onerror = (e) => reject(e.target.error);
    });
};

// 获取所有资产
export const getCustomAssetsFromDB = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

// 更新资产 (IndexedDB put works as insert or update)
export const updateCustomAssetInDB = async (asset) => {
    return saveCustomAssetToDB(asset);
};

// 删除资产
export const deleteCustomAssetFromDB = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
};
