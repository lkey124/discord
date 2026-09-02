/**
 * Đối tượng bài hát chuẩn hóa trong hệ thống
 */
class Song {
  constructor({
    title = 'Không rõ tên bài hát',
    url = '',
    duration = '00:00',
    durationSec = 0,
    thumbnail = '',
    author = 'Không rõ',
    requester = null,
    source = 'youtube'
  } = {}) {
    this.title = title;
    this.url = url;
    this.duration = duration;
    this.durationSec = durationSec;
    this.thumbnail = thumbnail;
    this.author = author;
    this.requester = requester;
    this.source = source;
  }

  static formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = Song;
