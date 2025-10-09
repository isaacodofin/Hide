import fs from 'fs';

import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const economyFile = path.join(__dirname, '..', 'data', 'economy.json');

// Initialize economy data if file doesn't exist

if (!fs.existsSync(economyFile)) {

    fs.writeFileSync(economyFile, JSON.stringify({}));

}

function getEconomyData() {

    try {

        return JSON.parse(fs.readFileSync(economyFile, 'utf8'));

    } catch {

        return {};

    }

}

function saveEconomyData(data) {

    fs.writeFileSync(economyFile, JSON.stringify(data, null, 2));

}

function getUserBalance(userId) {

    const data = getEconomyData();

    return data[userId] || { balance: 0, lastDaily: 0, lastWork: 0 };

}

function updateUserBalance(userId, balance, lastDaily = null, lastWork = null) {

    const data = getEconomyData();

    data[userId] = {

        balance: Math.max(0, balance),

        lastDaily: lastDaily || data[userId]?.lastDaily || 0,

        lastWork: lastWork || data[userId]?.lastWork || 0

    };

    saveEconomyData(data);

}

export default [

    {

        name: 'balance',

        aliases: ['bal'],

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const userData = getUserBalance(context.userId);

            await context.reply(`💰 Your Balance: $${userData.balance.toLocaleString()}`);

        }

    },

    {

        name: 'daily',

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const userData = getUserBalance(context.userId);

            const now = Date.now();

            const oneDay = 24 * 60 * 60 * 1000;

            

            if (now - userData.lastDaily < oneDay) {

                const timeLeft = oneDay - (now - userData.lastDaily);

                const hours = Math.floor(timeLeft / (60 * 60 * 1000));

                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

                return context.reply(`⏰ You already claimed your daily reward!\nCome back in ${hours}h ${minutes}m`);

            }

            

            const reward = Math.floor(Math.random() * 500) + 100;

            updateUserBalance(context.userId, userData.balance + reward, now);

            await context.reply(`🎁 Daily reward claimed!\nYou received: $${reward}\nNew balance: $${(userData.balance + reward).toLocaleString()}`);

        }

    },

    {

        name: 'work',

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const userData = getUserBalance(context.userId);

            const now = Date.now();

            const oneHour = 60 * 60 * 1000;

            

            if (now - userData.lastWork < oneHour) {

                const timeLeft = oneHour - (now - userData.lastWork);

                const minutes = Math.floor(timeLeft / (60 * 1000));

                return context.reply(`⏰ You're tired from working!\nRest for ${minutes} more minutes`);

            }

            

            const jobs = [

                'delivery driver', 'cashier', 'cleaner', 'security guard', 

                'waiter', 'programmer', 'designer', 'mechanic'

            ];

            const job = jobs[Math.floor(Math.random() * jobs.length)];

            const salary = Math.floor(Math.random() * 200) + 50;

            

            updateUserBalance(context.userId, userData.balance + salary, userData.lastDaily, now);

            await context.reply(`💼 You worked as a ${job}\nEarned: $${salary}\nNew balance: $${(userData.balance + salary).toLocaleString()}`);

        }

    },

    {

        name: 'transfer',

        aliases: ['pay'],

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const amount = parseInt(args[1]);

            const mention = context.mentions[0];

            

            if (!amount || amount <= 0) {

                return context.reply('Please specify a valid amount to transfer!');

            }

            

            if (!mention) {

                return context.reply('Please mention someone to transfer money to!');

            }

            

            if (mention === context.userId) {

                return context.reply('You cannot transfer money to yourself!');

            }

            

            const senderData = getUserBalance(context.userId);

            if (senderData.balance < amount) {

                return context.reply(`Insufficient funds! You have $${senderData.balance.toLocaleString()}`);

            }

            

            const receiverData = getUserBalance(mention);

            

            updateUserBalance(context.userId, senderData.balance - amount);

            updateUserBalance(mention, receiverData.balance + amount);

            

            await context.reply(`💸 Transfer successful!\nSent $${amount.toLocaleString()} to @${mention.split('@')[0]}\nYour new balance: $${(senderData.balance - amount).toLocaleString()}`);

        }

    },

    {

        name: 'gamble',

        aliases: ['bet'],

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const amount = parseInt(args[1]);

            

            if (!amount || amount <= 0) {

                return context.reply('Please specify a valid amount to gamble!');

            }

            

            const userData = getUserBalance(context.userId);

            if (userData.balance < amount) {

                return context.reply(`Insufficient funds! You have $${userData.balance.toLocaleString()}`);

            }

            

            const winChance = 0.45;

            const won = Math.random() < winChance;

            

            if (won) {

                const winAmount = Math.floor(amount * (Math.random() * 0.8 + 0.2));

                updateUserBalance(context.userId, userData.balance + winAmount);

                await context.reply(`🎰 You won!\nGambled: $${amount.toLocaleString()}\nWon: $${winAmount.toLocaleString()}\nNew balance: $${(userData.balance + winAmount).toLocaleString()}`);

            } else {

                updateUserBalance(context.userId, userData.balance - amount);

                await context.reply(`💸 You lost!\nGambled: $${amount.toLocaleString()}\nNew balance: $${(userData.balance - amount).toLocaleString()}`);

            }

        }

    },

    {

        name: 'leaderboard',

        aliases: ['lb', 'rich'],

        category: 'economy',

        execute: async (sock, message, args, context) => {

            const data = getEconomyData();

            const users = Object.entries(data)

                .sort(([,a], [,b]) => b.balance - a.balance)

                .slice(0, 10);

            

            if (users.length === 0) {

                return context.reply('No economy data available!');

            }

            

            let leaderboard = '🏆 Economy Leaderboard\n\n';

            users.forEach(([userId, userData], index) => {

                const position = index + 1;

                const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;

                leaderboard += `${medal} @${userId.split('@')[0]}: $${userData.balance.toLocaleString()}\n`;

            });

            

            await context.reply(leaderboard);

        }

    }

];