//I'm coked 😭
import Database from 'better-sqlite3';
import chalk from 'chalk';
import fs from 'fs';
import  { jidNormalizedUser }  from '@whiskeysockets/baileys';
import {
  getChatData,
  updateChatData,
  getCommandData,
  updateCommandData,
  resetDatabase,
  getSudo,       
    isSudo,     
    addSudo,        
    removeSudo,
} from '../lib/database.js';
import * as db from '../lib/database.js';
import { syncMode } from './SPECIAL.js';
const fsp = fs.promises;
import axios from 'axios';
import path from 'path';
import { channelInfo } from '../lib/messageConfig.js';
import { sleep, isUrl } from '../lib/myfunc.js';
import { promisify } from 'util';
import { exec } from 'child_process';
const execAsync = promisify(exec);
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import settings from '../settings.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const messageStore = new Map();
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');
const DB_PATH = path.join(__dirname, '../data/messageStore.db/ANTIEDIT.MS/antiedit_mStore.db');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
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

function saveMessageToDB(messageId, data) {
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO messages (messageId, content, mediaType, mediaPath, sender, groupId, chatId, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(messageId, data.content, data.mediaType, data.mediaPath, data.sender, data.group, data.chatId, data.timestamp);
    } catch (err) {
        console.error('DB save error:', err);
    }
}

function loadMessageFromDB(messageId) {
    try {
        const stmt = db.prepare('SELECT * FROM messages WHERE messageId = ?');
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
        console.error('DB load error:', err);
        return null;
    }
}

function deleteMessageFromDB(messageId) {
    try {
        const stmt = db.prepare('DELETE FROM messages WHERE messageId = ?');
        stmt.run(messageId);
    } catch (err) {
        console.error('DB delete error:', err);
    }
}

function loadAllMessagesFromDB() {
    try {
        const stmt = db.prepare('SELECT * FROM messages');
        const rows = stmt.all();
        rows.forEach(row => {
            messageStore.set(row.messageId, {
                content: row.content,
                mediaType: row.mediaType,
                mediaPath: row.mediaPath,
                sender: row.sender,
                group: row.groupId,
                chatId: row.chatId,
                timestamp: row.timestamp
            });
        });
        
    } catch (err) {
        console.error('DB load all error:', err);
    }
}

loadAllMessagesFromDB();

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
            
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
};

setInterval(cleanTempFolderIfLarge, 60 * 1000);

// ✅ FIXED: Store RAW message content BEFORE any processing
async function storeMessage(sock, message) {
    try {
        const mode = getSetting('antiedit', 'off');
        if (mode === 'off') return;

        if (!message.key?.id) return;

        const messageId = message.key.id;
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        let content = '';
        let mediaType = '';
        let mediaPath = '';

        // ✅ PRIORITY: Extract RAW text FIRST (before command processing)
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

        messageStore.set(messageId, messageData);
        saveMessageToDB(messageId, messageData);
    } catch (err) {
        console.error('storeMessage error (antiedit):', err);
    }
}

// ✅ FIXED: Extract edited content from correct protocol path
async function handleMessageEdit(sock, editedMessage) {
    try {
        const mode = getSetting('antiedit', 'off');
        if (mode === 'off') return;

        const messageId = editedMessage.key.id;
        const editedBy = editedMessage.key.participant || editedMessage.key.remoteJid;
        const editChatId = editedMessage.key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (editedBy.includes(sock.user.id) || editedBy === ownerNumber) return;

        let original = messageStore.get(messageId);
        if (!original) {
            original = loadMessageFromDB(messageId);
            if (!original) return;
        }

        // ✅ Extract edited content from protocolMessage
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
            if (!isGroup) {
                sendTargets.push(original.chatId);
            }
        } else if (mode === 'group') {
            if (isGroup) {
                sendTargets.push(original.chatId);
            }
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
                            await sock.sendMessage(target, {
                                image: { url: original.mediaPath },
                                ...mediaOptions
                            });
                            break;
                        case 'video':
                            await sock.sendMessage(target, {
                                video: { url: original.mediaPath },
                                ...mediaOptions
                            });
                            break;
                        case 'audio':
                            await sock.sendMessage(target, {
                                audio: { url: original.mediaPath },
                                mimetype: 'audio/mpeg',
                                ptt: false,
                                ...mediaOptions
                            });
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

        messageStore.delete(messageId);
        deleteMessageFromDB(messageId);

    } catch (err) {
        console.error('handleMessageEdit error:', err);
    }
}


