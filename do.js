// ==UserScript==
// @name         do ui
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  do ui
// @match        https://zigavn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  // --- Biến trạng thái ---
  let autoOutEnabled = true;

  // --- Hàm delay ---
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // --- Tạo UI nút bật/tắt ---
  function createToggleButton() {
    const btn = document.createElement('div');
    btn.id = 'fonsida-toggle';
    btn.textContent = 'AutoOut: ON';
    Object.assign(btn.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      padding: '6px 10px',
      fontSize: '14px',
      borderRadius: '6px',
      fontFamily: 'sans-serif',
      cursor: 'pointer',
      zIndex: 99999,
      userSelect: 'none'
    });
    btn.onclick = () => {
      autoOutEnabled = !autoOutEnabled;
      btn.textContent = `AutoOut: ${autoOutEnabled ? 'ON' : 'OFF'}`;
      btn.style.color = autoOutEnabled ? '#0f0' : '#f33';
      console.log(`[Fonsida] Auto Out ${autoOutEnabled ? 'BẬT' : 'TẮT'}`);
    };
    document.body.appendChild(btn);
  }

  // --- Hook hàm ctor ---
  const waitForBk = setInterval(() => {
    if (window.BkWinLoseLayer?.prototype?.ctor) {
      clearInterval(waitForBk);

      const originalCtor = BkWinLoseLayer.prototype.ctor;
      BkWinLoseLayer.prototype.ctor = function(a, b, c) {
        originalCtor.call(this, a, b, c);
        if (!autoOutEnabled) return; // Nếu tắt thì thôi

        if (a !== 1 && a !== -1) { // Hòa
          try {
            setTimeout(() => {
              if (window.BkLogicManager && typeof BkLogicManager.pa === 'function') {
                const mgr = BkLogicManager.pa();
                if (mgr && typeof mgr.im === 'function') {
                  mgr.im();
                  console.log('[Fonsida] ✅ Auto Out khi hòa!');
                }
              }
            }, 0);
          } catch(e) {
            console.warn('[Fonsida] ❌ Lỗi auto out:', e);
          }
        }
      };

      console.log('[Fonsida] 🔧 Hook BkWinLoseLayer thành công.');
    }
  }, 500);

  // --- Thêm UI ---
  createToggleButton();
})();
