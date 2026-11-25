const db = new Promise((resolve, reject) => {
  const request = indexedDB.open('plain-day-planner', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('plans');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function read() {
  const database = await db;
  return new Promise((resolve, reject) => {
    const request = database.transaction('plans').objectStore('plans').get('document');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function save(rows) {
  const database = await db;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('plans', 'readwrite');
    transaction.objectStore('plans').put(rows, 'document');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
