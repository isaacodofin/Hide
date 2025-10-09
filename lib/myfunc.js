import {

    proto,

    delay,
    getContentType

} from '@whiskeysockets/baileys';

import chalk from 'chalk';

import fs from 'fs';

import Crypto from 'crypto';

import axios from 'axios';

import moment from 'moment-timezone';

import {

    sizeFormatter

} from 'human-readable';

import util from 'util';

import * as Jimp from 'jimp';

import { EventEmitter } from 'events'; // Changed from 'stream' to 'events'

// optional: increase listener limit to avoid warnings

EventEmitter.defaultMaxListeners = 50;

import path from 'path';

import { tmpdir } from 'os';

const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000);

export { unixTimestampSeconds };

export const generateMessageTag = (epoch) => {

    let tag = unixTimestampSeconds().toString();

    if (epoch)

        tag += '.--' + epoch; // attach epoch if provided

    return tag;

}

export const processTime = (timestamp, now) => {

    return moment.duration(now - moment(timestamp * 1000)).asSeconds();

}

/**
 * Convert LID (Linked ID) to normal WhatsApp number
 * @param {string} lid - The LID string (e.g., "2331188455851:45@lid")
 * @returns {string} - Normal WhatsApp number (e.g., "2331188455851@s.whatsapp.net")
 */
export const lidToNumber = (lid) => {
    try {
        if (!lid) return null;

        // Remove @lid suffix if present
        const cleanLid = lid.replace('@lid', '');

        // Split by ':' and take the first part (the actual number)
        const numberPart = cleanLid.split(':')[0];

        // Return in WhatsApp format
        return numberPart + '@s.whatsapp.net';
    } catch (error) {
        console.error('❌ Error converting LID to number:', error);
        return null;
    }
};


/**
 * Extract clean phone number from LID
 * @param {string} lid - The LID string
 * @returns {string} - Clean phone number without any suffix
 */
export const lidToCleanNumber = (lid) => {
    try {
        if (!lid) return null;

        // Remove @lid suffix if present
        const cleanLid = lid.replace('@lid', '');

        // Split by ':' and take the first part (the actual number)
        return cleanLid.split(':')[0];
    } catch (error) {
        console.error('❌ Error extracting clean number from LID:', error);
        return null;
    }
};


/**
 * Check if a string is a LID format
 * @param {string} id - The ID to check
 * @returns {boolean} - True if it's a LID format
 */
export const isLidFormat = (id) => {
    return id && (id.includes('@lid') || id.includes(':'));
};


/**
 * Universal number normalizer - handles both regular numbers and LIDs
 * @param {string} id - Any WhatsApp ID format
 * @returns {string} - Normalized WhatsApp number
 */
export const normalizeWhatsAppId = (id) => {
    try {
        if (!id) return null;

        // If it's already a normal WhatsApp number, return as is
        if (id.includes('@s.whatsapp.net') && !id.includes(':')) {
            return id;
        }

        // If it's a LID format, convert it
        if (isLidFormat(id)) {
            return lidToNumber(id);
        }

        // If it's just a number, add WhatsApp suffix
        if (/^\d+$/.test(id)) {
            return id + '@s.whatsapp.net';
        }

        // Fallback: try to extract number and add suffix
        const numericPart = id.replace(/[^0-9]/g, '');
        return numericPart + '@s.whatsapp.net';
    } catch (error) {
        console.error('❌ Error normalizing WhatsApp ID:', error);
        return id; // Return original if conversion fails
    }
};
                 
export const getRandom = (ext) => {

    return `${Math.floor(Math.random() * 10000)}${ext}`;

}

export const WAVersion = async () => {
    let get = await fetchUrl("https://web.whatsapp.com/check-update?version=1&platform=web");
    let version = [get.currentVersion.replace(/[.]/g, ", ")];
    return version;
}

export const getBuffer = async (url, options) => {

    try {

        options ? options : {}

        const res = await axios({

            method: "get",

            url,

            headers: {

                'DNT': 1,

                'Upgrade-Insecure-Request': 1

            },

            ...options,

            responseType: 'arraybuffer'

        });

        return res.data;

    } catch (err) {

        return err;

    }

}

