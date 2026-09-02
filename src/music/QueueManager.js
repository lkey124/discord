const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const Extractor = require('./Extractor');
const Announcer = require('../tts/Announcer');
const Embeds = require('../ui/embeds');
const Components = require('../ui/components');

class GuildQueue {
  constructor(guild, manager) {
    this.guild = guild;
    this.manager = manager;
    this.voiceChannel = null;
    this.textChannel = null;
    this.connection = null;
    this.player = createAudioPlayer();
    this.songs = [];
    this.currentSong = null;
    this.loopMode = 0; // 0 = off, 1 = song, 2 = queue
    this.djOnly = false;
    this.ttsEnabled = true;
    this.isPaused = false;
    this.pausedByTTS = false;
    this.playerMessage = null;
    this.announcer = new Announcer(this);

    // Xử lý sự kiện Player nhạc
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.handleSongEnd();
    });

    this.player.on('error', (err) => {
      console.error(`[Player Error ${this.guild.name}]:`, err.message);
      if (this.textChannel) {
        this.textChannel.send(`⚠️ Lỗi khi phát bài hát: \`${err.message}\`. Đang chuyển bài tiếp theo...`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }
      this.handleSongEnd();
    });
  }

  /**
   * Kết nối vào Voice Channel
   */
  async connect(voiceChannel) {
    this.voiceChannel = voiceChannel;
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 15000);
    } catch (e) {
      console.warn('[VoiceConnection]: Đang hoàn tất bắt tay UDP...');
    }

    // Lắng nghe trạng thái ngắt kết nối
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch (e) {
        this.destroy();
      }
    });

    // Mặc định kết nối tới player phát nhạc
    this.connection.subscribe(this.player);
  }

  /**
   * Phát bài hát kế tiếp trong hàng đợi
   */
  async playNext() {
    if (this.songs.length === 0 && !this.currentSong) {
      this.currentSong = null;
      if (this.playerMessage) {
        this.playerMessage.delete().catch(() => {});
        this.playerMessage = null;
      }
      return;
    }

    // Xử lý chế độ Lặp bài (loopMode = 1)
    if (this.loopMode === 1 && this.currentSong) {
      // Giữ nguyên currentSong
    } else {
      // Nếu lặp cả hàng đợi (loopMode = 2) và vừa hết bài cũ
      if (this.loopMode === 2 && this.currentSong) {
        this.songs.push(this.currentSong);
      }
      this.currentSong = this.songs.shift();
    }

    if (!this.currentSong) return;

    try {
      const audioData = await Extractor.getAudioStream(this.currentSong);
      const resource = createAudioResource(audioData.stream, {
        inputType: audioData.type,
        inlineVolume: true
      });

      this.isPaused = false;
      this.pausedByTTS = false;
      this.connection.subscribe(this.player);
      this.player.play(resource);

      await this.sendOrUpdatePlayerMessage();

      // Tải trước bài tiếp theo trong hàng đợi ngầm (Prefetch) để chuyển bài tức thì
      if (this.songs.length > 0 && this.songs[0]) {
        Extractor.prefetch(this.songs[0]);
      }
    } catch (err) {
      console.error('[PlayNext Error]:', err);
      if (this.textChannel) {
        this.textChannel.send(`❌ Không thể phát bài hát **${this.currentSong.title}**: ${err.message}`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
      }
      this.currentSong = null;
      this.playNext();
    }
  }

  /**
   * Xử lý khi bài hát kết thúc
   */
  handleSongEnd() {
    if (this.pausedByTTS) return;
    this.playNext();
  }

  /**
   * Tạm dừng nhạc để nhường quyền cho TTS thông báo
   */
  pauseMusicForTTS() {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.pausedByTTS = true;
      this.player.pause(true);
    }
  }

  /**
   * Tiếp tục phát nhạc sau khi TTS thông báo xong
   */
  resumeMusicAfterTTS() {
    if (this.pausedByTTS && !this.isPaused) {
      this.pausedByTTS = false;
      if (this.connection) {
        this.connection.subscribe(this.player);
      }
      this.player.unpause();
    } else {
      this.pausedByTTS = false;
    }
  }

  /**
   * Tạm dừng hoặc tiếp tục theo yêu cầu của người dùng
   */
  togglePause() {
    if (this.isPaused) {
      this.player.unpause();
      this.isPaused = false;
    } else {
      this.player.pause(true);
      this.isPaused = true;
    }
    this.sendOrUpdatePlayerMessage();
    return this.isPaused;
  }

  /**
   * Bỏ qua bài hát hiện tại
   */
  skip() {
    if (this.loopMode === 1) {
      this.loopMode = 0; // Tắt lặp bài hiện tại nếu người dùng chủ động skip
    }
    this.player.stop(true);
  }

  /**
   * Dừng hẳn và xóa danh sách phát
   */
  stop() {
    this.songs = [];
    this.currentSong = null;
    this.loopMode = 0;
    this.player.stop(true);
    if (this.playerMessage) {
      this.playerMessage.delete().catch(() => {});
      this.playerMessage = null;
    }
  }

  /**
   * Xáo trộn ngẫu nhiên hàng đợi
   */
  shuffle() {
    for (let i = this.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
    }
  }

  /**
   * Xóa một bài cụ thể khỏi hàng đợi theo index
   */
  removeSong(index) {
    if (index >= 0 && index < this.songs.length) {
      return this.songs.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Thay đổi chế độ lặp
   */
  cycleLoopMode() {
    this.loopMode = (this.loopMode + 1) % 3;
    this.sendOrUpdatePlayerMessage();
    return this.loopMode;
  }

  /**
   * Cập nhật hoặc gửi tin nhắn giao diện Now Playing
   */
  async sendOrUpdatePlayerMessage() {
    if (!this.currentSong || !this.textChannel) return;

    const embed = Embeds.nowPlaying(this.currentSong, this, this.isPaused ? 'Tạm dừng' : 'Đang phát');
    const components = [Components.playerControls(this.isPaused, this.loopMode)];

    try {
      if (this.playerMessage) {
        await this.playerMessage.edit({ embeds: [embed], components });
      } else {
        this.playerMessage = await this.textChannel.send({ embeds: [embed], components });
      }
    } catch (err) {
      // Nếu tin nhắn cũ bị xóa, gửi tin nhắn mới
      try {
        this.playerMessage = await this.textChannel.send({ embeds: [embed], components });
      } catch (e) {
        console.error('[sendOrUpdatePlayerMessage Error]:', e.message);
      }
    }
  }

  /**
   * Ngắt kết nối và giải phóng tài nguyên
   */
  destroy() {
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
      this.leaveTimeout = null;
    }
    this.stop();
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (e) {}
      this.connection = null;
    }
    this.manager.delete(this.guild.id);
  }
}

class QueueManager {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Lấy hoặc khởi tạo Queue cho Guild
   * @param {object} guild Discord Guild
   * @returns {GuildQueue}
   */
  get(guild) {
    if (!this.queues.has(guild.id)) {
      this.queues.set(guild.id, new GuildQueue(guild, this));
    }
    return this.queues.get(guild.id);
  }

  delete(guildId) {
    this.queues.delete(guildId);
  }
}

module.exports = new QueueManager();
