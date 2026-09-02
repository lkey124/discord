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

    // Kiểm tra bot có đang trong phòng thoại nào của server không
    const botVoiceId = queue.voiceChannel?.id;
    if (!botVoiceId) return;

    // =========================================================================
    // 1. THÀNH VIÊN THAM GIA VÀO PHÒNG THOẠI CỦA BOT (VOICE ANNOUNCER)
    // =========================================================================
    const joinedBotRoom = newState.channelId === botVoiceId && oldState.channelId !== botVoiceId;

    if (joinedBotRoom) {
      const member = newState.member;
      if (member) {
        // Kiểm tra cooldown 10 giây chống spam ra vào
        if (queue.announcer.canAnnounce(member.id)) {
          const nameToAnnounce = member.displayName || member.user.username;
          await queue.announcer.announceMemberJoin(nameToAnnounce);
        }
      }
    }

    // =========================================================================
    // 2. TỰ ĐỘNG THOÁT PHÒNG KHI KHÔNG CÒN AI TRONG PHÒNG THOẠI (AUTO-LEAVE)
    // =========================================================================
    const currentChannel = guild.channels.cache.get(botVoiceId) || queue.voiceChannel;
    if (currentChannel && currentChannel.members) {
      // Đếm số người thật đang có mặt trong phòng (loại trừ các bot)
      const realHumans = currentChannel.members.filter(m => !m.user.bot);

      if (realHumans.size === 0) {
        // Nếu phòng hoàn toàn không còn ai, kích hoạt đếm ngược 15 giây
        if (!queue.leaveTimeout) {
          console.log(`[Auto-Leave]: Phòng thoại "${currentChannel.name}" trống. Bot sẽ tự thoát sau 15 giây nếu không ai vào lại.`);

          queue.leaveTimeout = setTimeout(async () => {
            // Kiểm tra lại lần cuối sau 15 giây
            const recheckChannel = guild.channels.cache.get(botVoiceId) || queue.voiceChannel;
            const remainingHumans = recheckChannel?.members ? recheckChannel.members.filter(m => !m.user.bot) : null;

            if (!remainingHumans || remainingHumans.size === 0) {
              console.log(`[Auto-Leave]: Phòng vẫn trống sau 15 giây. Bot tự động rời phòng.`);

              if (queue.textChannel) {
                try {
                  const notice = await queue.textChannel.send('👋 Không còn ai trong phòng thoại, bot xin phép rời phòng để tiết kiệm tài nguyên!');
                  setTimeout(() => notice.delete().catch(() => {}), 8000);
                } catch (e) {}
              }

              queue.destroy();
            }
            queue.leaveTimeout = null;
          }, 15000); // 15 giây
        }
      } else {
        // Nếu có người vào lại phòng trước khi hết 15 giây, lập tức hủy đếm ngược
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
