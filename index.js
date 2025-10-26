import messageStore from './lib/messageStore.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';  
//=========== BOT MODE==========//
import settings from './settings.js';
import { getSetting } from './lib/database.js';
import { channelInfo } from './lib/messageConfig.js';
import { Boom } from '@hapi/boom';
const currentPrefix = (global.prefix === undefined || global.prefix === null) ? '.' : global.prefix;
import FileType from 'file-type';
import axios from 'axios';
import { handleMessages, handleGroupParticipantUpdate, handleStatus, restorePresenceSettings, initializeCallHandler} from './main.js';
import awesomePhoneNumber from 'awesome-phonenumber';
import PhoneNumber from 'awesome-phonenumber';
import { imageToWebp, videoToWebp, writeExifImg, writeExifVid } from './lib/exif.js';
import { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep, reSize } from './lib/myfunc.js';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason, 
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import pino from "pino";
import readline from "readline";
import { parsePhoneNumber } from "libphonenumber-js";
// Remove the problematic PHONENUMBER_MCC import
import { rmSync, existsSync } from 'fs';
import { join } from 'path';


// === AUTO SHUTDOWN ON TOO MANY RECONNECTS ===
global.connectionRetries = 0;
const MAX_RETRIES = 3; // You can increase or decrease this


// Create a store object with required methods
console.log(chalk.cyan('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
console.log(chalk.cyan('┃') + chalk.white.bold('          🤖 GIFT MD BOT STARTING...        ') + chalk.cyan(' ┃'))
console.log(chalk.cyan('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
// ✅ FIXED VERSION
function deleteSessionFolder() {
  const sessionPath = path.join(process.cwd(), 'session');  // Use process.cwd()
  
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(chalk.green('✅ Session folder deleted successfully.'));
    } catch (err) {
      console.error(chalk.red('❌ Error deleting session folder:'), err);
    }
  } else {
    console.log(chalk.yellow('⚠️ No session folder found to delete.'));
  }
}

// Create a hybrid store object with required methods
const store = {
    messages: {},
    contacts: {},
    chats: {},
    maxInMemory: 30,
    
    groupMetadata: async (jid) => {
        return {}
    },
    
    bind: function(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                try {
                    if (msg.key && msg.key.remoteJid) {
                        const jid = msg.key.remoteJid;
                        messageStore.save(msg);
                        
                        if (!this.messages[jid]) {
                            this.messages[jid] = [];
                        }
                        
                        this.messages[jid].push(msg);
                        
                        if (this.messages[jid].length > this.maxInMemory) {
                            this.messages[jid].shift();
                        }
                    }
                } catch (error) {
                    console.error(chalk.red('❌ Error in store.bind:'), error.message);
                }
            })
        })
        
        ev.on('contacts.update', (contacts) => {
            try {
                contacts.forEach(contact => {
                    if (contact.id) {
                        this.contacts[contact.id] = contact
                    }
                })
            } catch (error) {
                console.error(chalk.red('❌ Error updating contacts:'), error.message);
            }
        })
        
        ev.on('chats.set', (chats) => {
            try {
                this.chats = chats
            } catch (error) {
                console.error(chalk.red('❌ Error setting chats:'), error.message);
            }
        })
    },
    
    // ✅ ADD THIS MISSING FUNCTION
    loadMessage: async function(jid, id) {
        try {
            // Try memory first
            if (this.messages[jid]) {
                const memMsg = this.messages[jid].find(m => m.key.id === id);
                if (memMsg) return memMsg;
            }
            
            // Fallback to database
            const dbMsg = messageStore.load(jid, id);
            if (dbMsg) return dbMsg;
            
            return null;
        } catch (error) {
            console.error(chalk.red('❌ Error loading message:'), error.message);
            return null;
        }
    }
}; // ✅ Don't forget semicolon
                    
let phoneNumber = "911234567890"
let owner = JSON.parse(fs.readFileSync('./data/database.json')).settings.User;

