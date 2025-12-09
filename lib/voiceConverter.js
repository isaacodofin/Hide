import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegPath.path);

export async function convertToVoiceNote(audioUrl, title) {
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if not exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const mp3Path = path.join(tempDir, `${sanitizedTitle}_${Date.now()}.mp3`);
    const oggPath = path.join(tempDir, `${sanitizedTitle}_${Date.now()}.ogg`);
    
    try {
        console.log('[VOICE] Downloading audio...');
        
        // Download MP3
        const response = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        fs.writeFileSync(mp3Path, response.data);
        console.log('[VOICE] ✅ Audio downloaded');
        
        // Convert to OGG (Opus codec)
        await new Promise((resolve, reject) => {
            console.log('[VOICE] Converting to voice note format...');
            
            ffmpeg(mp3Path)
                .toFormat('ogg')
                .audioCodec('libopus')
                .audioBitrate('128k')
                .audioChannels(1) // Mono for voice notes
                .audioFrequency(48000)
                .on('end', () => {
                    console.log('[VOICE] ✅ Conversion complete');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[VOICE] ❌ Conversion failed:', err);
                    reject(err);
                })
                .save(oggPath);
        });
        
        // Read converted file
        const voiceBuffer = fs.readFileSync(oggPath);
        
        // Cleanup
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        
        console.log('[VOICE] ✅ Voice note ready!');
        return voiceBuffer;
        
    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        
        throw error;
    }
}
