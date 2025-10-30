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
import { smsg, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep, reSize,isUrl, getCurrentTime, getCurrentTimezone } from './lib/myfunc.js';
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
import baileysPkg from '@whiskeysockets/baileys/package.json' with { type: "json" };

console.log(`[GIFT-MD] 📦 Baileys version: ${baileysPkg.version}`);
import NodeCache from "node-cache";
import pino from "pino";
import readline from "readline";
import { parsePhoneNumber } from "libphonenumber-js";
// Remove the problematic PHONENUMBER_MCC import
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import store from './lib/lightweight.js';
import dotenv from "dotenv";
dotenv.config();

const envPath = path.resolve(process.cwd(), '.env');

    function loadEnvSession() {
    const envSession = process.env.SESSION_ID;
    const sessionDir = path.join(process.cwd(), 'data', 'session', 'auth.db');

    if (!envSession) return false; 

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    console.log(chalk.yellow('[GIFT-MD] Session found in .env!'));
    console.log(chalk.green('[GIFT-MD] Downloading Session from .env'));

    // Allow multiple known prefixes or none at all
    const knownPrefixes = ["JUNE-MD:", "GIFT-MD:", "SESSION:", "MD:"];
    let base64Data = envSession.trim();

    // Remove any recognized prefix if present
    for (const prefix of knownPrefixes) {
        if (base64Data.startsWith(prefix)) {
            base64Data = base64Data.replace(prefix, "").trim();
            break;
        }
    }

    try {
        // Decode and write to creds.json
        const decoded = Buffer.from(base64Data, "base64").toString("utf8");

        // Optional validation: must contain {"noiseKey": or something typical from Baileys session
        if (!decoded.includes('"noiseKey"')) {
            console.log(chalk.red("❌ Decoded session doesn't look valid (missing noiseKey)."));
            return false;
        }

        fs.writeFileSync(path.join(sessionDir, "creds.json"), decoded);
        console.log(chalk.green("[GIFT-MD] ✅ Successfully downloaded session from .env!"));
        return true;
    } catch (e) {
        console.log(chalk.red("❌ Failed to decode SESSION_ID from .env:"), e.message);
        return false;
    }
}

const file = path.resolve(process.argv[1]); // current file path

function restartBot() {

  console.log(chalk.blue('🔁 Restarting bot...'));

  spawn(process.argv[0], [file], {

    stdio: 'inherit',

    shell: true

  });

  process.exit(0);

}
// ✅ Automatically restart if .env changes (SESSION_ID or other variables)

function checkEnvStatus() {
    try {
        console.log(chalk.green("╔═══════════════════════════════════════╗"));
        console.log(chalk.green("║       .env file watcher active.       ║"));
        console.log(chalk.green("╚═══════════════════════════════════════╝"));

        // Watch for changes in the .env file
        fs.watch(envPath, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'change') {
                console.log(chalk.bgRed.black('================================================='));
                console.log(chalk.white.bgRed('[GIFT-MD] 🚨 .env file change detected!'));
                console.log(chalk.white.bgRed('Restarting bot to apply new configuration (e.g., SESSION_ID).'));
                console.log(chalk.red.bgBlack('================================================='));
                
            restartBot()    // triggers auto restart
            }
        });
    } catch (err) {
        console.log(chalk.red(`❌ Failed to setup .env watcher: ${err.message}`));
    }
}

