#!/usr/bin/env python3
"""
red_desat.py — Red Desaturation Test (Standalone Pygame)
=========================================================

Module "Bão hoà màu đỏ" thuộc Menu Thần kinh Nhãn khoa.
Chạy độc lập với Pygame.

Cơ sở lâm sàng:
  Phát hiện suy giảm dẫn truyền sợi trục thị thần kinh (Optic Neuritis).

Kỹ thuật:
  - Không gian màu HSV: Hue=0° (đỏ), Saturation=[0..100]%, Value=100%
  - Chuyển đổi HSV→RGB bằng colorsys.hsv_to_rgb()
  - Nền xám trung tính RGB(128,128,128)
  - Slider + phím ↑↓ điều chỉnh Saturation, bước nhảy 1%
  - Lưu kết quả → log file

Usage:
    python3 red_desat.py
"""

import sys
import os
import math
import colorsys
import json
import datetime

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pygame

# ================================================================
#  Constants
# ================================================================

# Colors
NEUTRAL_GRAY = (128, 128, 128)
BG_COLOR = (60, 65, 75)
PANEL_COLOR = (240, 235, 225)
TEXT_COLOR = (50, 50, 50)
RED_ACCENT = (192, 57, 43)
WHITE = (255, 255, 255)
BTN_COLOR = (60, 100, 160)
BTN_HOVER = (80, 130, 200)

# HSV defaults
HUE_DEG = 0.0       # Đỏ chuẩn
SATURATION_INIT = 100  # %
VALUE_PCT = 100.0     # %

# Saturation range
SAT_MIN = 0
SAT_MAX = 100
SAT_STEP = 1
SAT_BIG_STEP = 5

# Window
WINDOW_W = 900
WINDOW_H = 700
STIMULUS_SIZE = 400
STIMULUS_MARGIN = 80

# ================================================================
#  HSV → RGB (wrapper)
# ================================================================

def hsv_to_rgb_int(h_deg, s_pct, v_pct):
    """
    Chuyển HSV → RGB [0..255].

    colorsys.hsv_to_rgb nhận:
        h: [0..1] (Hue/360)
        s: [0..1] (Saturation/100)
        v: [0..1] (Value/100)

    Returns: (r, g, b) integers [0..255]
    """
    h_norm = (h_deg % 360) / 360.0
    s_norm = s_pct / 100.0
    v_norm = v_pct / 100.0

    r, g, b = colorsys.hsv_to_rgb(h_norm, s_norm, v_norm)
    return (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))


def rgb_to_css(r, g, b):
    return f"rgb({r}, {g}, {b})"


# ================================================================
#  Button class
# ================================================================

class Button:
    def __init__(self, rect, text, color, hover_color=None, text_color=WHITE):
        self.rect = pygame.Rect(rect)
        self.text = text
        self.color = color
        self.hover_color = hover_color or (
            min(color[0] + 30, 255),
            min(color[1] + 30, 255),
            min(color[2] + 30, 255),
        )
        self.text_color = text_color
        self.font = pygame.font.SysFont('Arial', 18, bold=True)

    def draw(self, surface, mouse_pos):
        hover = self.rect.collidepoint(mouse_pos)
        color = self.hover_color if hover else self.color
        pygame.draw.rect(surface, color, self.rect, border_radius=8)
        text_surf = self.font.render(self.text, True, self.text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)

    def is_clicked(self, event):
        return (event.type == pygame.MOUSEBUTTONDOWN and
                event.button == 1 and
                self.rect.collidepoint(event.pos))


# ================================================================
#  Slider class
# ================================================================

