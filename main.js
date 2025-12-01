//import { autoSaveUsers } from './plugins/Aaqq.js';
import { getChatId, getSenderId } from './lib/myfunc.js';
import chalk from 'chalk';
import chatbotMemory from './lib/chatbot.js'
import settings from './settings.js';
import { buildContext } from './lib/context.js';
import { getCommandData, saveDatabase } from './lib/database.js';
import { isBanned } from './lib/isBanned.js';
import { handleMessageCases, handleAutotypingForMessage, handleAutoReaction, handleAutoread,
handleAutoEmoji,
handleStatusUpdate, handleAutoRecord, handleAutoRecordType, handleAnticall } from './lib/case.js';
import fs from 'fs';
import { getSetting, getWelcome, getGoodbye, isWelcomeEnabled, isGoodbyeEnabled } from './lib/database.js';
import { isSudo } from './lib/database.js';
import isAdmin from './lib/isAdmin.js';
import { incrementMessageCount, syncMode, resetUserCount } from './plugins/SPECIAL.js';
import { commands, aliases, loadCommands, categories } from './lib/executor.js';
import { applyFontStyle } from './lib/database.js';
import { channelInfo } from './lib/messageConfig.js';
import db from './lib/database.js';
import {rainbow, pastel} from './lib/color.js';
console.log(chalk.yellow('[GIFT-MD] initializing executor 🚀'));
loadCommands();
//.......................................................................................................................................................//
// === GLOBALS ===//
// goto index global//

// === RESTORE PRESENCE ===
const restorePresenceSettings = async (sock) => {
    try {
        const alwaysOnline = getSetting('alwaysOnline', false);
        const alwaysOffline = getSetting('alwaysOffline', false);

        if (alwaysOnline && !alwaysOffline) {
            if (global.onlineInterval) clearInterval(global.onlineInterval);
            await sock.sendPresenceUpdate('available').catch(console.error);
            global.onlineInterval = setInterval(async () => {
                try {
                    await sock.sendPresenceUpdate('available');
                } catch (err) {
                    console.error('❌ Error updating online presence:', err);
                }
            }, 30000);
        } else if (alwaysOffline) {
            if (global.offlineInterval) clearInterval(global.offlineInterval);
            await sock.sendPresenceUpdate('unavailable').catch(console.error);
            global.offlineInterval = setInterval(async () => {
                try {
                    await sock.sendPresenceUpdate('unavailable');
                } catch (err) {
                    console.error('❌ Error updating offline presence:', err);
                }
            }, 10000);
        }
    } catch (err) {
        console.error('❌ Error restoring presence settings:', err);
    }
};
//console.clear();
// ===== HANDLE MESSAGES ======//
  

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];  
        if (!message?.message) return;
        
        console.log("---- Incoming Message Object ----");
        console.log(JSON.stringify(message, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        , 2));
        
        const currentPrefix = global.prefix;
        
        /** ✅ SMART AUTO-DETECTION - Always gets @s.whatsapp.net
        const chatId = getChatId(message);
        const senderId = getSenderId(message, sock);*/
        // ✅ SMART AUTO-DETECTION with FALLBACK
let chatId = getChatId(message);
let senderId = getSenderId(message, sock);

