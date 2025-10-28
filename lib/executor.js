import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global maps
global.commands = new Map();
global.aliases = new Map();
global.fileCategories = {}; // File-based categories

// 🔄 Reload command file
async function reloadCommandFile(filePath) {
    try {
        const fileUrl = `file://${filePath}?update=${Date.now()}`; // bust cache
        let commandsExport = await import(fileUrl);

        if (commandsExport.default) {
            commandsExport = commandsExport.default;
        }
        if (!Array.isArray(commandsExport)) {
            commandsExport = [commandsExport];
        }

        // Remove old command(s) from this file
        global.commands.forEach((cmd, name) => {
            if (cmd.filePath === filePath) {
                global.commands.delete(name);
            }
        });

        // Register new command(s)
        const fileName = path.basename(filePath, '.js');
        const categoryName = fileName.toUpperCase() + ' CMD';

        commandsExport.forEach(command => {
            if (!command.name || typeof command.execute !== 'function') return;
            command.filePath = filePath; // track origin

            global.commands.set(command.name, command);

            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    global.aliases.set(alias, command);
                });
            }

            if (!global.fileCategories[categoryName]) {
                global.fileCategories[categoryName] = [];
            }
            if (!global.fileCategories[categoryName].includes(command.name)) {
                global.fileCategories[categoryName].push(command.name);
            }
        });

        
    } catch (err) {
        console.error(chalk.red(`❌ Reload failed for ${path.basename(filePath)}: ${err.message}`));
    }
}

// Initial load
async function loadCommandFile(filePath) {
    try {
        const fileUrl = `file://${filePath}`;
        let commandsExport = await import(fileUrl);

        if (commandsExport.default) {
            commandsExport = commandsExport.default;
        }
        if (!Array.isArray(commandsExport)) {
            commandsExport = [commandsExport];
        }

        const fileName = path.basename(filePath, '.js');
        const categoryName = fileName.toUpperCase() + ' CMD';

        commandsExport.forEach(command => {
            if (!command.name || typeof command.execute !== 'function') return;
            command.filePath = filePath; // track origin

            global.commands.set(command.name, command);

            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    global.aliases.set(alias, command);
                });
            }

            if (!global.fileCategories[categoryName]) {
                global.fileCategories[categoryName] = [];
            }
            if (!global.fileCategories[categoryName].includes(command.name)) {
                global.fileCategories[categoryName].push(command.name);
            }
        });

    } catch (err) {
        console.error(chalk.red(`❌ Failed to load command ${path.basename(filePath)}: ${err.message}`));
    }
}

async function loadCommands() {
    const commandsPath = path.join(__dirname, '..', 'plugins');

    // Clear existing categories
    global.fileCategories = {};

    async function readDirRecursive(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await readDirRecursive(entryPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                await loadCommandFile(entryPath);
            }
        }
    }

    await readDirRecursive(commandsPath);

    // Sort commands within each category alphabetically
    for (const category in global.fileCategories) {
        global.fileCategories[category].sort();
    }

    // Watch for changes → auto reload
    fs.watch(commandsPath, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.js')) return;
        const filePath = path.join(commandsPath, filename);

        if (fs.existsSync(filePath)) {
            console.log(chalk.yellowBright(`[GIFT-MD] ♻️ Detected change in: ${filename}`));
            reloadCommandFile(filePath); // reload immediately
        } else {
            console.log(chalk.redBright(`[GIFT-MD] 🗑️ File deleted: ${filename}`));
            // Remove from maps
            global.commands.forEach((cmd, name) => {
                if (cmd.filePath === filePath) global.commands.delete(name);
            });
        }
    });
}
console.log(chalk.greenBright(`[GIFT-MD] ✅ plugins loaded`));
export { loadCommands };
export const commands = global.commands;
export const aliases = global.aliases;
export const categories = global.fileCategories; // Export file-based categories
