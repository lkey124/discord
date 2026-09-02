const { EmbedBuilder } = require('discord.js');

class Embeds {
  /**
   * Tạo thanh tiến trình giả lập trực quan
   */
  static createProgressBar(currentSec, totalSec, size = 15) {
    if (!totalSec || totalSec === 0) return '🔘' + '▬'.repeat(size);
    const progress = Math.min(Math.max(currentSec / totalSec, 0), 1);
    const progressIndex = Math.round(size * progress);
    const emptyProgress = size - progressIndex;
    const progressText = '▬'.repeat(Math.max(progressIndex - 1, 0)) + '🔘' + '▬'.repeat(Math.max(emptyProgress, 0));
    return progressText;
  }

  /**
   * Embed trình phát nhạc đang chạy (Now Playing)
   */
  static nowPlaying(song, queue, statusText = 'Đang phát') {
    const loopLabels = {
      0: '❌ Tắt',
      1: '🔂 Lặp bài hiện tại',
      2: '🔁 Lặp toàn bộ hàng đợi'
    };

    const embed = new EmbedBuilder()
      .setColor('#2F3136')
      .setTitle(`🎶 ${statusText}: ${song.title}`)
      .setURL(song.url)
      .setAuthor({
        name: 'Discord Music Player • Zero-Typing',
        iconURL: 'https://cdn-icons-png.flaticon.com/512/3845/3845874.png'
      })
      .setDescription(
        `**Tác giả:** \`${song.author}\`\n` +
        `**Thời lượng:** \`${song.duration}\`\n` +
        `**Yêu cầu bởi:** <@${song.requester ? song.requester.id : 'N/A'}>\n` +
        `**Chế độ lặp:** \`${loopLabels[queue.loopMode] || '❌ Tắt'}\`\n` +
        `**Voice Announcer:** \`${queue.ttsEnabled ? '🔊 Bật' : '🔇 Tắt'}\` | **Chế độ DJ:** \`${queue.djOnly ? '🔒 Bật' : '🔓 Tắt'}\`\n\n` +
        `\`00:00\` ${this.createProgressBar(1, song.durationSec || 100)} \`${song.duration}\``
      )
      .setFooter({
        text: `Hàng đợi còn: ${queue.songs.length} bài • Dán trực tiếp link nhạc để thêm bài tự động!`,
        iconURL: song.requester ? song.requester.displayAvatarURL() : undefined
      })
      .setTimestamp();

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    return embed;
  }

  /**
   * Embed thông báo thêm bài vào hàng đợi
   */
  static songAdded(song, position) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('✅ Đã thêm vào hàng đợi')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: 'Thời lượng', value: `\`${song.duration}\``, inline: true },
        { name: 'Vị trí trong hàng đợi', value: `#${position}`, inline: true },
        { name: 'Yêu cầu bởi', value: `<@${song.requester.id}>`, inline: true }
      )
      .setTimestamp();

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    return embed;
  }

  /**
   * Embed danh sách hàng đợi phân trang (Queue Pagination)
   */
  static queueList(queue, page = 1, pageSize = 8) {
    const totalSongs = queue.songs.length;
    const maxPages = Math.max(Math.ceil(totalSongs / pageSize), 1);
    const currentPage = Math.min(Math.max(page, 1), maxPages);

    const startIndex = (currentPage - 1) * pageSize;
    const currentSongs = queue.songs.slice(startIndex, startIndex + pageSize);

    let description = '';
    if (queue.currentSong) {
      description += `**Đang phát hiện tại:**\n▶️ [${queue.currentSong.title}](${queue.currentSong.url}) | \`${queue.currentSong.duration}\` | <@${queue.currentSong.requester?.id}>\n\n`;
    }

    description += `**Danh sách chờ:**\n`;

    if (currentSongs.length === 0) {
      description += `*Hàng đợi đang trống. Dán thêm link nhạc vào chat nhé!*`;
    } else {
      description += currentSongs
        .map((s, idx) => {
          const songIndex = startIndex + idx + 1;
          return `**${songIndex}.** [${s.title}](${s.url}) \`[${s.duration}]\` - <@${s.requester?.id}>`;
        })
        .join('\n');
    }

    return new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📜 Danh Sách Hàng Đợi Bài Hát')
      .setDescription(description)
      .setFooter({
        text: `Trang ${currentPage}/${maxPages} • Tổng: ${totalSongs} bài chờ • Lặp: ${queue.loopMode === 1 ? 'Bài' : queue.loopMode === 2 ? 'Hàng đợi' : 'Tắt'}`
      })
      .setTimestamp();
  }

  /**
   * Embed Bảng Điều Khiển Tối Cao Admin (Invisible DM Control Panel)
   */
  static adminPanel(guild, queue) {
    const vcName = queue?.voiceChannel ? `<#${queue.voiceChannel.id}>` : '`Chưa kết nối`';
    const currentTitle = queue?.currentSong ? `[${queue.currentSong.title}](${queue.currentSong.url})` : '`Không phát`';
    const queueCount = queue?.songs ? queue.songs.length : 0;
    const isPaused = queue?.isPaused ? '⏸️ Tạm dừng' : '▶️ Đang chạy';

    return new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🛡️ BẢNG ĐIỀU KHIỂN TỐI CAO (ADMIN INVISIBLE PANEL)')
      .setDescription(
        `Bảng điều khiển khẩn cấp dành riêng cho Quản trị viên.\n` +
        `Mọi thao tác can thiệp trực tiếp vào hoạt động của bot mà không tạo dấu vết trên kênh chung.`
      )
      .addFields(
        { name: '🌐 Máy chủ', value: `**${guild.name}** (\`${guild.id}\`)`, inline: false },
        { name: '🔊 Phòng thoại Bot', value: vcName, inline: true },
        { name: '🎵 Bài đang phát', value: currentTitle, inline: true },
        { name: '📊 Trạng thái phát', value: `\`${isPaused}\``, inline: true },
        { name: '🔒 Chế độ DJ (DJ Only)', value: queue?.djOnly ? '🔴 **ĐANG KHÓA** (Chỉ Admin được dán link)' : '🟢 **ĐANG MỞ** (Mọi người được dán link)', inline: true },
        { name: '📢 Voice Announcer (TTS)', value: queue?.ttsEnabled ? '🟢 **BẬT** (Đọc tên khi vào)' : '🔴 **TẮT**', inline: true },
        { name: '📜 Số bài trong Queue', value: `\`${queueCount} bài\``, inline: true }
      )
      .setFooter({
        text: 'Lệnh bí mật kích hoạt an toàn • Tự động xóa sau khi mở',
        iconURL: guild.iconURL() || undefined
      })
      .setTimestamp();
  }
}

module.exports = Embeds;
