import messageStore from '../lib/messageStore.js';

export default [
{
    name: 'msgstats',
    aliases: ['messagestats', 'dbstats'],
    category: 'owner',
    description: 'Get message database statistics',
    usage: '.msgstats',
    
    execute: async (sock, message, args, context) => {
        const { reply, senderIsSudo } = context;
        
        if (!senderIsSudo) {
            return await reply('❌ This command is only for bot owners!');
        }
        
        try {
            const stats = messageStore.getStats();
            
            const statsText = `
📊 *MESSAGE DATABASE STATS*

📨 Total Messages: ${stats.totalMessages}
💾 Database Size: ${stats.dbSize}
🔄 Storage Type: Hybrid (RAM + SQLite)
⏳ Retention: 7 days

✅ System Status: Active
`.trim();
            
            await reply(statsText);
            
        } catch (error) {
            await reply('❌ Error getting stats: ' + error.message);
        }
    }
},
 {
    name: 'cleanmsgs',
    aliases: ['cleanupmessages'],
    category: 'owner',
    description: 'Cleanup old messages from database',
    usage: '.cleanmsgs <days>',
    
    execute: async (sock, message, args, context) => {
        const { reply, senderIsSudo } = context;
        
        if (!senderIsSudo) {
            return await reply('❌ This command is only for bot owners!');
        }
        
        try {
            const days = parseInt(args[1]) || 7;
            
            if (days < 1 || days > 365) {
                return await reply('❌ Please specify days between 1-365');
            }
            
            const statsBefore = messageStore.getStats();
            await reply(`🗑️ Cleaning messages older than ${days} days...`);
            
            messageStore.cleanup(days);
            
            const statsAfter = messageStore.getStats();
            const deleted = statsBefore.totalMessages - statsAfter.totalMessages;
            
            await reply(`✅ Cleanup complete!\n\n🗑️ Deleted: ${deleted} messages\n📨 Remaining: ${statsAfter.totalMessages}\n💾 Size: ${statsAfter.dbSize}`);
            
        } catch (error) {
            await reply('❌ Error during cleanup: ' + error.message);
        }
    }
}
];
