// ==UserScript==
// @name         Chặn toast "Đến lượt bạn"
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Chỉ chặn toast "Đến lượt bạn", các thông báo khác vẫn giữ nguyên
// @author       You
// @match        https://zigavn.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('load', () => {
        const originalShowToast = unsafeWindow.showToastMessage;

        if (!originalShowToast) {
            console.warn("Không tìm thấy showToastMessage trên window");
            return;
        }

        // Ghi đè hàm showToastMessage
        unsafeWindow.showToastMessage = function(msg, ...args) {
            // Chặn duy nhất toast "Đến lượt bạn"
            if (msg && msg.includes("\u0110\u1ebfn l\u01b0\u1ee3t b\u1ea1n")) {
                console.log("⚠️ Toast 'Đến lượt bạn' bị chặn:", msg);
                return; // không hiển thị toast
            }
            // Các thông báo khác vẫn hiển thị
            return originalShowToast(msg, ...args);
        };

        console.log("✅ Script chặn toast 'Đến lượt bạn' đã sẵn sàng.");
    });
})();
