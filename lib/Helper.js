import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Database from 'better-sqlite3';
import { getSetting, updateSetting } from '../lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== CONFIGURATION =====
const messageCache = new Map(); // In-memory cache
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');
const ANTIDELETE_STORE_PATH = path.join(__dirname, '../data/messageStore.db/ANTIDELETE.MS/antidelete_mStore.db');
const ANTIEDIT_STORE_PATH = path.join(__dirname, '../data/messageStore.db/ANTIEDIT.MS/antiedit_mStore.db');

// Ensure directories exist
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(ANTIDELETE_STORE_PATH))) {
    fs.mkdirSync(path.dirname(ANTIDELETE_STORE_PATH), { recursive: true });
}
if (!fs.existsSync(path.dirname(ANTIEDIT_STORE_PATH))) {
    fs.mkdirSync(path.dirname(ANTIEDIT_STORE_PATH), { recursive: true });
}

// ===== INITIALIZE STORAGE SYSTEMS =====
const antideleteStore = new Database(ANTIDELETE_STORE_PATH);
antideleteStore.pragma('journal_mode = WAL');

const antieditStore = new Database(ANTIEDIT_STORE_PATH);
antieditStore.pragma('journal_mode = WAL');

// Create tables if not exists
antideleteStore.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        messageId TEXT PRIMARY KEY,
        content TEXT,
        mediaType TEXT,
        mediaPath TEXT,
        sender TEXT,
        groupId TEXT,
        chatId TEXT,
        timestamp TEXT
    )
`);

antieditStore.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        messageId TEXT PRIMARY KEY,
        content TEXT,
        mediaType TEXT,
        mediaPath TEXT,
        sender TEXT,
        groupId TEXT,
        chatId TEXT,
        timestamp TEXT
    )
`);