export const getImg = async (url, options) => {

    try {

        options ? options : {}

        const res = await axios({

            method: "get",

            url,

            headers: {

                'DNT': 1,

                'Upgrade-Insecure-Request': 1

            },

            ...options,

            responseType: 'arraybuffer'

        });

        return res.data;

    } catch (err) {

        return err;

    }

}

export const fetchJson = async (url, options) => {

    try {

        options ? options : {}

        const res = await axios({

            method: 'GET',

            url: url,

            headers: {

                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'

            },

            ...options

        });

        return res.data;

    } catch (err) {

        return err;

    }

}

export const runtime = function(seconds) {

    seconds = Number(seconds);

    var d = Math.floor(seconds / (3600 * 24));

    var h = Math.floor(seconds % (3600 * 24) / 3600);

    var m = Math.floor(seconds % 3600 / 60);

    var s = Math.floor(seconds % 60);

    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";

    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";

    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";

    return dDisplay + hDisplay + mDisplay + sDisplay;

}

export const clockString = (ms) => {

    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000);

    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;

    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;

    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':');

}

export const sleep = async (ms) => {

    return new Promise(resolve => setTimeout(resolve, ms));

}

export const isUrl = (url) => {

    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'));

}

export const getTime = (format, date) => {

    if (date) {

        return moment(date).locale('id').format(format);

    } else {

        return moment.tz('Asia/Jakarta').locale('id').format(format);

    }

}

export const formatDate = (n, locale = 'id') => {

    let d = new Date(n);

    return d.toLocaleDateString(locale, {

        weekday: 'long',

        day: 'numeric',

        month: 'long',

        year: 'numeric',

        hour: 'numeric',

        minute: 'numeric',

        second: 'numeric'

    });

}

export const tanggal = (numer) => {

    const myMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const myDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

    const tgl = new Date(numer);

    const day = tgl.getDate();

    const bulan = tgl.getMonth();

    let thisDay = tgl.getDay();

    thisDay = myDays[thisDay];

    const yy = tgl.getYear();

    const year = (yy < 1000) ? yy + 1900 : yy;

    const time = moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss');

    const d = new Date();

    const locale = 'id';

    const gmt = new Date(0).getTime() - new Date('1 January 1970').getTime();

    const weton = ['Pahing', 'Pon', 'Wage', 'Kliwon', 'Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5];

    return `${thisDay}, ${day} - ${myMonths[bulan]} - ${year}`;

}

export const jam = (numer, options = {}) => {

    let format = options.format ? options.format : "HH:mm";

    let jam = options?.timeZone ? moment(numer).tz(timeZone).format(format) : moment(numer).format(format);

    return `${jam}`;

}

export const formatp = sizeFormatter({

    std: 'JEDEC', //'SI' = default | 'IEC' | 'JEDEC'

    decimalPlaces: 2,

    keepTrailingZeroes: false,

    render: (literal, symbol) => `${literal} ${symbol}B`,

});

export const json = (string) => {

    return JSON.stringify(string, null, 2);

}

function format(...args) {

    return util.format(...args);

}

export const logic = (check, inp, out) => {

    if (inp.length !== out.length) throw new Error('Input and Output must have same length');

    for (let i in inp)

        if (util.isDeepStrictEqual(check, inp[i])) return out[i];

    return null;

}

export const generateProfilePicture = async (buffer) => {

    const jimp = await Jimp.read(buffer);

    const min = jimp.getWidth();

    const max = jimp.getHeight();

    const cropped = jimp.crop(0, 0, min, max);

    return {

        img: await cropped.scaleToFit(720, 720).getBufferAsync(Jimp.MIME_JPEG),

        preview: await cropped.scaleToFit(720, 720).getBufferAsync(Jimp.MIME_JPEG)

    };

}

export const bytesToSize = (bytes, decimals = 2) => {

    if (bytes === 0) return '0 Bytes';

    const k = 1024;

    const dm = decimals < 0 ? 0 : decimals;

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];

}

export const getSizeMedia = (path) => {

    return new Promise((resolve, reject) => {

        if (/http/.test(path)) {

            axios.get(path)

                .then((res) => {

                    let length = parseInt(res.headers['content-length']);

                    let size = bytesToSize(length, 3);

                    if (!isNaN(length)) resolve(size);

                });

        } else if (Buffer.isBuffer(path)) {

            let length = Buffer.byteLength(path);

            let size = bytesToSize(length, 3);

            if (!isNaN(length)) resolve(size);

        } else {

            reject('error gatau apah');

        }

    });

}

