const config = require('../config');
const queueManager = require('../music/QueueManager');
const Embeds = require('../ui/embeds');
const Components = require('../ui/components');

class InteractionHandler {
  /**
   * Xử lý toàn bộ Button và Select Menu
   * @param {object} interaction Discord Interaction
   * @param {object} client Discord Client
   */
  static async handle(interaction, client) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;

    // =========================================================================
    // 1. NÚT ĐIỀU KHIỂN BẢNG ADMIN BÍ MẬT (Trong DM của Admin)
    // =========================================================================
    if (customId.startsWith('btn_admin_')) {
      if (!config.isAdmin(interaction.user)) {
        return interaction.reply({ content: '⛔ Bạn không có quyền can thiệp vào bảng quản trị!', ephemeral: true });
      }

      // Trích xuất action và guildId: btn_admin_{action}_{guildId}
      const parts = customId.split('_');
      const action = parts[2];
      const guildId = parts.slice(3).join('_');

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return interaction.reply({ content: '❌ Không tìm thấy thông tin máy chủ!', ephemeral: true });
      }

      const queue = queueManager.get(guild);

      switch (action) {
        case 'toggle': {
          const target = parts[3]; // 'dj' hoặc 'tts'
          if (target === 'dj') {
            queue.djOnly = !queue.djOnly;
          } else if (target === 'tts') {
            queue.ttsEnabled = !queue.ttsEnabled;
          }
          break;
        }
        case 'force': {
          const subAction = parts[3];
          if (subAction === 'skip') {
            queue.skip();
          } else if (subAction === 'leave') {
            queue.destroy();
          }
          break;
        }
        case 'clear': {
          queue.songs = [];
          break;
        }
        case 'refresh': {
          // Chỉ làm mới lại embed
          break;
        }
      }

      const updatedEmbed = Embeds.adminPanel(guild, queue);
      const updatedComponents = Components.adminControls(guild.id, queue);

      return interaction.update({
        embeds: [updatedEmbed],
        components: updatedComponents
      }).catch(() => {});
    }

    // =========================================================================
    // 2. NÚT ĐIỀU HƯỚNG VOICE (VÀO ROOM / KÍCH RỜI ROOM)
    // =========================================================================
    if (customId === 'btn_voice_join') {
      const memberVoice = interaction.member?.voice?.channel;
      if (!memberVoice) {
        return interaction.reply({ content: '⚠️ Bạn cần tham gia phòng thoại trước!', ephemeral: true });
      }
      const queue = queueManager.get(interaction.guild);
      await queue.connect(memberVoice);
      return interaction.reply({ content: `🟢 Đã kết nối vào phòng thoại: **${memberVoice.name}**`, ephemeral: true });
    }

    if (customId === 'btn_voice_leave') {
      const queue = queueManager.get(interaction.guild);
      queue.destroy();
      return interaction.reply({ content: '🔴 Đã ngắt kết nối và rời phòng thoại!', ephemeral: true });
    }

    // Các thao tác bên dưới yêu cầu thông tin Guild Queue
    const guild = interaction.guild;
    if (!guild) return;
    const queue = queueManager.get(guild);

    // =========================================================================
    // 3. NÚT ĐIỀU KHIỂN PHÁT NHẠC (NOW PLAYING BUTTONS)
    // =========================================================================
    if (customId === 'btn_player_pause') {
      if (!queue.currentSong) {
        return interaction.reply({ content: '⚠️ Không có bài hát nào đang chạy!', ephemeral: true });
      }

      // Kiểm tra quyền: CHỈ người gửi bài mới được tạm dừng
      const isOwner = (queue.currentSong.requester?.id === interaction.user.id);
      if (!isOwner) {
        const reqName = queue.currentSong.requester ? `<@${queue.currentSong.requester.id}>` : 'người yêu cầu';
        return interaction.reply({
          content: `⚠️ Chỉ có người gửi bài hát này (${reqName}) mới có quyền tạm dừng!`,
          ephemeral: true
        });
      }

      const isPaused = queue.togglePause();
      return interaction.reply({
        content: isPaused ? '⏸️ Đã tạm dừng bài hát.' : '▶️ Đã tiếp tục phát bài hát.',
        ephemeral: true
      });
    }

    if (customId === 'btn_player_skip') {
      if (!queue.currentSong) {
        return interaction.reply({ content: '⚠️ Không có bài hát nào để bỏ qua!', ephemeral: true });
      }
      queue.skip();
      return interaction.reply({ content: '⏭️ Đã bỏ qua bài hát hiện tại!', ephemeral: true });
    }

    if (customId === 'btn_player_loop') {
      const loopMode = queue.cycleLoopMode();
      const labels = ['❌ Đã tắt lặp', '🔂 Đang lặp bài hiện tại', '🔁 Đang lặp toàn bộ hàng đợi'];
      return interaction.reply({ content: labels[loopMode], ephemeral: true });
    }

    if (customId === 'btn_player_stop') {
      if (!queue.currentSong) {
        return interaction.reply({ content: '⚠️ Không có bài hát nào đang phát!', ephemeral: true });
      }

      // Kiểm tra quyền: CHỈ người gửi bài mới được tắt
      const isOwner = (queue.currentSong.requester?.id === interaction.user.id);
      if (!isOwner) {
        const reqName = queue.currentSong.requester ? `<@${queue.currentSong.requester.id}>` : 'người yêu cầu';
        return interaction.reply({
          content: `⚠️ Chỉ có người gửi bài hát này (${reqName}) mới có quyền tắt nhạc!`,
          ephemeral: true
        });
      }

      queue.stop();
      return interaction.reply({ content: '⏹️ Đã dừng hẳn và dọn sạch hàng đợi!', ephemeral: true });
    }

    if (customId === 'btn_player_queue') {
      const embed = Embeds.queueList(queue, 1);
      const components = Components.queueControls(queue, 1);
      return interaction.reply({ embeds: [embed], components, ephemeral: true });
    }

    // =========================================================================
    // 4. PHÂN TRANG VÀ THAO TÁC TRÊN DANH SÁCH CHỜ (QUEUE PAGINATION)
    // =========================================================================
    if (customId.startsWith('btn_queue_prev_') || customId.startsWith('btn_queue_next_')) {
      const isNext = customId.startsWith('btn_queue_next_');
      const currentPage = parseInt(customId.split('_')[3], 10) || 1;
      const targetPage = isNext ? currentPage + 1 : currentPage - 1;

      const embed = Embeds.queueList(queue, targetPage);
      const components = Components.queueControls(queue, targetPage);

      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'btn_queue_shuffle') {
      queue.shuffle();
      const embed = Embeds.queueList(queue, 1);
      const components = Components.queueControls(queue, 1);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'btn_queue_close') {
      return interaction.message.delete().catch(() => {});
    }

    // Menu chọn xóa bài khỏi hàng đợi
    if (customId === 'menu_queue_remove') {
      const selectedIndex = parseInt(interaction.values[0], 10);
      const removed = queue.removeSong(selectedIndex);

      const notice = removed ? `🗑️ Đã xóa bài **${removed.title}** khỏi hàng đợi!` : '⚠️ Không tìm thấy bài hát để xóa.';
      
      const embed = Embeds.queueList(queue, 1);
      const components = Components.queueControls(queue, 1);

      return interaction.update({
        content: notice,
        embeds: [embed],
        components
      });
    }
  }
}

module.exports = InteractionHandler;
