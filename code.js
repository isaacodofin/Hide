import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from 'fs';
import path from 'path';

const tempSessionPath = './data/session/temp_pair';

// Clean up temp session if exists
if (fs.existsSync(tempSessionPath)) {
    try {
        fs.rmSync(tempSessionPath, { recursive: true, force: true });
    } catch (e) {
        console.error('Failed to delete temp session:', e);
    }
}

async function generatePairingCode(phoneNumber) {
    try {
        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(tempSessionPath);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: state,
            markOnlineOnConnect: false,
            getMessage: async () => ({ conversation: '' })
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log('PAIR_SUCCESS');
                
                // Give time to save creds
                setTimeout(async () => {
                    await sock.logout();
                    
                    // Clean up temp session
                    setTimeout(() => {
                        if (fs.existsSync(tempSessionPath)) {
                            try {
                                fs.rmSync(tempSessionPath, { recursive: true, force: true });
                            } catch (e) {}
                        }
                        process.exit(0);
                    }, 1000);
                }, 2000);
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (!shouldReconnect) {
                    // Clean up temp session
                    if (fs.existsSync(tempSessionPath)) {
                        try {
                            fs.rmSync(tempSessionPath, { recursive: true, force: true });
                        } catch (e) {}
                    }
                    process.exit(0);
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Wait for connection to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Request pairing code
        if (!sock.authState.creds.registered) {
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            try {
                let code = await sock.requestPairingCode(cleanNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log('PAIRING_CODE:' + code);
                
                // Keep alive for 60 seconds to allow pairing
                setTimeout(() => {
                    if (fs.existsSync(tempSessionPath)) {
                        try {
                            fs.rmSync(tempSessionPath, { recursive: true, force: true });
                        } catch (e) {}
                    }
                    process.exit(0);
                }, 60000);
            } catch (err) {
                console.log('ERROR:Failed to request pairing code - ' + err.message);
                process.exit(1);
            }
        } else {
            console.log('ERROR:Already registered');
            process.exit(1);
        }

    } catch (error) {
        console.log('ERROR:' + error.message);
        
        // Clean up on error
        if (fs.existsSync(tempSessionPath)) {
            try {
                fs.rmSync(tempSessionPath, { recursive: true, force: true });
            } catch (e) {}
        }
        
        process.exit(1);
    }
}

// Get phone number from command line argument
const phoneNumber = process.argv[2];

if (!phoneNumber) {
    console.log('ERROR:No phone number provided');
    process.exit(1);
}

generatePairingCode(phoneNumber);
