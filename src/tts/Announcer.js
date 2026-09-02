const { Readable } = require('stream');
const googleTTS = require('google-tts-api');
const { createAudioResource, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const config = require('../config');

class Announcer {
  constructor(guildQueue) {
    this.guildQueue = guildQueue;
    this.ttsPlayer = createAudioPlayer();
    this.ttsQueue = [];
    this.isSpeaking = false;
    this.lastAnnounceTime = new Map(); // UserID -> Timestamp (Bộ đếm Cooldown 10s)

    // Lắng nghe sự kiện ttsPlayer kết thúc bài đọc
    this.ttsPlayer.on(AudioPlayerStatus.Idle, () => {
      this.isSpeaking = false;
      // Nếu còn lời thông báo tiếp theo trong hàng đợi TTS
      if (this.ttsQueue.length > 0) {
        this.processNext();
      } else {
        // Hết thông báo -> Phục hồi luồng nhạc đang phát
        this.guildQueue.resumeMusicAfterTTS();
      }
    });

    this.ttsPlayer.on('error', (err) => {
      console.error('[TTS Player Error]:', err.message);
      this.isSpeaking = false;
      this.guildQueue.resumeMusicAfterTTS();
    });
  }

  /**
   * Kiểm tra cooldown 10 giây chống spam ra vào phòng
   * @param {string} userId
   * @returns {boolean} True nếu được phép đọc
   */
  canAnnounce(userId) {
    const now = Date.now();
    const lastTime = this.lastAnnounceTime.get(userId) || 0;
    const cooldownMs = config.ttsCooldownSeconds * 1000;

    if (now - lastTime < cooldownMs) {
      return false;
    }
    this.lastAnnounceTime.set(userId, now);
    return true;
  }

  /**
   * Đưa lời thông báo mới vào hàng đợi phát âm
   * @param {string} displayName Tên thành viên
   */
  async announceMemberJoin(displayName) {
    if (!this.guildQueue.ttsEnabled) return;

    // Chuẩn hóa tên thành viên để đọc tự nhiên nhất
    const cleanName = displayName.replace(/[^\p{L}\p{N}\s]/gu, '').trim() || displayName;
    const message = `${cleanName} mới vào`;

    this.ttsQueue.push(message);

    if (!this.isSpeaking) {
      this.processNext();
    }
  }

  /**
   * Tạo Audio Resource từ Fish Audio API hoặc Google TTS dự phòng
   * @param {string} text
   * @returns {Promise<any>}
   */
  async createTtsResource(text) {
    // 1. Ưu tiên sử dụng Fish Audio nếu đã cấu hình API Key
    if (config.fishAudioApiKey && config.fishAudioVoiceId) {
      try {
        const response = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.fishAudioApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            reference_id: config.fishAudioVoiceId,
            format: 'mp3'
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const stream = Readable.from(buffer);
          const resource = createAudioResource(stream, { inlineVolume: true });
          if (resource.volume) resource.volume.setVolume(1.2);
          return resource;
        } else {
          console.warn(`[Fish Audio HTTP ${response.status}]: Chuyển sang Google TTS dự phòng.`);
        }
      } catch (fishErr) {
        console.warn(`[Fish Audio Error]: ${fishErr.message}. Chuyển sang Google TTS dự phòng.`);
      }
    }

    // 2. Dự phòng an toàn: Sử dụng Google TTS tiếng Việt
    const url = googleTTS.getAudioUrl(text, {
      lang: config.ttsLang,
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000
    });

    const resource = createAudioResource(url, { inlineVolume: true });
    if (resource.volume) resource.volume.setVolume(1.2);
    return resource;
  }

  /**
   * Xử lý phát thông điệp TTS tiếp theo
   */
  async processNext() {
    if (this.ttsQueue.length === 0) return;

    const message = this.ttsQueue.shift();
    this.isSpeaking = true;

    try {
      // 1. Tạm dừng bài hát đang chạy
      this.guildQueue.pauseMusicForTTS();

      // 2. Tạo resource âm thanh giọng đọc (Fish Audio hoặc Google TTS)
      const resource = await this.createTtsResource(message);

      // 3. Chuyển kết nối Voice sang luồng TTS
      if (this.guildQueue.connection) {
        this.guildQueue.connection.subscribe(this.ttsPlayer);
        this.ttsPlayer.play(resource);
      } else {
        this.isSpeaking = false;
      }
    } catch (err) {
      console.error('[Announcer Error]:', err.message);
      this.isSpeaking = false;
      this.guildQueue.resumeMusicAfterTTS();
    }
  }
}

module.exports = Announcer;