function extractMentionedJid(message) {

    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentioned.length > 0) return mentioned[0];    

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

    const match = text.match(/\b(\d{7,15})\b/);

    if (match) return match[1] + '@s.whatsapp.net'; 

    return null;

}
export default [

  {

    name: 'block',

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const text = args.slice(1).join(' ');

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      

      if (!quoted && !mentionedJid[0] && !text) {

        return context.reply("Reply to a message or mention/user ID to block");

      }

      const userId = mentionedJid[0] || 

                    (quoted ? message.message.extendedTextMessage.contextInfo.participant : null) ||

                    text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

      

      await sock.updateBlockStatus(userId, "block");

      context.reply("✅ User blocked successfully!");

    }

  },

  {

    name: 'unblock',

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const text = args.slice(1).join(' ');

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      

      if (!quoted && !mentionedJid[0] && !text) {

        return context.reply("Reply to a message or mention/user ID to unblock");

      }

      const userId = mentionedJid[0] || 

                    (quoted ? message.message.extendedTextMessage.contextInfo.participant : null) ||

                    text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

      

      await sock.updateBlockStatus(userId, "unblock");

      context.reply("✅ User unblocked successfully!");

    }

  },

  {

    name: 'delete',

    aliases: ['del'],

    category: 'owner',

    execute: async (sock, message, args, context) => {

      await context.react("🗑️");

      

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) return context.reply(`Please reply to a message`);

      try {

        // Delete the quoted message

        await sock.sendMessage(context.chatId, {

          delete: {

            remoteJid: context.chatId,

            fromMe: false,

            id: message.message.extendedTextMessage.contextInfo.stanzaId,

            participant: message.message.extendedTextMessage.contextInfo.participant,

          }

        });

        // Delete the command message

        await sock.sendMessage(context.chatId, {

          delete: {

            remoteJid: context.chatId,

            fromMe: message.key.fromMe,

            id: message.key.id,

            participant: message.key.participant,

          }

        });

      } catch (err) {

        console.error(err);

        context.reply("⚠️ Failed to delete message.");

      }

    }

          },

  {

    name: 'groupid',

    aliases: ['idgc'],

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const text = args.slice(1).join(' ');

      if (!text) return context.reply('Please provide a group link!');

      

      let linkRegex = text;

      let coded = linkRegex.split("https://chat.whatsapp.com/")[1];

      if (!coded) return context.reply("Link Invalid");

      sock.query({

        tag: "iq",

        attrs: {

          type: "get",

          xmlns: "w:g2",

          to: "@g.us"

        },

        content: [{ tag: "invite", attrs: { code: coded } }]

      }).then(async (res) => {

        const tee = `${res.content[0].attrs.id ? res.content[0].attrs.id : "undefined"}`;

        context.reply(tee + '@g.us');

      });

    }

  },

  {

    name: 'join',

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const text = args.slice(1).join(' ');

      if (!text) return context.reply("Enter group link");

      

      if (!isUrl(text) && !text.includes("whatsapp.com")) {

        return context.reply("Invalid link");

      }

      try {

        const link = text.split("https://chat.whatsapp.com/")[1];

        await sock.groupAcceptInvite(link);

        context.reply("✅ Joined successfully");

      } catch {

        context.reply("❌ Failed to join group");

      }

    }

  },

  {

    name: 'listblocked',

    aliases: ['blocked'],

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      try {

        const blockedList = await sock.fetchBlocklist();

        if (!blockedList.length) {

          return context.reply('✅ No contacts are currently blocked.');

        }

        let blockedUsers = blockedList.map((user, index) => `🔹 *${index + 1}.* @${user.split('@')[0]}`).join('\n');

        await sock.sendMessage(context.chatId, {

          text: `🚫 *Blocked Contacts:*\n\n${blockedUsers}`,

          mentions: blockedList

        }, { quoted: message });

      } catch (error) {

        context.reply('⚠️ Unable to fetch blocked contacts.');

      }

    }

  },

  {

    name: 'react',

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!args[1]) return context.reply(`*Reaction emoji needed*\n Example: ${global.prefix}react 🤔`);

      if (!quoted) return context.reply("Please reply to a message to react to it");

      const reactionMessage = {

        react: {

          text: args[1],

          key: { 

            remoteJid: context.chatId, 

            fromMe: false, 

            id: message.message.extendedTextMessage.contextInfo.stanzaId 

          },

        },

      };

      

      sock.sendMessage(context.chatId, reactionMessage);

    }

  },

  {

    name: 'restart',

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      context.reply(`*Restarting...*`);

      await sleep(3000);

      process.exit(0);

    }

  },

  {

    name: 'toviewonce',

    aliases: ['tovo', 'tovv'],

    category: 'owner',

    execute: async (sock, message, args, context) => {

      if (!message.key.fromMe && !context.senderIsSudo) {

        return context.reply("❌ This command is only for the owner!");

      }

      

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) return context.reply(`*Reply to an Image, Video, or Audio*`);

      const messageType = Object.keys(quoted)[0];

      

      try {

        if (messageType === 'imageMessage') {

          const stream = await downloadContentFromMessage(quoted[messageType], 'image');

          let buffer = Buffer.from([]);

          for await (const chunk of stream) {

            buffer = Buffer.concat([buffer, chunk]);

          }

          

          await sock.sendMessage(

            context.chatId,

            {

              image: buffer,

              caption: "✅ Converted to view once",

              viewOnce: true

            },

            { quoted: message }

          );

        } else if (messageType === 'videoMessage') {

          const stream = await downloadContentFromMessage(quoted[messageType], 'video');

          let buffer = Buffer.from([]);

          for await (const chunk of stream) {

            buffer = Buffer.concat([buffer, chunk]);

          }

          

          await sock.sendMessage(

            context.chatId,

            {

              video: buffer,

              caption: "✅ Converted to view once",

              viewOnce: true

            },

            { quoted: message }

          );

        } else if (messageType === 'audioMessage') {

          const stream = await downloadContentFromMessage(quoted[messageType], 'audio');

          let buffer = Buffer.from([]);

          for await (const chunk of stream) {

            buffer = Buffer.concat([buffer, chunk]);

          }

          

          await sock.sendMessage(context.chatId, {

            audio: buffer,

            mimetype: "audio/mpeg",

            ptt: true,

            viewOnce: true

          });

        } else {

          context.reply("❌ Please reply to an image, video, or audio message");

        }

      } catch (error) {

        console.error(error);

        context.reply("❌ Failed to convert to view once");

      }

    }

  },
    {

    name: 'mode',

    aliases: ['botmode'],

    category: 'owner',

    description: 'Toggle bot access mode between public and private',

    usage: '.mode [public/private] or .mode (to check status)',

    execute: async (sock, message, args, context) => {

        const { chatId, channelInfo, reply, senderIsSudo } = context; // 👈 DESTRUCTURE senderIsSudo

        // 🎯 USE DESTRUCTURED senderIsSudo - SAME AS WORKING COMMANDS!

        if (!senderIsSudo) {

            return await reply('❌ This command is only available for the owner or sudo users!');

        }

        // If no arguments provided, show current status

        if (args.length === 1) {

            const isPublic = db.getSetting('mode') === 'public';

            const currentMode = isPublic ? 'Public' : 'Private';

            const statusIcon = isPublic ? '🌍' : '🗝️';

            const description = isPublic 

                ? 'Anyone can use the bot' 

                : 'Only owner and sudo users can use the bot';

            

            return await reply(`${statusIcon} Bot Access Mode\n\nCurrent Mode: ${currentMode}\nDescription: ${description}\n\nUsage:\n• .mode public - Allow everyone to use bot\n• .mode private - Restrict to owner/sudo only\n• .mode - Check current mode`);

        }

        

        // Handle mode change

        const newMode = args[1].toLowerCase();

        

        if (newMode === 'public' || newMode === 'pub') {

            db.updateSetting('mode', 'public');

            

            try {

                syncMode();

                console.log('✅ Mode synced: public');

            } catch (error) {

                console.error('❌ Error syncing mode:', error);

            }

            

            await reply('🌍 Bot Mode Changed\n\n✅ Bot is now in Public Mode\n\nEveryone can now use the bot commands.');

            

        } else if (newMode === 'private' || newMode === 'priv') {

            db.updateSetting('mode', 'private');

            

            try {

                syncMode();

                console.log('✅ Mode synced: private');

            } catch (error) {

                console.error('❌ Error syncing mode:', error);

            }

            

            await reply('🗝️ Bot Mode Changed\n\n✅ Bot is now in Private Mode\n\nOnly owner and sudo users can use the bot.');

            

        } else {

            return await reply('❌ Invalid mode! Use:\n• .mode public - Enable public access\n• .mode private - Enable private access\n• .mode - Check current status');

        }

    }

},
    
