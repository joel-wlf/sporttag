// expo-sqlite über node:sqlite. Jede Abfrage gibt den Event-Loop kurz frei,
// damit sich gleichzeitige Zugriffe wie auf dem Gerät verschränken.
import { DatabaseSync } from 'node:sqlite';

const tick = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 3));

export async function openDatabaseAsync() {
  const db = new DatabaseSync(':memory:');
  const api = {
    async execAsync(sql) {
      await tick();
      db.exec(sql);
    },
    async runAsync(sql, ...params) {
      await tick();
      return db.prepare(sql).run(...params);
    },
    async getFirstAsync(sql, ...params) {
      await tick();
      return db.prepare(sql).get(...params) ?? null;
    },
    async getAllAsync(sql, ...params) {
      await tick();
      return db.prepare(sql).all(...params);
    },
    // Wie expo-sqlite: BEGIN/COMMIT auf derselben Verbindung, nicht exklusiv.
    async withTransactionAsync(task) {
      try {
        await api.execAsync('BEGIN');
        await task();
        await api.execAsync('COMMIT');
      } catch (error) {
        try {
          await api.execAsync('ROLLBACK');
        } catch {
          // keine offene Transaktion
        }
        throw error;
      }
    },
  };
  return api;
}
