import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = './data/session/chatbot';
const DB_PATH = path.join(DATA_DIR, 'chatbot_memory.db');

// Initialize SQLite database
const db = new Database(DB_PATH);

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, timestamp)
    );

    CREATE TABLE IF NOT EXISTS user_info (
        user_id TEXT PRIMARY KEY,
        name TEXT,
        age TEXT,
        location TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user ON chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_time ON chat_messages(timestamp);
`);

console.log('✅ Chatbot memory database initialized');

// In-memory cache for fast access
const chatMemory = {
    messages: new Map(),
    userInfo: new Map()
};

// Prepared statements for performance
const stmts = {
    insertMessage: db.prepare('INSERT INTO chat_messages (user_id, message) VALUES (?, ?)'),
    getMessages: db.prepare('SELECT message FROM chat_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20'),
    deleteOldMessages: db.prepare('DELETE FROM chat_messages WHERE user_id = ? AND timestamp NOT IN (SELECT timestamp FROM chat_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20)'),
    
    upsertUserInfo: db.prepare(`
        INSERT INTO user_info (user_id, name, age, location, updated_at) 
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(user_id) DO UPDATE SET
            name = COALESCE(excluded.name, name),
            age = COALESCE(excluded.age, age),
            location = COALESCE(excluded.location, location),
            updated_at = strftime('%s', 'now')
    `),
    getUserInfo: db.prepare('SELECT name, age, location FROM user_info WHERE user_id = ?'),
    deleteUserData: db.prepare('DELETE FROM chat_messages WHERE user_id = ?'),
    deleteUserInfo: db.prepare('DELETE FROM user_info WHERE user_id = ?'),
    getAllUsers: db.prepare('SELECT DISTINCT user_id FROM chat_messages UNION SELECT user_id FROM user_info'),
    clearAllMessages: db.prepare('DELETE FROM chat_messages'),
    clearAllUserInfo: db.prepare('DELETE FROM user_info')
};

/**
 * Load user messages from database into memory
 */
function loadMessagesFromDB(userId) {
    try {
        const rows = stmts.getMessages.all(userId);
        const messages = rows.map(row => row.message).reverse(); // Reverse to get chronological order
        chatMemory.messages.set(userId, messages);
        return messages;
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        return [];
    }
}

/**
 * Load user info from database into memory
 */
function loadUserInfoFromDB(userId) {
    try {
        const row = stmts.getUserInfo.get(userId);
        if (row) {
            const info = {
                name: row.name || undefined,
                age: row.age || undefined,
                location: row.location || undefined
            };
            // Remove undefined values
            Object.keys(info).forEach(key => info[key] === undefined && delete info[key]);
            chatMemory.userInfo.set(userId, info);
            return info;
        }
        return {};
    } catch (error) {
        console.error('❌ Error loading user info:', error);
        return {};
    }
}

/**
 * Get user messages (from memory or load from DB)
 */
export function getMessages(userId) {
    if (!chatMemory.messages.has(userId)) {
        loadMessagesFromDB(userId);
    }
    return chatMemory.messages.get(userId) || [];
}

/**
 * Add message to memory and database
 */
export function addMessage(userId, message) {
    try {
        // Add to database
        stmts.insertMessage.run(userId, message);
        
        // Update memory
        let messages = chatMemory.messages.get(userId) || [];
        messages.push(message);
        
        // Keep only last 20 messages in memory
        if (messages.length > 20) {
            messages.shift();
        }
        chatMemory.messages.set(userId, messages);
        
        // Clean up old messages in database (keep only last 20)
        stmts.deleteOldMessages.run(userId, userId);
        
        return messages;
    } catch (error) {
        console.error('❌ Error adding message:', error);
        return chatMemory.messages.get(userId) || [];
    }
}

/**
 * Get user info (from memory or load from DB)
 */
export function getUserInfo(userId) {
    if (!chatMemory.userInfo.has(userId)) {
        loadUserInfoFromDB(userId);
    }
    return chatMemory.userInfo.get(userId) || {};
}

/**
 * Update user info in memory and database
 */
export function updateUserInfo(userId, info) {
    try {
        // Get existing info
        const existing = getUserInfo(userId);
        const merged = { ...existing, ...info };
        
        // Update database
        stmts.upsertUserInfo.run(
            userId,
            merged.name || null,
            merged.age || null,
            merged.location || null
        );
        
        // Update memory
        chatMemory.userInfo.set(userId, merged);
        
        return merged;
    } catch (error) {
        console.error('❌ Error updating user info:', error);
        return chatMemory.userInfo.get(userId) || {};
    }
}

/**
 * Clear user conversation data
 */
export function clearUserData(userId) {
    try {
        stmts.deleteUserData.run(userId);
        stmts.deleteUserInfo.run(userId);
        chatMemory.messages.delete(userId);
        chatMemory.userInfo.delete(userId);
        return true;
    } catch (error) {
        console.error('❌ Error clearing user data:', error);
        return false;
    }
}

/**
 * Clear all chatbot memory (global reset)
 */
export function clearAllMemory() {
    try {
        stmts.clearAllMessages.run();
        stmts.clearAllUserInfo.run();
        chatMemory.messages.clear();
        chatMemory.userInfo.clear();
        return true;
    } catch (error) {
        console.error('❌ Error clearing all memory:', error);
        return false;
    }
}

/**
 * Get all users with stored conversations
 */
export function getAllUsers() {
    try {
        const rows = stmts.getAllUsers.all();
        return rows.map(row => row.user_id);
    } catch (error) {
        console.error('❌ Error getting all users:', error);
        return [];
    }
}

/**
 * Get memory stats
 */
export function getMemoryStats() {
    try {
        const totalMessages = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get().count;
        const totalUsers = db.prepare('SELECT COUNT(DISTINCT user_id) FROM (SELECT user_id FROM chat_messages UNION SELECT user_id FROM user_info)').get()['COUNT(DISTINCT user_id)'];
        const totalUserInfo = db.prepare('SELECT COUNT(*) as count FROM user_info').get().count;
        
        return {
            totalMessages,
            totalUsers,
            totalUserInfo,
            memorySize: {
                messages: chatMemory.messages.size,
                userInfo: chatMemory.userInfo.size
            }
        };
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        return null;
    }
}

/**
 * Optimize database (run periodically)
 */
export function optimizeDatabase() {
    try {
        db.exec('VACUUM');
        db.exec('ANALYZE');
        console.log('✅ Database optimized');
        return true;
    } catch (error) {
        console.error('❌ Error optimizing database:', error);
        return false;
    }
}

// Graceful shutdown
process.on('exit', () => {
    db.close();
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

export default {
    getMessages,
    addMessage,
    getUserInfo,
    updateUserInfo,
    clearUserData,
    clearAllMemory,
    getAllUsers,
    getMemoryStats,
    optimizeDatabase
};
