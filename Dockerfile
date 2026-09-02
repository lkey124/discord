FROM node:20-bookworm-slim

# 1. Cài đặt FFmpeg chính chủ và các công cụ hệ điều hành cần thiết
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Thiết lập user không đặc quyền (UID 1000) theo đúng tiêu chuẩn Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860 \
    FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR $HOME/app

# 3. Cài đặt thư viện dependencies
COPY --chown=user:user package*.json ./
RUN npm install --omit=dev

# 4. Sao chép toàn bộ mã nguồn của Bot
COPY --chown=user:user . .

# 5. Cấp quyền thực thi đầy đủ
RUN chmod -R 755 $HOME/app

# Cổng HTTP bắt buộc của Hugging Face Spaces để nhận diện container Running
EXPOSE 7860

# Khởi chạy bot
CMD ["node", "index.js"]
