const path = require('path');
const fs = require('fs');
const play = require('play-dl');
const YTDlpWrap = require('yt-dlp-wrap').default;
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
    if (!text) return [];
    const matches = text.match(this.MUSIC_URL_REGEX);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Phân tích và chuyển đổi URL thành một hoặc nhiều đối tượng Song
   * @param {string} url
   * @param {object} requester Discord User
   * @returns {Promise<Song[]>}
   */
  static async resolve(url, requester) {
    try {
      let cleanUrl = url;
      // Nếu là link video đơn lẻ nhưng YouTube tự đính kèm Radio Mix (&list=RD...), chỉ lấy video chính
      if (cleanUrl.includes('youtube.com/watch') && (cleanUrl.includes('&list=RD') || cleanUrl.includes('&start_radio='))) {
        cleanUrl = cleanUrl.replace(/&list=RD[^&]+/gi, '').replace(/&start_radio=[^&]+/gi, '').replace(/&index=[^&]+/gi, '');
      }

      const validated = await play.validate(cleanUrl);

      // 1. YouTube Video đơn lẻ
      if (validated === 'yt_video') {
        const info = await play.video_basic_info(cleanUrl);
        const details = info.video_details;
        return [
          new Song({
            title: details.title || 'YouTube Track',
            url: details.url,
            duration: details.durationRaw || Song.formatDuration(details.durationInSec),
            durationSec: details.durationInSec || 0,
            thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || '',
            author: details.channel?.name || 'YouTube',
            requester,
            source: 'youtube'
          })
        ];
      }

      // 2. YouTube Playlist
      if (validated === 'yt_playlist') {
        const playlist = await play.playlist_info(url, { incomplete: true });
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

      // 3. Spotify Track
      if (validated === 'sp_track') {
        if (play.is_expired()) {
          await play.refreshToken();
        }
        const spData = await play.spotify(url);
        const artists = spData.artists ? spData.artists.map(a => a.name).join(', ') : '';
        const searchTitle = `${spData.name} ${artists}`.trim();
        
        // Tìm kiếm trên YouTube để lấy luồng phát
        const searchResults = await play.search(searchTitle, { limit: 1 });
        const ytTrack = searchResults[0];

        return [
          new Song({
            title: `${spData.name} - ${artists}`,
            url: ytTrack ? ytTrack.url : url,
            duration: Song.formatDuration(spData.durationInSec),
            durationSec: spData.durationInSec || (ytTrack ? ytTrack.durationInSec : 0),
            thumbnail: spData.thumbnail?.url || (ytTrack ? ytTrack.thumbnails[0]?.url : ''),
            author: artists || 'Spotify',
            requester,
            source: 'spotify'
          })
        ];
      }

      // 4. Spotify Playlist / Album
      if (validated === 'sp_playlist' || validated === 'sp_album') {
        if (play.is_expired()) {
          await play.refreshToken();
        }
        const spData = await play.spotify(url);
        const tracks = await spData.all_tracks();
        const songs = [];

        for (const track of tracks.slice(0, 50)) { // Giới hạn tối đa 50 bài để tối ưu tốc độ
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

      // 5. SoundCloud Track
      if (validated === 'so_track') {
        const soData = await play.soundcloud(url);
        return [
          new Song({
            title: soData.name || 'SoundCloud Track',
            url: soData.url,
            duration: Song.formatDuration(soData.durationInSec),
            durationSec: soData.durationInSec || 0,
            thumbnail: soData.thumbnail || '',
            author: soData.publisher?.name || 'SoundCloud',
            requester,
            source: 'soundcloud'
          })
        ];
      }

      // 6. Tìm kiếm từ khóa thông thường nếu không khớp URL chính xác
      const searchResults = await play.search(url, { limit: 1 });
      if (searchResults && searchResults.length > 0) {
        const item = searchResults[0];
        return [
          new Song({
            title: item.title || 'YouTube Track',
            url: item.url,
            duration: item.durationRaw || Song.formatDuration(item.durationInSec),
            durationSec: item.durationInSec || 0,
            thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
            author: item.channel?.name || 'YouTube',
            requester,
            source: 'youtube'
          })
        ];
      }

      return [];
    } catch (err) {
      console.error(`[Extractor Error] Không thể bóc tách URL ${url}:`, err.message);
      return [];
    }
  }

  /**
   * Lấy đường dẫn binary yt-dlp (tự động tải nếu chưa có)
   */
  static async getYtDlpPath() {
    const isWin = process.platform === 'win32';
    const binDir = path.resolve(process.cwd(), 'bin');
    const binFile = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');

    if (fs.existsSync(binFile)) {
      return binFile;
    }

    try {
      if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
      console.log('⬇️ Đang tải bộ giải mã stream yt-dlp...');
      await YTDlpWrap.downloadFromGithub(binFile);
      if (!isWin) fs.chmodSync(binFile, '755');
      console.log('✅ yt-dlp đã sẵn sàng!');
      return binFile;
    } catch (e) {
      console.warn('⚠️ Không thể tải yt-dlp:', e.message);
      return null;
    }
  }

  /**
   * Tạo stream audio không quảng cáo từ URL bài hát (Hỗ trợ yt-dlp chống chặn định dạng)
   * @param {Song} song
   * @returns {Promise<{ stream: any, type: string }>}
   */
  static async getAudioStream(song) {
    let finalUrl = song.url;
    // Nếu là track dạng search tạm thời
    if (finalUrl.startsWith('ytsearch:')) {
      const query = finalUrl.replace('ytsearch:', '');
      const results = await play.search(query, { limit: 1 });
      if (results && results.length > 0) {
        finalUrl = results[0].url;
        song.url = finalUrl;
        if (!song.thumbnail && results[0].thumbnails?.[0]) {
          song.thumbnail = results[0].thumbnails[0].url;
        }
      }
    }

    // 1. Ưu tiên sử dụng yt-dlp trích xuất Direct HTTPS CDN URL (Chấm dứt lỗi Premature close)
    try {
      const binPath = await this.getYtDlpPath();
      if (binPath) {
        const ytDlp = new YTDlpWrap(binPath);
        const directUrl = (await ytDlp.execPromise([
          '-g',
          '-f', 'bestaudio',
          '--no-playlist',
          finalUrl
        ])).trim();

        if (directUrl && directUrl.startsWith('http')) {
          return { stream: directUrl, type: 'arbitrary' };
        }
      }
    } catch (ytDlpErr) {
      console.warn('[yt-dlp direct url error]:', ytDlpErr.message, 'Đang thử phương thức phụ...');
    }

    // 2. Dự phòng bằng play-dl
    return await play.stream(finalUrl, { quality: 2 });
  }
}

module.exports = Extractor;
