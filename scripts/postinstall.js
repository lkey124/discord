const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Tự động vá lỗi yt-search (chống crash khi YouTube đổi cấu trúc title JSON)
try {
  const ytsFile = path.resolve(__dirname, '../node_modules/yt-search/dist/yt-search.js');
  if (fs.existsSync(ytsFile)) {
    let content = fs.readFileSync(ytsFile, 'utf8');
    content = content.replace('title: title.trim(),', "title: (typeof title === 'string' ? title.trim() : 'YouTube Track'),");
    content = content.replace('title: _title.trim(),', "title: (typeof _title === 'string' ? _title.trim() : 'YouTube Track'),");
    fs.writeFileSync(ytsFile, content);
    console.log('✅ Đã vá lỗi cấu trúc title cho yt-search!');
  }
} catch (e) {
  console.warn('⚠️ Vá yt-search cảnh báo:', e.message);
}

// 2. Tự động tải yt-dlp binary phù hợp với hệ điều hành (Linux/Windows)
const isWin = process.platform === 'win32';
const binDir = path.resolve(__dirname, '..', 'bin');
const binFile = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

if (fs.existsSync(binFile)) {
  if (!isWin) {
    try {
      fs.chmodSync(binFile, '755');
      console.log('✅ Đã cấp quyền 755 cho file thực thi yt-dlp Linux');
    } catch (e) {}
  }
  console.log('✅ yt-dlp binary đã tồn tại:', binFile);
  process.exit(0);
}

const downloadUrl = isWin
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

console.log(`⬇️ Đang tải yt-dlp binary cho ${process.platform}...`);

function download(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  const options = new URL(url);
  options.headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

  https.get(options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, dest, cb);
    }
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        if (!isWin) {
          try {
            fs.chmodSync(dest, '755');
          } catch (e) {}
        }
        cb(null);
      });
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    cb(err);
  });
}

download(downloadUrl, binFile, (err) => {
  if (err) console.warn('⚠️ Tải yt-dlp trong postinstall cảnh báo:', err.message);
  else console.log('✅ Đã tải và cấp quyền thực thi cho yt-dlp thành công!');
  process.exit(0);
});
