// ==UserScript==
// @name         atjr
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  J R
// @author       FonArt
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let inGame = false;

    //
    const originalLogMessage = window.logMessage;
    window.logMessage = function (msg) {
        if (msg.includes("ProcessGameTableInfo")) {
            console.log("[AutoClick] Đã vào bàn chơi");
            inGame = true;
        }
        if (msg.includes("ProcessOutGame")) {
            console.log("[AutoClick] Đã thoát bàn chơi");
            inGame = false;
        }
        return originalLogMessage.apply(this, arguments);
    };

    // 
    function autoClickWhenIdle() {
        if (!inGame) {
            console.log("[AutoClick] Đang ở sảnh, click tìm bàn...");
            clickAt(250, 550);  // Thay đổi toạ độ nếu cần
        } else {
            console.log("[AutoClick] Đang trong bàn, không click");
        }
    }

    // 
    function clickAt(x, y) {
        const target = document.elementFromPoint(x, y);
        if (target) {
            const down = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y });
            const up = new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y });
            target.dispatchEvent(down);
            target.dispatchEvent(up);
        }
    }

    // Bắt đầu chạy mỗi 3 giây
    setInterval(autoClickWhenIdle, 50);

})();
