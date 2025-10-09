import { useSQLiteAuthState, clearSQLiteSession } from './lib/sqliteAuth.js';
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

// Create a store object with required methods
console.log(chalk.cyan('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'))
console.log(chalk.cyan('┃') + chalk.white.bold('          🤖 GIFT MD BOT STARTING...        ') + chalk.cyan(' ┃'))
console.log(chalk.cyan('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'))
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async (jid) => {
        return {}
    },
    bind: function(ev) {
        // Handle events
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                if (msg.key && msg.key.remoteJid) {
                    this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {}
                    this.messages[msg.key.remoteJid][msg.key.id] = msg
                }
            })
        })
        ev.on('contacts.update', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) {
                    this.contacts[contact.id] = contact
                }
            })
        })
        
        ev.on('chats.set', (chats) => {
            this.chats = chats
        })
    },
    loadMessage: async (jid, id) => {
        return this.messages[jid]?.[id] || null
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
    const { state, saveCreds } = await useSQLiteAuthState('./data/session/auth.db', 'gift-md')
    const msgRetryCounterCache = new NodeCache()

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth:state,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
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
            const sessionExists = fs.existsSync('./data/session/auth.db')
            if (sessionExists) {
                console.log(chalk.green('[GIFT-MD] ✅ Using existing Qslite session...'))
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
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

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
            await XeonBotInc.sendMessage(botNumber, {text:`╔═▣══════════▣╗
║       ▣ GIFT - MD ▣     ║
╚═▣══════════▣╝
▣ Time: ${new Date().toLocaleString()}
▣ Status: Online and Ready!
▣ Current prefix is: [ ${currentPrefix} ]
▣ ✅Do ur best to join below channel`,
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
          

            await delay(1999)
            
            // Initialize features after connection
            await restorePresenceSettings(XeonBotInc);
            initializeCallHandler(XeonBotInc);
            
        } else if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason === DisconnectReason.badSession) {
                console.log(`Bad Session File, Please Delete Session and Scan Again`);
                clearSQLiteSession();
            startXeonBotInc()
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log("Connection closed, reconnecting....");
                startXeonBotInc();
            } else if (reason === DisconnectReason.connectionLost) {
                console.log("Connection Lost from Server, reconnecting...");
                startXeonBotInc();
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                startXeonBotInc()
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(`Device Logged Out, Please Scan Again And Run.`);
                clearSQLiteSession();
            startXeonBotInc()
            } else if (reason === DisconnectReason.restartRequired) {
                console.log("Restarting...");
                startXeonBotInc()
            } else if (reason === DisconnectReason.timedOut) {
                console.log("Connection TimedOut, Reconnecting...");
                startXeonBotInc()
            } else XeonBotInc.end(`Unknown DisconnectReason: ${reason}|${connection}`)
        }
    })

    XeonBotInc.ev.on('creds.update', saveCreds)

    // Group participants update
    XeonBotInc.ev.on("group-participants.update", async (anu) => {
        await handleGroupParticipantUpdate(XeonBotInc, anu);
    })

    return XeonBotInc
}

startXeonBotInc()

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err)
})
