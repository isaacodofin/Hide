/**

 * Credits:

 * - Baileys Library by @adiwajshing

 * - Enhanced by Gift md Bot Team

 */

import fs from 'fs';

import path from 'path';

import { spawn, exec } from 'child_process';

import { promisify } from 'util';

import { fileURLToPath } from 'url';

import { dirname } from 'path';

// Get __dirname equivalent in ESM

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Ensure temp directories exist

const tempDir = path.join(__dirname, '../tmp');

const dbDir = path.join(__dirname, '../data/cvt.son');

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

/**

 * Enhanced FFmpeg wrapper with better error handling

 */

function ffmpeg(buffer, args = [], ext = '', ext2 = '', tempPath = tempDir) {

  return new Promise(async (resolve, reject) => {

    try {

      const timestamp = Date.now();

      const tmp = path.join(tempPath, `input_${timestamp}.${ext}`);

      const out = path.join(tempPath, `output_${timestamp}.${ext2}`);

      

      await fs.promises.writeFile(tmp, buffer);

      

      const ffmpegProcess = spawn('ffmpeg', [

        '-y',

        '-i', tmp,

        ...args,

        out

      ]);

      

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {

        stderr += data.toString();

      });

      

      ffmpegProcess.on('error', (error) => {

        cleanup([tmp, out]);

        reject(new Error(`FFmpeg spawn error: ${error.message}`));

      });

      

      ffmpegProcess.on('close', async (code) => {

        try {

          await fs.promises.unlink(tmp).catch(() => {});

          

          if (code !== 0) {

            await fs.promises.unlink(out).catch(() => {});

            return reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));

          }

          

          if (!fs.existsSync(out)) {

            return reject(new Error('Output file not created'));

          }

          

          const result = await fs.promises.readFile(out);

          await fs.promises.unlink(out).catch(() => {});

          resolve(result);

        } catch (e) {

          cleanup([tmp, out]);

          reject(e);

        }

      });

    } catch (e) {

      reject(e);

    }

  });

}

/**

 * Clean up temporary files

 */

function cleanup(files) {

  files.forEach(file => {

    if (fs.existsSync(file)) {

      fs.unlinkSync(file);

    }

  });

}

function toAudio(buffer, ext) {

  return ffmpeg(buffer, [

    '-vn',

    '-ac', '2',

    '-b:a', '128k',

    '-ar', '44100',

    '-f', 'mp3'

  ], ext, 'mp3');

}

function toHQAudio(buffer, ext) {

  return ffmpeg(buffer, [

    '-vn',

    '-ac', '2',

    '-b:a', '320k',

    '-ar', '48000',

    '-f', 'mp3'

  ], ext, 'mp3');

}

function toPTT(buffer, ext) {

  return ffmpeg(buffer, [

    '-vn',

    '-c:a', 'libopus',

    '-b:a', '128k',

    '-vbr', 'on',

    '-compression_level', '10'

  ], ext, 'opus');

}

function toVideo(buffer, ext) {

  return ffmpeg(buffer, [

    '-c:v', 'libx264',

    '-c:a', 'aac',

    '-ab', '128k',

    '-ar', '44100',

    '-crf', '32',

    '-preset', 'slow'

  ], ext, 'mp4');

}

function toHQVideo(buffer, ext) {

  return ffmpeg(buffer, [

    '-c:v', 'libx264',

    '-c:a', 'aac',

    '-ab', '192k',

    '-ar', '48000',

    '-crf', '18',

    '-preset', 'medium'

  ], ext, 'mp4');

}

function toGIF(buffer, ext, fps = 10, scale = '320:-1') {

  return ffmpeg(buffer, [

    '-vf', `fps=${fps},scale=${scale}:flags=lanczos`,

    '-c:v', 'gif'

  ], ext, 'gif');

}

function toWebP(buffer, ext) {

  return ffmpeg(buffer, [

    '-vcodec', 'libwebp',

    '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512',

    '-loop', '0',

    '-preset', 'default',

    '-an',

    '-vsync', '0'

  ], ext, 'webp');

}

function toAnimatedWebP(buffer, ext) {

  return ffmpeg(buffer, [

    '-vcodec', 'libwebp',

    '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15',

    '-loop', '0',

    '-preset', 'default',

    '-an',

    '-vsync', '0',

    '-t', '10'

  ], ext, 'webp');

}

function extractAudio(buffer, ext) {

  return ffmpeg(buffer, [

    '-vn',

    '-acodec', 'copy'

  ], ext, 'mp3');

}

function addWatermark(buffer, ext, text = 'Gift MD', position = 'bottomright') {

  const positions = {

    topleft: '10:10',

    topright: 'main_w-text_w-10:10',

    bottomleft: '10:main_h-text_h-10',

    bottomright: 'main_w-text_w-10:main_h-text_h-10'

  };

  

  return ffmpeg(buffer, [

    '-vf', `drawtext=text='${text}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=${positions[position]}`

  ], ext, 'mp4');

}

function compressVideo(buffer, ext, crf = 28) {

  return ffmpeg(buffer, [

    '-c:v', 'libx264',

    '-crf', crf.toString(),

    '-c:a', 'aac',

    '-b:a', '128k'

  ], ext, 'mp4');

}

function changeVideoSpeed(buffer, ext, speed = 1.0) {

  return ffmpeg(buffer, [

    '-filter:v', `setpts=${1/speed}*PTS`,

    '-filter:a', `atempo=${speed}`

  ], ext, 'mp4');

}

function resizeVideo(buffer, ext, width = 720, height = 720) {

  return ffmpeg(buffer, [

    '-vf', `scale=${width}:${height}`

  ], ext, 'mp4');

}

