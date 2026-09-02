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

    // Kiểm tra bot có đang trong phòng thoại này không
    const botVoiceId = queue.voiceChannel?.id;
    if (!botVoiceId) return;

    // 1. THÀNH VIÊN THAM GIA VÀO PHÒNG THOẠI CỦA BOT
    const joinedBotRoom = newState.channelId === botVoiceId && oldState.channelId !== botVoiceId;

    if (joinedBotRoom) {
      const member = newState.member;
      if (!member) return;

      // Kiểm tra cooldown 10 giây chống spam ra vào
      if (queue.announcer.canAnnounce(member.id)) {
        const nameToAnnounce = member.displayName || member.user.username;
        await queue.announcer.announceMemberJoin(nameToAnnounce);
      }
    }

    // 2. TỰ ĐỘNG DỌN DẸP / RỜI PHÒNG NẾU KHÔNG CÒN AI TRONG PHÒNG
    const currentChannel = guild.channels.cache.get(botVoiceId);
    if (currentChannel) {
      // Đếm số người thật (loại trừ bot)
      const nonBotMembers = currentChannel.members.filter(m => !m.user.bot);
      if (nonBotMembers.size === 0) {
        // Tự động giải phóng bot sau 60 giây nếu phòng hoàn toàn trống
        if (!queue.leaveTimeout) {
          queue.leaveTimeout = setTimeout(() => {
            if (currentChannel.members.filter(m => !m.user.bot).size === 0) {
              queue.destroy();
            }
            queue.leaveTimeout = null;
          }, 60000);
        }
      } else if (queue.leaveTimeout) {
        clearTimeout(queue.leaveTimeout);
        queue.leaveTimeout = null;
      }
    }
  }
}

module.exports = VoiceHandler;
