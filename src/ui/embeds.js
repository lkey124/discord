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
   * Embed trình phát nhạc đang chạy (Now Playing) - Thiết kế siêu gọn gàng (Minimalist)
   */
  static nowPlaying(song, queue, statusText = 'Đang phát') {
    const loopIcons = { 0: '', 1: ' • 🔂 Lặp bài', 2: ' • 🔁 Lặp queue' };
    const requester = song.requester ? `<@${song.requester.id}>` : 'Mọi người';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🎵 ${statusText}: ${song.title}`)
      .setURL(song.url)
      .setDescription(
        `👤 **${song.author}** • ⏱️ **${song.duration}** • 🙋 ${requester}${loopIcons[queue.loopMode] || ''}\n\n` +
        `\`00:00\` ${this.createProgressBar(1, song.durationSec || 100)} \`${song.duration}\``
      );

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    if (queue.songs.length > 0) {
      embed.setFooter({ text: `Hàng đợi còn: ${queue.songs.length} bài tiếp theo` });
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
        { name: '📜 Số bài trong Queue', value: `\`${queueCount} bài\``, inline: true },
        { name: '⚡ Tự Động Giữ Thức 24/7', value: '🟢 **Đang Tự Động Ping** (Không cần App ngoài)', inline: false }
      )
      .setFooter({
        text: 'Lệnh bí mật kích hoạt an toàn • Tự động xóa sau khi mở • 24/7 Render Anti-Sleep',
        iconURL: guild.iconURL() || undefined
      })
      .setTimestamp();
  }

  /**
   * Embed Bảng Menu Hướng dẫn toàn bộ lệnh tiếng Việt
   */
  static help() {
    return new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🇻🇳 DANH SÁCH LỆNH TIẾNG VIỆT CỦA BOT')
      .setDescription(
        `Bot hỗ trợ cả 2 cách: **Dán link trực tiếp vào chat** và **Gõ lệnh tiếng Việt với tiền tố \`!\`**.\n` +
        `Dưới mỗi bài hát luôn có đầy đủ các nút bấm để điều khiển 1 chạm!`
      )
      .addFields(
        {
          name: '🎵 Lệnh Phát Nhạc',
          value:
            '• `!phat <tên hoặc link>` (viết tắt: `!p`, `!hat`, `!nhac`): Phát link hoặc tìm bài theo tên.\n' +
            '• `!tamdung` (viết tắt: `!dung`): Tạm dừng bài hát đang phát.\n' +
            '• `!tieptuc` (viết tắt: `!tiep`): Tiếp tục phát bài hát.\n' +
            '• `!qua` (viết tắt: `!chuyen`, `!boqua`, `!next`): Bỏ qua bài hát hiện tại.\n' +
            '• `!tat` (viết tắt: `!dunglai`, `!stop`): Dừng hẳn nhạc và xóa sạch hàng đợi.\n' +
            '• `!danhsach` (viết tắt: `!ds`, `!hangdoi`, `!q`): Xem danh sách bài hát chờ.\n' +
            '• `!bai` (viết tắt: `!dangphat`, `!np`): Xem thông tin bài hát đang phát.\n' +
            '• `!lap` (viết tắt: `!l`): Đổi chế độ lặp (Tắt / Lặp 1 bài / Lặp cả hàng đợi).\n' +
            '• `!tron` (viết tắt: `!xao`, `!daobai`): Xáo trộn ngẫu nhiên thứ tự bài hát.',
          inline: false
        },
        {
          name: '🔊 Lệnh Phòng Thoại & Giọng Nói',
          value:
            '• `!vao` (viết tắt: `!goi`, `!join`): Gọi bot vào phòng thoại bạn đang đứng.\n' +
            '• `!ra` (viết tắt: `!cut`, `!roi`, `!leave`): Đuổi bot ra khỏi phòng thoại.\n' +
            '• `!docten <bat/tat>` (viết tắt: `!tts`): Bật/tắt đọc tên khi có người vào phòng.\n' +
            '• `!noi <câu muốn nói>` (viết tắt: `!doc`): Bot nói to câu này bằng tiếng Việt!',
          inline: false
        },
        {
          name: '🛡️ Trợ Giúp & Tiện Ích',
          value:
            '• `!lenh` (viết tắt: `!giup`, `!huongdan`, `!help`): Mở bảng danh sách lệnh này.\n' +
            '• `!trangthai` (viết tắt: `!tt`, `!ping`): Xem độ trễ, Uptime và trạng thái 24/7.\n' +
            '• `#ad`: Lệnh bí mật Admin (Tự biến mất trong 0.01s, gửi bảng điều khiển vào DM).',
          inline: false
        }
      )
      .setFooter({ text: 'Discord Music & Voice Announcer Bot • Sẵn sàng 24/7' })
      .setTimestamp();
  }
}

module.exports = Embeds;
