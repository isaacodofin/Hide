//🌚🌚🌚🌚
import Database from 'better-sqlite3';
import { proto } from '@whiskeysockets/baileys';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils/auth-utils.js';
import { BufferJSON } from '@whiskeysockets/baileys/lib/Utils/generics.js';
import fs from 'fs';
import path from 'path';

export const useSQLiteAuthState = async (
    dbPath = './data/session/auth.db',
    sessionId = 'default'
) => {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath);
    
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('cache_size = -32000'); 
db.pragma('temp_store = MEMORY');
db.pragma('page_size = 4096');
db.prepare(`
        CREATE TABLE IF NOT EXISTS creds (
            id TEXT PRIMARY KEY,
            data TEXT
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS keys (
            session_id TEXT,
            type TEXT,
            id TEXT,
            value TEXT,
            PRIMARY KEY (session_id, type, id)
        )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_keys_type ON keys(type)`).run();

    // --- Helper functions ---

    const writeCreds = (creds) => {
        db.prepare(`INSERT OR REPLACE INTO creds (id, data) VALUES (?, ?)`)
          .run(sessionId, JSON.stringify(creds, BufferJSON.replacer));
    };

    const readCreds = () => {
        const row = db.prepare(`SELECT data FROM creds WHERE id=?`).get(sessionId);
        return row ? JSON.parse(row.data, BufferJSON.reviver) : initAuthCreds();
    };

    const writeKey = (type, id, value) => {
        db.prepare(`INSERT OR REPLACE INTO keys (session_id, type, id, value) VALUES (?, ?, ?, ?)`)
          .run(sessionId, type, id, JSON.stringify(value, BufferJSON.replacer));
    };

    const deleteKey = (type, id) => {
        db.prepare(`DELETE FROM keys WHERE session_id=? AND type=? AND id=?`)
          .run(sessionId, type, id);
    };

    const readKey = (type, id) => {
        const row = db.prepare(`SELECT value FROM keys WHERE session_id=? AND type=? AND id=?`)
          .get(sessionId, type, id);
        return row ? JSON.parse(row.value, BufferJSON.reviver) : null;
    };

    // --- Initialize creds ---
    const creds = readCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = readKey(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) {
                                writeKey(category, id, value);
                            } else {
                                deleteKey(category, id);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            writeCreds(creds);
        }
    };
};


 export const clearSQLiteSession = (dbPath = './data/session/auth.db') => {
    try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        console.log('✅ Session cleared!');
        return true;
    } catch (error) {
        console.error('Clear error:', error);
        return false;
    }
};                           
