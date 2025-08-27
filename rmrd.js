// ==UserScript==
// @name         Chặn toast "Đối phương đã từ chối hòa" & "Đến lượt bạn"
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Chỉ chặn toast "Đối phương đã từ chối hòa" và "Đến lượt bạn" mà vẫn giữ nguyên logic web/game
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
            // Chặn hai thông báo
            if (msg && (msg.includes("\u0110\u1ed1i ph\u01b0\u01a1ng \u0111\u00e3 t\u1eeb ch\u1ed1i h\u00f2a") ||
                        msg.includes("\u0110\u1ebfn l\u01b0\u1ee3t b\u1ea1n"))) {
                console.log("⚠️ Toast bị chặn:", msg);
                return; // không hiển thị toast
            }
            // Các thông báo khác vẫn hiển thị bình thường
            return originalShowToast(msg, ...args);
        };

        console.log("✅ Script chặn toast 'Đối phương đã từ chối hòa' và 'Đến lượt bạn' đã sẵn sàng.");
    });
})();