// ===== STORAGE FUNCTIONS =====
function saveMessageToStore(messageId, data, storeType = 'delete') {
    try {
        const store = storeType === 'delete' ? antideleteStore : antieditStore;
        const stmt = store.prepare(`
            INSERT OR REPLACE INTO messages (messageId, content, mediaType, mediaPath, sender, groupId, chatId, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(messageId, data.content, data.mediaType, data.mediaPath, data.sender, data.group, data.chatId, data.timestamp);
    } catch (err) {
        console.error('Store save error:', err);
    }
}

function loadMessageFromStore(messageId, storeType = 'delete') {
    try {
        const store = storeType === 'delete' ? antideleteStore : antieditStore;
        const stmt = store.prepare('SELECT * FROM messages WHERE messageId = ?');
        const row = stmt.get(messageId);
        if (row) {
            return {
                content: row.content,
                mediaType: row.mediaType,
                mediaPath: row.mediaPath,
                sender: row.sender,
                group: row.groupId,
                chatId: row.chatId,
                timestamp: row.timestamp
            };
        }
        return null;
    } catch (err) {
        console.error('Store load error:', err);
        return null;
    }
}

function deleteMessageFromStore(messageId, storeType = 'delete') {
    try {
        const store = storeType === 'delete' ? antideleteStore : antieditStore;
        const stmt = store.prepare('DELETE FROM messages WHERE messageId = ?');
        stmt.run(messageId);
    } catch (err) {
        console.error('Store delete error:', err);
    }
}

function loadAllMessagesFromStore(storeType = 'delete') {
    try {
        const store = storeType === 'delete' ? antideleteStore : antieditStore;
        const stmt = store.prepare('SELECT * FROM messages');
        const rows = stmt.all();
        rows.forEach(row => {
            const key = `${storeType}_${row.messageId}`;
            messageCache.set(key, {
                content: row.content,
                mediaType: row.mediaType,
                mediaPath: row.mediaPath,
                sender: row.sender,
                group: row.groupId,
                chatId: row.chatId,
                timestamp: row.timestamp
            });
        });
        console.log(`✅ Loaded ${rows.length} messages from ${storeType} store to memory`);
    } catch (err) {
        console.error('Store load all error:', err);
    }
}

// Load all messages on startup
loadAllMessagesFromStore('delete');
loadAllMessagesFromStore('edit');

// ===== UTILITY FUNCTIONS =====
const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }
        return totalSize / (1024 * 1024);
    } catch (err) {
        console.error('Error getting folder size:', err);
        return 0;
    }
};

const cleanTempFolderIfLarge = () => {
    try {
        const sizeMB = getFolderSizeInMB(TEMP_MEDIA_DIR);
        if (sizeMB > 200) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                fs.unlinkSync(filePath);
            }
            console.log(`🧹 Cleaned tmp folder (was ${sizeMB.toFixed(2)}MB)`);
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
};

// Start periodic cleanup check every 1 minute
setInterval(cleanTempFolderIfLarge, 60 * 1000);

// ===== ANTIDELETE: STORE INCOMING MESSAGES =====
async function storeMessageForDelete(sock, message) {
    try {
        const mode = getSetting('antidelete', 'off');
        if (mode === 'off') return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        const chatId = message.key.remoteJid || message.key.remoteJidAlt;
        const sender = message.key.participant || message.key.participantAlt || message.key.remoteJid || message.key.remoteJidAlt;

        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;

        // Detect content (including view-once wrappers)
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        
        if (viewOnceContainer) {
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                const stream = await downloadContentFromMessage(viewOnceContainer.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                fs.writeFileSync(mediaPath, buffer);
                isViewOnce = true;
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                const stream = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                fs.writeFileSync(mediaPath, buffer);
                isViewOnce = true;
            }
        } else if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
            fs.writeFileSync(mediaPath, buffer);
        } else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            const stream = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
            fs.writeFileSync(mediaPath, buffer);
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            const stream = await downloadContentFromMessage(message.message.videoMessage, 'video');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
            fs.writeFileSync(mediaPath, buffer);
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            fs.writeFileSync(mediaPath, buffer);
        }

        const messageData = {
            content,
            mediaType,
            mediaPath,
            sender,
            chatId,
            group: chatId.endsWith('@g.us') ? chatId : null,
            timestamp: new Date().toISOString()
        };

        // HYBRID STORAGE: Save to both RAM and Store
        messageCache.set(`delete_${messageId}`, messageData);
        saveMessageToStore(messageId, messageData, 'delete');

        // Anti-ViewOnce: forward immediately to owner if captured
        if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
            try {
                const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const senderName = sender.split('@')[0];
                const mediaOptions = {
                    caption: `Anti-ViewOnce ${mediaType}\nFrom: @${senderName}`,
                    mentions: [sender]
                };

                if (mediaType === 'image') {
                    await sock.sendMessage(ownerNumber, { image: { url: mediaPath }, ...mediaOptions });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(ownerNumber, { video: { url: mediaPath }, ...mediaOptions });
                }
            } catch (err) {
                console.error('ViewOnce forward error:', err);
            }
        }
    } catch (err) {
        console.error('storeMessageForDelete error:', err);
    }
}

// ===== ANTIEDIT: STORE MESSAGES FOR EDIT DETECTION =====
async function storeMessageForEdit(sock, message) {
    try {
        const mode = getSetting('antiedit', 'off');
        if (mode === 'off') return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        const chatId = message.key.remoteJid || message.key.remoteJidAlt;
        const sender = message.key.participant || message.key.participantAlt || message.key.remoteJid || message.key.remoteJidAlt;

        let content = '';
        let mediaType = '';
        let mediaPath = '';

        // Extract RAW text FIRST (before command processing)
        if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage?.caption) {
            content = message.message.imageMessage.caption || '';
            mediaType = 'image';
        } else if (message.message?.videoMessage?.caption) {
            content = message.message.videoMessage.caption || '';
            mediaType = 'video';
        } else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            try {
                const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                mediaPath = path.join(TEMP_MEDIA_DIR, `edit_${messageId}.jpg`);
                fs.writeFileSync(mediaPath, buffer);
            } catch (err) {
                console.error('Image download error:', err);
            }
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            try {
                const stream = await downloadContentFromMessage(message.message.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                mediaPath = path.join(TEMP_MEDIA_DIR, `edit_${messageId}.mp4`);
                fs.writeFileSync(mediaPath, buffer);
            } catch (err) {
                console.error('Video download error:', err);
            }
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            try {
                const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                mediaPath = path.join(TEMP_MEDIA_DIR, `edit_${messageId}.${ext}`);
                fs.writeFileSync(mediaPath, buffer);
            } catch (err) {
                console.error('Audio download error:', err);
            }
        }

        const messageData = {
            content,
            mediaType,
            mediaPath,
            sender,
            chatId,
            group: chatId.endsWith('@g.us') ? chatId : null,
            timestamp: new Date().toISOString()
        };

        messageCache.set(`edit_${messageId}`, messageData);
        saveMessageToStore(messageId, messageData, 'edit');
    } catch (err) {
        console.error('storeMessageForEdit error:', err);
    }
}

// ===== ANTIDELETE: HANDLE DELETED MESSAGES =====
async function handleMessageDelete(sock, deletedMessage) {
    try {
        const mode = getSetting('antidelete', 'off');
        if (mode === 'off') return;

        const messageId = deletedMessage.key.id;
        const deletedBy = deletedMessage.key.participant || deletedMessage.key.participantAlt || deletedMessage.key.remoteJid || deletedMessage.key.remoteJidAlt;
        const deleteChatId = deletedMessage.key.remoteJid || deletedMessage.key.remoteJidAlt;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        let original = messageCache.get(`delete_${messageId}`);
        if (!original) {
            original = loadMessageFromStore(messageId, 'delete');
            if (!original) return;
        }

        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const isGroup = original.chatId?.endsWith('@g.us');
        const groupName = isGroup ? (await sock.groupMetadata(original.chatId)).subject : '';

        const time = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        let text = `🗑️ ANTIDELETE REPORT 🗑️\n\n` +
            `❌ Deleted By: @${deletedBy.split('@')[0]}\n` +
            `👤 Sender: @${senderName}\n` +
            `📱 Number: ${sender}\n` +
            `🕒 Time: ${time}\n`;

        if (groupName) text += `👥 Group: ${groupName}\n`;
        if (original.content) text += `\n💬 Message: ${original.content}`;

        const mediaOptions = {
            caption: `Deleted ${original.mediaType}\nFrom: @${senderName}`,
            mentions: [sender]
        };

        const sendTargets = [];
        if (mode === 'dm') {
            sendTargets.push(ownerNumber);
        } else if (mode === 'inbox') {
            if (!isGroup) sendTargets.push(original.chatId);
        } else if (mode === 'group') {
            if (isGroup) sendTargets.push(original.chatId);
        } else if (mode === 'all') {
            sendTargets.push(ownerNumber);
            sendTargets.push(original.chatId);
        }

        for (const target of sendTargets) {
            try {
                await sock.sendMessage(target, {
                    text,
                    mentions: [deletedBy, sender]
                });

                if (original.mediaType && fs.existsSync(original.mediaPath)) {
                    switch (original.mediaType) {
                        case 'image':
                            await sock.sendMessage(target, { image: { url: original.mediaPath }, ...mediaOptions });
                            break;
                        case 'video':
                            await sock.sendMessage(target, { video: { url: original.mediaPath }, ...mediaOptions });
                            break;
                        case 'audio':
                            await sock.sendMessage(target, { audio: { url: original.mediaPath }, mimetype: 'audio/mpeg', ptt: false, ...mediaOptions });
                            break;
                        case 'sticker':
                            await sock.sendMessage(target, { sticker: { url: original.mediaPath } });
                            break;
                    }
                }
            } catch (err) {
                console.error(`Error sending to ${target}:`, err);
            }
        }

        if (original.mediaPath && fs.existsSync(original.mediaPath)) {
            try {
                fs.unlinkSync(original.mediaPath);
            } catch (err) {
                console.error('Media cleanup error:', err);
            }
        }

        messageCache.delete(`delete_${messageId}`);
        deleteMessageFromStore(messageId, 'delete');
    } catch (err) {
        console.error('handleMessageDelete error:', err);
    }
}

// ===== ANTIEDIT: HANDLE EDITED MESSAGES =====
async function handleMessageEdit(sock, editedMessage) {
    try {
        const mode = getSetting('antiedit', 'off');
        if (mode === 'off') return;

        const messageId = editedMessage.key.id;
        const editedBy = editedMessage.key.participant || editedMessage.key.participantAlt || editedMessage.key.remoteJid || editedMessage.key.remoteJidAlt;
        const editChatId = editedMessage.key.remoteJid || editedMessage.key.remoteJidAlt;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (editedBy.includes(sock.user.id) || editedBy === ownerNumber) return;

        let original = messageCache.get(`edit_${messageId}`);
        if (!original) {
            original = loadMessageFromStore(messageId, 'edit');
            if (!original) return;
        }

        // Extract edited content from protocolMessage
        let editedContent = '';
        const protocolMsg = editedMessage.message?.protocolMessage;
        
        if (protocolMsg?.editedMessage) {
            if (protocolMsg.editedMessage.conversation) {
                editedContent = protocolMsg.editedMessage.conversation;
            } else if (protocolMsg.editedMessage.extendedTextMessage?.text) {
                editedContent = protocolMsg.editedMessage.extendedTextMessage.text;
            } else if (protocolMsg.editedMessage.imageMessage?.caption) {
                editedContent = protocolMsg.editedMessage.imageMessage.caption;
            } else if (protocolMsg.editedMessage.videoMessage?.caption) {
                editedContent = protocolMsg.editedMessage.videoMessage.caption;
            }
        }

        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const isGroup = original.chatId?.endsWith('@g.us');
        const groupName = isGroup ? (await sock.groupMetadata(original.chatId)).subject : '';

        const time = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        let text = `🔄 ANTIEDIT REPORT 🔄\n\n` +
            `✏️ Edited By: @${editedBy.split('@')[0]}\n` +
            `👤 Sender: @${senderName}\n` +
            `📱 Number: ${sender}\n` +
            `🕒 Time: ${time}\n`;

        if (groupName) text += `👥 Group: ${groupName}\n`;

        if (original.content) {
            text += `\n📝 Original Message:\n${original.content}`;
        } else {
            text += `\n📝 Original Message:\n(Message was captured but had no text content)`;
        }

        if (editedContent) {
            text += `\n\n✨ Edited To:\n${editedContent}`;
        }

        const mediaOptions = {
            caption: `Edited ${original.mediaType}\nFrom: @${senderName}`,
            mentions: [sender]
        };

        const sendTargets = [];
        if (mode === 'dm') {
            sendTargets.push(ownerNumber);
        } else if (mode === 'inbox') {
            if (!isGroup) sendTargets.push(original.chatId);
        } else if (mode === 'group') {
            if (isGroup) sendTargets.push(original.chatId);
        } else if (mode === 'all') {
            sendTargets.push(ownerNumber);
            sendTargets.push(original.chatId);
        }

        for (const target of sendTargets) {
            try {
                await sock.sendMessage(target, {
                    text,
                    mentions: [editedBy, sender]
                });

                if (original.mediaType && fs.existsSync(original.mediaPath)) {
                    switch (original.mediaType) {
                        case 'image':
                            await sock.sendMessage(target, { image: { url: original.mediaPath }, ...mediaOptions });
                            break;
                        case 'video':
                            await sock.sendMessage(target, { video: { url: original.mediaPath }, ...mediaOptions });
                            break;
                        case 'audio':
                            await sock.sendMessage(target, { audio: { url: original.mediaPath }, mimetype: 'audio/mpeg', ptt: false, ...mediaOptions });
                            break;
                    }
                }
            } catch (err) {
                console.error(`Error sending to ${target}:`, err);
            }
        }

        if (original.mediaPath && fs.existsSync(original.mediaPath)) {
            try {
                fs.unlinkSync(original.mediaPath);
            } catch (err) {
                console.error('Media cleanup error:', err);
            }
        }

        messageCache.delete(`edit_${messageId}`);
        deleteMessageFromStore(messageId, 'edit');
    } catch (err) {
        console.error('handleMessageEdit error:', err);
    }
}

// ===== UNIFIED STORE FUNCTION =====
async function storeMessage(sock, message) {
    await storeMessageForDelete(sock, message);
    await storeMessageForEdit(sock, message);
}

// ===== EXPORTS =====
export { 
    storeMessage,
    storeMessageForDelete,
    storeMessageForEdit,
    handleMessageDelete, 
    handleMessageEdit 
};
