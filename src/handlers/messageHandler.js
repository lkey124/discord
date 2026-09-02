const config = require('../config');
const queueManager = require('../music/QueueManager');
const Extractor = require('../music/Extractor');
const Embeds = require('../ui/embeds');
const Components = require('../ui/components');

class MessageHandler {
  static processedMessages = new Set();

  /**
   * Xử lý toàn bộ tin nhắn chat trong server (Hỗ trợ Zero-Typing và Hệ thống Lệnh đầy đủ)
   * @param {object} message Discord Message
   */
  static async handle(message) {
    if (message.author.bot || !message.guild) return;

    // Chống xử lý trùng lặp sự kiện cùng một tin nhắn trong 5 giây
    if (MessageHandler.processedMessages.has(message.id)) return;
    MessageHandler.processedMessages.add(message.id);
    setTimeout(() => MessageHandler.processedMessages.delete(message.id), 5000);

    const trimmedContent = message.content.trim();
    if (!trimmedContent) return;

    // =========================================================================
    // 1. CƠ CHẾ LỆNH ẨN ADMIN TUYỆT ĐỐI (Invisible Admin Trigger)
    // =========================================================================
    if (trimmedContent.toLowerCase() === config.secretCode.toLowerCase()) {
      await message.delete().catch(() => {});

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
    // 2. HỆ THỐNG LỆNH VĂN BẢN (TEXT COMMANDS VỚI TIỀN TỐ !)
    // =========================================================================
    if (trimmedContent.startsWith('!')) {
      const args = trimmedContent.slice(1).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();
      const queue = queueManager.get(message.guild);

      // --- 2.1. Lệnh Trợ Giúp & Trạng Thái ---
      if (['lenh', 'giup', 'huongdan', 'menu', 'help'].includes(command)) {
        const embed = Embeds.help();
        return message.reply({ embeds: [embed] });
      }

      if (['trangthai', 'tt', 'ping', 'status', 'uptime'].includes(command)) {
        const uptimeSec = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSec / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        const seconds = uptimeSec % 60;
        const memoryMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

        const statusText =
          `📊 **TRẠNG THÁI HOẠT ĐỘNG BOT:**\n` +
          `• **Độ trễ Ping:** \`${message.client.ws.ping}ms\`\n` +
          `• **Thời gian online:** \`${hours}h ${minutes}m ${seconds}s\`\n` +
          `• **Bộ nhớ RAM sử dụng:** \`${memoryMB} MB\`\n` +
          `• **Số server đang tham gia:** \`${message.client.guilds.cache.size} server\`\n` +
          `• **Chế độ 24/7:** \`🟢 Đang hoạt động (Anti-Sleep tích hợp sẵn)\``;

        const statusMsg = await message.reply(statusText);
        setTimeout(() => statusMsg.delete().catch(() => {}), 15000);
        return;
      }

      // --- 2.2. Lệnh Phòng Thoại ---
      if (['vao', 'goi', 'join', 'call', 'bot'].includes(command)) {
        const memberVoice = message.member?.voice?.channel;
        if (!memberVoice) {
          const warn = await message.reply('⚠️ Bạn cần tham gia một phòng thoại trước!');
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        queue.textChannel = message.channel;
        await queue.connect(memberVoice);

        const replyMsg = await message.reply({
          content: `🟢 **Đã kết nối vào phòng:** <#${memberVoice.id}>!\n*(Dán link nhạc vào chat hoặc gõ \`!phat <tên bài>\` để phát nhạc)* 🎵`,
          components: [Components.voiceActionRow()]
        });
        setTimeout(() => replyMsg.delete().catch(() => {}), 15000);
        return;
      }

      if (['ra', 'cut', 'roi', 'leave', 'out', 'kick'].includes(command)) {
        queue.destroy();
        const leaveMsg = await message.reply('🔴 **Đã ngắt kết nối và rời khỏi phòng thoại!**');
        setTimeout(() => leaveMsg.delete().catch(() => {}), 5000);
        return;
      }

      // --- 2.3. Lệnh Phát Nhạc (!phat, !p, !hat, !nhac) ---
      if (['phat', 'hat', 'nhac', 'play', 'p'].includes(command)) {
        const query = args.join(' ').trim();
        if (!query) {
          const warn = await message.reply('⚠️ Vui lòng cung cấp link bài hát hoặc tên bài hát cần tìm! (Ví dụ: `!phat Kyoto in the rain` hoặc `!p tên bài`)');
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        const memberVoice = message.member?.voice?.channel;
        if (!memberVoice) {
          const warn = await message.reply('⚠️ Bạn cần tham gia một phòng thoại trước khi bật nhạc!');
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        if (queue.djOnly && !config.isAdmin(message.author)) {
          const djWarn = await message.reply('🔒 Chế độ DJ đang bật. Chỉ Admin mới có quyền phát nhạc!');
          setTimeout(() => djWarn.delete().catch(() => {}), 6000);
          return;
        }

        queue.textChannel = message.channel;
        if (!queue.connection || !queue.voiceChannel) {
          await queue.connect(memberVoice);
        }

        await message.delete().catch(() => {});

        const statusMsg = await message.channel.send(`🔍 Đang tìm kiếm bài hát: **${query}**...`);
        try {
          const songs = await Extractor.resolve(query, message.author);
          if (songs.length === 0) {
            const notFound = await message.channel.send(`❌ Không tìm thấy bài hát phù hợp với từ khóa: **${query}**`);
            setTimeout(() => notFound.delete().catch(() => {}), 6000);
            return;
          }

          let addedCount = 0;
          for (const song of songs) {
            if (!queue.currentSong) {
              queue.songs.push(song);
              await queue.playNext();
            } else {
              const isCurrent = queue.currentSong?.url === song.url;
              const isLastInQueue = queue.songs.length > 0 && queue.songs[queue.songs.length - 1].url === song.url;
              if (!isCurrent && !isLastInQueue) {
                queue.songs.push(song);
                addedCount++;
              }
            }
          }

          if (addedCount > 0 && songs.length === 1) {
            const addedEmbed = Embeds.songAdded(songs[0], queue.songs.length);
            const notifyMsg = await message.channel.send({ embeds: [addedEmbed] });
            setTimeout(() => notifyMsg.delete().catch(() => {}), 7000);
          } else if (addedCount > 1) {
            const playlistMsg = await message.channel.send(`✅ Đã thêm thành công **${addedCount} bài hát** vào hàng đợi!`);
            setTimeout(() => playlistMsg.delete().catch(() => {}), 7000);
          }
        } catch (err) {
          console.error('[Play Command Error]:', err);
        } finally {
          statusMsg.delete().catch(() => {});
        }
        return;
      }

      // --- 2.4. Các lệnh điều khiển âm nhạc ---
      if (['tamdung', 'dung', 'pause'].includes(command)) {
        if (!queue.currentSong) return message.reply('⚠️ Không có bài hát nào đang chạy!');

        // Kiểm tra quyền: Chỉ người gửi bài hoặc Admin mới được tạm dừng
        const isOwnerOrAdmin = (queue.currentSong.requester?.id === message.author.id) || config.isAdmin(message.author);
        if (!isOwnerOrAdmin) {
          const reqName = queue.currentSong.requester ? `<@${queue.currentSong.requester.id}>` : 'người yêu cầu';
          const warn = await message.reply(`⚠️ Chỉ có người gửi bài hát này (${reqName}) hoặc Admin mới có quyền tạm dừng!`);
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        const isPaused = queue.togglePause();
        const notice = await message.reply(isPaused ? '⏸️ **Đã tạm dừng bài hát.**' : '▶️ **Đã tiếp tục phát bài hát.**');
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      if (['tieptuc', 'tiep', 'resume'].includes(command)) {
        if (!queue.currentSong) return message.reply('⚠️ Không có bài hát nào đang chạy!');

        // Kiểm tra quyền: Chỉ người gửi bài hoặc Admin mới được tiếp tục
        const isOwnerOrAdmin = (queue.currentSong.requester?.id === message.author.id) || config.isAdmin(message.author);
        if (!isOwnerOrAdmin) {
          const reqName = queue.currentSong.requester ? `<@${queue.currentSong.requester.id}>` : 'người yêu cầu';
          const warn = await message.reply(`⚠️ Chỉ có người gửi bài hát này (${reqName}) hoặc Admin mới có quyền tiếp tục phát!`);
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        if (queue.isPaused) queue.togglePause();
        const notice = await message.reply('▶️ **Đã tiếp tục phát bài hát.**');
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      if (['qua', 'chuyen', 'boqua', 'skip', 'next', 'fs'].includes(command)) {
        if (!queue.currentSong) return message.reply('⚠️ Không có bài hát nào để bỏ qua!');
        queue.skip();
        const notice = await message.reply('⏭️ **Đã bỏ qua bài hát hiện tại!**');
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      if (['tat', 'dunglai', 'stop'].includes(command)) {
        if (!queue.currentSong) return message.reply('⚠️ Không có bài hát nào đang phát!');

        // Kiểm tra quyền: Chỉ người gửi bài hoặc Admin mới được tắt
        const isOwnerOrAdmin = (queue.currentSong.requester?.id === message.author.id) || config.isAdmin(message.author);
        if (!isOwnerOrAdmin) {
          const reqName = queue.currentSong.requester ? `<@${queue.currentSong.requester.id}>` : 'người yêu cầu';
          const warn = await message.reply(`⚠️ Chỉ có người gửi bài hát này (${reqName}) hoặc Admin mới có quyền tắt nhạc!`);
          setTimeout(() => warn.delete().catch(() => {}), 6000);
          return;
        }

        queue.stop();
        const notice = await message.reply('⏹️ **Đã dừng hẳn và dọn sạch hàng đợi!**');
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      if (['danhsach', 'ds', 'hangdoi', 'queue', 'q', 'list'].includes(command)) {
        const embed = Embeds.queueList(queue, 1);
        const components = Components.queueControls(queue, 1);
        const qMsg = await message.reply({ embeds: [embed], components });
        return;
      }

      if (['bai', 'dangphat', 'nowplaying', 'np'].includes(command)) {
        if (!queue.currentSong) return message.reply('⚠️ Hiện tại không có bài hát nào đang phát!');
        const embed = Embeds.nowPlaying(queue.currentSong, queue, queue.isPaused ? 'Tạm dừng' : 'Đang phát');
        const components = [Components.playerControls(queue.isPaused, queue.loopMode)];
        return message.reply({ embeds: [embed], components });
      }

      if (['lap', 'loop', 'l'].includes(command)) {
        const loopMode = queue.cycleLoopMode();
        const labels = ['❌ Đã tắt lặp', '🔂 Đang lặp bài hiện tại', '🔁 Đang lặp toàn bộ hàng đợi'];
        const notice = await message.reply(`🔁 **${labels[loopMode]}**`);
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      if (['tron', 'xao', 'daobai', 'shuffle'].includes(command)) {
        if (queue.songs.length < 2) return message.reply('⚠️ Hàng đợi cần tối thiểu 2 bài hát để xáo trộn!');
        queue.shuffle();
        const notice = await message.reply('🔀 **Đã xáo trộn ngẫu nhiên toàn bộ danh sách chờ!**');
        setTimeout(() => notice.delete().catch(() => {}), 5000);
        return;
      }

      // --- 2.5. Lệnh Voice Announcer & Giọng Nói ---
      if (['docten', 'tts'].includes(command)) {
        const sub = args[0]?.toLowerCase();
        if (sub === 'on' || sub === 'bat') queue.ttsEnabled = true;
        else if (sub === 'off' || sub === 'tat') queue.ttsEnabled = false;
        else queue.ttsEnabled = !queue.ttsEnabled;

        const notice = await message.reply(`📢 **Voice Announcer (Đọc tên vào phòng):** \`${queue.ttsEnabled ? '🟢 ĐANG BẬT' : '🔴 ĐANG TẮT'}\``);
        setTimeout(() => notice.delete().catch(() => {}), 6000);
        return;
      }

      if (['noi', 'doc', 'say', 'speak'].includes(command)) {
        const textToSay = args.join(' ').trim();
        if (!textToSay) return message.reply('⚠️ Vui lòng nhập nội dung muốn bot nói! (Ví dụ: `!noi Chào cả nhà`)');

        const memberVoice = message.member?.voice?.channel;
        if (!memberVoice) return message.reply('⚠️ Bạn cần vào phòng thoại trước để nghe bot nói!');

        queue.textChannel = message.channel;
        if (!queue.connection || !queue.voiceChannel) {
          await queue.connect(memberVoice);
        }

        await queue.announcer.announceMemberJoin(textToSay);
        await message.delete().catch(() => {});
        return;
      }
    }

    // =========================================================================
    // 3. TRIẾT LÝ "ZERO-TYPING": TỰ ĐỘNG BẮT LINK NHẠC DÁN TRỰC TIẾP VÀO CHAT
    // =========================================================================
    const musicUrls = Extractor.extractUrls(trimmedContent);
    if (musicUrls.length === 0) return;

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

    if (queue.djOnly && !config.isAdmin(message.author)) {
      const djWarn = await message.reply('🔒 Chế độ DJ đang được kích hoạt. Hiện tại chỉ Admin mới có quyền thêm bài hát!');
      setTimeout(() => djWarn.delete().catch(() => {}), 6000);
      return;
    }

    queue.textChannel = message.channel;

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

        let addedCount = 0;
        for (const song of songs) {
          if (!queue.currentSong) {
            queue.songs.push(song);
            await queue.playNext();
          } else {
            const isCurrent = queue.currentSong?.url === song.url;
            const isLastInQueue = queue.songs.length > 0 && queue.songs[queue.songs.length - 1].url === song.url;
            if (!isCurrent && !isLastInQueue) {
              queue.songs.push(song);
              addedCount++;
            }
          }
        }

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
