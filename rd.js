// ==UserScript==
// @name         Auto R D
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  TR D
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function log(msg) {
        console.log("[AUTO-REFUSE-DRAW]", msg);
    }

    // 
    const originalPopup = window.showPopupConfirmWith;
    if (typeof originalPopup === "function") {
        window.showPopupConfirmWith = function (message, title, acceptCallback, _, rejectCallback) {
            log("Phát hiện popup xác nhận: " + message);

            // 
            if (message.includes("muốn hòa") || message.includes("đề nghị hòa")) {
                log("Tự động từ chối hòa");
                if (typeof rejectCallback === "function") {
                    setTimeout(rejectCallback, 100); //
                }
            } else {
                // 
                return originalPopup.apply(this, arguments);
            }
        };
        log("Đã hook showPopupConfirmWith thành công");
    } else {
        log("Không tìm thấy hàm showPopupConfirmWith");
    }
})();
