// ==UserScript==
// @name         Zigavn <-> Google Auto Switch
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Sau 30s ở zigavn.com, chuyển sang google.com, đợi 1s rồi quay lại zigavn.com
// @match        https://zigavn.com/*
// @match        https://www.google.com/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const ZIGAVN_URL = "https://zigavn.com/";
    const GOOGLE_URL = "https://www.google.com/";

    if (location.hostname.includes("zigavn.com")) {
        console.log("[AutoSwitch] Đang ở zigavn, sẽ chuyển sang google sau 30s...");
        setTimeout(() => {
            window.location.href = GOOGLE_URL;
        }, 50_000); // 30 giây
    }

    if (location.hostname.includes("google.com")) {
        console.log("[AutoSwitch] Đang ở google, sẽ quay lại zigavn sau 1s...");
        setTimeout(() => {
            window.location.href = ZIGAVN_URL;
        }, 500); // 1 giây
    }

})();