checkEnvStatus(); 
// Create a store object with required methods
console.log(chalk.cyan('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
console.log(chalk.cyan('┃') + chalk.white.bold('        🤖 GIFT MD BOT STARTING...') +chalk.cyan('      ┃'))
console.log(chalk.cyan('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
// Read store on startup
store.readFromFile();
// Write store every 10 seconds
setInterval(() => store.writeToFile(), 10000);

// ✅ FIXED VERSION
function deleteSessionFolder() {
  const sessionPath = path.join(process.cwd(), 'data', 'session', 'auth.db');  // Use process.cwd()
  
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(chalk.green('[GIFT-MD] ✅ Session folder deleted successfully.'));
    } catch (err) {
      console.error(chalk.red('❌ Error deleting session folder:'), err);
    }
  } else {
    console.log(chalk.yellow('⚠️ No session folder found to delete.'));
  }
}

                    
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
global.getCurrentTime = getCurrentTime;
global.getCurrentTimezone = getCurrentTimezone;

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

// ✅ SMART SESSION PARSER - Handles ANY session format
function parseAndSaveSession(sessionInput) {
    const sessionDir = path.join(process.cwd(), 'data', 'session', 'auth.db');
    
    try {
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        let sessionData = sessionInput.trim();
        
        // Step 1: Remove any known prefixes
        const knownPrefixes = [
            "GIFT-MD:", "JUNE-MD:", "SESSION:", "MD:", 
            "GIFT_MD:", "JUNE_MD:", "SESSION_ID:", 
            "Gifted~", "Gifted-", "BAILEYS:"
        ];
        
        for (const prefix of knownPrefixes) {
            if (sessionData.startsWith(prefix)) {
                sessionData = sessionData.replace(prefix, "").trim();
                console.log(chalk.cyan(`[GIFT-MD] 🔍 Detected prefix: ${prefix}`));
                break;
            }
        }
        
        // Step 2: Try to detect format
        let credsJson = null;
        
        // Check if it's already valid JSON
        if (sessionData.startsWith('{') && sessionData.endsWith('}')) {
            console.log(chalk.cyan('[GIFT-MD] 📋 Format detected: Raw JSON'));
            try {
                credsJson = JSON.parse(sessionData);
            } catch (e) {
                throw new Error('Invalid JSON format: ' + e.message);
            }
        }
        // Otherwise, assume it's base64
        else {
            console.log(chalk.cyan('[GIFT-MD] 🔐 Format detected: Base64'));
            try {
                const decoded = Buffer.from(sessionData, 'base64').toString('utf8');
                credsJson = JSON.parse(decoded);
            } catch (e) {
                throw new Error('Invalid base64 or JSON: ' + e.message);
            }
        }
        
        // Step 3: Validate session structure
        if (!credsJson || typeof credsJson !== 'object') {
            throw new Error('Session data is not a valid object');
        }
        
        // Check for essential Baileys properties
        const requiredKeys = ['noiseKey', 'signedIdentityKey', 'signedPreKey', 'registrationId'];
        const hasRequiredKeys = requiredKeys.some(key => credsJson.hasOwnProperty(key));
        
        if (!hasRequiredKeys) {
            throw new Error('Session missing required Baileys keys (noiseKey, signedIdentityKey, etc.)');
        }
        
        // Step 4: Save to creds.json
        const credsPath = path.join(sessionDir, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(credsJson, null, 2));
        
        console.log(chalk.green('[GIFT-MD] ✅ Session validated and saved successfully!'));
        restartBot();
        return true;
        
    } catch (error) {
        console.log(chalk.red(`[GIFT-MD] ❌ Failed to parse session: ${error.message}`));
        return false;
    }
}

async function startXeonBotInc() {
    loadEnvSession()
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./data/session/auth.db`)
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
            // ✅ ADD THIS - Clear retry cache to prevent memory bloat
        if (XeonBotInc?.msgRetryCounterCache) {
            XeonBotInc.msgRetryCounterCache.clear()
        }
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
        console.log(chalk.bold.blue('2. Use .env  session'))
        console.log(chalk.bold.blue('3. Paste any kind of session'))
        
        console.log('')

        const option = await question(chalk.bgBlack(chalk.green('Choose between option: 1--2--3\n')))
                 
        if (option === '2') {
            // ✅ NEW: Load session from .env
            console.log(chalk.cyan('[GIFT-MD] 🔍 Checking .env for SESSION_ID...'))
            
            const sessionLoaded = loadEnvSession();
            
            if (sessionLoaded) {
                console.log(chalk.green('[GIFT-MD] ✅ Session loaded from .env successfully!'))
                console.log(chalk.cyan('[GIFT-MD] 🔄 Connecting with .env session...'))
                return; // Skip pairing, use .env session
            } else {
                console.log(chalk.red('❌ No valid SESSION_ID found in .env'))
                console.log(chalk.yellow('💡 Tip: Add SESSION_ID to your .env file'))
                console.log(chalk.yellow('   Format: SESSION_ID=GIFT-MD:your_base64_session_here'))
                console.log('')
                console.log(chalk.yellow('⚠️  Falling back to phone number pairing...'))
                console.log('')
            }
        }else if (option === '3') {
            console.log(chalk.cyan('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
            console.log(chalk.cyan('┃')+ chalk.green('          📋 PASTE YOUR SESSION')+ chalk.cyan('         ┃'))
            console.log(chalk.cyan('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
            console.log('')
            console.log(chalk.yellow('✅ Supported formats:'))
            console.log(chalk.white('   • Base64 with prefix: GIFT-MD:eyJub2..'))
            console.log(chalk.white('   • Base64 without prefix: eyJub2lzy....'))
            console.log(chalk.white('   • Raw JSON: {"noiseKey":{"private":...'))
            console.log('')
            console.log(chalk.cyan('Paste your session below (press Enter when done):'))
            console.log('')
            
            const pastedSession = await question(chalk.bgBlack(chalk.green('> ')))
            
            if (!pastedSession || pastedSession.trim().length < 50) {
                console.log(chalk.red('❌ Session too short or empty!'))
                console.log(chalk.yellow('⚠️  Falling back to phone number pairing...'))
                console.log('')
            } else {
                console.log(chalk.cyan('[GIFT-MD] 🔍 Analyzing session format...'))
                
                const sessionSaved = parseAndSaveSession(pastedSession);
                
                if (sessionSaved) {
                    console.log(chalk.green('[GIFT-MD] ✅ Session saved successfully!'))
                    console.log(chalk.cyan('[GIFT-MD] 🔄 Connecting with pasted session...'))
                    return; // Skip pairing
                } else {
                    console.log(chalk.red('❌ Failed to parse session!'))
                    console.log(chalk.yellow('⚠️  Falling back to phone number pairing...'))
                    console.log('')
                }
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
// Connection handling
XeonBotInc.ev.on('connection.update', async (s) => {
    const { connection, lastDisconnect } = s
    
    if (connection == "open") {
        console.log(chalk.green('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
        console.log(chalk.green('┃') + chalk.white.bold('        ✅ CONNECTION SUCCESSFUL!     ') + chalk.green('  ┃'))
        console.log(chalk.green('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
        
        // Extract LID
        if (XeonBotInc.user.lid) {
            global.ownerLid = XeonBotInc.user.lid.split(':')[0];
            console.log(chalk.cyan(`[GIFT-MD] 🆔 User LID captured: ${global.ownerLid}`));
        }
        
        global.sock = XeonBotInc;
        const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Send startup message
        try {
            await XeonBotInc.sendMessage(botNumber, {
                text: `╔═▣══════════▣╗
║       ▣ GIFT - MD ▣     ║
╚═▣══════════▣╝
▣ Time: ${new Date().toLocaleString()}
▣ Status: Online and Ready!
▣ Current prefix is: [ ${currentPrefix} ]`,
                ...channelInfo
            });
            console.log(chalk.green('[GIFT-MD] ✅ Startup message sent to User!'));
        } catch (error) {
            console.error(chalk.yellow('[GIFT-MD] ⚠️ Could not send startup message:'), error.message);
        }

        await delay(1999)
        
        // Initialize features
        await restorePresenceSettings(XeonBotInc);
        initializeCallHandler(XeonBotInc);
    }
    
    // ✅ SIMPLIFIED CONNECTION CLOSE HANDLER
    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        console.log(chalk.yellow(`[GIFT-MD] ⚠️ Connection closed. Status code: ${statusCode}`));
        
        // Only delete session on logout or bad auth
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log(chalk.red('[GIFT-MD] 🚨 Logged out - deleting session'));
            deleteSessionFolder();
            await delay(5000);
            process.exit(0); // Exit - require manual restart
        } 
        // For badSession, also delete
        else if (statusCode === DisconnectReason.badSession) {
            console.log(chalk.red('[GIFT-MD] 🚨 Bad session - deleting and restarting'));
            deleteSessionFolder();
            await delay(3000);
            startXeonBotInc();
        }
        // For all other disconnects, just reconnect
        else {
       await delay(10000);
            console.log(chalk.cyan('[GIFT-MD] 🔄 Reconnecting...'));
            await delay(3000); // 3 second delay
            startXeonBotInc();
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
    console.error(chalk.red('[GIFT-MD] ❌ Failed to start:'), err);
    console.log(chalk.yellow('[GIFT-MD] 🔄 Retrying in 10 seconds...'));
    setTimeout(() => {
        startXeonBotInc();
    }, 10000);
});

// ... your existing code ...

// ✅ FIXED VERSION
process.on('uncaughtException', function (err) {
    console.log(chalk.red('[GIFT-MD] ❌ Uncaught exception:'), err);
    console.log(chalk.yellow('[GIFT-MD] 🔄 Attempting to restart...'));
    
    setTimeout(() => {
        startXeonBotInc();
    }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(chalk.red('[GIFT-MD] ❌ Unhandled Rejection at:'), promise, 'reason:', reason);
});

  // =================================
// 🧹 MEMORY MANAGEMENT (Optimized for 716 MiB server)
// =================================

console.log(chalk.cyan('[GIFT-MD] 📊 Initializing memory optimization...'));
console.log(chalk.cyan(`[GIFT-MD] 💾 Server RAM: 716 MiB | Available: ~430 MiB | Bot Limit: 280 MB`));

// ✅ Check if GC is available on startup (only once)
if (global.gc) {
    console.log(chalk.green('[GIFT-MD] ✅ Garbage collection enabled!'));
} else {
    console.log(chalk.yellow('[GIFT-MD] ⚠️ Garbage collection not available.'));
    console.log(chalk.cyan('[GIFT-MD] 💡 To enable: node --expose-gc index.js'));
}

// 1. Aggressive Garbage Collection (every 30 seconds for low RAM)
setInterval(() => {
    if (global.gc) {
        try {
            global.gc();
            const memUsage = process.memoryUsage();
            const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
            const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
            
            // ✅ Only log if RAM is high (above 200 MB)
            if (rss > 200) {
                console.log(chalk.cyan(`[GIFT-MD] 🧹 GC: RAM ${rss} MB | Heap ${heapUsed} MB`));
            }
        } catch (err) {
            // Silent fail - don't spam console
        }
    }
    // ✅ REMOVED: No more warning spam!
}, 30_000); // Every 30 seconds

// 2. Memory Monitoring with 3-tier warning system
setInterval(() => {
    const memUsage = process.memoryUsage();
    const rss = memUsage.rss / 1024 / 1024;
    const heapUsed = memUsage.heapUsed / 1024 / 1024;
    
    // 🟡 Warning (200-250 MB)
    if (rss >= 200 && rss < 250) {
        console.log(chalk.yellow(`[GIFT-MD] ⚠️ RAM: ${rss.toFixed(2)} MB / 280 MB (Warning)`));
    }
    // 🟠 High (250-270 MB) - Force GC
    else if (rss >= 250 && rss < 270) {
        console.log(chalk.hex('#FFA500')(`[GIFT-MD] 🟠 High RAM: ${rss.toFixed(2)} MB / 280 MB`));
        if (global.gc) {
            console.log(chalk.cyan('[GIFT-MD] 🧹 Forcing garbage collection...'));
            try {
                global.gc();
            } catch (err) {
                // Silent fail
            }
        }
    }
    // 🔴 Critical (270+ MB) - Emergency cleanup
    else if (rss >= 270) {
        console.log(chalk.red(`[GIFT-MD] 🔴 CRITICAL RAM: ${rss.toFixed(2)} MB / 280 MB`));
        console.log(chalk.red('[GIFT-MD] ⚠️ Memory limit approaching! Forcing cleanup...'));
        
        if (global.gc) {
            try {
                global.gc();
                console.log(chalk.green('[GIFT-MD] ✅ Emergency GC completed'));
            } catch (err) {
                console.error(chalk.red('[GIFT-MD] ❌ GC failed:', err.message));
            }
        }
        
        // Clear caches
        if (global.sock?.msgRetryCounterCache) {
            global.sock.msgRetryCounterCache.clear();
        }
    }
}, 60_000); // Check every 60 seconds (less frequent)             
   










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

console.log(chalk.green('[GIFT-MD] ✅ Memory optimization enabled (Low RAM mode)\n'));           
