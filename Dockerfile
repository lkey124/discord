FROM node:20-bookworm-slim

# 1. Cài đặt FFmpeg chính chủ, curl, python3 và các gói hệ thống thiết yếu
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Cài đặt yt-dlp chính thức trực tiếp vào hệ điều hành
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# 3. Thiết lập user không đặc quyền (UID 1000) theo đúng tiêu chuẩn Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860 \
    FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR $HOME/app

# 4. Cài đặt thư viện dependencies
COPY --chown=user:user package*.json ./
RUN npm install --omit=dev

# 5. Sao chép toàn bộ mã nguồn của Bot
COPY --chown=user:user . .

# 6. Cấp quyền thực thi đầy đủ
RUN chmod -R 755 $HOME/app

# Cổng HTTP bắt buộc của Hugging Face Spaces để nhận diện container Running
EXPOSE 7860

# Khởi chạy bot
CMD ["node", "index.js"]
