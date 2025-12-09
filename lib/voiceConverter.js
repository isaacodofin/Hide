import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ffmpeg will use system-installed ffmpeg (most servers have it)

export async function convertToVoiceNote(audioUrl, title) {
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if not exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const timestamp = Date.now();
    const mp3Path = path.join(tempDir, `${sanitizedTitle}_${timestamp}.mp3`);
    const oggPath = path.join(tempDir, `${sanitizedTitle}_${timestamp}.ogg`);
    
    try {
        console.log('[VOICE] Downloading audio from:', audioUrl.substring(0, 50) + '...');
        
        // Download MP3
        const response = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        console.log('[VOICE] Downloaded:', response.data.length, 'bytes');
        fs.writeFileSync(mp3Path, response.data);
        console.log('[VOICE] ✅ Audio saved to:', mp3Path);
        
        // Convert to OGG (Opus codec)
        await new Promise((resolve, reject) => {
            console.log('[VOICE] Starting conversion...');
            
            ffmpeg(mp3Path)
                .toFormat('ogg')
                .audioCodec('libopus')
                .audioBitrate('128k')
                .audioChannels(1) // Mono for voice notes
                .audioFrequency(48000)
                .on('start', (cmd) => {
                    console.log('[VOICE] ffmpeg command:', cmd);
                })
                .on('progress', (progress) => {
                    console.log('[VOICE] Processing:', progress.percent, '%');
                })
                .on('end', () => {
                    console.log('[VOICE] ✅ Conversion complete');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[VOICE] ❌ Conversion failed:', err.message);
                    reject(err);
                })
                .save(oggPath);
        });
        
        // Read converted file
        console.log('[VOICE] Reading converted file...');
        const voiceBuffer = fs.readFileSync(oggPath);
        console.log('[VOICE] Voice note size:', voiceBuffer.length, 'bytes');
        
        // Cleanup
        console.log('[VOICE] Cleaning up temp files...');
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        
        console.log('[VOICE] ✅ Voice note ready!');
        return voiceBuffer;
        
    } catch (error) {
        console.error('[VOICE] ❌ Error:', error.message);
        
        // Cleanup on error
        if (fs.existsSync(mp3Path)) {
            fs.unlinkSync(mp3Path);
            console.log('[VOICE] Cleaned up mp3');
        }
        if (fs.existsSync(oggPath)) {
            fs.unlinkSync(oggPath);
            console.log('[VOICE] Cleaned up ogg');
        }
        
        throw error;
    }
}
