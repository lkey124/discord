const config = require('../config');
const queueManager = require('../music/QueueManager');
const Extractor = require('../music/Extractor');
const Embeds = require('../ui/embeds');
const Components = require('../ui/components');

class MessageHandler {
  /**
   * Xử lý toàn bộ tin nhắn chat trong server
   * @param {object} message Discord Message
   */
  static async handle(message) {
    if (message.author.bot || !message.guild) return;

    const trimmedContent = message.content.trim();

    // =========================================================================
    // 1. CƠ CHẾ LỆNH ẨN ADMIN TUYỆT ĐỐI (Invisible Admin Trigger)
    // =========================================================================
    if (trimmedContent.toLowerCase() === config.secretCode.toLowerCase()) {
      // 0.01s xóa sạch tin nhắn kích hoạt để xóa dấu vết trước các thành viên khác
      await message.delete().catch(() => {});

      // Kiểm tra định danh User ID hoặc Username của Admin
      if (config.isAdmin(message.author)) {
        const queue = queueManager.get(message.guild);
        const adminEmbed = Embeds.adminPanel(message.guild, queue);
        const adminComponents = Components.adminControls(message.guild.id, queue);

        try {
          await message.author.send({
            embeds: [adminEmbed],
            components: adminComponents
          });
        } catch (dmErr) {
          console.error('[Admin DM Error]: Không thể gửi tin nhắn riêng cho Admin. Vui lòng mở quyền DM từ server!');
        }
      }
      return;
    }

    // =========================================================================
    // 2. LỆNH TRIỆU HỒI / RỜI PHÒNG VOICE CHỦ ĐỘNG (!join, !vao, !leave, !out)
    // =========================================================================
    const lowerContent = trimmedContent.toLowerCase();
    if (['!join', '!vao', '!call', '!bot'].includes(lowerContent)) {
      const memberVoice = message.member?.voice?.channel;
      if (!memberVoice) {
        const warn = await message.reply('⚠️ Bạn cần tham gia một phòng thoại (Voice Channel) trước khi triệu hồi bot!');
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }

      const queue = queueManager.get(message.guild);
      queue.textChannel = message.channel;
      await queue.connect(memberVoice);

      const replyMsg = await message.reply({
        content: `🟢 **Đã kết nối vào phòng:** <#${memberVoice.id}>!\n*(Bây giờ bạn chỉ việc dán link YouTube/Spotify vào chat là bot sẽ tự phát luôn)* 🎵`,
        components: [Components.voiceActionRow()]
      });
      setTimeout(() => replyMsg.delete().catch(() => {}), 15000);
      return;
    }

    if (['!leave', '!out', '!kick'].includes(lowerContent)) {
      const queue = queueManager.get(message.guild);
      queue.destroy();
      const leaveMsg = await message.reply('🔴 **Đã ngắt kết nối và rời khỏi phòng thoại!**');
      setTimeout(() => leaveMsg.delete().catch(() => {}), 5000);
      return;
    }

    // =========================================================================
    // 3. TRIẾT LÝ "ZERO-TYPING": TỰ ĐỘNG BẮT LINK NHẠC DÁN TRỰC TIẾP VÀO CHAT
    // =========================================================================
    const musicUrls = Extractor.extractUrls(trimmedContent);
    if (musicUrls.length === 0) return;

    // Kiểm tra kênh âm nhạc chuyên dụng nếu được cấu hình
    if (config.musicChannelId && message.channel.id !== config.musicChannelId) {
      return;
    }

    const memberVoice = message.member?.voice?.channel;
    if (!memberVoice) {
      const warnMsg = await message.reply('⚠️ Bạn cần tham gia một phòng thoại (Voice Channel) trước khi dán link nghe nhạc!');
      setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      return;
    }

    const queue = queueManager.get(message.guild);

    // Kiểm tra Chế độ Khóa DJ
    if (queue.djOnly && !config.isAdmin(message.author)) {
      const djWarn = await message.reply('🔒 Chế độ DJ đang được kích hoạt. Hiện tại chỉ Admin mới có quyền thêm bài hát!');
      setTimeout(() => djWarn.delete().catch(() => {}), 6000);
      return;
    }

    queue.textChannel = message.channel;

    // Tự động kết nối vào phòng thoại của người dùng nếu bot chưa vào
    if (!queue.connection || !queue.voiceChannel) {
      await queue.connect(memberVoice);
    }

    // Tự động xóa tin nhắn dán link của người dùng để giữ kênh chat sạch đẹp
    await message.delete().catch(() => {});

    const statusMsg = await message.channel.send('🔍 Đang bóc tách luồng audio sạch 100% không quảng cáo...');

    try {
      let addedCount = 0;
      for (const url of musicUrls) {
        const songs = await Extractor.resolve(url, message.author);
        if (songs.length === 0) continue;

        for (const song of songs) {
          if (!queue.currentSong) {
            queue.songs.push(song);
            await queue.playNext();
          } else {
            queue.songs.push(song);
            addedCount++;
          }
        }

        // Nếu thêm bài vào danh sách chờ
        if (addedCount > 0 && songs.length === 1) {
          const addedEmbed = Embeds.songAdded(songs[0], queue.songs.length);
          const notifyMsg = await message.channel.send({ embeds: [addedEmbed] });
          setTimeout(() => notifyMsg.delete().catch(() => {}), 7000);
        }
      }

      if (addedCount > 1) {
        const playlistMsg = await message.channel.send(`✅ Đã thêm thành công **${addedCount} bài hát** vào hàng đợi!`);
        setTimeout(() => playlistMsg.delete().catch(() => {}), 7000);
      }
    } catch (err) {
      console.error('[Music Process Error]:', err);
    } finally {
      statusMsg.delete().catch(() => {});
    }
  }
}

module.exports = MessageHandler;