{
    name: "lyrics",
    description: "Get lyrics for any song",
    category: "SEARCH MENU",
    usage: ".lyrics <song name> - <artist>",
    
    async execute(sock, m, args, context) {
        try {
            const chatId = m.key.remoteJid;
            //const query = args.join(' ');
            const query = args.slice(1).join(' ').trim();
            
            if (!query) {
                await context.react('😒');
                return await context.replyPlain( {
                    text: '❌ Please provide a song name.\n\nExample: .lyrics Shape of You - Ed Sheeran'
                }, { quoted: m });
            }
await context.react('🥳');
            await context.replyPlain( { text: '🎵 Searching for lyrics...' }, { quoted: m });

            const response = await axios.get(`https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(query)}`);
            const result = response.data;

            if (!result.status || !result.result) {
                return await context.replyPlain( {
                    text: '❌ Lyrics not found. Please check the song name and try again.'
                }, { quoted: m });
            }

            const lyricsData = result.result;
            let lyricsText = `🎵 ${lyricsData.title}\n`;
            lyricsText += `👤 Artist: ${lyricsData.artist}\n\n`;
            lyricsText += `📝 Lyrics:\n\n${lyricsData.lyrics}`;

            // Split lyrics if too long
            if (lyricsText.length > 4000) {
                const parts = lyricsText.match(/.{1,3900}/g);
                for (let i = 0; i < parts.length && i < 3; i++) {
                    await context.replyPlain( {
                        text: i === 0 ? parts[i] : `Continued...\n\n${parts[i]}`
                    }, { quoted: m });
                }
            } else {
                await context.replyPlain({
                    text: lyricsText
                }, { quoted: m });
            }

        } catch (error) {
            console.error('❌ Lyrics Command Error:', error);
            await context.replyPlain({
                text: '❌ Failed to fetch lyrics. Please try again later.'
            }, { quoted: m });
        }
    }
},/***
     {

    name: 'sudo',

    aliases: ['admin'],

    category: 'owner',

    description: 'Manage sudo users',

    usage: '.sudo add/del/list [@user|number]',

    execute: async (sock, message, args, context) => {

        const { chatId, reply, react, senderIsSudo } = context;

        const senderJid = message.key.participantPn || message.key.remoteJid;

        const ownerJid = settings.ownerNumber + '@s.whatsapp.net';

        const isOwner = message.key.fromMe || senderJid === ownerJid;

        // Remove command name if included in args

        const cleanArgs = args[0] === 'sudo' ? args.slice(1) : args;

        if (cleanArgs.length < 1) {

            return await reply('Usage:\n.sudo add <user|number>\n.sudo del <user|number>\n.sudo list');

        }

        const sub = cleanArgs[0].toLowerCase();

        if (!['add', 'del', 'remove', 'list'].includes(sub)) {

            return await reply('Usage:\n.sudo add <user|number>\n.sudo del <user|number>\n.sudo list');

        }

        if (sub === 'list') {

            await react('📋');

            const list = getSudo();

            

            if (list.length === 0) {

                return await reply('No additional sudo users set.\n\nNote: Owner has permanent sudo privileges.');

            }

            const text = list.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n');

            

            // Use reply instead of sock.sendMessage to ensure font styling

            return await reply(

                `👥 Sudo Users:\n\n${text}\n\nNote: Owner (@${settings.ownerNumber}) has permanent sudo privileges.`,

                { mentions: list }

            );

        }

        if (!senderIsSudo) {

await react('😱');

            return await reply('❌ Only owner can add/remove sudo users. Use .sudo list to view.');

        }

        // For add/del commands, we need a target

        if (cleanArgs.length < 2) {

            await react('💫');

            return await reply(`Please provide a user to ${sub}.\nExample: .sudo ${sub} @user or .sudo ${sub} 2348085046874`);

        }

        let targetJid = extractMentionedJid(message);

        

        // If no mention found, try to parse the phone number from cleanArgs[1]

        if (!targetJid) {

            const phoneNumber = cleanArgs[1].replace(/\D/g, '');

            if (phoneNumber && phoneNumber.length >= 7) {

                targetJid = phoneNumber + '@s.whatsapp.net';

            }

        }

        if (!targetJid) {

            return await reply('Please mention a user or provide a valid phone number.');

        }

        if (sub === 'add') {

            await react('➕');

            

            if (targetJid === ownerJid) {

                return await reply('Owner already has permanent sudo privileges.');

            }

            

            const ok = addSudo(targetJid);

            const phoneNumber = targetJid.split('@')[0];

            return await reply(ok ? `✅ Added sudo: @${phoneNumber}` : '❌ Failed to add sudo');

        }

        if (sub === 'del' || sub === 'remove') {

            await react('➖');

            

            if (targetJid === ownerJid) {

                return await reply('❌ Owner cannot be removed from sudo privileges.');

            }

            const ok = removeSudo(targetJid);

            const phoneNumber = targetJid.split('@')[0];

            return await reply(ok ? `✅ Removed sudo: @${phoneNumber}` : '❌ Failed to remove sudo');

        }

    }

},*/
{
    name: 'broadcast',
    description: 'Send message to all group members individually via DM',
    aliases: ['bc', 'massdm'],
    category: 'owner',
    usage: '.broadcast <message>',
    
    async execute(sock, message, args, context) {
        try {
            const { reply, senderIsSudo, chatId, isGroup } = context;
            
            // Only owner/sudo can use this command
            if (!message.key.fromMe && !senderIsSudo) {
                return await reply('This command is only available for the owner or sudo users!');
            }
            
            // Must be used in a group
            if (!isGroup) {
                return await reply('This command can only be used in groups!');
            }
            
            // Get message to broadcast
            const broadcastMsg = args.slice(1).join(' ');
            
            if (!broadcastMsg) {
                return await reply(`Please provide a message to broadcast!\n\nUsage: ${global.prefix}broadcast <your message>`);
            }
            
            if (broadcastMsg.length > 500) {
                return await reply('Message is too long! Please keep it under 500 characters.');
            }
            
            try {
                // Get group metadata and participants
                const groupMetadata = await sock.groupMetadata(chatId);
                const participants = groupMetadata.participants;
                const groupName = groupMetadata.subject;
                
                await reply(`Starting broadcast to ${participants.length} members...\n\nThis may take a few minutes to avoid spam detection.`);
                
                let successCount = 0;
                let failCount = 0;
                
                // Message each participant individually
                
                
for (const participant of participants) {
    const userJid = jidNormalizedUser(participant.id)  // 🔥 normalize here

    

    // Skip the bot itself

    if (userJid === sock.user.id) continue

    try {

        const personalizedMsg = `BROADCAST MESSAGE

From Group: ${groupName}

${broadcastMsg}

This message was sent individually to all group members.`;

        await sock.sendMessage(userJid, {

            text: personalizedMsg,

            ...channelInfo

        })

        successCount++

        console.log(`📤 Broadcast sent to: ${userJid}`)

        

        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 2000))

    } catch (error) {

        failCount++

        console.log(`❌ Failed to message ${userJid}:`, error.message)

    }

}
                
                
                // Send completion report
                const reportMsg = `BROADCAST COMPLETED
                
Total Members: ${participants.length}
Successfully Sent: ${successCount}
Failed: ${failCount}

Note: Failed messages are usually due to users blocking the bot or privacy settings.`;
                
                await reply(reportMsg);
                
            } catch (error) {
                console.error('Error getting group metadata:', error);
                await reply('Failed to get group information. Make sure the bot is still in the group.');
            }
            
        } catch (error) {
            console.error('Error in broadcast command:', error);
            await reply('An error occurred while broadcasting the message.');
        }
    }
},
  {
        name: 'clearsession',
        description: 'Clear WhatsApp session and restart bot',
        usage: 'clearsession',
        category: 'system',
        ownerOnly: true,

        async execute(sock, message, args, context) {
            const { reply, isFromOwner, senderIsSudo, react } = context;

            if (!isFromOwner && !senderIsSudo) {
                return await reply('❌ Only owner/sudo can clear sessions!');
            }

            try {
                await react('⏳');
                await reply('🔄 Clearing WhatsApp session...\n\nBot will restart automatically.');

                // Clear session files
                const sessionPaths = ['./data/session'];

                let clearedFiles = 0;
                sessionPaths.forEach(sessionPath => {
                    try {
                        if (fs.existsSync(sessionPath)) {
                            if (fs.lstatSync(sessionPath).isDirectory()) {
                                fs.rmSync(sessionPath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(sessionPath);
                            }
                            clearedFiles++;
                            console.log(`✅ Cleared: ${sessionPath}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to clear ${sessionPath}:`, error.message);
                    }
                });

                await react('✅');
                console.log(`🔄 Session cleared! ${clearedFiles} files/folders removed`);

                // Exit process to trigger restart
                setTimeout(() => {
                    process.exit(0);
                }, 2000);

            } catch (error) {
                await react('❌');
                console.error('Clear session error:', error);
                await reply(`❌ Failed to clear session!\n\nError: ${error.message}`);
            }
        }
    },
    
  {
        name: 'cleartmp',
        aliases: ['cleartemp'],
        description: 'Clear WhatsApp session and restart bot',
        usage: 'clearsession',
        category: 'system',
        ownerOnly: true,

        async execute(sock, message, args, context) {
            const { reply, isFromOwner, senderIsSudo, react } = context;

            if (!isFromOwner && !senderIsSudo) {
                return await reply('❌ Only owner/sudo can clear sessions!');
            }

            try {
                await react('⏳');
                await reply('🔄 Clearing temp/tmp..\n\nBot will restart automatically.');

                // Clear session files
                const sessionPaths = ['./tmp','./temp'];

                let clearedFiles = 0;
                sessionPaths.forEach(sessionPath => {
                    try {
                        if (fs.existsSync(sessionPath)) {
                            if (fs.lstatSync(sessionPath).isDirectory()) {
                                fs.rmSync(sessionPath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(sessionPath);
                            }
                            clearedFiles++;
                            console.log(`✅ Cleared: ${sessionPath}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to clear ${sessionPath}:`, error.message);
                    }
                });

                await react('✅');
                console.log(`🔄 temp/tmp cleared! ${clearedFiles}`);

                // Exit process to trigger restart
                setTimeout(() => {
                    process.exit(0);
                }, 2000);

            } catch (error) {
                await react('❌');
                console.error('Clear session error:', error);
                await reply(`❌ Failed to clear temp!\n\nError: ${error.message}`);
            }
        }
    },
            
   {
        name: 'resetdatabase',
        aliases: ['resetdb', 'dbdefault'],
        description: 'Reset database to default settings',
        usage: 'resetdatabase [confirm]',
        category: 'system',
        ownerOnly: true,

        async execute(sock, message, args, context) {
            const { reply, isFromOwner, senderIsSudo, react } = context;

            if (!isFromOwner && !senderIsSudo) {
                return await reply('❌ Only owner/sudo can reset database!');
            }

            const confirm = args[1]?.toLowerCase();

            if (confirm !== 'confirm') {
                return await reply(`⚠️ DATABASE RESET WARNING

🚨 This will permanently delete ALL:
• Chat settings and configurations
• Command data and preferences  
• User warnings and statistics
• Group settings and admin data
• Plugin data and custom configs

This action CANNOT be undone!

To proceed, use: .resetdatabase confirm

⚡ Think twice before continuing!`);
            }

            try {
                await react('⏳');
                await reply('🔄 Resetting database to default...');

                // Get database file paths
                const dbPaths = [
                    './data/database.json',
                    './database.json',
                    './lib/database.json',
                    './data/chats.json',
                    './data/commands.json',
                    './data/settings.json'
                ];

                let resetCount = 0;

                // Method 1: Use resetDatabase function if available
                if (typeof resetDatabase === 'function') {
                    await resetDatabase();
                    resetCount++;
                    console.log('✅ Database reset using resetDatabase()');
                } else {
                    // Method 2: Manual file deletion
                    dbPaths.forEach(dbPath => {
                        if (fs.existsSync(dbPath)) {
                            try {
                                fs.unlinkSync(dbPath);
                                resetCount++;
                                console.log(`✅ Deleted: ${dbPath}`);
                            } catch (error) {
                                console.error(`❌ Failed to delete ${dbPath}:`, error.message);
                            }
                        }
                    });
                }

                // Clear data directories
                const dataDirs = [
                    './data/plugins',
                    './data/chats',
                    './data/commands'
                ];

                dataDirs.forEach(dir => {
                    if (fs.existsSync(dir)) {
                        try {
                            const files = fs.readdirSync(dir);
                            files.forEach(file => {
                                const filePath = path.join(dir, file);
                                fs.unlinkSync(filePath);
                            });
                            console.log(`✅ Cleared data directory: ${dir}`);
                        } catch (error) {
                            console.error(`❌ Error clearing ${dir}:`, error.message);
                        }
                    }
                });

                await react('✅');
                await reply(`✅ Database reset completed!

🔄 Files reset: ${resetCount}
🗂️ Data directories cleared
⚡ All settings restored to default

Bot will restart to apply changes...`);

                // Restart bot to reinitialize with default settings
                setTimeout(() => {
                    process.exit(0);
                }, 3000);

            } catch (error) {
                await react('❌');
                console.error('Database reset error:', error);
                await reply(`❌ Failed to reset database!\n\nError: ${error.message}\n\nPlease check console for details.`);
            }
        }
   },
    {
    name: 'sudo',
    aliases: ['admin'],
    category: 'owner',
    description: 'Manage sudo users',
    usage: '.sudo add/del/list [@user|number]',
    execute: async (sock, message, args, context) => {
        const { chatId, reply, react } = context;
        
        // Get sender JID (handles both LID and phone format)
        const senderJid = message.key.participant || message.key.participantPn || message.key.remoteJid;
        const ownerJid = settings.ownerNumber + '@s.whatsapp.net';
        
        // Check if sender is owner (compare cleaned versions)
        const senderClean = senderJid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const ownerClean = settings.ownerNumber;
        const isOwner = message.key.fromMe || senderClean === ownerClean;
        
        // Check if sender is sudo
        const senderIsSudo = isSudo(senderJid);
        
        console.log(chalk.blue('🔍 Sudo command debug:'));
        console.log('  Sender JID:', senderJid);
        console.log('  Sender Clean:', senderClean);
        console.log('  Owner Clean:', ownerClean);
        console.log('  Is Owner:', isOwner);
        console.log('  Is Sudo:', senderIsSudo);

        // Remove command name if included in args
        const cleanArgs = args[0] === 'sudo' ? args.slice(1) : args;

        if (cleanArgs.length < 1) {
            return await reply('Usage:\n.sudo add <user|number>\n.sudo del <user|number>\n.sudo list');
        }

        const sub = cleanArgs[0].toLowerCase();

        if (!['add', 'del', 'remove', 'list'].includes(sub)) {
            return await reply('Usage:\n.sudo add <user|number>\n.sudo del <user|number>\n.sudo list');
        }

        if (sub === 'list') {
            await react('📋');
            const list = getSudo();
            
            if (list.length === 0) {
                return await reply('No additional sudo users set.\n\nNote: Owner has permanent sudo privileges.');
            }
            
            // Clean and format the list
            const text = list.map((j, i) => {
                const clean = j.replace('@s.whatsapp.net', '').replace('@lid', '');
                return `${i + 1}. @${clean}`;
            }).join('\n');
            
            return await reply(
                `👥 Sudo Users:\n\n${text}\n\nNote: Owner (@${settings.ownerNumber}) has permanent sudo privileges.`,
                { mentions: list }
            );
        }

        // Only owner or sudo can add/remove
        if (!isOwner && !senderIsSudo) {
            await react('❌');
            return await reply('❌ Only owner or sudo users can manage sudo list!');
        }

        // For add/del commands, we need a target
        if (cleanArgs.length < 2) {
            await react('💫');
            return await reply(`Please provide a user to ${sub}.\nExample: .sudo ${sub} @user or .sudo ${sub} 2348085046874`);
        }

        // Extract target JID
        let targetJid = null;
        
        // Check for mentioned user
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for quoted message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = message.message.extendedTextMessage.contextInfo.participant;
        }
        // Try to parse phone number from text
        else {
            const phoneNumber = cleanArgs[1].replace(/\D/g, '');
            if (phoneNumber && phoneNumber.length >= 7) {
                targetJid = phoneNumber + '@s.whatsapp.net';
            }
        }

        if (!targetJid) {
            return await reply('Please mention a user or provide a valid phone number.');
        }

        console.log(chalk.yellow('🎯 Target JID:'), targetJid);

        if (sub === 'add') {
            await react('➕');
            
            // Check if target is owner
            const targetClean = targetJid.replace('@s.whatsapp.net', '').replace('@lid', '');
            if (targetClean === ownerClean) {
                return await reply('Owner already has permanent sudo privileges.');
            }
            
            const ok = addSudo(targetJid);
            const displayNumber = targetClean;
            
            if (ok) {
                return await reply(`✅ Added sudo: @${displayNumber}`, { mentions: [targetJid] });
            } else {
                return await reply(`⚠️ User @${displayNumber} is already a sudo user!`, { mentions: [targetJid] });
            }
        }

        if (sub === 'del' || sub === 'remove') {
            await react('➖');
            
            // Check if target is owner
            const targetClean = targetJid.replace('@s.whatsapp.net', '').replace('@lid', '');
            if (targetClean === ownerClean) {
                return await reply('❌ Owner cannot be removed from sudo privileges.');
            }
            
            const ok = removeSudo(targetJid);
            const displayNumber = targetClean;
            
            return await reply(ok ? `✅ Removed sudo: @${displayNumber}` : `❌ User @${displayNumber} is not in sudo list`, { mentions: [targetJid] });
        }
    }
},
    {
    name: 'antiedit',
    aliases: ['ae'],
    category: 'owner',
    description: 'Configure antiedit feature to track message edits',
    usage: '.antiedit [off/dm/inbox/group/all]',
    execute: async (sock, message, args, context) => {
        const { chatId, reply, isFromOwner, senderIsSudo } = context;

        if (!isFromOwner && !senderIsSudo) {
            return await reply('Only the bot owner can use this command.');
        }

        const currentMode = getSetting('antiedit', 'off');
        const newMode = args[1]?.toLowerCase();

        if (!newMode) {
            const dbCount = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
            const ramCount = messageStore.size;
            
            const modeEmoji = {
                'off': '❌',
                'dm': '📨',
                'inbox': '📥',
                'group': '👥',
                'all': '🌐'
            };

            return await reply(
                `ANTIEDIT SETUP\n\n` +
                `Current Mode: ${modeEmoji[currentMode] || '❓'} ${currentMode}\n` +
                `📊 Messages in RAM: ${ramCount}\n` +
                `💾 Messages in DB: ${dbCount}\n\n` +
                `Options:\n` +
                `• off - Disable\n` +
                `• dm - Send to owner DM\n` +
                `• inbox - Repost in same chat (PM only)\n` +
                `• group - Repost in same chat (groups only)\n` +
                `• all - Repost everywhere`
            );
        }

        const validModes = ['off', 'dm', 'inbox', 'group', 'all'];

        if (!validModes.includes(newMode)) {
            return await reply(`Invalid mode. Valid options: ${validModes.join(', ')}`);
        }

        updateSetting('antiedit', newMode);

        const modeMessages = {
            'off': '❌ Antiedit disabled',
            'dm': '📨 Antiedit enabled - Sending to owner DM',
            'inbox': '📥 Antiedit enabled - Reposting in PM inbox',
            'group': '👥 Antiedit enabled - Reposting in groups',
            'all': '🌐 Antiedit enabled - Reposting everywhere'
        };

        return await reply(modeMessages[newMode]);
    }
};


];
export { storeMessage, handleMessageEdit };
