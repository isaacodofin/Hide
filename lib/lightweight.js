import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const STORE_FILE = path.join(process.cwd(), 'data', 'messageStore.db', 'Mstore.js');

class LightweightStore {
    constructor() {
        this.messages = {};
        this.contacts = {};
        this.chats = {};
        this.groupMetadata = {};
        this.maxInMemory = 30; // Keep only 30 messages per chat in RAM
    }

    bind(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            messages.forEach(msg => {
                try {
                    if (msg.key && msg.key.remoteJid) {
                        const jid = msg.key.remoteJid;
                        
                        if (!this.messages[jid]) {
                            this.messages[jid] = [];
                        }
                        
                        this.messages[jid].push(msg);
                        
                        // Keep only recent messages in memory
                        if (this.messages[jid].length > this.maxInMemory) {
                            this.messages[jid].shift();
                        }
                    }
                } catch (error) {
                    console.error(chalk.red('❌ Error in store.bind:'), error.message);
                }
            });
        });

        ev.on('contacts.update', (contacts) => {
            try {
                contacts.forEach(contact => {
                    if (contact.id) {
                        this.contacts[contact.id] = contact;
                    }
                });
            } catch (error) {
                console.error(chalk.red('❌ Error updating contacts:'), error.message);
            }
        });

        ev.on('chats.set', (chats) => {
            try {
                this.chats = chats;
            } catch (error) {
                console.error(chalk.red('❌ Error setting chats:'), error.message);
            }
        });
    }

    loadMessage(jid, id) {
        try {
            if (this.messages[jid]) {
                const memMsg = this.messages[jid].find(m => m.key.id === id);
                if (memMsg) return memMsg;
            }
            return null;
        } catch (error) {
            console.error(chalk.red('❌ Error loading message:'), error.message);
            return null;
        }
    }

    // Write to file periodically
    writeToFile() {
        try {
            const data = {
                contacts: this.contacts,
                chats: this.chats,
                groupMetadata: this.groupMetadata
            };
            
            // Don't save messages (too large)
            fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
            
        } catch (error) {
            console.error(chalk.red('❌ Error writing store:'), error.message);
        }
    }

    // Read from file on startup
    readFromFile() {
        try {
            if (fs.existsSync(STORE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
                this.contacts = data.contacts || {};
                this.chats = data.chats || {};
                this.groupMetadata = data.groupMetadata || {};
                console.log(chalk.green('✅ Store loaded from disk'));
            }
        } catch (error) {
            console.error(chalk.yellow('⚠️ Could not load store:'), error.message);
        }
    }
}

const store = new LightweightStore();
export default store;