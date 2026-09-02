@echo off
chcp 65001 >nul
title Discord Music & Voice Announcer Bot - Local Runner
echo ========================================================
echo   🎵 DISCORD MUSIC & VIETNAMESE VOICE ANNOUNCER BOT
echo   🚀 CHẠY TRỰC TIẾP TRÊN MÁY TÍNH (IP DÂN CƯ VIỆT NAM)
echo   🛡️ YOUTUBE KHÔNG BAO GIỜ CHẶN BOT & TỐC ĐỘ CỰC CAO!
echo ========================================================
echo.

if not exist node_modules (
    echo [1/2] Đang cài đặt thư viện cần thiết...
    call npm install
)

echo [2/2] Đang khởi động Bot...
echo Nhấn Ctrl + C để dừng bot bất kỳ lúc nào.
echo ========================================================
node index.js
pause
