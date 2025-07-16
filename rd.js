// ==UserScript==
// @name         Auto Refuse Draw (ZigaVN)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Tự động từ chối cầu hòa trên zigavn.com
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function log(msg) {
        console.log("[AUTO-REFUSE-DRAW]", msg);
    }

    // Tự động từ chối khi hàm showPopupConfirmWith xuất hiện
    const originalPopup = window.showPopupConfirmWith;
    if (typeof originalPopup === "function") {
        window.showPopupConfirmWith = function (message, title, acceptCallback, _, rejectCallback) {
            log("Phát hiện popup xác nhận: " + message);

            // Nếu popup là lời mời cầu hòa
            if (message.includes("muốn hòa") || message.includes("đề nghị hòa")) {
                log("Tự động từ chối hòa");
                if (typeof rejectCallback === "function") {
                    setTimeout(rejectCallback, 100); // delay nhẹ cho chắc
                }
            } else {
                // Nếu không phải cầu hòa, gọi lại popup gốc
                return originalPopup.apply(this, arguments);
            }
        };
        log("Đã hook showPopupConfirmWith thành công");
    } else {
        log("Không tìm thấy hàm showPopupConfirmWith");
    }
})();
