import {getSudo,isSudo} from './database.js';
import settings from '../settings.js';
import isAdmin from './isAdmin.js';
import { getSetting } from './database.js';
import { getChatId, getSenderId } from './myfunc.js';
import { channelInfo } from './messageConfig.js';
import { applyFontStyle } from './database.js';

function buildContext(sock, message, extra = {}) {

    const chatId = getChatId(message);
    const sender = getSenderId(message, sock);

    // Fix: Better handling of sender ID
    let cleanSender = sender;
    if (sender.includes(':')) {
        cleanSender = sender.split(':')[0];
    }

    const isGroup = chatId.endsWith('@g.us');
    const isChannel = chatId.endsWith('@newsletter');
    const isPrivate = !isGroup && !isChannel;

    let senderNumber = cleanSender.replace('@s.whatsapp.net', '').replace('@lid', '');

    const sudoUsers = getSudo('sudo', []);
    
    const senderIsSudo = message.key.fromMe || 
        senderNumber === settings.ownerNumber || 
        senderNumber === global.ownerLid ||
        senderNumber === global.channelLid ||
        cleanSender === settings.ownerNumber + '@s.whatsapp.net' ||
        cleanSender === global.ownerLid + '@s.whatsapp.net' ||
        (isChannel && (
            sender.includes(settings.ownerNumber) ||
            sender.includes(global.ownerLid) ||
            sender.includes(global.channelLid) ||
            senderNumber === settings.ownerNumber ||
            senderNumber === global.ownerLid ||
            senderNumber === global.channelLid
        )) ||
        (Array.isArray(sudoUsers) && (
            sudoUsers.includes(senderNumber) || 
            sudoUsers.includes(cleanSender) ||
            sudoUsers.includes(senderNumber + '@s.whatsapp.net') ||
            sudoUsers.includes(cleanSender.replace('@s.whatsapp.net', ''))
        )) ||
        (settings.sudo && Array.isArray(settings.sudo) && (
            settings.sudo.includes(senderNumber) || 
            settings.sudo.includes(cleanSender) ||
            settings.sudo.includes(senderNumber + '@s.whatsapp.net') ||
            settings.sudo.includes(cleanSender.replace('@s.whatsapp.net', ''))
        ));

    const rawText = message.message?.conversation?.trim() ||
        message.message?.extendedTextMessage?.text?.trim() ||
        message.message?.imageMessage?.caption?.trim() ||
        message.message?.videoMessage?.caption?.trim() ||
        message.message?.documentMessage?.caption?.trim() ||
        '';
    
    console.log('rawText', rawText);
    
    const userMessage = rawText.toLowerCase()
        .replace(/\.\s+/g, '.')
        .trim();

    const messageId = message.key.id;
    const timestamp = message.messageTimestamp;
    const isFromOwner = message.key.fromMe;

    const messageType = Object.keys(message.message || {})[0];
    const hasMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(messageType);
    const hasQuotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    let isSenderAdmin = false;
    let isBotAdmin = false;
    if ((isGroup || isChannel) && extra.isAdminCheck) {
        const adminStatus = extra.adminStatus || {};
        isSenderAdmin = adminStatus.isSenderAdmin || false;
        isBotAdmin = adminStatus.isBotAdmin || false;
    }

    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isBotMentioned = mentions.includes(sock.user.id);

    const defaultExternalAdReply = {
        title: `♻️ GIFT MD`,
        body: `Ⓜ️ Status: Online | 😎 Version: ${settings.version}`,
        thumbnailUrl: "https://files.catbox.moe/hoqhfi.jpeg",
        sourceUrl: "https://github.com/mruniquehacker/Knightbot-MD",
        mediaType: 1,
        showAdAttribution: false,
        renderLargerThumbnail: false
    };

    // ✅ 1. REACT (No dependencies)
    const react = async (emoji) => {
        return await sock.sendMessage(chatId, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    };

    // ✅ 2. REPLY (No dependencies)
    const reply = async (content, options = {}) => {
        const useExternalAd = options.externalAdReply !== false;
        const customExternalAd = options.externalAdReply === true ? defaultExternalAdReply : options.externalAdReply;
        
        try {        
            const currentStyle = getSetting('fontstyle', 'normal');
            
            let messageOptions = {
                ...channelInfo,
                ...options
            };

            if (typeof content === 'string') {
                const formattedText = applyFontStyle(content);
                messageOptions.text = formattedText;
            } else if (typeof content === 'object' && content !== null) {
                messageOptions = { ...messageOptions, ...content };
                
                if (content.text && typeof content.text === 'string') {
                    messageOptions.text = applyFontStyle(content.text);
                }
                
                if (content.caption && typeof content.caption === 'string') {
                    messageOptions.caption = applyFontStyle(content.caption);
                }
            }
            
            if (useExternalAd) {
                messageOptions.contextInfo = {
                    ...messageOptions.contextInfo,
                    externalAdReply: customExternalAd || defaultExternalAdReply
                };
            }
            
            delete messageOptions.externalAdReply;
            
            const sendMessageOptions = {};
            
            if (options.quoted !== undefined) {
                sendMessageOptions.quoted = options.quoted;
            } else {
                sendMessageOptions.quoted = message;
            }
            
            const validSendOptions = [
                'messageId', 'cachedGroupMetadata', 'additionalAttributes',
                'ephemeralExpiration', 'statusJidList', 'backgroundColor',
                'font', 'useJoinedVoice', 'ptt', 'seconds', 'gifPlayback',
'jpegThumbnail', 'contextInfo', 'mentions'
            ];
            
            validSendOptions.forEach(opt => {
                if (options[opt] !== undefined && !messageOptions[opt]) {
                    sendMessageOptions[opt] = options[opt];
                }
            });
            
            delete messageOptions.quoted;
            validSendOptions.forEach(opt => delete messageOptions[opt]);
            
            return await sock.sendMessage(chatId, messageOptions, sendMessageOptions);
            
        } catch (error) {
            console.error('❌ Error in enhanced reply function:', error);
            
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
            
            const sendMessageOptions = {};
            if (options.quoted !== undefined) {
                sendMessageOptions.quoted = options.quoted;
            } else {
                sendMessageOptions.quoted = message;
            }
            
            return await sock.sendMessage(chatId, fallbackOptions, sendMessageOptions);
        }
    };

    // ✅ 3. REPLYPLAIN (No dependencies)
    const replyPlain = async (content, options = {}) => {
        try {      
            let messageOptions = {
                ...channelInfo,
                ...options
            };

            if (typeof content === 'string') {
                const formattedText = applyFontStyle(content);
                messageOptions.text = formattedText;
            } else if (typeof content === 'object' && content !== null) {
                messageOptions = { ...messageOptions, ...content };
                
                const textProperties = [
                    'text', 'caption', 'title', 'body', 'footer', 
                    'headerText', 'footerText', 'buttonText', 'description'
                ];
                
                textProperties.forEach(prop => {
                    if (content[prop] && typeof content[prop] === 'string') {
                        messageOptions[prop] = applyFontStyle(content[prop]);
                    }
                });
                
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
            
            const sendMessageOptions = {};
            
            if (options.quoted !== undefined) {
                sendMessageOptions.quoted = options.quoted;
            } else {
                sendMessageOptions.quoted = message;
            }
            
            const validSendOptions = [
                'messageId', 'cachedGroupMetadata', 'additionalAttributes',
                'ephemeralExpiration', 'statusJidList', 'backgroundColor',
                'font', 'useJoinedVoice', 'ptt', 'seconds', 'gifPlayback', 'jpegThumbnail', 'contextInfo', 'mentions'
            ];
            
            validSendOptions.forEach(opt => {
                if (options[opt] !== undefined && !messageOptions[opt]) {
                    sendMessageOptions[opt] = options[opt];
                }
            });
            
            delete messageOptions.quoted;
            validSendOptions.forEach(opt => delete messageOptions[opt]);
            
            return await sock.sendMessage(chatId, messageOptions, sendMessageOptions);
            
        } catch (error) {
            console.error('❌ Error in replyPlain function:', error);
            
            let fallbackOptions = {
                ...channelInfo, 
                ...options
            };
            
            if (typeof content === 'string') {
                fallbackOptions.text = content;
            } else if (typeof content === 'object' && content !== null) {
                fallbackOptions = { ...fallbackOptions, ...content };
            }
            
            const sendMessageOptions = {};
            if (options.quoted !== undefined) {
                sendMessageOptions.quoted = options.quoted;
            } else {
                sendMessageOptions.quoted = message;
            }
            
            return await sock.sendMessage(chatId, fallbackOptions, sendMessageOptions);
        }
    };

    // ✅ 4. REPLYWITHAD (Depends on reply - must come LAST)
    const replyWithAd = async (content, customAd = {}, options = {}) => {
        const externalAdReply = { ...defaultExternalAdReply, ...customAd };
        return await reply(content, { ...options, externalAdReply });
    };

    return {
        // Basic info
        chatId,
        sender,
        cleanSender,
        senderNumber,
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
        react,
        reply,
        replyPlain,
        replyWithAd
    };
}

export { buildContext };
