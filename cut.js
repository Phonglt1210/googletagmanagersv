// ==UserScript==
// @name         Ziga Auto Invite Toàn bộ mỗi 300ms
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Gửi toàn bộ danh sách user mỗi 300ms một lần
// @match        https://zigavn.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const listUser = [
        "1quat5000", "SatThuVoDanh07", "HiepKhach_", "ThichChocCho__", "HacChoDe",
        "THACH_TieuNhan", "TranVanThach_NhaQue", "Tu_CoTuong", "TruongVanDuc36",
        "Dan36LuaDao", "ThemOcCho", "MinhNguyetDaKy", "LamThanhPhong_", "Ngoan_AnNaCoi","Nguoiquetrac","thienlun_anthientran",
        "dan36luadao", "HueXinh_TrangBom", "d0cocaubai","norival__","bugchess32u","ThanhKinhPhanUu", "ChanNhan_BatLoTuong", "kyma8x", "thaptieuthu", "CAFESAIGON", "Dan36LuaDao","TranVanThach_HN","TaoLaThach_TieuNhan","MonLe_Gap_LoTon","NguoiQuetRac","TruongVanDuc_36RauMa", "KyNghe_SG","TaoLaThach_TieuNhan","TruongVanDuc_RauMa","TuongKyCuongPhong",
"ThuanTocTay_YeuNgoan","ThachTieuNhan","Phat_Phap_Nhiem_Mau","TaoLaThach_MatLon","XuThanh_LuaDao"
    ];

    function sendInvite(user) {
        try {
            const gameType = Math.random() < 0.5 ? "K" : "L";
            const packet = new BkPacket();
            packet.DJ(1, gameType, user);
            BkConnectionManager.send(packet);
            console.log(`[TM] Đã gửi lời mời cho ${user} chơi ${gameType === "K" ? "Cờ tướng" : "Cờ úp"}`);
        } catch (e) {
            console.warn(`[TM] Lỗi gửi lời mời cho ${user}:`, e);
        }
    }

    function startInvite(users) {
        setInterval(() => {
            users.forEach(user => sendInvite(user));
        }, 100);
    }

    window.addEventListener("load", () => {
        setTimeout(() => {
            startInvite(listUser);
        }, 100);
    });
})();
