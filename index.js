// Tự động cấu hình FFmpeg Static cho môi trường Linux/Render
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    process.env.FFMPEG_PATH = ffmpegStatic;
    console.log('[FFmpeg]: Đã kích hoạt binary ffmpeg-static:', ffmpegStatic);
  }
} catch (e) {
  console.warn('[FFmpeg]: Không tìm thấy ffmpeg-static:', e.message);
}

const http = require('http');
const { Client, GatewayIntentBits, Partials, ActivityType, Events } = require('discord.js');
const config = require('./src/config');
const MessageHandler = require('./src/handlers/messageHandler');
const InteractionHandler = require('./src/handlers/interactionHandler');
const VoiceHandler = require('./src/handlers/voiceHandler');

// Kiểm tra biến môi trường
config.validate();

// Khởi tạo Discord Client với đầy đủ các Gateway Intents thiết yếu
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Bắt buộc để nhận diện link nhạc tự động & mã bí mật
    GatewayIntentBits.DirectMessages   // Bắt buộc để giao tiếp bảng Admin trong tin nhắn riêng
  ],
  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

const KeepAlive = require('./src/services/KeepAlive');

// =========================================================================
// HTTP HEALTH CHECK SERVER & INTERNAL SELF-PINGER (24/7 Không cần App ngoài)
// =========================================================================
const port = process.env.PORT || 3000;
const keepAliveService = new KeepAlive(port);

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'online',
    message: 'Discord Music & Voice Announcer Bot đang chạy 24/7 không cần app ngoài!',
    bot: client.user ? client.user.tag : 'đang khởi động...',
    uptimeSeconds: Math.floor(process.uptime()),
    keepAlive: keepAliveService.getStatus(),
    timestamp: new Date().toISOString()
  }, null, 2));
});

let currentPort = Number(process.env.PORT || 3000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    currentPort++;
    console.warn(`⚠️ Cổng đang bận. Đang thử cổng ${currentPort}...`);
    server.listen(currentPort);
  } else {
    console.error('[HTTP Server Error]:', err.message);
  }
});

server.listen(currentPort, () => {
  console.log(`🌐 HTTP Health Check Server đang lắng nghe tại cổng: ${server.address().port} (Chuẩn Render 24/7)`);
  // Bắt đầu chu kỳ tự động ping giữ thức 24/7
  keepAliveService.port = server.address().port;
  keepAliveService.start();
});

// Sự kiện khi Bot sẵn sàng hoạt động
client.once(Events.ClientReady, () => {
  console.log('====================================================');
  console.log(`🚀 BOT ĐÃ TRỰC TUYẾN: ${client.user.tag}`);
  console.log(`🎵 Chế độ: Zero-Typing Music & Vietnamese Voice Announcer`);
  console.log(`🛡️ Admin Secret Code: "${config.secretCode}" (ID: ${config.adminUserId || 'Chưa đặt'})`);
  console.log('====================================================');

  client.user.setPresence({
    activities: [{
      name: 'Dán link nhạc để nghe! 🎵',
      type: ActivityType.Listening
    }],
    status: 'online'
  });

  // Tự động làm nóng bộ giải mã yt-dlp ngay khi khởi động
  const Extractor = require('./src/music/Extractor');
  Extractor.warmUp();
});

// Lắng nghe tin nhắn chat (Phát hiện link nhạc & kích hoạt Admin ẩn)
client.on('messageCreate', async (message) => {
  try {
    await MessageHandler.handle(message);
  } catch (error) {
    console.error('[Error in messageCreate]:', error);
  }
});

// Lắng nghe tương tác Nút bấm và Menu (Buttons & Select Menus)
client.on('interactionCreate', async (interaction) => {
  try {
    await InteractionHandler.handle(interaction, client);
  } catch (error) {
    console.error('[Error in interactionCreate]:', error);
  }
});

// Lắng nghe thay đổi trạng thái phòng thoại (Voice Announcer đọc tiếng Việt)
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    await VoiceHandler.handle(oldState, newState);
  } catch (error) {
    console.error('[Error in voiceStateUpdate]:', error);
  }
});

// Xử lý bắt lỗi tiến trình ngầm để tránh dừng bot
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

// Đăng nhập bot
if (config.token && config.token !== 'your_bot_token_here') {
  client.login(config.token).catch((err) => {
    console.error('❌ Đăng nhập thất bại. Kiểm tra lại DISCORD_TOKEN trong file .env!');
    console.error(err.message);
  });
} else {
  console.log('ℹ️ Bot chưa thể đăng nhập vì chưa có DISCORD_TOKEN trong file .env.');
  console.log('👉 Vui lòng mở file .env và điền DISCORD_TOKEN & ADMIN_USER_ID trước khi khởi chạy.');
}