class Slider:
    def __init__(self, rect, min_val, max_val, initial, label=""):
        self.rect = pygame.Rect(rect)
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial
        self.label = label
        self.dragging = False

        self.font = pygame.font.SysFont('Arial', 16, bold=True)
        self.value_font = pygame.font.SysFont('Arial', 20, bold=True)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                self.dragging = True
                self._update_from_mouse(event.pos[0])

        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            self.dragging = False

        if event.type == pygame.MOUSEMOTION and self.dragging:
            self._update_from_mouse(event.pos[0])

    def _update_from_mouse(self, mx):
        rel = (mx - self.rect.left) / self.rect.width
        rel = max(0.0, min(1.0, rel))
        self.value = self.min_val + rel * (self.max_val - self.min_val)
        self.value = round(self.value)

    def draw(self, surface):
        # Label
        label_surf = self.font.render(self.label, True, TEXT_COLOR)
        surface.blit(label_surf, (self.rect.left, self.rect.top - 22))

        # Track
        track_rect = self.rect.inflate(0, -8)
        pygame.draw.rect(surface, (180, 180, 180), track_rect, border_radius=4)

        # Fill
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        fill_w = int(track_rect.width * ratio)
        if fill_w > 0:
            fill_rect = pygame.Rect(track_rect.left, track_rect.top,
                                    fill_w, track_rect.height)
            pygame.draw.rect(surface, RED_ACCENT, fill_rect, border_radius=4)

        # Thumb
        thumb_x = track_rect.left + fill_w
        thumb_rect = pygame.Rect(thumb_x - 8, track_rect.centery - 12, 16, 24)
        pygame.draw.rect(surface, (220, 220, 220), thumb_rect, border_radius=6)
        pygame.draw.rect(surface, (120, 120, 120), thumb_rect, 2, border_radius=6)

        # Value display
        val_surf = self.value_font.render(f"{self.value}%", True, RED_ACCENT)
        val_rect = val_surf.get_rect(midleft=(self.rect.right + 16, self.rect.centery))
        surface.blit(val_surf, val_rect)


# ================================================================
#  Main App
# ================================================================