import db from './lib/database.js';
// NEW - Use database settings first, fallback to settings.js
global.prefix = getSetting('prefix', settings.prefix);
global.mode = getSetting('mode', settings.Mode);
global.packname = getSetting('packname', settings.packname);
global.botName = getSetting('botName', settings.botName);
global.botOwner = getSetting('botOwner', settings.botOwner);
global.version = getSetting('version', settings.version);
global.startTime = Date.now();
global.author = "ISAAC-FAVOUR";
global.channelLink = "https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A";
global.dev = "2348085046874";
global.devgit = "https://github.com/isaacfont461461-cmd/OfficialGift-Md";
global.devyt = "@officialGift-md";
global.ytch = "Mr Unique Hacker";


const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

async function startXeonBotInc() {
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    })


    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
            
            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, { 
                        text: '❌ An error occurred while processing your message.',
                    ...channelInfo 
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }
        
    
    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        let id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact 
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        if (pairingCode && !XeonBotInc.authState.creds.registered) {
    if (useMobile) throw new Error('Cannot use pairing code with mobile api')

    let phoneNumber
  /**  clearSQLiteSession();
    await delay(3099)
    console.clear();*/
    if (process.stdin.isTTY) {
        // Interactive Mode - Show options
        console.log(chalk.grey('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
        console.log(chalk.cyan('┃') + chalk.white.bold('           CONNECTION OPTIONS              ') + chalk.cyan('┃'))
        console.log(chalk.grey('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
        console.log('')
        console.log(chalk.bold.blue('1. Enter phone number for new pairing'))
        console.log(chalk.bold.blue('2. Use existing session (if available)'))
        console.log('')

        const option = await question(chalk.bgBlack(chalk.green('Choose option (1 or 2): ')))

        if (option === '2') {
            // Check if session exists
            const sessionExists = fs.existsSync('./session')
            if (sessionExists) {
                console.log(chalk.green('[GIFT-MD] ✅ Using existing session...'))
                return // Skip pairing process
            } else {
                console.log(chalk.bold.blue('⚠️  No existing session found, falling back to phone number input...'))
            }
        }

        phoneNumber = await question(chalk.bgBlack(chalk.green('Please type your WhatsApp number\nFormat: 2348085046874 (without + or spaces) : ')))
    } else {
        // Non-Interactive Mode
     console.log(chalk.bold.cyan('[GIFT-MD] Using setting owner number'))
        phoneNumber = settings.ownerNumber || phoneNumber
    }

    // Clean the phone number - remove any non-digit characters
if (!phoneNumber || phoneNumber.trim() === '') {
    console.log(chalk.red('❌ No owner number provided in settings.'));
    console.log(chalk.yellow('👉 Please add your owner number in settings.js before starting the bot.'));
    process.exit(1); // Stop the bot so user fixes it
}

phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    // Validate the phone number using awesome-phonenumber (ESM compatible)
    if (!awesomePhoneNumber('+' + phoneNumber).isValid()) {
        console.log(chalk.bold.red('Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, etc.) without + or spaces.'));
        process.exit(1);
    }

    setTimeout(async () => {
        try {
            let code = await XeonBotInc.requestPairingCode(phoneNumber)
            code = code?.match(/.{1,4}/g)?.join("-") || code

            console.log('')
            console.log(chalk.green('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
            console.log(chalk.green('┃') + chalk.white.bold('              PAIRING CODE               ') + chalk.green('┃'))
            console.log(chalk.green('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
            console.log('')
            console.log(chalk.cyan.bold(`    ${code}    `))
            console.log('')
            console.log(chalk.yellow('📱 How to link your WhatsApp:'))
            console.log(chalk.white('1. Open WhatsApp on your phone'))
            console.log(chalk.white('2. Go to Settings > Linked Devices'))
            console.log(chalk.white('3. Tap "Link a Device"'))
            console.log(chalk.white('4. Enter the code: ') + chalk.green.bold(code))
            console.log('')
            console.log(chalk.cyan.bold('⏱️  Code expires in 1 minute'))
            console.log('')

        } catch (error) {
            console.error('')
            console.log(chalk.red('❌ Failed to generate pairing code'))
            console.log(chalk.yellow('Error details:'), error.message)
            console.log(chalk.gray('Please check your internet connection and try again'))
            process.exit(1)
        }
    }, 3000)
}

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s
        if (connection == "open") {
            global.connectionRetries = 0;
            console.log(chalk.green('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
            console.log(chalk.green('┃') + chalk.white.bold('          ✅ CONNECTION SUCCESSFUL!        ') + chalk.green('┃'))
            console.log(chalk.green('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
            console.log('') 
                
            // Try to extract lid number from the lid property
            if (XeonBotInc.user.lid) {
                global.ownerLid = XeonBotInc.user.lid.split(':')[0]; // Get number before ':'
                console.log(chalk.cyan(`🆔 Owner LID captured: ${global.ownerLid}`));
            }
      
            global.sock = XeonBotInc; // ✅ Make socket available globally for autobio & other features
            const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
            // ✅ Add try-catch
try {
    await XeonBotInc.sendMessage(botNumber, {
        text: `╔═▣══════════▣╗
║       ▣ GIFT - MD ▣     ║
╚═▣══════════▣╝
▣ Time: ${new Date().toLocaleString()}
▣ Status: Online and Ready!
▣ Current prefix is: [ ${currentPrefix} ]`,
        contextInfo: {
    externalAdReply: {
      title: "Join GIFT-MD Official Channel",
      body: "Tap below to view channel👇😌👇",
      thumbnailUrl: "https://whatsapp.com/channel/0029VbBT5JR3LdQMA5ckyE3e", // optional image
      sourceUrl: "https://files.catbox.moe/cwrn41.jpg", // 🔴 your channel link
      mediaType: 1,
      renderLargerThumbnail: false
    }
  }
    });
    console.log(chalk.green('✅ Startup message sent!'));
} catch (error) {
    console.error(chalk.yellow('⚠️ Could not send startup message:'), error.message);
    // Don't crash, just log the error
}
          

            await delay(1999)
            
            // Initialize features after connection
            await restorePresenceSettings(XeonBotInc);
            initializeCallHandler(XeonBotInc);
            
        } else if (connection === "close") {
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    global.connectionRetries++;
    console.log(chalk.yellow(`⚠️ Connection closed. Retry attempt ${global.connectionRetries}/${MAX_RETRIES}`));

    if (global.connectionRetries >= MAX_RETRIES) {
        console.log(chalk.red(`🚨 Too many reconnection attempts (${MAX_RETRIES}). Shutting down bot.`));
        console.log(chalk.red('🛑 Please check your network or session files.'));
        await delay(5000); // Give logs time to print
        process.exit(1);
    }

    if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        deleteSessionFolder();
        await delay(10000)
        process.exit(0);
    } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        await delay(1000)
        startXeonBotInc();
    } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        await delay(1000)
        startXeonBotInc();
    } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
        await delay(5000)
        startXeonBotInc();
    } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Scan Again And Run.`);
        deleteSessionFolder();
        await delay(5000)
        process.exit(0);
    } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restarting...");
        startXeonBotInc();
    } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        startXeonBotInc();
    } else {
        XeonBotInc.end(`Unknown DisconnectReason: ${reason}|${connection}`);
    }
}
    })

    XeonBotInc.ev.on('creds.update', saveCreds)

    // Group participants update
    XeonBotInc.ev.on("group-participants.update", async (anu) => {
        await handleGroupParticipantUpdate(XeonBotInc, anu);
    })

    return XeonBotInc
}

// ✅ FIXED
startXeonBotInc().catch(err => {
    console.error(chalk.red('❌ Failed to start bot:'), err);
    console.log(chalk.yellow('🔄 Retrying in 10 seconds...'));
    setTimeout(() => {
        startXeonBotInc();
    }, 10000);
});

// ... your existing code ...

// ✅ FIXED VERSION
process.on('uncaughtException', function (err) {
    console.log(chalk.red('❌ Uncaught exception:'), err);
    console.log(chalk.yellow('🔄 Attempting to restart bot...'));
    
    setTimeout(() => {
        startXeonBotInc();
    }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
});

                
    // =================================
// 🧹 MEMORY MANAGEMENT (Optimized for 716 MiB server)
// =================================

console.log(chalk.cyan('\n📊 Initializing memory optimization...'));
console.log(chalk.cyan(`💾 Server RAM: 716 MiB | Available: ~430 MiB | Bot Limit: 320 MB`));

// 1. Aggressive Garbage Collection (every 30 seconds for low RAM)
setInterval(() => {
    if (global.gc) {
        global.gc();
        const memUsage = process.memoryUsage();
        const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
        const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        
        console.log(chalk.cyan(`🧹 GC completed | RAM: ${rss} MB | Heap: ${heapUsed} MB`));
    } else {
        //console.log(chalk.yellow('⚠️ Garbage collection not available. Start with: node --expose-gc index.js'));
    }
}, 30_000); // Every 30 seconds (more frequent for low RAM)

// 2. Memory Monitoring with 3-tier warning system
setInterval(() => {
    const memUsage = process.memoryUsage();
    const rss = memUsage.rss / 1024 / 1024;
    const heapUsed = memUsage.heapUsed / 1024 / 1024;
    
    // Log every 5 minutes for monitoring
    const shouldLog = Date.now() % 300000 < 30000; // True once every 5 min
    if (shouldLog) {
        console.log(chalk.blue(`📊 Memory: RAM ${rss.toFixed(2)} MB | Heap ${heapUsed.toFixed(2)} MB`));
    }
    
    // 🟡 Warning (200-280 MB)
    if (rss >= 200 && rss < 280) {
        console.log(chalk.yellow(`⚠️ RAM: ${rss.toFixed(2)} MB / 280 MB (Warning)`));
    }
    // 🟠 High (280-320 MB) - Force GC
    else if (rss >= 280 && rss < 320) {
        console.log(chalk.hex('#FFA500')(`🟠 High RAM: ${rss.toFixed(2)} MB / 320 MB`));
        if (global.gc) {
            console.log(chalk.cyan('🧹 Forcing garbage collection...'));
            global.gc();
        }
    }
    // 🔴 Critical (> 320 MB) - RESTART
    else if (rss >= 320) {
        console.log(chalk.red(`🚨 CRITICAL: ${rss.toFixed(2)} MB > 320 MB`));
        console.log(chalk.red('🔄 Restarting to prevent server crash...'));
        
        if (global.sock) {
            try { global.sock.end(); } catch (e) {}
        }
        
        setTimeout(() => process.exit(1), 3000);
    }
}, 30_000);

// 3. Aggressive store cleanup (every 3 minutes)
setInterval(() => {
    try {
        let cleaned = 0;
        
        // Clean messages (keep only 30 per chat for low RAM)
        Object.keys(store.messages).forEach(jid => {
            if (store.messages[jid] && store.messages[jid].length > 30) {
                const excess = store.messages[jid].length - 30;
                store.messages[jid].splice(0, excess);
                cleaned += excess;
            }
        });
        
        if (cleaned > 0) {
            console.log(chalk.gray(`🗑️ Cleaned ${cleaned} messages | Freed ~${(cleaned * 0.01).toFixed(2)} MB`));
        }
        
        // Force GC after cleanup
        if (global.gc) {
            global.gc();
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Cleanup error:'), error.message);
    }
}, 180_000); // Every 3 minutes

console.log(chalk.green('✅ Memory optimization enabled (Low RAM mode)\n'));           
