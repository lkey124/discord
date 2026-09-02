const queueManager = require('../music/QueueManager');

class VoiceHandler {
  /**
   * Xử lý sự kiện thay đổi trạng thái phòng thoại
   * @param {object} oldState Discord VoiceState cũ
   * @param {object} newState Discord VoiceState mới
   */
  static async handle(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    // Bỏ qua nếu sự kiện phát sinh từ chính bot hoặc các bot khác
    if (newState.member?.user?.bot) return;

    const queue = queueManager.get(guild);

    // Xác định kênh phòng thoại bot đang tham gia (nếu có)
    const botVoiceChannel = guild.members.me?.voice?.channel || queue.voiceChannel;
    const botVoiceId = botVoiceChannel?.id;

    // =========================================================================
    // 1. THÀNH VIÊN THAM GIA VÀO PHÒNG THOẠI (VOICE ANNOUNCER)
    // =========================================================================
    const member = newState.member;
    const newChannel = newState.channel;

    // Trường hợp 1: Thành viên bước vào phòng thoại khi bot chưa ở trong phòng nào -> Tự động kết nối và chào
    if (newChannel && !botVoiceId && queue.ttsEnabled && oldState.channelId !== newState.channelId) {
      if (queue.announcer.canAnnounce(member.id)) {
        try {
          await queue.connect(newChannel);
          const nameToAnnounce = member.displayName || member.user.username;
          setTimeout(() => {
            queue.announcer.announceMemberJoin(nameToAnnounce);
          }, 800);
        } catch (e) {
          console.warn('[Auto-Join Voice Announcer Error]:', e.message);
        }
      }
    }
    // Trường hợp 2: Thành viên bước vào phòng thoại MÀ BOT ĐANG CÓ MẶT
    else if (botVoiceId && newState.channelId === botVoiceId && oldState.channelId !== botVoiceId) {
      if (member && queue.ttsEnabled) {
        if (queue.announcer.canAnnounce(member.id)) {
          const nameToAnnounce = member.displayName || member.user.username;
          await queue.announcer.announceMemberJoin(nameToAnnounce);
        }
      }
    }

    // =========================================================================
    // 2. THÀNH VIÊN RỜI KHỎI PHÒNG THOẠI (LEAVE ANNOUNCER)
    // =========================================================================
    const leftBotRoom = botVoiceId && oldState.channelId === botVoiceId && newState.channelId !== botVoiceId;
    if (leftBotRoom && member && queue.ttsEnabled) {
      // Đếm số người thật CÒN LẠI trong phòng
      const remainingHumans = activeBotChannel?.members ? activeBotChannel.members.filter(m => !m.user.bot && m.id !== member.id) : null;
      // Chỉ đọc thông báo rời khi trong phòng vẫn còn người nghe
      if (remainingHumans && remainingHumans.size > 0) {
        const nameToAnnounce = member.displayName || member.user.username;
        await queue.announcer.announceMemberLeave(nameToAnnounce);
      }
    }

    // =========================================================================
    // 3. TỰ ĐỘNG THOÁT PHÒNG KHI KHÔNG CÒN AI TRONG PHÒNG THOẠI (AUTO-LEAVE)
    // =========================================================================
    const activeBotChannel = guild.members.me?.voice?.channel || queue.voiceChannel;
    if (activeBotChannel && activeBotChannel.members) {
      // Đếm số người thật đang có mặt trong phòng (loại trừ các bot)
      const realHumans = activeBotChannel.members.filter(m => !m.user.bot);

      if (realHumans.size === 0) {
        // Nếu phòng hoàn toàn không còn ai, kích hoạt đếm ngược đúng 10 giây
        if (!queue.leaveTimeout) {
          console.log(`[Auto-Leave]: Phòng thoại "${activeBotChannel.name}" trống. Bot sẽ tự thoát sau đúng 10 giây nếu không ai vào lại.`);

          queue.leaveTimeout = setTimeout(async () => {
            // Kiểm tra lại lần cuối sau 10 giây
            const recheckChannel = guild.channels.cache.get(botVoiceId) || queue.voiceChannel;
            const remainingHumans = recheckChannel?.members ? recheckChannel.members.filter(m => !m.user.bot) : null;

            if (!remainingHumans || remainingHumans.size === 0) {
              console.log(`[Auto-Leave]: Phòng vẫn trống sau 10 giây. Bot tự động rời phòng.`);

              if (queue.textChannel) {
                try {
                  const notice = await queue.textChannel.send('👋 Không còn ai trong phòng thoại, bot tự động rời phòng để tiết kiệm tài nguyên!');
                  setTimeout(() => notice.delete().catch(() => {}), 6000);
                } catch (e) {}
              }

              queue.destroy();
            }
            queue.leaveTimeout = null;
          }, 10000); // Chính xác 10 giây
        }
      } else {
        // Nếu có người vào lại phòng trước khi hết 10 giây, lập tức hủy đếm ngược
        if (queue.leaveTimeout) {
          clearTimeout(queue.leaveTimeout);
          queue.leaveTimeout = null;
          console.log(`[Auto-Leave]: Đã có người vào lại phòng "${currentChannel.name}". Đã hủy bỏ tự thoát.`);
        }
      }
    }
  }
}

module.exports = VoiceHandler;
