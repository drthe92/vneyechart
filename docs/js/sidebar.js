/* ============================================================
   sidebar.js — Tự dựng Sidebar điều hướng cho toàn bộ /docs
   - Hiển thị cố định bên trái trên mọi trang (kể cả bài viết)
   - Tự đánh dấu bài viết đang xem (class "active")
   ============================================================ */
(function () {
    "use strict";

    var groups = [
        {
            title: "1. Hướng dẫn sử dụng chung",
            items: [
                ["overview.html", "Tổng quan về phần mềm"],
                ["calibration.html", "Hiệu chỉnh Kích thước & Màu sắc"],
                ["shortcuts.html", "Hệ thống Phím tắt"]
            ]
        },
        {
            title: "2. Phác đồ Điều trị Lâm sàng",
            items: [
                ["amblyopia_protocol.html", "Protocol: Luyện tập Nhược thị"],
                ["post_op_strabismus_protocol.html", "Protocol: Phục hồi Hậu phẫu Lác"]
            ]
        },
        {
            title: "3. Các Module Chuyên biệt",
            items: [
                ["m06_divergence.html", "Module 6: Mở rộng Phân kỳ (Base-In)"],
                ["m13_convergence.html", "Module 13: Mở rộng Hội tụ (Base-Out)"]
            ]
        },
        {
            title: "4. Danh sách Bài tập (Therapeutic)",
            items: [
                ["m01_catch.html", "Module 1: Hứng hạt (Anti-suppression)"],
                ["m02_align.html", "Module 2: Khớp khung (Flat Fusion)"],
                ["m03_vergence.html", "Module 3: Vận nhãn (Vergence)"],
                ["m04_saccadic.html", "Module 4: Vận nhãn nhanh (Saccadic)"],
                ["m05_rds.html", "Module 5: Thị giác nổi (RDS)"],
                ["m06_divergence.html", "Module 6: Phân kỳ (Divergence)"],
                ["m07_cam.html", "Module 7: Kích thích Lưới quay CAM"],
                ["m08_anticrowding.html", "Module 8: Phá ức chế vùng cận"],
                ["m09_redcone.html", "Module 9: Kích thích tế bào nón Đỏ"],
                ["m10_okn.html", "Module 10: OKN Tracker"],
                ["m11_gabor.html", "Module 11: Gabor Perceptual Learning"],
                ["m12_pursuit.html", "Module 12: Bám đuôi (Pursuit)"]
            ]
        }
    ];

    var current = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    var nav = document.querySelector(".docs-sidebar");
    if (!nav) return;

    var html = '<div class="sidebar-header"><h2>📚 MỤC LỤC TÀI LIỆU</h2></div>';

    html += '<div class="menu-group"><ul><li><a href="index.html"' +
        (current === "index.html" ? ' class="active"' : "") +
        '>Giới thiệu</a></li></ul></div>';

    groups.forEach(function (g) {
        html += '<div class="menu-group"><h3>' + g.title + '</h3><ul>';
        g.items.forEach(function (it) {
            var active = it[0] === current ? ' class="active"' : "";
            html += '<li><a href="' + it[0] + '"' + active + '>' + it[1] + '</a></li>';
        });
        html += '</ul></div>';
    });

    nav.innerHTML = html;
})();