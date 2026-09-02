require('dotenv').config();
const ffmpegStatic = require('ffmpeg-static');

// Gán đường dẫn FFmpeg static để @discordjs/voice tự động nhận diện trên mọi HĐH
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  adminUserId: process.env.ADMIN_USER_ID || '',
  secretCode: (process.env.SECRET_CODE || '#ad').trim(),
  musicChannelId: process.env.MUSIC_CHANNEL_ID || '',
  ttsLang: process.env.TTS_LANG || 'vi',
  ttsCooldownSeconds: parseInt(process.env.TTS_COOLDOWN || '10', 10),
  fishAudioApiKey: (process.env.FISH_AUDIO_API_KEY || '').trim(),
  fishAudioVoiceId: (process.env.FISH_AUDIO_VOICE_ID || '5aaab6b5458b4591b87a33de8a3e4874').trim(),
  
  // Kiểm tra tính hợp lệ cơ bản
  validate() {
    if (!this.token || this.token === 'your_bot_token_here') {
      console.warn('⚠️ [CẢNH BÁO]: DISCORD_TOKEN chưa được thiết lập trong file .env!');
    }
    if (!this.adminUserId || this.adminUserId === 'your_discord_user_id_here') {
      console.warn('⚠️ [CẢNH BÁO]: ADMIN_USER_ID chưa được thiết lập. Chức năng Admin ẩn sẽ không nhận diện được Admin!');
    }
    if (this.fishAudioApiKey) {
      console.log(`🎙️ [Fish Audio]: Đã kích hoạt giọng đọc Fish Audio (Voice ID: ${this.fishAudioVoiceId})`);
    } else {
      console.log('📢 [TTS]: Đang sử dụng Google TTS tiếng Việt (Thêm FISH_AUDIO_API_KEY vào .env nếu muốn dùng giọng Fish Audio AI)');
    }
  },

  // Hàm kiểm tra Admin linh hoạt (Hỗ trợ cả Discord User ID lẫn Username)
  isAdmin(user) {
    if (!user) return false;
    const target = (this.adminUserId || '').toLowerCase();
    if (!target) return false;
    return (user.id && user.id.toLowerCase() === target) ||
           (user.username && user.username.toLowerCase() === target);
  }
};
