//I'm coked 😭
import messageStore from '../lib/messageStore.js';
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
},
     {

    name: 'sudo',

    aliases: ['admin'],

    category: 'owner',

    description: 'Manage sudo users',

    usage: '.sudo add/del/list [@user|number]',

    execute: async (sock, message, args, context) => {

        const { chatId, reply, react, senderIsSudo } = context;

        const senderJid = message.key.participant || message.key.remoteJid;

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

},
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
    name: 'msgstats',
    aliases: ['messagestats', 'dbstats'],
    category: 'owner',
    description: 'Get message database statistics',
    usage: '.msgstats',
    
    execute: async (sock, message, args, context) => {
        const { reply, senderIsSudo } = context;
        
        if (!senderIsSudo) {
            return await reply('❌ This command is only for bot owners!');
        }
        
        try {
            const stats = messageStore.getStats();
            
            const statsText = `
📊 MESSAGE DATABASE STATS

📨 Total Messages: ${stats.totalMessages}
💾 Database Size: ${stats.dbSize}
🔄 Storage Type: Hybrid (RAM + SQLite)
⏳ Retention: 7 days

✅ System Status: Active
`.trim();
            
            await reply(statsText);
            
        } catch (error) {
            await reply('❌ Error getting stats: ' + error.message);
        }
    }
},
 {
    name: 'cleanmsgs',
    aliases: ['cleanupmessages'],
    category: 'owner',
    description: 'Cleanup old messages from database',
    usage: '.cleanmsgs <days>',
    
    execute: async (sock, message, args, context) => {
        const { reply, senderIsSudo } = context;
        
        if (!senderIsSudo) {
            return await reply('❌ This command is only for bot owners!');
        }
        
        try {
            const days = parseInt(args[1]) || 7;
            
            if (days < 1 || days > 365) {
                return await reply('❌ Please specify days between 1-365');
            }
            
            const statsBefore = messageStore.getStats();
            await reply(`🗑️ Cleaning messages older than ${days} days...`);
            
            messageStore.cleanup(days);
            
            const statsAfter = messageStore.getStats();
            const deleted = statsBefore.totalMessages - statsAfter.totalMessages;
            
            await reply(`✅ Cleanup complete!\n\n🗑️ Deleted: ${deleted} messages\n📨 Remaining: ${statsAfter.totalMessages}\n💾 Size: ${statsAfter.dbSize}`);
            
        } catch (error) {
            await reply('❌ Error during cleanup: ' + error.message);
        }
    }
}

];
