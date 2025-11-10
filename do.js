// ==UserScript==
// @name         do
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  do
// @match        https://zigavn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Delay helper
    const delay = ms => new Promise(r => setTimeout(r, ms));

    // Hook constructor của BkWinLoseLayer
    const originalCtor = BkWinLoseLayer.prototype.ctor;
    BkWinLoseLayer.prototype.ctor = function(a, b, c) {
        originalCtor.call(this, a, b, c);

        // 
        if (a !== 1 && a !== -1) { //
            try {
                //
                setTimeout(() => {
                    if (window.BkLogicManager && typeof BkLogicManager.pa === 'function') {
                        const mgr = BkLogicManager.pa();
                        if (mgr && typeof mgr.im === 'function') {
                            mgr.im();
                            console.log('[Fonsida] ✅ ');
                        }
                    }
                }, 0); // 
            } catch(e) {
                console.warn('[Fonsida] ❌', e);
            }
        }
    };

    console.log('[Fonsida] 🔧 ');
})();