class RedDesaturationApp:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode(
            (WINDOW_W, WINDOW_H),
            pygame.HWSURFACE | pygame.DOUBLEBUF,
        )
        pygame.display.set_caption("Red Desaturation Test — Bão hoà màu đỏ")
        self.clock = pygame.time.Clock()
        self.running = True

        # State
        self.saturation = SATURATION_INIT
        self.hue = HUE_DEG
        self.value = VALUE_PCT
        self.results = []

        # Fonts
        self.title_font = pygame.font.SysFont('Arial', 24, bold=True)
        self.info_font = pygame.font.SysFont('Arial', 16)
        self.small_font = pygame.font.SysFont('Arial', 13)
        self.key_font = pygame.font.SysFont('Consolas', 14)

        # Stimulus surface (pre-render)
        self.stimulus_size = STIMULUS_SIZE
        self.stimulus_surf = pygame.Surface((self.stimulus_size, self.stimulus_size))

        # Slider
        slider_rect = pygame.Rect(80, WINDOW_H - 100, 360, 32)
        self.slider = Slider(slider_rect, SAT_MIN, SAT_MAX,
                             self.saturation, "Độ bão hoà màu đỏ (Saturation)")

        # Buttons
        self.save_btn = Button(
            (480, WINDOW_H - 106, 150, 40),
            "💾 Lưu kết quả",
            BTN_COLOR, BTN_HOVER,
        )
        self.reset_btn = Button(
            (650, WINDOW_H - 106, 150, 40),
            "⟳ Đặt lại 100%",
            (80, 80, 90), (100, 100, 110),
        )
        self.quit_btn = Button(
            (WINDOW_W - 110, 16, 90, 36),
            "✕ Thoát",
            (160, 60, 60), (200, 80, 80),
        )

    # ---------------------------------------------------------------
    #  Render
    # ---------------------------------------------------------------

    def _render_stimulus(self):
        """Vẽ hình vuông đỏ (HSV) trên nền xám trung tính."""
        w, h = self.stimulus_size
        margin = int(w * 0.1)
        size = w - 2 * margin

        # Neutral gray background
        self.stimulus_surf.fill(NEUTRAL_GRAY)

        # HSV → RGB
        rgb = hsv_to_rgb_int(self.hue, self.saturation, self.value)

        # Draw rounded rect
        rect = pygame.Rect(margin, margin, size, size)
        radius = int(size * 0.08)
        pygame.draw.rect(self.stimulus_surf, rgb, rect, border_radius=radius)

        # Thin border
        pygame.draw.rect(self.stimulus_surf, (0, 0, 0, 30), rect,
                         width=1, border_radius=radius)

    def _draw(self):
        self.screen.fill(BG_COLOR)

        # ---- Title ----
        title_surf = self.title_font.render(
            "🟥 Red Desaturation Test — Bão hoà màu đỏ", True,
            (220, 230, 240)
        )
        self.screen.blit(title_surf, (30, 20))

        # ---- Clinical indication ----
        clinical_lines = [
            "Chỉ định: Tầm soát bệnh lý thị thần kinh (Optic Neuritis),",
            "chèn ép giao thoa thị giác.",
            "Kết luận: % bão hoà bị mất tỷ lệ thuận với tổn thương.",
            "⚠ Ngưỡng cảnh báo: < 80%",
        ]
        y = 58
        for line in clinical_lines:
            color = (200, 180, 150) if "⚠" in line else (180, 190, 200)
            cls = self.small_font
            if "⚠" in line:
                cls = self.info_font
                color = (255, 200, 100)
            surf = cls.render(line, True, color)
            self.screen.blit(surf, (30, y))
            y += 20

        # ---- Stimulus (centered) ----
        cx = WINDOW_W // 2
        cy = WINDOW_H // 2 - 40
        stim_rect = self.stimulus_surf.get_rect(center=(cx, cy))
        self.screen.blit(self.stimulus_surf, stim_rect)

        # ---- Result panel (top-right) ----
        panel_rect = pygame.Rect(WINDOW_W - 210, 60, 190, 120)
        pygame.draw.rect(self.screen, PANEL_COLOR, panel_rect, border_radius=10)
        pygame.draw.rect(self.screen, RED_ACCENT, panel_rect, 2, border_radius=10)

        panel_lines = [
            f"Saturation: {self.saturation}%",
            f"Hue: {self.hue:.0f}° (Đỏ)",
            f"RGB: {rgb_to_css(*hsv_to_rgb_int(self.hue, self.saturation, self.value))}",
            f"Số lần lưu: {len(self.results)}",
        ]
        py = panel_rect.top + 14
        for i, line in enumerate(panel_lines):
            font = self.info_font if i == 0 else self.small_font
            color = RED_ACCENT if i == 0 else TEXT_COLOR
            surf = font.render(line, True, color)
            self.screen.blit(surf, (panel_rect.left + 14, py))
            py += 24 if i == 0 else 20

        # ---- Slider ----
        self.slider.draw(self.screen)

        # ---- Buttons ----
        mouse_pos = pygame.mouse.get_pos()
        self.save_btn.draw(self.screen, mouse_pos)
        self.reset_btn.draw(self.screen, mouse_pos)
        self.quit_btn.draw(self.screen, mouse_pos)

        # ---- Keyboard hints ----
        hints = [
            "↑↓: ±1%    ←→: ±5%    S: Lưu    R: Reset    ESC: Thoát",
        ]
        hint_surf = self.small_font.render(hints[0], True, (140, 150, 160))
        self.screen.blit(hint_surf, (30, WINDOW_H - 40))

        pygame.display.flip()

    # ---------------------------------------------------------------
    #  Event Loop
    # ---------------------------------------------------------------

    def _handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                return

            self.slider.handle_event(event)

            if self.save_btn.is_clicked(event):
                self._save_result()

            if self.reset_btn.is_clicked(event):
                self.saturation = 100
                self.slider.value = 100

            if self.quit_btn.is_clicked(event):
                self.running = False

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False

                elif event.key == pygame.K_UP:
                    self.saturation = min(SAT_MAX, self.saturation + SAT_STEP)
                    self.slider.value = self.saturation

                elif event.key == pygame.K_DOWN:
                    self.saturation = max(SAT_MIN, self.saturation - SAT_STEP)
                    self.slider.value = self.saturation

                elif event.key == pygame.K_RIGHT:
                    self.saturation = min(SAT_MAX, self.saturation + SAT_BIG_STEP)
                    self.slider.value = self.saturation

                elif event.key == pygame.K_LEFT:
                    self.saturation = max(SAT_MIN, self.saturation - SAT_BIG_STEP)
                    self.slider.value = self.saturation

                elif event.key == pygame.K_s:
                    self._save_result()

                elif event.key == pygame.K_r:
                    self.saturation = 100
                    self.slider.value = 100

        # Sync slider → saturation
        self.saturation = int(self.slider.value)

    def _save_result(self):
        entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "saturation": self.saturation,
            "hue": self.hue,
            "value": self.value,
        }
        self.results.append(entry)

        # Log to console
        print(
            f"[RedDesat] Saturation: {self.saturation}% | "
            f"HSV({self.hue:.0f}°, {self.saturation}%, {self.value:.0f}%)"
        )

        # Flash feedback
        self.save_btn.color = (40, 167, 60)
        self.save_btn.text = "✅ Đã lưu!"

    # ---------------------------------------------------------------
    #  Run
    # ---------------------------------------------------------------

    def run(self):
        while self.running:
            self._handle_events()
            self._render_stimulus()
            self._draw()
            self.clock.tick(60)

        # Export results
        if self.results:
            log_path = "red_desat_results.json"
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
            print(f"[RedDesat] Đã lưu {len(self.results)} kết quả vào {log_path}")

        pygame.quit()
        sys.exit(0)


# ================================================================
#  Main
# ================================================================

if __name__ == "__main__":
    app = RedDesaturationApp()
    app.run()