function videoToAudio(buffer, ext) {

  return ffmpeg(buffer, [

    '-vn',

    '-acodec', 'mp3'

  ], ext, 'mp3');

}

// ===== MISSING FUNCTIONS ADDED BELOW =====

/**

 * Convert Audio Format

 */

function convertAudioFormat(buffer, ext, format = 'mp3') {

  return ffmpeg(buffer, [

    '-vn',

    '-acodec', format === 'mp3' ? 'libmp3lame' : format === 'wav' ? 'pcm_s16le' : format === 'flac' ? 'flac' : 'libvorbis',

    '-b:a', '192k',

    '-ar', '44100'

  ], ext, format);

}

/**

 * Change Speed (alias for changeVideoSpeed)

 */

function changeSpeed(buffer, ext, speed = 1.0) {

  return changeVideoSpeed(buffer, ext, speed);

}

/**

 * Create Thumbnail from Video

 */

function createThumbnail(buffer, ext, time = '00:00:01') {

  return ffmpeg(buffer, [

    '-ss', time,

    '-vframes', '1',

    '-vf', 'scale=320:240'

  ], ext, 'jpg');

}

/**

 * Extract Frames from Video

 */

function extractFrames(buffer, ext, fps = 1) {

  return ffmpeg(buffer, [

    '-vf', `fps=${fps}`,

    '-q:v', '2'

  ], ext, 'jpg');

}

/**

 * Convert Image Format

 */

function convertImage(buffer, ext, format = 'jpg') {

  return ffmpeg(buffer, [

    '-q:v', '2'

  ], ext, format);

}

/**

 * Resize Image

 */

function resizeImage(buffer, ext, width = 512, height = 512) {

  return ffmpeg(buffer, [

    '-vf', `scale=${width}:${height}`

  ], ext, 'jpg');

}

/**

 * Merge Audio and Video

 */

function mergeAudioVideo(videoBuffer, audioBuffer, videoExt, audioExt) {

  return new Promise(async (resolve, reject) => {

    try {

      const timestamp = Date.now();

      const videoTmp = path.join(tempDir, `video_${timestamp}.${videoExt}`);

      const audioTmp = path.join(tempDir, `audio_${timestamp}.${audioExt}`);

      const out = path.join(tempDir, `merged_${timestamp}.mp4`);

      

      await fs.promises.writeFile(videoTmp, videoBuffer);

      await fs.promises.writeFile(audioTmp, audioBuffer);

      

      const ffmpegProcess = spawn('ffmpeg', [

        '-y',

        '-i', videoTmp,

        '-i', audioTmp,

        '-c:v', 'copy',

        '-c:a', 'aac',

        '-shortest',

        out

      ]);

      

      ffmpegProcess.on('close', async (code) => {

        try {

          cleanup([videoTmp, audioTmp]);

          

          if (code !== 0) {

            await fs.promises.unlink(out).catch(() => {});

            return reject(new Error(`FFmpeg failed with code ${code}`));

          }

          

          const result = await fs.promises.readFile(out);

          await fs.promises.unlink(out).catch(() => {});

          resolve(result);

        } catch (e) {

          reject(e);

        }

      });

    } catch (e) {

      reject(e);

    }

  });

}

/**

 * Add Audio to Image (create video with static image and audio)

 */

function addAudioToImage(imageBuffer, audioBuffer, imageExt, audioExt) {

  return new Promise(async (resolve, reject) => {

    try {

      const timestamp = Date.now();

      const imageTmp = path.join(tempDir, `image_${timestamp}.${imageExt}`);

      const audioTmp = path.join(tempDir, `audio_${timestamp}.${audioExt}`);

      const out = path.join(tempDir, `output_${timestamp}.mp4`);

      

      await fs.promises.writeFile(imageTmp, imageBuffer);

      await fs.promises.writeFile(audioTmp, audioBuffer);

      

      const ffmpegProcess = spawn('ffmpeg', [

        '-y',

        '-loop', '1',

        '-i', imageTmp,

        '-i', audioTmp,

        '-c:v', 'libx264',

        '-c:a', 'aac',

        '-b:a', '192k',

        '-shortest',

        '-pix_fmt', 'yuv420p',

        out

      ]);

      

      ffmpegProcess.on('close', async (code) => {

        try {

          cleanup([imageTmp, audioTmp]);

          

          if (code !== 0) {

            await fs.promises.unlink(out).catch(() => {});

            return reject(new Error(`FFmpeg failed with code ${code}`));

          }

          

          const result = await fs.promises.readFile(out);

          await fs.promises.unlink(out).catch(() => {});

          resolve(result);

        } catch (e) {

          reject(e);

        }

      });

    } catch (e) {

      reject(e);

    }

  });

}

/**

 * Get Media Information

 */

function getMediaInfo(buffer, ext) {

  return new Promise(async (resolve, reject) => {

    try {

      const timestamp = Date.now();

      const tmp = path.join(tempDir, `info_${timestamp}.${ext}`);

      

      await fs.promises.writeFile(tmp, buffer);

      

      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${tmp}"`);

      await fs.promises.unlink(tmp).catch(() => {});

      

      resolve(JSON.parse(stdout));

    } catch (e) {

      reject(e);

    }

  });

}

export {

  ffmpeg,

  cleanup,

  toAudio,

  toHQAudio,

  toPTT,

  toVideo,

  toHQVideo,

  toGIF,

  toWebP,

  toAnimatedWebP,

  extractAudio,

  addWatermark,

  compressVideo,

  changeVideoSpeed,

  resizeVideo,

  videoToAudio,

  convertAudioFormat,

  changeSpeed,

  createThumbnail,

  extractFrames,

  convertImage,

  resizeImage,

  mergeAudioVideo,

  addAudioToImage,

  getMediaInfo

};