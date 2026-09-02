---
title: Discord Music Bot
emoji: 🎵
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
---

# Discord Music & Vietnamese Voice Announcer Bot 🎵🇻🇳

Bot Discord phát nhạc chất lượng cao với triết lý **Zero-Typing** (tự bắt link dán vào chat), hệ thống nút bấm 1 chạm, trọn bộ lệnh tiếng Việt, Voice Announcer đọc tên khi vào phòng thoại và tích hợp cơ chế tự động giữ thức **24/7 trên Render** không cần app ngoài.

---

## ✨ Tính Năng Nổi Bật

- 🚀 **Zero-Typing**: Chỉ cần ở trong phòng thoại và dán link YouTube/Spotify vào chat $\rightarrow$ Bot tự phát luôn!
- 🇻🇳 **Hệ thống Lệnh Tiếng Việt Đầy Đủ**:
  - `!phat <tên bài>`: Tìm kiếm và phát nhạc theo từ khóa.
  - `!tamdung` / `!tieptuc`: Tạm dừng / Tiếp tục bài hát.
  - `!qua`: Bỏ qua bài hiện tại.
  - `!tat`: Dừng nhạc và dọn sạch hàng đợi.
  - `!danhsach`: Xem danh sách bài hát chờ phân trang.
  - `!vao` / `!ra`: Triệu hồi hoặc mời bot rời phòng.
  - `!noi <câu nói>`: Bot nói to câu này bằng tiếng Việt.
  - `!docten <bat/tat>`: Bật/tắt đọc tên khi vào phòng.
  - `!lenh`: Bảng hướng dẫn lệnh.
- 🔒 **Độc Quyền Người Yêu Cầu**: Chỉ người gửi bài hát đó mới có quyền tạm dừng hoặc tắt bài hát đó.
- ⏱️ **Tự Động Rời Phòng Sau 10 Giây**: Tự động dọn dẹp và rời phòng khi không còn ai để tiết kiệm tài nguyên.
- 🔊 **Discord DAVE E2EE Ready**: Tích hợp `@snazzah/davey` và `@discordjs/voice 0.19.2`, đảm bảo mã hóa âm thanh hoàn hảo trên máy chủ Discord mới nhất.
- ⚡ **Tự Giữ Thức 24/7 Trên Render (Internal Keep-Alive)**: Tự động gửi ping nội bộ định kỳ mỗi 8 phút, ngăn Render Free Web Service rơi vào trạng thái ngủ đông (Sleep) mà **không cần dùng UptimeRobot hay bất kỳ ứng dụng bên thứ 3 nào**.

---

## 🚀 Hướng Dẫn Deploy Lên Render 24/7

1. Truy cập [Render.com](https://dashboard.render.com/) và bấm **New +** $\rightarrow$ **Web Service**.
2. Kết nối tới kho GitHub này: `https://github.com/lkey124/discord`.
3. Điền các cấu hình:
   - **Name**: `discord-music-bot` (hoặc tên tùy thích)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Trong mục **Environment Variables**, thêm các biến sau:
   - `DISCORD_TOKEN`: Token bot của bạn
   - `CLIENT_ID`: `1544696625643917334`
   - `ADMIN_USER_ID`: `1056192010358374423`
   - `SECRET_CODE`: `#ad`
   - `FISH_AUDIO_VOICE_ID`: `5aaab6b5458b4591b87a33de8a3e4874`
   - `PORT`: `3000`
5. Bấm **Create Web Service**. Bot sẽ tự động build, khởi động và tự ping giữ thức 24/7!
