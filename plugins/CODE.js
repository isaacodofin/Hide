import { spawn } from 'child_process';
import path from 'path';
import awesomePhoneNumber from 'awesome-phonenumber';

export default [
  {
    name: 'code',
    aliases: ['getcode', 'gencode'],
    category: 'owner',
    execute: async (sock, message, args, context) => {
      if (!message.key.fromMe && !context.senderIsSudo) {
        return context.reply("❌ This command is only for the owner!");
      }

      const text = args.slice(1).join(' ');
      if (!text) {
        return context.reply('Please provide a phone number.\n\nUsage: .code 2348012345678');
      }

      const phoneNumber = text.replace(/[^0-9]/g, '');

      if (phoneNumber.length < 10) {
        return context.reply('Invalid phone number. Please provide a valid number with country code.\n\nExample: .code 2348012345678');
      }

      // Validate phone number
      if (!awesomePhoneNumber('+' + phoneNumber).isValid()) {
        return context.reply('❌ Invalid phone number format.\n\nPlease enter a valid international number.\n\nExample: .code 2348012345678');
      }

      await context.reply('🔄 Initializing temporary pairing session...\n⏳ Please wait...');

      try {
        // Spawn the code.js process
        const codeProcess = spawn('node', ['code.js', phoneNumber], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        let outputBuffer = '';
        let errorBuffer = '';
        let pairingCode = null;
        let hasError = false;

        // Capture stdout
        codeProcess.stdout.on('data', (data) => {
          const output = data.toString();
          outputBuffer += output;

          // Check for pairing code
          if (output.includes('PAIRING_CODE:')) {
            pairingCode = output.split('PAIRING_CODE:')[1].trim();
          }

          // Check for success
          if (output.includes('PAIR_SUCCESS')) {
            // Will be handled in close event
          }

          // Check for errors
          if (output.includes('ERROR:')) {
            hasError = true;
          }
        });

        // Capture stderr
        codeProcess.stderr.on('data', (data) => {
          errorBuffer += data.toString();
        });

        // Handle process completion
        codeProcess.on('close', async (exitCode) => {
          if (pairingCode && !hasError) {
            const successMessage = `✅ PAIRING CODE GENERATED

Code: ${pairingCode}

Phone: +${phoneNumber}

HOW TO LINK:
1. Open WhatsApp on your phone
2. Tap the 3 dots (⋮) at top right
3. Select Linked Devices
4. Tap Link a Device
5. Tap Link with phone number instead
6. Enter the code above

⏱️ Code expires in 60 seconds!

Note: This creates a temporary session that will auto-disconnect. Your main bot remains active.`;

            await context.reply(successMessage);
          } else if (outputBuffer.includes('ERROR:')) {
            const errorMsg = outputBuffer.split('ERROR:')[1].split('\n')[0].trim();
            await context.reply(`❌ Error: ${errorMsg}`);
          } else if (outputBuffer.includes('PAIR_SUCCESS')) {
            await context.reply('✅ Pairing successful! Temporary session created and closed.');
          } else if (exitCode !== 0) {
            await context.reply('❌ Failed to generate pairing code. Please try again.\n\nMake sure the phone number is correct and not already registered.');
          }
        });

        // Handle process errors
        codeProcess.on('error', async (error) => {
          console.error('Code process error:', error);
          await context.reply('❌ Failed to start pairing process.\n\nError: ' + error.message);
        });

        // Timeout after 70 seconds
        setTimeout(() => {
          if (!pairingCode && codeProcess.exitCode === null) {
            codeProcess.kill('SIGTERM');
            context.reply('⏱️ Pairing process timed out. Please try again.');
          }
        }, 70000);

      } catch (error) {
        console.error('Code command error:', error);
        await context.reply('❌ An error occurred while generating the code.\n\nPlease try again or contact the developer.');
      }
    }
  }
];
