# 🎵 Discord Music & Vietnamese Voice Announcer Bot

> Bot Discord chuyên dụng hai trong một: **Phát nhạc chất lượng cao không dính quảng cáo** và **Tự động thông báo giọng đọc tiếng Việt khi có người vào phòng thoại**, vận hành theo triết lý **"Zero-Typing"** (100% nút bấm) kết hợp **Lệnh ẩn Admin tuyệt đối**.

---

## ✨ TÍNH NĂNG NỔI BẬT

### 1. 🎧 Triết lý "Zero-Typing" Phát Nhạc Tự Động
- **Không cần nhớ lệnh prefix hay slash command**: Người dùng chỉ việc copy và dán trực tiếp đường link bài hát (**YouTube, Spotify, SoundCloud...**) vào kênh chat.
- Bot tự động nhận diện liên kết, bóc tách luồng audio sạch 100% không quảng cáo để phát ngay lập tức hoặc xếp vào hàng đợi.
- Dưới mỗi bài hát đi kèm bảng điều khiển trực quan bằng nút bấm:
  - `⏸ / ▶️`: Tạm dừng / Tiếp tục
  - `⏭️`: Bỏ qua bài hát
  - `🔁 / 🔂`: Đổi chế độ lặp (Tắt / Lặp bài / Lặp toàn bộ hàng đợi)
  - `⏹️`: Dừng hẳn và dọn sạch danh sách
  - `📜 Mở Hàng Đợi`: Mở bảng danh sách phát phân trang

### 2. 📜 Hàng Đợi Phân Trang & Xóa Bài Linh Hoạt
- Bảng danh sách hàng đợi trực quan với phân trang `◀️ Trang trước` / `▶️ Trang sau`.
- Nút `🔀 Xáo trộn`: Đảo ngẫu nhiên thứ tự bài hát.
- **Menu thả xuống `🗑️ Xóa bài`**: Chọn trực tiếp bài hát trên trang để gỡ khỏi danh sách chờ.

### 3. 📢 Voice Announcer (Giọng Đọc Tiếng Việt)
- Mỗi khi có thành viên mới kết nối vào phòng thoại của bot:
  - Bộ đếm **Cooldown 10 giây** chống spam ra vào liên tục.
  - Tự động **tạm dừng bài hát** đang chạy.
  - Sử dụng **Google TTS tiếng Việt** với ngữ điệu chuẩn: `"[Tên hiển thị] mới vào"`.
  - Đọc xong tự động **phục hồi phát nhạc tiếp tục** mượt mà không bị ngắt quãng trải nghiệm của cả phòng.

### 4. 🛡️ Invisible Admin Control (Lệnh Ẩn Tuyệt Đối)
- **Không đăng ký bất kỳ lệnh `/admin` nào** trên gợi ý Discord để tránh lộ quyền quản trị.
- Admin chỉ cần gõ mã bí mật vào kênh chat (mặc định: `#ad`):
  - Bot tự động **xóa sạch tin nhắn đó trong 0.01 giây** để phi tang dấu vết trước mắt các thành viên khác.
  - Bot gửi ngay một **Bảng điều khiển tối cao** vào tin nhắn riêng (**Direct Message - DM**) của Admin.
- Các nút can thiệp khẩn cấp trong DM Admin:
  - 🔒 **Khóa / Mở Chế Độ DJ**: Khi khóa, chỉ Admin mới được gửi link, chặn thành viên dán link phá phòng.
  - 🔊 **Bật / Tắt Voice TTS**: Tắt hoặc bật tính năng đọc tên khi vào phòng.
  - ⏭️ **Cưỡng Chế Skip**: Bỏ qua bài hát ngay lập tức.
  - 🗑️ **Xóa Sạch Queue**: Dọn sạch hàng đợi khẩn cấp.
  - 🔌 **Ép Bot Rời Phòng**: Buộc bot ngắt kết nối ngay lập tức.
  - 🔄 **Làm Mới Trạng Thái**: Cập nhật thông số bài hát thời gian thực.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI TỪ A–Z

### Bước 1: Tạo Bot trên Discord Developer Portal
1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications) và đăng nhập.
2. Nhấn **New Application**, đặt tên cho bot (ví dụ: `VibeMusic`).
3. Chuyển sang thẻ **Bot** ở menu bên trái:
   - Nhấn **Reset Token** để copy mã `TOKEN` (Lưu lại để dán vào file `.env`).
   - Kéo xuống mục **Privileged Gateway Intents**, **BẬT CẢ 3 TÙY CHỌN SAU**:
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent**
     - ✅ **Message Content Intent** *(CỰC KỲ QUAN TRỌNG: Để bot đọc được link nhạc và mã bí mật)*.
4. Chuyển sang thẻ **OAuth2** $\rightarrow$ **URL Generator**:
   - Mục **Scopes**: Tích chọn `bot` và `applications.commands`.
   - Mục **Bot Permissions**: Tích chọn `Administrator` (hoặc tối thiểu: *Send Messages, Manage Messages, Embed Links, Connect, Speak, Use Voice Activity*).
   - Copy đường link ở dưới cùng và mở trên trình duyệt để mời bot vào server của bạn.

### Bước 2: Lấy Discord ID của Admin
1. Mở Discord trên máy tính.
2. Vào **User Settings** (biểu tượng bánh răng) $\rightarrow$ **Advanced** $\rightarrow$ Bật **Developer Mode**.
3. Chuột phải vào Avatar/Tên tài khoản Discord của bạn $\rightarrow$ Chọn **Copy User ID**.

### Bước 3: Cấu hình file `.env`
Mở file `.env` trong thư mục dự án và điền thông tin:

```env
DISCORD_TOKEN=điền_token_bot_vào_đây
CLIENT_ID=điền_application_id_vào_đây
ADMIN_USER_ID=điền_user_id_của_bạn_vào_đây
SECRET_CODE=#ad
TTS_LANG=vi
TTS_COOLDOWN=10
```

### Bước 4: Khởi chạy Bot

#### 🖥️ Chạy trực tiếp trên máy:
```bash
npm start
```
*(Nếu muốn chạy ở chế độ tự động reload khi sửa code, dùng `npm run dev`)*.

#### 🌐 Chạy ngầm 24/7 (Khuyên dùng PM2 trên VPS hoặc Server):
```bash
# Cài đặt PM2 toàn cục (nếu chưa có)
npm install -g pm2

# Khởi chạy bot dưới nền
pm2 start index.js --name "discord-music-bot"

# Thiết lập tự khởi động lại khi máy chủ reboot
pm2 startup
pm2 save
```

---

## 💡 CÁCH SỬ DỤNG HÀNG NGÀY

1. **Nghe nhạc**: Bạn vào bất kỳ phòng thoại (Voice Channel) nào, sau đó copy link YouTube/Spotify dán vào kênh chat $\rightarrow$ Bot tự động bay vào phòng và phát nhạc!
2. **Điều khiển bài hát**: Bấm các nút tương tác bên dưới khung phát nhạc.
3. **Mở bảng Admin bí mật**: Gõ `#ad` trong chat $\rightarrow$ Tin nhắn tự biến mất và bảng điều khiển gửi thẳng vào tin nhắn riêng của bạn!
