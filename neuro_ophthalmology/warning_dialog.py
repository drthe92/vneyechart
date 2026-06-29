"""
warning_dialog.py — Safety Warning Modal (OKN Contraindications)
=================================================================

Hiển thị hộp thoại cảnh báo trước khi khởi động OKN test.
Yêu cầu bác sĩ xác nhận đã đọc cảnh báo chống chỉ định
cho bệnh nhân có tiền sử động kinh nhạy cảm ánh sáng.
"""

import pygame

# ================================================================
#  Constants
# ================================================================

WARNING_WIDTH = 600
WARNING_HEIGHT = 320

BG_COLOR = (30, 30, 30)
PANEL_COLOR = (240, 235, 220)
TITLE_COLOR = (180, 40, 40)
TEXT_COLOR = (50, 50, 50)
HIGHLIGHT_COLOR = (200, 30, 30)
BUTTON_NORMAL = (60, 130, 200)
BUTTON_HOVER = (80, 160, 230)
BUTTON_TEXT = (255, 255, 255)
DISABLED_TEXT = (160, 160, 160)

# ================================================================
#  WarningDialog
# ================================================================

class WarningDialog:
    """
    Modal cảnh báo an toàn lâm sàng.

    Usage:
        dialog = WarningDialog(screen)
        confirmed = dialog.run()
        if confirmed:
            # start OKN test
    """

    def __init__(self, screen: pygame.Surface):
        self.screen = screen
        self.clock = pygame.time.Clock()
        self.font_large = pygame.font.SysFont('Arial', 20, bold=True)
        self.font_small = pygame.font.SysFont('Arial', 16)
        self.font_tiny = pygame.font.SysFont('Arial', 14)

        # Layout
        screen_w, screen_h = screen.get_size()
        self.rect = pygame.Rect(
            (screen_w - WARNING_WIDTH) // 2,
            (screen_h - WARNING_HEIGHT) // 2,
            WARNING_WIDTH,
            WARNING_HEIGHT,
        )

        # Nút Confirm
        btn_w, btn_h = 220, 48
        self.confirm_btn = pygame.Rect(
            self.rect.centerx - btn_w // 2,
            self.rect.bottom - 70,
            btn_w,
            btn_h,
        )

        # Nút Cancel
        self.cancel_btn = pygame.Rect(
            self.rect.centerx - btn_w // 2,
            self.rect.bottom - 70,
            btn_w,
            btn_h,
        )

        # Checkbox
        self.checked = False
        self.checkbox_rect = pygame.Rect(
            self.rect.left + 40,
            self.rect.top + 170,
            20, 20,
        )

        self.result = False
        self.running = True

    # ---------------------------------------------------------------
    #  Event Loop
    # ---------------------------------------------------------------

    def run(self) -> bool:
        """Chạy modal, trả về True nếu bác sĩ xác nhận."""
        overlay = pygame.Surface(self.screen.get_size(), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))

        while self.running:
            mouse_pos = pygame.mouse.get_pos()
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.result = False
                    self.running = False
                    return False

                if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    if self.confirm_btn.collidepoint(event.pos) and self.checked:
                        self.result = True
                        self.running = False
                    elif self.cancel_btn.collidepoint(event.pos):
                        self.result = False
                        self.running = False
                    elif self.checkbox_rect.collidepoint(event.pos):
                        self.checked = not self.checked

                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.result = False
                        self.running = False
                    if event.key == pygame.K_RETURN and self.checked:
                        self.result = True
                        self.running = False

            # ---- Draw ----
            self.screen.blit(overlay, (0, 0))
            self._draw_panel(mouse_pos)
            pygame.display.update(self.rect)
            self.clock.tick(60)

        return self.result

    # ---------------------------------------------------------------
    #  Drawing
    # ---------------------------------------------------------------

    def _draw_panel(self, mouse_pos):
        # Panel background
        pygame.draw.rect(self.screen, PANEL_COLOR, self.rect, border_radius=12)
        pygame.draw.rect(self.screen, (180, 40, 40), self.rect, 3, border_radius=12)

        # Title
        title_surf = self.font_large.render(
            "⚠ CẢNH BÁO AN TOÀN LÂM SÀNG", True, TITLE_COLOR
        )
        title_rect = title_surf.get_rect(center=(self.rect.centerx, self.rect.top + 30))
        self.screen.blit(title_surf, title_rect)

        # Warning text
        lines = [
            ("Chống chỉ định tuyệt đối:", HIGHLIGHT_COLOR, self.font_small),
            ("Khởi chạy test OKN trên bệnh nhân có tiền sử", TEXT_COLOR, self.font_small),
            ("ĐỘNG KINH NHẠY CẢM ÁNH SÁNG", HIGHLIGHT_COLOR, self.font_large),
            ("(Photosensitive epilepsy)", HIGHLIGHT_COLOR, self.font_small),
        ]

        y_offset = self.rect.top + 65
        for text, color, font in lines:
            surf = font.render(text, True, color)
            rect = surf.get_rect(center=(self.rect.centerx, y_offset))
            self.screen.blit(surf, rect)
            y_offset += 24

        # Checkbox
        pygame.draw.rect(self.screen, (80, 80, 80), self.checkbox_rect, 2, border_radius=3)
        if self.checked:
            pygame.draw.rect(
                self.screen, (60, 160, 60),
                self.checkbox_rect.inflate(-4, -4), border_radius=2,
            )
            check_surf = self.font_large.render("✓", True, (255, 255, 255))
            check_rect = check_surf.get_rect(center=self.checkbox_rect.center)
            self.screen.blit(check_surf, check_rect)

        # Checkbox label
        label_surf = self.font_small.render(
            "Tôi đã đọc và hiểu cảnh báo trên.", True,
            TEXT_COLOR if self.checked else DISABLED_TEXT,
        )
        label_rect = label_surf.get_rect(
            midleft=(self.checkbox_rect.right + 12, self.checkbox_rect.centery)
        )
        self.screen.blit(label_surf, label_rect)

        # Confirm button
        btn_color = BUTTON_NORMAL if self.checked else DISABLED_TEXT
        if self.checked and self.confirm_btn.collidepoint(mouse_pos):
            btn_color = BUTTON_HOVER

        pygame.draw.rect(
            self.screen, btn_color, self.confirm_btn,
            border_radius=8,
        )
        confirm_surf = self.font_large.render("Xác nhận & Bắt đầu", True, BUTTON_TEXT)
        confirm_rect = confirm_surf.get_rect(center=self.confirm_btn.center)
        self.screen.blit(confirm_surf, confirm_rect)

        # Cancel button hint
        hint_surf = self.font_tiny.render("Nhấn ESC để huỷ", True, DISABLED_TEXT)
        hint_rect = hint_surf.get_rect(center=(self.rect.centerx, self.rect.bottom - 15))
        self.screen.blit(hint_surf, hint_rect)