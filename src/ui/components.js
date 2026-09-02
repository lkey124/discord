const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class Components {
  /**
   * Hàng nút điều khiển bài hát chính (Now Playing Controls)
   */
  static playerControls(isPaused = false, loopMode = 0) {
    const pauseBtn = new ButtonBuilder()
      .setCustomId('btn_player_pause')
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setLabel(isPaused ? 'Tiếp tục' : 'Tạm dừng')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary);

    const skipBtn = new ButtonBuilder()
      .setCustomId('btn_player_skip')
      .setEmoji('⏭️')
      .setLabel('Bỏ qua')
      .setStyle(ButtonStyle.Primary);

    const loopBtn = new ButtonBuilder()
      .setCustomId('btn_player_loop')
      .setEmoji(loopMode === 1 ? '🔂' : '🔁')
      .setLabel(loopMode === 1 ? 'Lặp bài' : loopMode === 2 ? 'Lặp queue' : 'Lặp: Tắt')
      .setStyle(loopMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary);

    const stopBtn = new ButtonBuilder()
      .setCustomId('btn_player_stop')
      .setEmoji('⏹️')
      .setLabel('Dừng hẳn')
      .setStyle(ButtonStyle.Danger);

    const queueBtn = new ButtonBuilder()
      .setCustomId('btn_player_queue')
      .setEmoji('📜')
      .setLabel('Mở Hàng Đợi')
      .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder().addComponents(pauseBtn, skipBtn, loopBtn, stopBtn, queueBtn);
  }

  /**
   * Hàng nút điều hướng phòng thoại: Vào Room / Rời Room
   */
  static voiceActionRow() {
    const joinBtn = new ButtonBuilder()
      .setCustomId('btn_voice_join')
      .setEmoji('🟢')
      .setLabel('Vào Room Voice')
      .setStyle(ButtonStyle.Success);

    const leaveBtn = new ButtonBuilder()
      .setCustomId('btn_voice_leave')
      .setEmoji('🔴')
      .setLabel('Kích Bot Rời Room')
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder().addComponents(joinBtn, leaveBtn);
  }

  /**
   * Bộ điều khiển cho bảng Hàng Đợi (Queue Pagination & Deletion)
   */
  static queueControls(queue, currentPage = 1, pageSize = 8) {
    const totalSongs = queue.songs.length;
    const maxPages = Math.max(Math.ceil(totalSongs / pageSize), 1);

    // Row 1: Nút phân trang và thao tác
    const prevBtn = new ButtonBuilder()
      .setCustomId(`btn_queue_prev_${currentPage}`)
      .setEmoji('◀️')
      .setLabel('Trang trước')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`btn_queue_next_${currentPage}`)
      .setEmoji('▶️')
      .setLabel('Trang sau')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= maxPages);

    const shuffleBtn = new ButtonBuilder()
      .setCustomId('btn_queue_shuffle')
      .setEmoji('🔀')
      .setLabel('Xáo trộn')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalSongs < 2);

    const closeBtn = new ButtonBuilder()
      .setCustomId('btn_queue_close')
      .setEmoji('❌')
      .setLabel('Đóng')
      .setStyle(ButtonStyle.Danger);

    const buttonRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn, shuffleBtn, closeBtn);
    const components = [buttonRow];

    // Row 2: Select Menu xóa bài trên trang hiện tại
    const startIndex = (currentPage - 1) * pageSize;
    const currentSongs = queue.songs.slice(startIndex, startIndex + pageSize);

    if (currentSongs.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('menu_queue_remove')
        .setPlaceholder('🗑️ Chọn một bài hát để xóa khỏi hàng đợi...');

      currentSongs.forEach((song, idx) => {
        const actualIndex = startIndex + idx;
        const shortTitle = song.title.length > 70 ? song.title.substring(0, 67) + '...' : song.title;
        selectMenu.addOptions({
          label: `#${actualIndex + 1}. ${shortTitle}`,
          description: `Thời lượng: ${song.duration} | Người gửi: ${song.requester?.username || 'Ẩn danh'}`,
          value: `${actualIndex}`
        });
      });

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return components;
  }

  /**
   * Bảng điều khiển tối cao Admin trong DM
   */
  static adminControls(guildId, queue) {
    const djOnly = queue?.djOnly || false;
    const ttsEnabled = queue?.ttsEnabled ?? true;

    // Row 1: Quyền hạn và can thiệp bài hát
    const djBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_toggle_dj_${guildId}`)
      .setEmoji(djOnly ? '🔓' : '🔒')
      .setLabel(djOnly ? 'Mở DJ (Ai cũng dán link)' : 'Khóa DJ (Chỉ Admin dán link)')
      .setStyle(djOnly ? ButtonStyle.Success : ButtonStyle.Secondary);

    const ttsBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_toggle_tts_${guildId}`)
      .setEmoji(ttsEnabled ? '🔇' : '🔊')
      .setLabel(ttsEnabled ? 'Tắt Voice TTS' : 'Bật Voice TTS')
      .setStyle(ttsEnabled ? ButtonStyle.Secondary : ButtonStyle.Success);

    const forceSkipBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_force_skip_${guildId}`)
      .setEmoji('⏭️')
      .setLabel('Cưỡng chế Skip')
      .setStyle(ButtonStyle.Primary);

    const row1 = new ActionRowBuilder().addComponents(djBtn, ttsBtn, forceSkipBtn);

    // Row 2: Quản lý hàng đợi và ngắt kết nối
    const clearBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_clear_queue_${guildId}`)
      .setEmoji('🗑️')
      .setLabel('Xóa Sạch Queue')
      .setStyle(ButtonStyle.Danger);

    const forceLeaveBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_force_leave_${guildId}`)
      .setEmoji('🔌')
      .setLabel('Ép Bot Rời Phòng')
      .setStyle(ButtonStyle.Danger);

    const refreshBtn = new ButtonBuilder()
      .setCustomId(`btn_admin_refresh_${guildId}`)
      .setEmoji('🔄')
      .setLabel('Làm Mới Bảng')
      .setStyle(ButtonStyle.Secondary);

    const row2 = new ActionRowBuilder().addComponents(clearBtn, forceLeaveBtn, refreshBtn);

    return [row1, row2];
  }
}

module.exports = Components;