export const parseMention = (text = '') => {

    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');

}

export const getGroupAdmins = (participants) => {

    let admins = [];

    for (let i of participants) {

        i.admin === "superadmin" ? admins.push(i.id) : i.admin === "admin" ? admins.push(i.id) : '';

    }

    return admins || [];

}

/**

 * Serialize Message

 * @param {WAConnection} conn 

 * @param {Object} m 

 * @param {store} store 

 */

export const smsg = (XeonBotInc, m, store) => {

    if (!m) return m;

    let M = proto.WebMessageInfo;

    if (m.key) {

        m.id = m.key.id;

        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;

        m.chat = m.key.remoteJid;

        m.fromMe = m.key.fromMe;

        m.isGroup = m.chat.endsWith('@g.us');

        m.sender = XeonBotInc.decodeJid(m.fromMe && XeonBotInc.user.id || m.participant || m.key.participant || m.chat || '');

        if (m.isGroup) m.participant = XeonBotInc.decodeJid(m.key.participant) || '';

    }

    if (m.message) {

        m.mtype = getContentType(m.message);

        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]);

        m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == 'listResponseMessage') && m.msg.singleSelectReply.selectedRowId || (m.mtype == 'buttonsResponseMessage') && m.msg.selectedButtonId || (m.mtype == 'viewOnceMessage') && m.msg.caption || m.text;

        let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null;

        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];

        if (m.quoted) {

            let type = getContentType(quoted);

            m.quoted = m.quoted[type];

            if (['productMessage'].includes(type)) {

                type = getContentType(m.quoted);

                m.quoted = m.quoted[type];

            }

            if (typeof m.quoted === 'string') m.quoted = {

                text: m.quoted

            };

            m.quoted.mtype = type;

            m.quoted.id = m.msg.contextInfo.stanzaId;

            m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;

            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false;

            m.quoted.sender = XeonBotInc.decodeJid(m.msg.contextInfo.participant);

            m.quoted.fromMe = m.quoted.sender === (XeonBotInc.user && XeonBotInc.user.id);

            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';

            m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];

            m.getQuotedObj = m.getQuotedMessage = async () => {

                if (!m.quoted.id) return false;

                let q = await store.loadMessage(m.chat, m.quoted.id, XeonBotInc);

                return smsg(XeonBotInc, q, store);

            }

            let vM = m.quoted.fakeObj = M.fromObject({

                key: {

                    remoteJid: m.quoted.chat,

                    fromMe: m.quoted.fromMe,

                    id: m.quoted.id

                },

                message: quoted,

                ...(m.isGroup ? {

                    participant: m.quoted.sender

                } : {})

            });

            /**

             * 

             * @returns 

             */

            m.quoted.delete = () => XeonBotInc.sendMessage(m.quoted.chat, {

                delete: vM.key

            });

            /**

             * 

             * @param {*} jid 

             * @param {*} forceForward 

             * @param {*} options 

             * @returns 

             */

            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => XeonBotInc.copyNForward(jid, vM, forceForward, options);

            /**

             *

             * @returns

             */

            m.quoted.download = () => XeonBotInc.downloadMediaMessage(m.quoted);

        }

    }

    if (m.msg.url) m.download = () => XeonBotInc.downloadMediaMessage(m.msg);

    m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || '';

    /**

     * Reply to this message

     * @param {String|Object} text 

     * @param {String|false} chatId 

     * @param {Object} options 

     */

    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? XeonBotInc.sendMedia(chatId, text, 'file', '', m, {

        ...options

    }) : XeonBotInc.sendText(chatId, text, m, {

        ...options

    });

    /**

     * Copy this message

     */

    m.copy = () => smsg(XeonBotInc, M.fromObject(M.toObject(m)));

    /**

     * 

     * @param {*} jid 

     * @param {*} forceForward 

     * @param {*} options 

     * @returns 

     */

    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => XeonBotInc.copyNForward(jid, m, forceForward, options);

    return m;

}

export const reSize = (buffer, ukur1, ukur2) => {

    return new Promise(async (resolve, reject) => {

        var baper = await Jimp.read(buffer);

        var ab = await baper.resize(ukur1, ukur2).getBufferAsync(Jimp.MIME_JPEG);

        resolve(ab);

    });

}