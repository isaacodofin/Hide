// lib/isAdmin.js - Fixed with null safety
async function isAdmin(sock, chatId, senderId) {
    try {
        // ✅ Validate inputs first
        if (!sock || !chatId) {
            
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        // ✅ Handle null/undefined senderId
        if (!senderId) {
            
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        
        if (!groupMetadata || !groupMetadata.participants) {
            console.error('❌ Could not get group metadata');
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        // ✅ Safe bot ID extraction
        let botId = sock.user.id;
        if (botId.includes(':')) {
            botId = botId.split(':')[0] + '@s.whatsapp.net';
        } else if (!botId.includes('@')) {
            botId = botId + '@s.whatsapp.net';
        }

        // ✅ Normalize senderId safely
        let normalizedSenderId = senderId;
        if (typeof senderId === 'string') {
            if (senderId.includes(':')) {
                normalizedSenderId = senderId.split(':')[0];
            }
            if (!normalizedSenderId.includes('@')) {
                normalizedSenderId = normalizedSenderId + '@s.whatsapp.net';
            }
        }

        // ✅ Find participant with multiple format matching
        const participant = groupMetadata.participants.find(p => {
            if (!p || !p.id) return false;
            
            const participantId = p.id.split(':')[0]; // Remove device suffix
            const searchId = normalizedSenderId.split(':')[0];
            
            // Match base numbers
            const participantNumber = participantId.replace(/@.*/, '');
            const searchNumber = searchId.replace(/@.*/, '');
            
            return participantNumber === searchNumber;
        });

        // ✅ Find bot participant
        const bot = groupMetadata.participants.find(p => {
            if (!p || !p.id) return false;
            
            const participantId = p.id.split(':')[0];
            const botNumber = botId.split(':')[0].replace(/@.*/, '');
            const participantNumber = participantId.replace(/@.*/, '');
            
            return participantNumber === botNumber;
        });

        const isBotAdmin = bot ? (bot.admin === 'admin' || bot.admin === 'superadmin') : false;
        const isSenderAdmin = participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;

        // Debug logging
        
        

        return { isSenderAdmin, isBotAdmin };

    } catch (error) {
        console.error('❌ Error in isAdmin:', error.message);
        console.error('Stack:', error.stack);
        
        // Safe fallback
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

export default isAdmin;
