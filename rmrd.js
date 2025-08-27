// ==UserScript==
// @name         Chặn toast "Đến lượt bạn"
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Chỉ chặn toast "Đến lượt bạn", các thông báo khác vẫn giữ nguyên
// @author       You
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('load', () => {
        const originalShowToast = window.showToastMessage;

        if (!originalShowToast) {
            console.warn("Không tìm thấy showToastMessage trên window");
            return;
        }

        window.showToastMessage = function(msg, ...args) {
            if (msg && msg.includes("Đến lượt bạn")) {
                console.log("⚠️ Toast 'Đến lượt bạn' bị chặn:", msg);
                return;
            }
            return originalShowToast(msg, ...args);
        };

        console.log("✅ Script chặn toast 'Đến lượt bạn' đã sẵn sàng.");
    });
})();
