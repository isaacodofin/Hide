import {
     getSetting, 
     updateSetting
} from '../lib/database.js';
import { 
    getCurrentTimezone, 
    setTimezone, 
    resetTimezone,
    getCurrentTime, 
    formatTimezoneList, 
    findTimezone,
    DEFAULT_TIMEZONE 
} from '../lib/myfunc.js';

export default [
    {
        name: 'timezone',
        aliases: ['tz', 'time'],
        category: 'SETTINGS MENU',
        description: 'Show current timezone and time',
        execute: async (sock, message, args, context) => {
            const currentTz = getCurrentTimezone();
            const currentTime = getCurrentTime('full');
            
            const info = `🕐 *Timezone Info*\n\n` +
                `📍 Current Timezone: ${currentTz}\n` +
                `🕰️ Current Time: ${currentTime}\n\n` +
                `Use *${global.prefix}settimezone <zone>* to change\n` +
                `Use *${global.prefix}timezones* to see all options`;
            
            await context.reply(info);
        }
    },
    
    {
        name: 'settimezone',
        aliases: ['settz', 'changetimezone'],
        category: 'SETTINGS MENU',
        description: 'Set bot timezone',
        execute: async (sock, message, args, context) => {
            if (!context.senderIsSudo) {
                return context.reply('❌ Only the owner can change timezone!');
            }
            
            const timezone = args.slice(1).join('/'); // Handle "Africa Lagos" → "Africa/Lagos"
            
            if (!timezone) {
                return context.reply(
                    `❌ Please provide a timezone!\n\n` +
                    `Example:\n` +
                    `${global.prefix}settimezone Africa/Lagos\n` +
                    `${global.prefix}settimezone America/New_York\n\n` +
                    `Use *${global.prefix}timezones* to see all options\n` +
                    `Use *${global.prefix}findtz <name>* to search`
                );
            }
            
            // Try to format input (handle both "Africa/Lagos" and "Africa Lagos")
            let formattedTz = timezone;
            if (!timezone.includes('/') && args.length >= 3) {
                formattedTz = `${args[1]}/${args[2]}`;
            }
            
            const result = setTimezone(formattedTz);
            
            if (result.success) {
                const newTime = getCurrentTime('full');
                await context.reply(
                    `✅ ${result.message}\n\n` +
                    `🕰️ Current time: ${newTime}`
                );
            } else {
                // Try to find similar timezones
                const suggestions = findTimezone(timezone.split('/').pop() || timezone);
                let suggestionText = '';
                
                if (suggestions.length > 0 && suggestions.length <= 5) {
                    suggestionText = `\n\nDid you mean:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
                }
                
                await context.reply(`❌ ${result.message}${suggestionText}`);
            }
        }
    },
    
    {
        name: 'timezones',
        aliases: ['tzlist', 'timezonelist'],
        category: 'SETTINGS MENU',
        description: 'List all available timezones',
        execute: async (sock, message, args, context) => {
            const list = formatTimezoneList();
            const currentTz = getCurrentTimezone();
            
            const output = `🌍 *Available Timezones*\n\n` +
                `📍 Current: ${currentTz}\n` +
                `${list}\n\n` +
                `Use *${global.prefix}settimezone <zone>* to change`;
            
            await context.reply(output);
        }
    },
    
    {
        name: 'findtz',
        aliases: ['searchtz', 'findtimezone'],
        category: 'SETTINGS MENU',
        description: 'Search for a timezone',
        execute: async (sock, message, args, context) => {
            const search = args.slice(1).join(' ');
            
            if (!search) {
                return context.reply(
                    `❌ Please provide a search term!\n\n` +
                    `Example:\n` +
                    `${global.prefix}findtz lagos\n` +
                    `${global.prefix}findtz new york\n` +
                    `${global.prefix}findtz tokyo`
                );
            }
            
            const results = findTimezone(search);
            
            if (results.length === 0) {
                await context.reply(`❌ No timezones found matching "${search}"`);
            } else if (results.length > 10) {
                await context.reply(
                    `🔍 Found ${results.length} results. Showing first 10:\n\n` +
                    results.slice(0, 10).map((tz, i) => `${i + 1}. ${tz}`).join('\n') +
                    `\n\nTry a more specific search.`
                );
            } else {
                await context.reply(
                    `🔍 *Found ${results.length} timezone(s):*\n\n` +
                    results.map((tz, i) => `${i + 1}. ${tz}`).join('\n') +
                    `\n\nUse *${global.prefix}settimezone <zone>* to set`
                );
            }
        }
    },
    
    {
        name: 'resettimezone',
        aliases: ['resettz'],
        category: 'SETTINGS MENU',
        description: 'Reset timezone to default',
        execute: async (sock, message, args, context) => {
            if (!context.senderIsSudo) {
                return context.reply('❌ Only the owner can reset timezone!');
            }
            
            const result = resetTimezone();
            const newTime = getCurrentTime('full');
            
            await context.reply(
                `✅ ${result.message}\n\n` +
                `🕰️ Current time: ${newTime}`
            );
        }
    }
];
