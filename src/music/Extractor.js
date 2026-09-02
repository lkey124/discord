const play = require('play-dl');
const yts = require('yt-search');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const Song = require('./Song');

class Extractor {
  /**
   * Biểu thức chính quy phát hiện link âm nhạc trong tin nhắn (Hỗ trợ mọi subdomain: m., music., youtu.be, spotify...)
   */
  static MUSIC_URL_REGEX = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)[^\s>]+)/gi;

  /**
   * Trích xuất các liên kết âm nhạc từ nội dung văn bản
   * @param {string} text
   * @returns {string[]} Danh sách URL tìm thấy
   */
  static extractUrls(text) {
    const matches = text.match(this.MUSIC_URL_REGEX);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Phân tích và chuyển đổi URL thành một hoặc nhiều đối tượng Song (Tích hợp yt-search chống chặn Cloud IP)
   * @param {string} url
   * @param {object} requester Discord User
   * @returns {Promise<Song[]>}
   */
  static async resolve(url, requester) {
    let cleanUrl = url.trim();

    // 1. Nếu là link YouTube đơn lẻ nhưng YouTube tự đính kèm Radio Mix (&list=RD...), chỉ lấy video chính
    if (cleanUrl.includes('youtube.com/watch') && (cleanUrl.includes('&list=RD') || cleanUrl.includes('&start_radio='))) {
      cleanUrl = cleanUrl.replace(/&list=RD[^&]+/gi, '').replace(/&start_radio=[^&]+/gi, '').replace(/&index=[^&]+/gi, '');
    }

    // 2. Nhận diện Video ID của YouTube nếu là link -> Dùng yt-search cực nhanh & không bao giờ bị chặn
    const ytVideoIdMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytVideoIdMatch) {
      const videoId = ytVideoIdMatch[1];
      try {
        const r = await yts({ videoId });
        if (r && r.title) {
          return [
            new Song({
              title: r.title || 'YouTube Track',
              url: r.url || `https://www.youtube.com/watch?v=${videoId}`,
              duration: r.duration?.timestamp || Song.formatDuration(r.duration?.seconds || 0),
              durationSec: r.duration?.seconds || 0,
              thumbnail: r.thumbnail || r.image || '',
              author: r.author?.name || 'YouTube',
              requester,
              source: 'youtube'
            })
          ];
        }
      } catch (ytsErr) {
        console.warn('[yt-search videoId error]:', ytsErr.message);
      }
    }

    // 3. Xử lý Spotify Track / Playlist
    try {
      const validated = await play.validate(cleanUrl);

      // Spotify Track
      if (validated === 'sp_track') {
        if (play.is_expired()) await play.refreshToken();
        const spData = await play.spotify(cleanUrl);
        const artists = spData.artists ? spData.artists.map(a => a.name).join(', ') : '';
        const searchTitle = `${spData.name} ${artists}`.trim();

        const searchResults = await yts(searchTitle);
        const ytTrack = searchResults?.videos?.[0];

        return [
          new Song({
            title: `${spData.name} - ${artists}`,
            url: ytTrack ? ytTrack.url : cleanUrl,
            duration: Song.formatDuration(spData.durationInSec),
            durationSec: spData.durationInSec || (ytTrack ? ytTrack.duration?.seconds : 0),
            thumbnail: spData.thumbnail?.url || (ytTrack ? ytTrack.thumbnail : ''),
            author: artists || 'Spotify',
            requester,
            source: 'spotify'
          })
        ];
      }

      // Spotify Playlist / Album
      if (validated === 'sp_playlist' || validated === 'sp_album') {
        if (play.is_expired()) await play.refreshToken();
        const spData = await play.spotify(cleanUrl);
        const tracks = await spData.all_tracks();
        const songs = [];

        for (const track of tracks.slice(0, 50)) {
          const artists = track.artists ? track.artists.map(a => a.name).join(', ') : '';
          songs.push(
            new Song({
              title: `${track.name} - ${artists}`,
              url: `ytsearch:${track.name} ${artists}`,
              duration: Song.formatDuration(track.durationInSec),
              durationSec: track.durationInSec || 0,
              thumbnail: track.thumbnail?.url || '',
              author: artists || 'Spotify',
              requester,
              source: 'spotify'
            })
          );
        }
        return songs;
      }

      // YouTube Playlist chính quy (playlist?list=...)
      if (validated === 'yt_playlist') {
        const playlist = await play.playlist_info(cleanUrl, { incomplete: true });
        const videos = await playlist.all_videos();
        return videos.map(video => (
          new Song({
            title: video.title || 'YouTube Track',
            url: video.url,
            duration: video.durationRaw || Song.formatDuration(video.durationInSec),
            durationSec: video.durationInSec || 0,
            thumbnail: video.thumbnails?.[video.thumbnails.length - 1]?.url || '',
            author: video.channel?.name || playlist.title || 'YouTube Playlist',
            requester,
            source: 'youtube'
          })
        ));
      }
    } catch (e) {
      console.warn('[Validation warning]:', e.message);
    }

    // 4. Tìm kiếm từ khóa bằng yt-search (Cực nhanh & chạy 100% trên Render không chặn Cloud IP)
    try {
      const searchResults = await yts(cleanUrl);
      if (searchResults && searchResults.videos && searchResults.videos.length > 0) {
        const item = searchResults.videos[0];
        return [
          new Song({
            title: item.title || 'YouTube Track',
            url: item.url,
            duration: item.duration?.timestamp || Song.formatDuration(item.duration?.seconds || 0),
            durationSec: item.duration?.seconds || 0,
            thumbnail: item.thumbnail || item.image || '',
            author: item.author?.name || 'YouTube',
            requester,
            source: 'youtube'
          })
        ];
      }
    } catch (searchErr) {
      console.error('[yt-search error]:', searchErr.message);
    }

    return [];
  }

  /**
   * Lấy đường dẫn binary yt-dlp (tự động phát hiện hoặc tải nếu chưa có)
   */
  static async getYtDlpPath() {
    const isWin = process.platform === 'win32';
    const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const candidates = [
      path.resolve(__dirname, '../../bin', binName),
      path.resolve(process.cwd(), 'bin', binName),
      path.join(process.cwd(), binName)
    ];

    for (const binFile of candidates) {
      if (fs.existsSync(binFile)) {
        if (!isWin) {
          try { fs.chmodSync(binFile, '755'); } catch (e) {}
        }
        return binFile;
      }
    }

    // Kiểm tra xem hệ thống đã cài yt-dlp sẵn trong PATH chưa
    try {
      const whichCmd = isWin ? 'where yt-dlp' : 'which yt-dlp';
      const sysBin = require('child_process').execSync(whichCmd, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0];
      if (sysBin && fs.existsSync(sysBin)) {
        return sysBin;
      }
    } catch (e) {}

    const defaultBin = candidates[0];
    try {
      const binDir = path.dirname(defaultBin);
      if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
      console.log('⬇️ Đang tải bộ giải mã stream yt-dlp...');
      await YTDlpWrap.downloadFromGithub(defaultBin);
      if (!isWin) fs.chmodSync(defaultBin, '755');
      console.log('✅ yt-dlp đã sẵn sàng!');
      return defaultBin;
    } catch (e) {
      console.warn('⚠️ Không thể tải yt-dlp:', e.message);
      return null;
    }
  }

  /**
   * Làm nóng bộ giải mã ngay khi bot khởi động (giúp giải nén sẵn vào RAM)
   */
  static async warmUp() {
    try {
      const binPath = await this.getYtDlpPath();
      if (binPath) {
        const { execFile } = require('child_process');
        execFile(binPath, ['--version'], (err, stdout) => {
          if (err) console.warn('[Warmup Warning]:', err.message);
          else console.log('🔥 [Warmup]: Bộ giải mã âm thanh yt-dlp đã làm nóng sẵn sàng! Phiên bản:', stdout.trim());
        });
      }
    } catch (e) {}
  }

  static getCookiePath() {
    // 1. Nếu có biến môi trường YOUTUBE_COOKIES, tự ghi ra file cookies.txt
    if (process.env.YOUTUBE_COOKIES) {
      try {
        const targetPath = path.resolve(process.cwd(), 'cookies.txt');
        if (!fs.existsSync(targetPath)) {
          let cookieData = process.env.YOUTUBE_COOKIES.trim();
          if (!cookieData.includes('\t') && !cookieData.includes('\n')) {
            try { cookieData = Buffer.from(cookieData, 'base64').toString('utf8'); } catch (e) {}
          }
          fs.writeFileSync(targetPath, cookieData);
          return targetPath;
        }
      } catch (e) {}
    }

    // 2. Tìm file cookies.txt hoặc cookies.json trong các thư mục dự án
    const cookieCandidates = [
      path.resolve(process.cwd(), 'cookies.txt'),
      path.resolve(__dirname, '../../cookies.txt'),
      path.resolve(process.cwd(), 'cookies.json'),
      path.resolve(__dirname, '../../cookies.json')
    ];

    for (const cPath of cookieCandidates) {
      if (fs.existsSync(cPath) && fs.statSync(cPath).size > 10) {
        return cPath;
      }
    }
    return null;
  }

  static streamCache = new Map();

  /**
   * Tải trước bài tiếp theo trong hàng đợi vào RAM (Prefetching)
   * @param {Song} song
   */
  static async prefetch(song) {
    if (!song || !song.url || this.streamCache.has(song.url)) return;
    try {
      await this.getAudioStream(song);
    } catch (e) {}
  }

  /**
   * Tạo stream audio không quảng cáo từ URL bài hát (Hỗ trợ Cookie FIA & Android Client)
   * @param {Song} song
   * @returns {Promise<{ stream: any, type: string }>}
   */
  static async getAudioStream(song) {
    let finalUrl = song.url;
    // Nếu là track dạng search tạm thời
    if (finalUrl.startsWith('ytsearch:')) {
      const query = finalUrl.replace('ytsearch:', '');
      const results = await yts(query);
      if (results && results.videos && results.videos.length > 0) {
        finalUrl = results.videos[0].url;
        song.url = finalUrl;
        if (!song.thumbnail && results.videos[0].thumbnail) {
          song.thumbnail = results.videos[0].thumbnail;
        }
      }
    }

    // 1. Kiểm tra Bộ nhớ đệm RAM (Phản hồi tức thì 0ms nếu đã có)
    const cached = this.streamCache.get(finalUrl);
    if (cached && Date.now() < cached.expireAt) {
      return { stream: cached.directUrl, type: 'arbitrary' };
    }

    // 2. Ưu tiên sử dụng yt-dlp với Cookie (nếu có) hoặc bộ đôi Android Music + Smart TV
    try {
      const binPath = await this.getYtDlpPath();
      if (binPath) {
        const ytDlp = new YTDlpWrap(binPath);
        const cookiePath = this.getCookiePath();

        const args = [
          '--dump-single-json',
          '--no-playlist',
          '--skip-download',
          '--no-warnings',
          '--no-cache-dir',
          '--geo-bypass',
          '--no-check-certificates',
          '--js-runtimes', 'node',
          '-f', 'bestaudio/best',
          '-S', 'proto:https'
        ];

        if (cookiePath) {
          args.push('--cookies', cookiePath);
        }

        args.push(finalUrl);

        const extractPromise = ytDlp.execPromise(args);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Bóc tách stream quá thời gian (Timeout 35s)')), 35000)
        );

        const rawJson = await Promise.race([extractPromise, timeoutPromise]);
        const response = JSON.parse(rawJson);
        const download = response.requested_downloads?.[0] || response;
        const directUrl = download.url;

        if (directUrl && directUrl.startsWith('http')) {
          // Lưu vào Cache 1 tiếng
          this.streamCache.set(finalUrl, {
            directUrl,
            expireAt: Date.now() + 3600 * 1000
          });
          return { stream: directUrl, type: 'arbitrary' };
        }
      }
    } catch (ytDlpErr) {
      console.warn('[yt-dlp direct url error]:', ytDlpErr.message);
      // Nếu là link YouTube, không rơi xuống play-dl vì Cloud IP sẽ bị chặn
      if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
        throw ytDlpErr;
      }
    }

    // 3. Dự phòng cho Spotify/SoundCloud bằng play-dl
    return await play.stream(finalUrl, { quality: 2 });
  }
}

module.exports = Extractor;
