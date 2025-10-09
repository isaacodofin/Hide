// commands/updater.js
import fetch from 'node-fetch';
import axios from 'axios';
import moment from 'moment-timezone';
const  version  = global.version
import { getLatestVersion } from "../lib/getLatestVersion.js";
import chalk from 'chalk';
import fs  from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMIT_FILE = './data/commit-hash.txt';

function getCommitHash() {
    try {
        if (fs.existsSync(COMMIT_FILE)) {
            return fs.readFileSync(COMMIT_FILE, 'utf8').trim();
        }
        return null;
    } catch (error) {
        console.error('Error reading commit hash:', error);
        return null;
    }
}

function setCommitHash(hash) {
    try {
        const dataDir = path.dirname(COMMIT_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(COMMIT_FILE, hash);
        return true;
    } catch (error) {
        console.error('Error saving commit hash:', error);
        return false;
    }
}
export default [
    {
        name: 'update',
        aliases: ['upgrade', 'sync'],
        category: 'owner',
        description: 'Update the bot to the latest version',
        usage: '.update',
        
        execute: async (sock, message, args, context) => {
            const { chatId, senderIsSudo } = context;
            
            // Check if sender is owner or sudo
            if (!message.key.fromMe && !senderIsSudo) {
                return await context.reply('❌ This command is only for the bot owner.');
            }

            try {
                // Initial update check message
                await context.replyPlain('🔍 Checking for bot updates...');

                // Replace with your GitHub repo URL
                const REPO_OWNER = 'eminentboy11';
                const REPO_NAME = 'GIFT-MD';
                const BRANCH = 'main'; // or 'master'

                // Fetch the latest commit hash from GitHub
                const { data: commitData } = await axios.get(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`,
                    {
                        headers: {
                            'User-Agent': 'WhatsApp-Bot-Updater'
                        }
                    }
                );
                
                const latestCommitHash = commitData.sha;
                const currentHash = getCommitHash();

                if (latestCommitHash === currentHash) {
                    return await context.reply('✅ Bot is already up-to-date!');
                }

                // Update progress message
                await context.reply('🚀 Updating Bot...\n\nThis may take a few moments...');

                // Download the latest code
                const zipPath = path.join(__dirname, '../tmp/latest.zip');
                const tempDir = path.dirname(zipPath);
                
                // Ensure tmp directory exists
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const { data: zipData } = await axios.get(
                    `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/${BRANCH}.zip`,
                    { 
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'WhatsApp-Bot-Updater'
                        }
                    }
                );
                
                fs.writeFileSync(zipPath, zipData);

                // Extract ZIP file
                await context.replyPlain('📦 Extracting the latest code...');

                const extractPath = path.join(__dirname, '../tmp/latest');
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(extractPath, true);

                // Copy updated files
                await context.replyPlain('🔄 Replacing files while preserving your config...');
                const sourcePath = path.join(extractPath, `${REPO_NAME}-${BRANCH}`);
                const destinationPath = path.join(__dirname, '..');
                await context.replyPlain('🧹 Cleaning up old or unused files...');
clearExtraFiles(sourcePath, destinationPath);
                copyFolderSync(sourcePath, destinationPath);

                // Save the latest commit hash
                setCommitHash(latestCommitHash);

                // Cleanup
                fs.unlinkSync(zipPath);
                fs.rmSync(extractPath, { recursive: true, force: true });

                // Progress simulation
                let progressMsg = await context.replyPlain('🔄 Installing updates: [▒▒▒▒▒▒▒▒] 0%');
                
                const progressStages = [
                    '🔄 Installing updates: [████▒▒▒▒] 40%',
                    '🔄 Installing updates: [██████▒▒] 70%',
                    '🔄 Installing updates: [████████] 100%'
                ];
                
                for (const progress of progressStages) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    await context.replyPlain(progress);
                }

                // Final success message
                await context.replyPlain(
                    '✅ Update complete!\n\n' +
                    'Restarting the bot to apply changes...\n\n' +
                    '⚡ Powered by Gift MD'
                );

       // Restart the bot safely
setTimeout(() => {
    if (typeof global.restart === "function") {
        console.log("🔄 Restarting bot using manager restart()");
        global.restart();
    } else {
        console.log("⚠️ Manager not found. Exiting process...");
        process.exit(1); // fallback (PM2 / hosting panel will restart)
    }
}, 2000);
                
            } catch (error) {
                console.error('Update error:', error);
                await context.reply(
                    `❌ Update failed!\n\n` +
                    `Error: ${error.message}\n\n` +
                    `Please try manually or contact support.`
                );
            }
        }
    },

    {
        name: 'checkupdate',
        aliases: ['checkupgrade', 'updatecheck'],
        category: 'owner',
        description: 'Check if there are any updates available',
        usage: '.checkupdate',
        
        execute: async (sock, message, args, context) => {
            const { chatId, senderIsSudo } = context;
            
            // Check if sender is owner or sudo
            if (!message.key.fromMe && !senderIsSudo) {
                return await context.reply('❌ This command is only for the bot owner.');
            }

            try {
                // Initial check message
                await context.reply('🔍 Checking for bot updates...');

                // Replace with your GitHub repo URL
                const REPO_OWNER = 'eminentboy11';
                const REPO_NAME = 'GIFT-MD';
                const BRANCH = 'main'; // or 'master'

                // Fetch the latest commit info from GitHub
                const { data: commitData } = await axios.get(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`,
                    {
                        headers: {
                            'User-Agent': 'WhatsApp-Bot-Updater'
                        }
                    }
                );
                
                const latestCommitHash = commitData.sha;
                const latestCommitMessage = commitData.commit.message;
                const commitDate = new Date(commitData.commit.committer.date).toLocaleString();
                const author = commitData.commit.author.name;
                
                const currentHash = getCommitHash();
                const latestVersion = await getLatestVersion();

                if (latestCommitHash === currentHash) {
                    return await context.replyPlain(
                        `✅ Bot is up-to-date!\n\n` +
                        `Current Version: \`${latestVersion || 'Unknown'}\`\n` +
                        `Last Commit: ${latestCommitMessage}\n` +
                        `Date: ${commitDate}\n` +
                        `Author: ${author}`
                    );
                }

                // Get commit comparison to show what's new
                let changelog = '';
                try {
                    const { data: compareData } = await axios.get(
                        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${currentHash}...${latestCommitHash}`,
                        {
                            headers: {
                                'User-Agent': 'WhatsApp-Bot-Updater'
                            }
                        }
                    );
                    
                    if (compareData.commits && compareData.commits.length > 0) {
                        changelog = '\n\nWhat\'s New:\n';
                        compareData.commits.slice(0, 5).forEach(commit => {
                            changelog += `• ${commit.commit.message.split('\n')[0]}\n`;
                        });
                        
                        if (compareData.commits.length > 5) {
                            changelog += `• ...and ${compareData.commits.length - 5} more changes\n`;
                        }
                    }
                } catch (error) {
                    console.log('Could not fetch detailed changelog:', error.message);
                }
await context.replyPlain(
    `🆕 Update Available!\n\n` +
    `Current Version: \`${global.version || 'Unknown'}\`\n` +
    `Latest Version: \`${latestVersion || 'Unknown'}\`\n` +
    `Last Commit: ${latestCommitMessage}\n` +
    `Date: ${commitDate}\n` +
    `Author: ${author}${changelog}\n\n` +
    `Use .update to install the latest version.`
);
            } catch (error) {
                console.error('Update check error:', error);
                await context.reply(
                    `❌ Failed to check for updates!\n\n` +
                    `Error: ${error.message}\n\n` +
                    `Please try again later.`
                );
            }
        }
    },
    {
    name: "github",
    aliases: ["repo","script"],
    description: "Get GIFT MD repository information",
    category: "UTILITY MENU",
    usage: ".github",
    
    async execute(sock, m, args, context) {
        try {
            const chatId = m.key.remoteJid;
            
            // First send "loading" message
            let loadingMsg = await context.replyPlain( { text: '📦 Getting GIFT MD repo info...' }, { quoted: m });
                await context.react('♻️');
            // Fetch repo info
            const res = await fetch('https://api.github.com/repos/eminentboy11/GIFT-MD', {
                headers: { 'User-Agent': 'Gift-MD-Bot' }
            });

            if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

            const repo = await res.json();

            let caption = `📦 GIFT MD REPO INFO 📦\n\n`;
            caption += `🔹Name : ${repo.name}\n`;
            caption += `🔹Owner : ${repo.owner.login}\n`;
            caption += `🔹Private : ${repo.private ? 'Yes 🔒' : 'No 🌐'}\n`;
            caption += `🔹Size : ${(repo.size / 1024).toFixed(2)} MB\n`;
            caption += `🔹Stars : ${repo.stargazers_count}\n`;
            caption += `🔹Forks : ${repo.forks_count}\n`;
            caption += `🔹Watchers : ${repo.watchers_count}\n`;
            caption += `🔹Last Updated : ${moment(repo.updated_at).format('DD/MM/YY - HH:mm:ss')}\n`;
            caption += `🔹URL : ${repo.html_url}\n\n`;
            caption += `⭐Don't forget to star the repo!`;

            // ✅ Edit the "loading" message with repo info
            await context.replyPlain( { 
                text: caption, 
                edit: loadingMsg.key 
            });
            await context.react('🤠');
            // ✅ Now download the repo zip
            const zipUrl = `https://github.com/eminentboy11/GIFT-MD/archive/refs/heads/main.zip`;
            const zipPath = path.join(__dirname, "../tmp/repo.zip");
            fs.mkdirSync(path.dirname(zipPath), { recursive: true });

            const response = await axios.get(zipUrl, {
                responseType: "arraybuffer",
                headers: { "User-Agent": "Gift-MD" }
            });

            fs.writeFileSync(zipPath, response.data);

            // Send ZIP as document
            await context.replyPlain( {
                document: fs.readFileSync(zipPath),
                mimetype: "application/zip",
                fileName: `${repo.name}.zip`
            }, { quoted: loadingMsg });

            // Cleanup
            fs.unlinkSync(zipPath);

        } catch (error) {
            console.error('❌ GitHub Command Error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Failed to fetch repository information. Please try again later.' }, { quoted: m });
        }
    }
    }
];

function clearExtraFiles(repoPath, localPath) {
    const preservedFiles = [
        'settings.js',
        'data',
        'node_modules',
        '.npm',
        'tmp',
        'package.json',
        'package-lock.json',
        'index.js',
        'main.js',
        'lib',
        'plugins',
    ];

    const repoItems = fs.readdirSync(repoPath);
    const localItems = fs.readdirSync(localPath);

    for (const item of localItems) {
        const localItemPath = path.join(localPath, item);

        // Skip preserved folders/files
        if (preservedFiles.includes(item)) continue;

        // If not present in repo → delete it
        if (!repoItems.includes(item)) {
            try {
                fs.rmSync(localItemPath, { recursive: true, force: true });
                console.log(`🧹 Removed obsolete item: ${item}`);
            } catch (err) {
                console.error(`Failed to delete ${item}:`, err);
            }
        }
    }
}

// Improved directory copy function
function copyFolderSync(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(source);
    for (const item of items) {
        const srcPath = path.join(source, item);
        const destPath = path.join(target, item);

        // Skip sensitive files - ADD YOUR IMPORTANT FILES HERE
        const preservedFiles = [
            'settings.js', 
            'data',
            'node_modules',
            '.git',
            'session',
            'tmp'
        ];
        
        if (preservedFiles.includes(item)) {
            continue;
        }

        try {
            const stat = fs.lstatSync(srcPath);
            if (stat.isDirectory()) {
                copyFolderSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        } catch (copyError) {
            console.error(`Failed to copy ${item}:`, copyError);
        }
    }
}
