import Database from 'better-sqlite3';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data','messageStore.db', 'chatStore.db',);

const dbPath = path.join(dataDir, 'messages.db');
const messagesDb = new Database(dbPath);  // ← Different name!

// Optimize SQLite performance
messagesDb.pragma('journal_mode = WAL');
messagesDb.pragma('synchronous = NORMAL');
messagesDb.pragma('cache_size = -32000');

// Create tables
messagesDb.exec(`
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
            
            const stmt = messagesDb.prepare(`
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
            const stmt = messagesDb.prepare(`
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
            const stmt = messagesDb.prepare(`
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
            const stmt = messagesDb.prepare(`DELETE FROM messages WHERE timestamp < ?`);
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
            const totalStmt = messagesDb.prepare(`SELECT COUNT(*) as total FROM messages`);
            const sizeStmt = messagesDb.prepare(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`);
            
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
        messagesDb.close();
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
console.log(chalk.cyan('HELLO-WORD'));

export default messageStore;

