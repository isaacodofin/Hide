import express from 'express';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ CORRECT IMPORT FOR BAILEYS v6.7.8
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
    delay,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Retry tracking Map (stores retry counts per session ID)
const retryTracking = new Map();
const MAX_RETRIES = 3;

// ✅ Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Utility to generate random ID
function makeid(length = 10) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Remove temp folder
function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

// ✅ Validate phone number format
function isValidPhoneNumber(num) {
    const cleaned = num.replace(/[^0-9]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
}

// ✅ ROOT ROUTE - Landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ PAIR ROUTE - Pairing page
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ✅ CODE ENDPOINT - API for generating pairing code
app.get('/code', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    // ✅ Validate phone number
    if (!num || !isValidPhoneNumber(num)) {
        return res.status(400).json({ 
            error: 'Invalid phone number format',
            message: 'Please provide a valid phone number (10-15 digits)'
        });
    }

    async function GIFT_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            const { version } = await fetchLatestBaileysVersion();
            
            let sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.macOS('Desktop'), // ✅ Changed to macOS for better compatibility
                mobile: false,
                syncFullHistory: false,
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                
                const code = await sock.requestPairingCode(num);
                
                // ✅ Validate pairing code
                if (!code || code.length < 6) {
                    console.log('[GIFT-MD] ❌ Invalid pairing code generated');
                    await removeFile('./temp/' + id);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: 'Failed to generate pairing code' });
                    }
                }
                
                console.log(`[GIFT-MD] ✅ Pairing code: ${code} for ${num}`);
                
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                
                // ✅ Log connecting state
                if (connection === 'connecting') {
                    console.log('[GIFT-MD] 🔄 Connecting to WhatsApp...');
                }
                
                if (connection === 'open') {
                    console.log('[GIFT-MD] 🎉 Connection opened!');
                    
                    // ✅ Reset retry count on successful connection
                    retryTracking.delete(id);
                    
                    await delay(10000);
                    
                    if (!sock?.user?.id) {
                        console.log('[GIFT-MD] ❌ User undefined after connection');
                        return await removeFile('./temp/' + id);
                    }
                    
                    console.log('[GIFT-MD] ✅ User connected:', sock.user.id);
                    
                    try {
                        const credsPath = path.join(__dirname, 'temp', id, 'creds.json');
                        
                        if (!fs.existsSync(credsPath)) {
                            console.log('[GIFT-MD] ❌ Creds file not found');
                            return await removeFile('./temp/' + id);
                        }
                        
                        console.log('[GIFT-MD] 📖 Reading session data...');
                        const data = fs.readFileSync(credsPath);
                        await delay(2000);
                        
                        const b64data = Buffer.from(data).toString('base64');
                        const sessionString = 'GIFT-MD~' + b64data;
                        
                        console.log(`[GIFT-MD] 📤 Sending session (${sessionString.length} chars)...`);
                        
                        // ✅ SEND SESSION FIRST
                        await sock.sendMessage(sock.user.id, { 
                            text: sessionString 
                        });
                        
                        console.log('[GIFT-MD] ✅ Session sent!');
                        
                        // ✅ WAIT 5 SECONDS
                        await delay(5000);
                        
                        console.log('[GIFT-MD] 📤 Sending instructions...');
                        
                        // ✅ SEND INSTRUCTIONS
                        const GIFT_MD_TEXT = `
╔════════════════════◇
║ SESSION CONNECTED ✅
║ 🎁 GIFT MD BOT
║ By Isaac Favour
╚════════════════════╝

╔════════════════════◇
║ SETUP INSTRUCTIONS:
║ 
║ 1. Copy the session above (GIFT-MD~...)
║ 2. Go to your hosting platform
║ 3. Set environment variable:
║    SESSION_ID = <paste here>
║ 4. Deploy your bot
╚════════════════════╝

╔════════════════════◇
║ SUPPORT & LINKS:
║ 
║ 📺 YouTube: @officialGift-md
║ 📱 Owner: +2348085046874
║ 🔗 Repo: github.com/isaacfont461461-cmd
║ 💬 Channel: whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A
╚════════════════════╝

🎉 Enjoy GIFT MD!

Don't forget to give a ⭐ to the repo!
______________________________`;

                        await sock.sendMessage(sock.user.id, { 
                            text: GIFT_MD_TEXT 
                        });
                        
                        console.log('[GIFT-MD] ✅ Instructions sent!');
                        
                        // ✅ WAIT 5 SECONDS BEFORE CLOSING
                        await delay(5000);
                        
                        console.log('[GIFT-MD] 🔒 Closing connection...');
                        
                        // ✅ Check if socket is still open before closing
                        if (sock.ws.readyState === 1) {
                            await sock.ws.close();
                        }
                        
                        await delay(2000);
                        await removeFile('./temp/' + id);
                        retryTracking.delete(id); // ✅ Clean up retry tracking
                        
                    } catch (sendError) {
                        console.log('[GIFT-MD] ❌ Send error:', sendError.message);
                        console.error(sendError);
                        await removeFile('./temp/' + id);
                        retryTracking.delete(id);
                    }
                    
                } else if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const reason = lastDisconnect?.error?.message || 'Unknown';
                    
                    console.log(`[GIFT-MD] ⚠️ Connection closed. Status: ${statusCode}, Reason: ${reason}`);
                    
                    // ✅ Get current retry count
                    const retries = retryTracking.get(id) || 0;
                    
                    // ✅ Handle logged out
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        console.log('[GIFT-MD] 🚨 Logged out - cleaning up');
                        await removeFile('./temp/' + id);
                        retryTracking.delete(id);
                        // ✅ REMOVED: await sock.ws.close(); (already closed!)
                    }
                    
                    // ✅ Handle bad session
                    else if (statusCode === DisconnectReason.badSession) {
                        console.log('[GIFT-MD] 🚨 Bad session - deleting and restarting');
                        await removeFile('./temp/' + id);
                        await delay(3000);
                        GIFT_MD_PAIR_CODE();
                    }
                    
                    // ✅ Handle temporary disconnections with retry limit
                    else if ([515, 516, 428, 408].includes(statusCode)) {
                        if (retries < MAX_RETRIES) {
                            retryTracking.set(id, retries + 1);
                            console.log(`[GIFT-MD] 🔄 Retry ${retries + 1}/${MAX_RETRIES} (Status: ${statusCode})`);
                            await delay(3000);
                            GIFT_MD_PAIR_CODE();
                        } else {
                            console.log('[GIFT-MD] ❌ Max retries reached - giving up');
                            await removeFile('./temp/' + id);
                            retryTracking.delete(id);
                        }
                    }
                    
                    // ✅ Handle unknown errors
                    else {
                        console.log('[GIFT-MD] ❌ Unknown disconnection - cleaning up');
                        await removeFile('./temp/' + id);
                        retryTracking.delete(id);
                    }
                }
            });
            
        } catch (err) {
            console.log('[GIFT-MD] ❌ Service error:', err.message);
            console.error(err);
            await removeFile('./temp/' + id);
            retryTracking.delete(id);
            
            if (!res.headersSent) {
                await res.status(500).json({ 
                    error: 'Service temporarily unavailable',
                    message: err.message 
                });
            }
        }
    }

    return await GIFT_MD_PAIR_CODE();
});

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'GIFT MD Pairing API is running',
        activeSessions: retryTracking.size
    });
});

// ✅ 404 HANDLER
app.use((req, res) => {
    res.status(404).send('404 - Page Not Found');
});

// ✅ START SERVER
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════╗
║   🎁 GIFT MD PAIRING SITE      ║
║   Status: ONLINE ✅            ║
║   Port: ${PORT}                    ║
╚════════════════════════════════╝

🌐 Home: http://localhost:${PORT}
🔗 Pairing: http://localhost:${PORT}/pair
📡 API: http://localhost:${PORT}/code?number=...
    `);
});
