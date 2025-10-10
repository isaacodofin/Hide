//🌚🌚🌚🌚
import Database from 'better-sqlite3';
import { proto } from '@whiskeysockets/baileys';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils/auth-utils.js';
import { BufferJSON } from '@whiskeysockets/baileys/lib/Utils/generics.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'messages.db');
const db = new Database(dbPath);

// Optimize SQLite performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT NOT NULL,
        chatId TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (id, chatId)
    );
    
    CREATE INDEX IF NOT EXISTS idx_chatId ON messages(chatId);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
`);

export const messageStore = {
    /**
     * Save message to database
     */
    save: (msg) => {
        try {
            if (!msg?.key?.id || !msg?.key?.remoteJid) return;
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO messages (id, chatId, message, timestamp)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run(
                msg.key.id,
                msg.key.remoteJid,
                JSON.stringify(msg),
                Date.now()
            );
        } catch (error) {
            console.error('❌ Error saving message to DB:', error);
        }
    },
    
    /**
     * Load message from database
     */
    load: (chatId, messageId) => {
        try {
            const stmt = db.prepare(`
                SELECT message FROM messages 
                WHERE id = ? AND chatId = ?
            `);
            
            const row = stmt.get(messageId, chatId);
            return row ? JSON.parse(row.message) : null;
        } catch (error) {
            console.error('❌ Error loading message from DB:', error);
            return null;
        }
    },
    
    /**
     * Load multiple messages for a chat
     */
    loadChatMessages: (chatId, limit = 50) => {
        try {
            const stmt = db.prepare(`
                SELECT message FROM messages 
                WHERE chatId = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `);
            
            const rows = stmt.all(chatId, limit);
            return rows.map(row => JSON.parse(row.message));
        } catch (error) {
            console.error('❌ Error loading chat messages:', error);
            return [];
        }
    },
    
    /**
     * Delete old messages (cleanup)
     */
    cleanup: (daysToKeep = 7) => {
        try {
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            const stmt = db.prepare(`DELETE FROM messages WHERE timestamp < ?`);
            const result = stmt.run(cutoffTime);
            
            if (result.changes > 0) {
                console.log(`🗑️ Cleaned up ${result.changes} old messages (older than ${daysToKeep} days)`);
            }
        } catch (error) {
            console.error('❌ Error cleaning up messages:', error);
        }
    },
    
    /**
     * Get database stats
     */
    getStats: () => {
        try {
            const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM messages`);
            const sizeStmt = db.prepare(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`);
            
            const total = totalStmt.get().total;
            const size = sizeStmt.get().size;
            
            return {
                totalMessages: total,
                dbSize: (size / 1024 / 1024).toFixed(2) + ' MB'
            };
        } catch (error) {
            console.error('❌ Error getting stats:', error);
            return { totalMessages: 0, dbSize: '0 MB' };
        }
    },
    
    /**
     * Close database connection
     */
    close: () => {
        db.close();
    }
};

// Auto-cleanup old messages every 24 hours
setInterval(() => {
    messageStore.cleanup(7); // Keep messages for 7 days
}, 24 * 60 * 60 * 1000);

// Cleanup on startup
messageStore.cleanup(7);

// Log startup stats
const stats = messageStore.getStats();
console.log(`📊 Message Store: ${stats.totalMessages} messages | ${stats.dbSize}`);

export default messageStore;