// Fallback to basic Baileys if smart detection fails
/**if (!chatId) {
    chatId = message.key.remoteJid;
}
if (!senderId) {
    senderId = message.key.participant || message.key.remoteJid;
}*/
        
    
        if (!chatId) {
            console.log('⚠️ Could not detect valid chatId');
            continue;
        }
        const pushname = message.pushName || "Unknown User";
        const isGroup = chatId.endsWith('@g.us');
        const isChannel = chatId.endsWith('@newsletter');
        const tempContext = buildContext(sock, message);
        const contextSenderIsSudo = tempContext.senderIsSudo;
        const time = global.getCurrentTime('time2');
        
        // Rest of your code...
       
    const userMessage = (  
        message.message?.conversation?.trim() ||  
        message.message?.extendedTextMessage?.text?.trim() ||  
        message.message?.imageMessage?.caption?.trim() ||  
        message.message?.videoMessage?.caption?.trim() ||  
        ''  
    ).toLowerCase().replace(/\.\s+/g, '.').trim();  

    const rawText = message.message?.conversation?.trim() ||  
        message.message?.extendedTextMessage?.text?.trim() ||  
        message.message?.imageMessage?.caption?.trim() ||  
        message.message?.videoMessage?.caption?.trim() ||  
        '';  
       // === LOG ALL MESSAGES ===
  console.log('\x1b[30m--------------------\x1b[0m');
  console.log(
    chalk.bgBlack.bold(rainbow(
      `┏━━━━━━━━━━[GIFT-MD]━━━━━━━━━┓\n` +
      ` 📩 New Message: [${time}]     \n` +
      ` 📍 Chat: ${isGroup ? "Group" : isChannel ? "Channel" : "Private "}            \n` +
      ` 📥 From: [${pushname}]\n`+
      ` 🆔 Chatid: ${chatId}\n` +
      ` 👤 Sender: ${senderId}\n` +
      ` 💌 Text: ${rawText || "[bot]"}               \n`+
 `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`)));


       // Only log command usage  
    if (userMessage.startsWith(currentPrefix)) {  
        // ✅ FIXED: Reduced auto-reactions to avoid rate limits  
        try {  
            if (!isChannel) {  
                await handleAutoReaction(sock, message);  
            }  
        } catch (reactionErrbor) {  
              
        }  
          
        await handleAutotypingForMessage(sock, chatId);  
        await handleAutoRecord(sock,chatId);  
        await handleAutoRecordType(sock, chatId);  
        /**console.log(`📝 Command used in ${isGroup ? 'Gc' : isChannel ? 'Cl' : 'Pm'}: ${userMessage}`);*/
    }  
    // Ban check  
    if (isBanned(senderId) && !userMessage.startsWith(`${currentPrefix}unban`)) {  
        if (Math.random() < 0.1) {  
            await sock.sendMessage(chatId, {  
                text: '❌ You are banned from using the bot. Contact an admin to get unbanned.',  
                ...channelInfo  
            });  
        }  
        return;  
    }  

    // Handle play command replies  
    if (global.playQueue && global.playQueue[chatId]) {  
        const userReply = userMessage.trim().toLowerCase();  
        const queueData = global.playQueue[chatId];  
          
        if (userReply === 'a' || userReply === 'audio') {  
            await sock.sendMessage(chatId, {  
                audio: { url: queueData.audioUrl },  
                mimetype: "audio/mpeg",  
                fileName: `${queueData.title}.mp3`  
            }, { quoted: message });  

            global.playQueue[chatId].audioSent = true;  
            if (global.playQueue[chatId].documentSent) delete global.playQueue[chatId];  
            return;  
        }  
          
        if (userReply === 'd' || userReply === 'doc' || userReply === 'document') {  
            await sock.sendMessage(chatId, {  
                document: { url: queueData.audioUrl },  
                mimetype: "audio/mpeg",  
                fileName: `${queueData.title}.mp3`  
            }, { quoted: message });  

            global.playQueue[chatId].documentSent = true;  
            if (global.playQueue[chatId].audioSent) delete global.playQueue[chatId];  
            return;  
        }  
    }  

    // Non-command messages  
            // Non-command messages  
    if (!userMessage.startsWith(currentPrefix)) {  
        // ✅ FIXED: Reduced auto-reactions for channels  
        try {  
            if (!isChannel) { 
   // ✅ CHATBOT HANDLER - Call chatbot if enabled
        try {
            const chatbotCommand = global.commands.get('chatbot');
            if (chatbotCommand && chatbotCommand.handleChatbot) {
                const context = buildContext(sock, message);
                await chatbotCommand.handleChatbot(sock, message, context);
            }
        } catch (chatbotError) {
            console.error('❌ Chatbot error:', chatbotError.message);
        }
   
                await handleAutoReaction(sock, message);  await handleAutoread(sock, message);
await handleAutoEmoji(sock, message);
            }  
        } catch (reactionError) {  
            
        }  
          
        await handleAutotypingForMessage(sock, chatId);  
        await handleAutoRecord(sock, chatId);  
        await handleAutoRecordType(sock, chatId);  
          
        if (isGroup || isChannel) {  // Add channel support here  
            const adminStatus = await isAdmin(sock, chatId, senderId);  
            const context = buildContext(sock, message, { isAdminCheck: true, adminStatus });  
            await handleMessageCases(sock, message, context, false);  
              
            // ✅ FIXED: Use global commands instead of direct require  
            const antilinkCommand = global.commands.get('antilink');  
            if (antilinkCommand && antilinkCommand.checkMessage) {  
                await antilinkCommand.checkMessage(sock, message, context);  
            }  
              
            const antibadwordCommand = global.commands.get('antibadword');  
            if (antibadwordCommand && antibadwordCommand.checkMessage) {  
                await antibadwordCommand.checkMessage(sock, message, context);  
            }  
        }  
        return;  
    }  
    // ✅ CHANNEL BYPASS - Skip all restrictions for channels
