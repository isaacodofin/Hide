import settings from '../settings.js';
import isAdmin from './isAdmin.js';
import { getSetting } from './database.js';
import { channelInfo } from './messageConfig.js';
import { applyFontStyle } from './database.js';

function buildContext(sock, message, extra = {}) {

    const chatId = message.key.remoteJid;

    const sender = message.key.fromMe

        ? sock.user.id

        : (message.key.participant || message.key.remoteJid);

    // Fix: Better handling of sender ID

    let cleanSender = sender;

    if (sender.includes(':')) {

        cleanSender = sender.split(':')[0];

    }

    const isGroup = chatId.endsWith('@g.us');

    const isChannel = chatId.endsWith('@newsletter');

    const isPrivate = !isGroup && !isChannel;

    // ✅ ENHANCED: Better channel-aware sender number extraction

    let senderNumber = cleanSender.replace('@s.whatsapp.net', '').replace('@lid', '');

    // ✅ FIXED: Enhanced channel support - extract actual phone number

    if (isChannel) {

        // For channels, try multiple detection methods

        if (message.key.fromMe) {

            senderNumber = settings.ownerNumber || global.ownerLid;

        } else if (global.ownerLid && sender.includes(global.ownerLid)) {

            senderNumber = global.ownerLid;

        } else if (settings.ownerNumber && sender.includes(settings.ownerNumber)) {

            senderNumber = settings.ownerNumber;

        } else {

            // Extract number from various channel formats

            const numberMatch = sender.match(/(\d{10,15})/);

            if (numberMatch) {

                senderNumber = numberMatch[1];

            }

        }

    }

    // ✅ ENHANCED sudo check with better group participant detection

    

    const sudoUsers = getSetting('sudo', []);

    // ✅ FIXED: More comprehensive sudo detection for channels

    const senderIsSudo = message.key.fromMe || 

        senderNumber === settings.ownerNumber || 

        senderNumber === global.ownerLid ||
        senderNumber === global.channelLid ||
        cleanSender === settings.ownerNumber + '@s.whatsapp.net' ||

        cleanSender === global.ownerLid + '@s.whatsapp.net' ||

        // ✅ NEW: Direct channel owner detection

        // ✅ NEW: Direct channel owner detection
    (isChannel && (
        sender.includes(settings.ownerNumber) ||
        sender.includes(global.ownerLid) ||
        sender.includes(global.channelLid) ||  // ← ADD THIS LINE
        senderNumber === settings.ownerNumber ||
        senderNumber === global.ownerLid ||
        senderNumber === global.channelLid  // ← ADD THIS LINE
    )) ||
        // Check various sudo formats

        (Array.isArray(sudoUsers) && (

            sudoUsers.includes(senderNumber) || 

            sudoUsers.includes(cleanSender) ||

            sudoUsers.includes(senderNumber + '@s.whatsapp.net') ||

            sudoUsers.includes(cleanSender.replace('@s.whatsapp.net', ''))
        )) ||

        // Fallback to settings.sudo if it exists

        (settings.sudo && Array.isArray(settings.sudo) && (

            settings.sudo.includes(senderNumber) || 

            settings.sudo.includes(cleanSender) ||

            settings.sudo.includes(senderNumber + '@s.whatsapp.net') ||

            settings.sudo.includes(cleanSender.replace('@s.whatsapp.net', ''))
        ));

    // Enhanced message text extraction

    const rawText = message.message?.conversation?.trim() ||

        message.message?.extendedTextMessage?.text?.trim() ||

        message.message?.imageMessage?.caption?.trim() ||

        message.message?.videoMessage?.caption?.trim() ||

        message.message?.documentMessage?.caption?.trim() ||

        '';

    const userMessage = rawText.toLowerCase()

        .replace(/\.\s+/g, '.')

        .trim();

    // Message metadata

    const messageId = message.key.id;

    const timestamp = message.messageTimestamp;

    const isFromOwner = message.key.fromMe;

    

    // Message type detection

    const messageType = Object.keys(message.message || {})[0];

    const hasMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(messageType);

    const hasQuotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    

    // Group admin checks

    let isSenderAdmin = false;

    let isBotAdmin = false;

    if ((isGroup || isChannel) && extra.isAdminCheck) {

        const adminStatus = extra.adminStatus || {};

        isSenderAdmin = adminStatus.isSenderAdmin || false;

        isBotAdmin = adminStatus.isBotAdmin || false;

    }

    // Extract mentions if any

    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    const isBotMentioned = mentions.includes(sock.user.id);

    // Default External Ad Reply configuration

    const defaultExternalAdReply = {

        title: `♻️ GIFT MD`,

        body: `Ⓜ️ Status: Online | 😎 Version: ${settings.version}`,

        thumbnailUrl: "https://files.catbox.moe/hoqhfi.jpeg",

        sourceUrl: "https://github.com/mruniquehacker/Knightbot-MD",

        mediaType: 1,

        showAdAttribution: false,

        renderLargerThumbnail: false

    };

    // Enhanced reply function that works with all message types and text properties

    const reply = async (content, options = {}) => {

        const useExternalAd = options.externalAdReply !== false;

        const customExternalAd = options.externalAdReply === true ? defaultExternalAdReply : options.externalAdReply;

        

        try {        

            const currentStyle = getSetting('fontstyle', 'normal');

            

            let messageOptions = {

                ...channelInfo,

                ...options

            };

            // Handle different content types

            if (typeof content === 'string') {

                // Plain string - apply font styling

                const formattedText = applyFontStyle(content);

                messageOptions.text = formattedText;

                

            } else if (typeof content === 'object' && content !== null) {

                // Object content - copy all properties and apply styling to text fields

                messageOptions = { ...messageOptions, ...content };

                

                // Apply font styling to 'text' property if it exists

                if (content.text && typeof content.text === 'string') {

                    const formattedText = applyFontStyle(content.text);

                    messageOptions.text = formattedText;

                }

                

                // Apply font styling to 'caption' property if it exists

                if (content.caption && typeof content.caption === 'string') {

                    const formattedCaption = applyFontStyle(content.caption);

                    messageOptions.caption = formattedCaption;

                }

            }

            

            // Add external ad reply if enabled

            if (useExternalAd) {

                messageOptions.contextInfo = {

                    ...messageOptions.contextInfo,

                    externalAdReply: customExternalAd || defaultExternalAdReply

                };

            }

            

            // Clean up the externalAdReply option to avoid conflicts

            delete messageOptions.externalAdReply;

            

            return await sock.sendMessage(chatId, messageOptions, { quoted: message });

            

        } catch (error) {

            console.error('❌ Error in enhanced reply function:', error);

            

            // Fallback without font styling

            let fallbackOptions = {

                ...channelInfo,

                ...options

            };

            

            if (typeof content === 'string') {

                fallbackOptions.text = content;

            } else if (typeof content === 'object' && content !== null) {

                fallbackOptions = { ...fallbackOptions, ...content };

            }

            

            if (useExternalAd) {

                fallbackOptions.contextInfo = {

                    ...fallbackOptions.contextInfo,

                    externalAdReply: customExternalAd || defaultExternalAdReply

                };

            }

            

            delete fallbackOptions.externalAdReply;

            return await sock.sendMessage(chatId, fallbackOptions, { quoted: message });

        }

    };

        

    const react = async (emoji) => {

        return await sock.sendMessage(chatId, {

            react: {

                text: emoji,

                key: message.key

            }

        });

    };

    const replyWithAd = async (content, customAd = {}, options = {}) => {

        const externalAdReply = { ...defaultExternalAdReply, ...customAd };

        return await reply(content, { ...options, externalAdReply });

    };

    const replyPlain = async (content, options = {}) => {

        try {      

            let messageOptions = {

                ...channelInfo,   // ✅ keeps "View channel" & forwarded label (NO ads)

                ...options

            };

            // Handle different content types (same logic as reply() but NO external ads)

            if (typeof content === 'string') {

                // Plain string - apply font styling

                const formattedText = applyFontStyle(content);

                messageOptions.text = formattedText;

                

            } else if (typeof content === 'object' && content !== null) {

                // Object content - copy all properties and apply styling to ALL text fields

                messageOptions = { ...messageOptions, ...content };

                

                // Apply font styling to ALL possible text properties

                const textProperties = [

                    'text', 'caption', 'title', 'body', 'footer', 

                    'headerText', 'footerText', 'buttonText', 'description'

                ];

                

                textProperties.forEach(prop => {

                    if (content[prop] && typeof content[prop] === 'string') {

                        messageOptions[prop] = applyFontStyle(content[prop]);

                    }

                });

                

                // Handle nested text in buttons, sections, etc.

                if (content.buttons && Array.isArray(content.buttons)) {

                    messageOptions.buttons = content.buttons.map(button => ({

                        ...button,

                        buttonText: button.buttonText && typeof button.buttonText === 'object' ? {

                            ...button.buttonText,

                            displayText: button.buttonText.displayText ? 

                                applyFontStyle(button.buttonText.displayText) : 

                                button.buttonText.displayText

                        } : button.buttonText

                    }));

                }

                

                // Handle sections in list messages

                if (content.sections && Array.isArray(content.sections)) {

                    messageOptions.sections = content.sections.map(section => ({

                        ...section,

                        title: section.title ? applyFontStyle(section.title) : section.title,

                        rows: section.rows ? section.rows.map(row => ({

                            ...row,

                            title: row.title ? applyFontStyle(row.title) : row.title,

                            description: row.description ? applyFontStyle(row.description) : row.description

                        })) : section.rows

                    }));

                }

            }

            return await sock.sendMessage(chatId, messageOptions, { quoted: message });

        } catch (error) {

            console.error('❌ Error in replyPlain function:', error);

            

            // Fallback without font styling

            let fallbackOptions = {

                ...channelInfo, 

                ...options

            };

            

            if (typeof content === 'string') {

                fallbackOptions.text = content;

            } else if (typeof content === 'object' && content !== null) {

                fallbackOptions = { ...fallbackOptions, ...content };

            }

            

            return await sock.sendMessage(chatId, fallbackOptions, { quoted: message });

        }

    };

    // ✅ DEBUG: Log sudo detection for channels

    if (isChannel) {

        console.log(`🔍 SUDO DEBUG:`);

        console.log(`   Sender Number: ${senderNumber}`);

        console.log(`   Settings Owner: ${settings.ownerNumber}`);

        console.log(`   Global Owner LID: ${global.ownerLid}`);

        console.log(`   Is Sudo: ${senderIsSudo}`);

        console.log(`   From Me: ${message.key.fromMe}`);

    }

    return {

        // Basic info

        chatId,

        sender,

        cleanSender,

        senderNumber, // Added this for debugging

        isGroup,

        isChannel,

        isPrivate,

        messageId,

        timestamp,

        

        // Permission checks

        isSenderAdmin,

        isBotAdmin,

        senderIsSudo,

        isFromOwner,

        

        // Message content

        userMessage,

        rawText,

        messageType,

        hasMedia,

        hasQuotedMessage,

        

        // Social features

        mentions,

        isBotMentioned,

        

        // Configuration

        defaultExternalAdReply,

        

        // Reply functions

        reply,

        react,

        replyWithAd,

        replyPlain

    };

}

export { buildContext };