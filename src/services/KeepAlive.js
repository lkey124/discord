/**
 * Module Tự động Giữ Thức (Self-Ping Keep-Alive) 24/7 không cần App ngoài
 */
class KeepAlive {
  constructor(port = 3000) {
    this.port = port;
    this.pingCount = 0;
    this.lastPingTime = null;
    this.timer = null;
    this.isRunning = false;
  }

  /**
   * Khởi động chu kỳ tự đánh thức thông minh
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Render tự động cấp biến môi trường RENDER_EXTERNAL_URL
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;

    console.log('====================================================');
    console.log('⚡ [KEEP-ALIVE 24/7]: Khởi động cơ chế tự đánh thức nội bộ!');
    if (externalUrl) {
      console.log(`🌐 Mục tiêu ping internet công khai: ${externalUrl}`);
    } else {
      console.log(`🏠 Chạy nội bộ cục bộ (Sẽ tự nhận diện URL công khai khi deploy Render)`);
    }
    console.log('====================================================');

    // Chạy ping đầu tiên sau 30 giây khi khởi động
    setTimeout(() => this.ping(), 30000);

    // Chu kỳ định kỳ mỗi 8 phút (Render ngủ sau 15 phút, 8 phút là khoảng thời gian hoàn hảo)
    const INTERVAL_MS = 8 * 60 * 1000;
    this.timer = setInterval(() => this.ping(), INTERVAL_MS);
  }

  /**
   * Thực hiện gửi request đánh thức
   */
  async ping() {
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
    const targetUrl = externalUrl || `http://127.0.0.1:${this.port}/health`;

    try {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'DiscordBot-Internal-KeepAlive/2.0' }
      });

      this.pingCount++;
      this.lastPingTime = new Date();
      const timeStr = this.lastPingTime.toLocaleTimeString('vi-VN');

      console.log(`[KeepAlive Ping #${this.pingCount}]: ✅ Thành công (HTTP ${response.status}) lúc ${timeStr} - Duy trì bot thức 24/7!`);
    } catch (err) {
      console.warn(`[KeepAlive Ping Error]: ${err.message}. Sẽ thử lại trong chu kỳ kế tiếp.`);
    }
  }

  /**
   * Lấy dữ liệu thống kê trạng thái Keep-Alive
   */
  getStatus() {
    return {
      active: this.isRunning,
      pingCount: this.pingCount,
      lastPingTime: this.lastPingTime ? this.lastPingTime.toLocaleString('vi-VN') : 'Chưa có',
      targetUrl: process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${this.port}`
    };
  }
}

module.exports = KeepAlive;
