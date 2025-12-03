import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const DATA_DIR = './data/session/chatbot';
const DB_FILE = path.join(DATA_DIR, 'chatbot_memory.json');

await fs.promises.mkdir(DATA_DIR, { recursive: true });

// Create file if missing
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        messages: {},
        users: {}
    }, null, 2));
}

function loadDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

console.log(chalk.blue('[GIFT-MD] ✅ Chatbot memory initialized'));

// ------------------------------------------------------
// Messages
// ------------------------------------------------------
export function getMessages(userId) {
    const db = loadDB();
    return db.messages[userId] || [];
}

export function addMessage(userId, message) {
    const db = loadDB();
    if (!db.messages[userId]) db.messages[userId] = [];

    db.messages[userId].push(message);

    // Keep last 20
    if (db.messages[userId].length > 20) {
        db.messages[userId].shift();
    }

    saveDB(db);
    return db.messages[userId];
}

// ------------------------------------------------------
// User Info
// ------------------------------------------------------
export function getUserInfo(userId) {
    const db = loadDB();
    return db.users[userId] || {};
}

export function updateUserInfo(userId, info) {
    const db = loadDB();
    db.users[userId] = { ...(db.users[userId] || {}), ...info };
    saveDB(db);
    return db.users[userId];
}

// ------------------------------------------------------
// Clearing data
// ------------------------------------------------------
export function clearUserData(userId) {
    const db = loadDB();
    delete db.messages[userId];
    delete db.users[userId];
    saveDB(db);
    return true;
}

export function clearAllMemory() {
    saveDB({ messages: {}, users: {} });
    return true;
}

// ------------------------------------------------------
// Extra helpers
// ------------------------------------------------------
export function getAllUsers() {
    const db = loadDB();
    return [...new Set([
        ...Object.keys(db.messages),
        ...Object.keys(db.users)
    ])];
}

export function getMemoryStats() {
    const db = loadDB();
    return {
        totalUsers: getAllUsers().length,
        totalMessages: Object.values(db.messages).reduce((a, b) => a + b.length, 0),
        totalUserInfo: Object.keys(db.users).length
    };
}

export default {
    getMessages,
    addMessage,
    getUserInfo,
    updateUserInfo,
    clearUserData,
    clearAllMemory,
    getAllUsers,
    getMemoryStats
};
