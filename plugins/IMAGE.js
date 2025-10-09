import axios from "axios";

import FormData from 'form-data';

import { handleMediaUpload } from '../lib/catbox.js';

import { downloadContentFromMessage, downloadMediaMessage } from '@whiskeysockets/baileys';

import fs from 'fs';

export default [

  {

    name: 'remini',

    aliases: ['enhance', 'hd'],

    category: 'image',

    execute: async (sock, message, args, context) => {

      await context.react("✨");

      

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      

      if (!quoted) {

        return context.reply("Send or reply to an image.");

      }

      

      const messageType = Object.keys(quoted)[0];

      if (!['imageMessage'].includes(messageType)) {

        return context.reply(`Send or reply to an image with caption: ${global.prefix}remini`);

      }

      

      try {

        const mediaUrl = await handleMediaUpload(quoted, sock, messageType);

        if (!mediaUrl) return context.reply("Failed to upload image for processing.");

        

        const encodedUrl = encodeURIComponent(mediaUrl);

        const apiUrl = `https://api.siputzx.my.id/api/iloveimg/upscale?image=${encodedUrl}`;

        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

        

        await sock.sendMessage(

          context.chatId, 

          { 

            image: Buffer.from(response.data),

            caption: "Image enhanced successfully" 

          }, 

          { quoted: message }

        );

      } catch (error) {

        console.error(error);

        context.reply("An error occurred while enhancing the image.");

      }

    }

  },

  

  {

    name: 'wallpaper',

    category: 'image',

    execute: async (sock, message, args, context) => {

      await context.react("🖼️");

      

      const text = args.slice(1).join(' ');

      if (!text) return context.reply("Enter a search query.");

      

      try {

        // Using a free wallpaper API

        const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(text)}&per_page=30&client_id=demo`;

        

        try {

          const response = await axios.get(apiUrl);

          const results = response.data.results;

          

          if (!results.length) return context.reply("No wallpapers found.");

          

          const randomWallpaper = results[Math.floor(Math.random() * results.length)];

          await sock.sendMessage(

            context.chatId,

            {

              caption: `Title: ${randomWallpaper.description || randomWallpaper.alt_description || "Untitled"}\nBy: ${randomWallpaper.user.name}\nSource: Unsplash\nResolution: ${randomWallpaper.width}x${randomWallpaper.height}`,

              image: { url: randomWallpaper.urls.regular }

            },

            { quoted: message }

          );

        } catch (apiError) {

          // Fallback to a simpler API

          const fallbackUrl = `https://source.unsplash.com/1080x1920/?${encodeURIComponent(text)}`;

          

          await sock.sendMessage(

            context.chatId,

            {

              caption: `Search: ${text}\nSource: Unsplash\nResolution: 1080x1920`,

              image: { url: fallbackUrl }

            },

            { quoted: message }

          );

        }

      } catch (error) {

        console.error(error);

        context.reply("An error occurred while fetching the wallpaper.");

      }

    }

  }

];