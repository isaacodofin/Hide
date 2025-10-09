import axios from 'axios';

import fetch from 'node-fetch';

export default[
    {

    name: 'gpt',

    aliases: ['gpt'],

    category: 'ai',

    description: 'Chat with Gpt (GPT)',

    usage: '.gpt <question> ',

    execute: async (sock, message, args, context) => {

        const { chatId, channelInfo } = context;

        

        const query = args.slice(1).join(' ').trim();

        

        if (!query) {

            return await context.reply("Please provide a question after .gpt \n\nExample: .gpt write a basic html code");

        }

        try {

            await sock.sendMessage(chatId, {

                react: { text: '🤖', key: message.key }

            });

            const command = args[0].toLowerCase();

            if (command === 'gpt') {

                const response = await axios.get(`https://api.dreaded.site/api/chatgpt?text=${encodeURIComponent(query)}`);

                

                if (response.data && response.data.success && response.data.result) {

                    const answer = response.data.result.prompt;

                    await context.reply(answer);

                } else {

                    throw new Error('Invalid response from API');

                }

            }

        } catch (error) {

            console.error('API Error:', error);

            await sock.sendMessage(chatId, {

                text: "❌ Failed to get response. Please try again later.",

                ...channelInfo

            }, { quoted: message });

        }

    }

},
 {
    name: 'sora',
    aliases: ['txt2video', 'soraai'],
    description: 'Generate AI video from text prompt using Sora AI',
    usage: '.sora <prompt>\nExample: .sora anime girl with short blue hair',
    execute: async (sock, message, args, context) => {
        const { chatId, reply, react } = context;

        try {
            const input = args.slice(1).join(' ');

            if (!input) {
                return await reply('❌ Provide a prompt.\n\n📝 Example: .sora anime girl with short blue hair');
            }

            await react('⏳');

            const apiUrl = `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(input)}`;
            const { data } = await axios.get(apiUrl, { 
                timeout: 60000, 
                headers: { 'user-agent': 'Mozilla/5.0' } 
            });

            const videoUrl = data?.videoUrl || data?.result || data?.data?.videoUrl;
            
            if (!videoUrl) {
                throw new Error('No videoUrl in API response');
            }

            await react('✅');

            await sock.sendMessage(chatId, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `✨ Sora AI Video\n\n📝 Prompt: ${input}`
            }, { quoted: message });

        } catch (error) {
            console.error('[SORA] error:', error?.message || error);
            await react('❌');
            await reply('⚠️ Failed to generate video. Try a different prompt later.');
        }
    }
} ]