if (isChannel) {
    try {
        const args = userMessage.slice(currentPrefix.length).split(' ');
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName) || aliases.get(commandName);
        if (command) {
            const context = buildContext(sock, message);
            
            await command.execute(sock, message, args, context);
        }/** else {
            await sock.sendMessage(chatId, {
                text: `😒 Cmd "${commandName}" 🤷. Use ${currentPrefix}help to see available commands.`,
                ...channelInfo
            }, { quoted: message });
        }*/
    } catch (err) {
        console.error(`❌ Channel command error: ${err.message}`);
    }
    return; // Exit after handling channel command
}
    
    // Admin commands  
    const adminCommands = [  
        `${currentPrefix}mute`, `${currentPrefix}unmute`, `${currentPrefix}ban`,  
        `${currentPrefix}unban`, `${currentPrefix}promote`, `${currentPrefix}demote`,  
        `${currentPrefix}kick`, `${currentPrefix}tagall`, `${currentPrefix}antilink`,   `${currentPrefix}antibadword`,
    `${currentPrefix}open`,
        `${currentPrefix}close`,
        `${currentPrefix}add`,
        `${currentPrefix}admins`,
        `${currentPrefix}kick`,
        `${currentPrefix}poll`,
      `${currentPrefix}resetlink`,
       `${currentPrefix}setgdesc`,
       `${currentPrefix}setgname`,
        `${currentPrefix}setgpp`,
       `${currentPrefix}tagadmin`,
        `${currentPrefix}tagall`,
    `${currentPrefix}tagnotadmin`,
        
    ];  
    const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));  

    // Owner commands  
    const ownerCommands = [  
        `${currentPrefix}mode`, `${currentPrefix}autostatus`,   `${currentPrefix}antidelete`, `${currentPrefix}antideletepm`, `${currentPrefix}kick`, `${currentPrefix}block`, `${currentPrefix}add`, `${currentPrefix}sudo`, `${currentPrefix}cleartmp`, `${currentPrefix}setpp`, `${currentPrefix}clearsession`, `${currentPrefix}prefix`, `${currentPrefix}autoreact`, `${currentPrefix}autotyping`, `${currentPrefix}autoread`  
    ];  
    const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));  

    let isSenderAdmin = false;  
    let isBotAdmin = false;  

    if (isGroup) {  // Add channel support here  
const adminStatus = await isAdmin(sock, chatId, senderId);  
isSenderAdmin = adminStatus.isSenderAdmin;  
isBotAdmin = adminStatus.isBotAdmin;
}
 
       
if ((isGroup) && isAdminCommand) {  
        if (!isBotAdmin) {  
            await sock.sendMessage(chatId, {   
                text: '❌ Please make the bot an admin to use admin commands.',   
                ...channelInfo   
            }, { quoted: message });  
            return;  
        }  
        if (!isSenderAdmin && !message.key.fromMe && !contextSenderIsSudo) {  
            await sock.sendMessage(chatId, {  
                text: '❌ Only group admins can use this command!',  
                ...channelInfo  
            }, { quoted: message });  
            return;  
        }  
    }  

    if (isOwnerCommand && !message.key.fromMe && !contextSenderIsSudo) {  
await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' });  
return;

}

try {  
const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));    
// ✅ FIXED: Enhanced channel owner detection  
const isChannelOwner = isChannel && (  
    message.key.fromMe ||   
    contextSenderIsSudo ||   
    senderId.includes(settings.ownerNumber) ||  
    (global.ownerLid && senderId.includes(global.ownerLid))  
);  
  
// ✅ FIXED: Allow channel owners to use bot even in private mode  
if (!data.isPublic && !message.key.fromMe && !contextSenderIsSudo && !isChannelOwner) {  
    if (isChannel) {  
        
    }  
    return;  
}  
  

} catch (error) {
console.log('📊 messageCount.json not found, assuming public mode');
}

// COMMAND HANDLER EXECUTION  
    try {  
        const args = userMessage.slice(currentPrefix.length).split(' ');  
        const commandName = args[0].toLowerCase();  
                      
        let command = commands.get(commandName) || aliases.get(commandName);  

        if (command) {  
            const adminStatus = (isGroup || isChannel) ? await isAdmin(sock, chatId, senderId) : {};  
            const context = buildContext(sock, message, { isAdminCheck: true, adminStatus });  
// ✅ FIXED: Execute command without auto-reactions to avoid //
            
            await command.execute(sock, message, args, context);  
              
            // ✅ FIXED: Only auto-react if not in channel to avoid rate limits  
            if (!isChannel) {  
                try {  
                    await handleAutoReaction(sock, message);  
                } catch (reactionError) {  
                      
                }  
            }  
              
        }/** else {  
            await sock.sendMessage(chatId, {  
                text: `😒Cmd "${commandName}" 🤷. Use ${currentPrefix}help to see available commands.`,  
                ...channelInfo  
            }, { quoted: message });  
        }  */
    } catch (error) {  
        console.error(`❌ Error executing command: ${error.message}`);  
          
        // ✅ FIXED: Only send error message if it's not a rate limit error  
        if (!error.message.includes('rate-overlimit') && !error.message.includes('Internal Server Error')) {  
            try {  
                await sock.sendMessage(chatId, {  
                    text: `❌ Error: ${error.message}`,  
                    ...channelInfo  
                }, { quoted: message });  
            } catch (sendError) {  
                console.error(`❌ Failed to send error message: ${sendError.message}`);  
            }  
        }  
    }  

} catch (error) {  
    console.error(`❌ Error in handleMessages: ${error.message}`);}
}

// === CALL HANDLER ===

async function initializeCallHandler(sock) {
    try {
        sock.ev.on('call', async (callData) => {
            await handleAnticall(sock, callData);
        });
    } catch (err) {
        console.error('❌ Error initializing call handler:', err);
    }
}

// === GROUP PARTICIPANT UPDATE ===
async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action } = update;
        if (!id.endsWith('@g.us')) return;

        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;
        const groupDesc = groupMetadata.desc || 'No description available';
        const memberCount = groupMetadata.participants.length;

        if (action === 'add' && isWelcomeEnabled(id)) {
            const welcomeMessage = getWelcome(id);
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = welcomeMessage
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc)
                    .replace(/{count}/g, memberCount.toString());
                try {
                    const styled = applyFontStyle(formattedMessage);
                    await sock.sendMessage(id, { text: styled, mentions: [participant], ...channelInfo });
                } catch {
                    await sock.sendMessage(id, { text: formattedMessage, mentions: [participant], ...channelInfo });
                }
            }
        }

        if (action === 'remove' && isGoodbyeEnabled(id)) {
            const goodbyeMessage = getGoodbye(id);
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = goodbyeMessage
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc)
                    .replace(/{count}/g, memberCount.toString());
                try {
                    const styled = applyFontStyle(formattedMessage);
                    await sock.sendMessage(id, { text: styled, mentions: [participant], ...channelInfo });
                } catch {
                    await sock.sendMessage(id, { text: formattedMessage, mentions: [participant], ...channelInfo });
                }
            }
        }
    } catch (err) {
        console.error('Error in handleGroupParticipantUpdate:', err);
    }
}

// === STATUS HANDLER ===
async function handleStatus(sock, statusUpdate) {
    try {
        await handleStatusUpdate(sock, statusUpdate);
    } catch (err) {
        console.error('Error in handleStatus:', err);
    }
}

export {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus,
    restorePresenceSettings,
    initializeCallHandler
};
