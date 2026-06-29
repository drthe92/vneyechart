"""
ui.py — Menu System & Parameter Form
======================================

Giao diện menu chính "Thần kinh Nhãn khoa" với:
  - Submenu "Bão hoà màu đỏ" (placeholder)
  - Submenu "OKN Test" (full implementation)
  - Form nhập thông số OKN: cpd, velocity, direction, distance, screen size
"""

import pygame
from typing import Optional

from .calibration import ScreenInfo
from .okn_test import OKNTest, Direction, DIRECTION_LABELS

# ================================================================
#  Constants
# ================================================================

# Colors
BG_COLOR = (25, 30, 40)
PANEL_COLOR = (40, 48, 60)
TITLE_COLOR = (220, 230, 240)
TEXT_COLOR = (180, 190, 205)
HIGHLIGHT = (100, 170, 255)
ACCENT = (60, 140, 220)
DANGER = (200, 60, 60)
SUCCESS = (80, 200, 80)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

# Sizes
MENU_WIDTH = 520
MENU_HEIGHT = 580

# ================================================================
#  InputField (simple text input for number entry)
# ================================================================

class InputField:
    """Ô nhập số đơn giản."""

    def __init__(self, rect: pygame.Rect, label: str, value: float,
                 min_val: float, max_val: float, step: float, fmt: str = ".1f"):
        self.rect = rect
        self.label = label
        self.value = value
        self.min_val = min_val
        self.max_val = max_val
        self.step = step
        self.fmt = fmt
        self.active = False
        self.text = f"{value:{fmt}}"

        self.font = pygame.font.SysFont('Arial', 18)
        self.label_font = pygame.font.SysFont('Arial', 14, bold=True)

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self.active = self.rect.collidepoint(event.pos)

        if self.active and event.type == pygame.KEYDOWN:
            if event.key == pygame.K_RETURN:
                self._commit()
            elif event.key == pygame.K_BACKSPACE:
                self.text = self.text[:-1]
            elif event.key == pygame.K_UP:
                self.value = min(self.max_val, self.value + self.step)
                self.text = f"{self.value:{self.fmt}}"
            elif event.key == pygame.K_DOWN:
                self.value = max(self.min_val, self.value - self.step)
                self.text = f"{self.value:{self.fmt}}"
            elif event.unicode and (event.unicode.isdigit() or event.unicode in '.-'):
                self.text += event.unicode

    def _commit(self):
        try:
            v = float(self.text)
            self.value = max(self.min_val, min(self.max_val, v))
        except ValueError:
            pass
        self.text = f"{self.value:{self.fmt}}"

    def draw(self, surface: pygame.Surface):
        # Label
        label_surf = self.label_font.render(self.label, True, TEXT_COLOR)
        surface.blit(label_surf, (self.rect.left, self.rect.top - 18))

        # Background
        color = ACCENT if self.active else (60, 70, 85)
        pygame.draw.rect(surface, color, self.rect, border_radius=4)
        pygame.draw.rect(surface, (100, 120, 150), self.rect, 1, border_radius=4)

        # Text
        display_text = self.text if self.text else "0"
        text_surf = self.font.render(display_text, True, WHITE)
        text_rect = text_surf.get_rect(midleft=(self.rect.left + 10, self.rect.centery))
        surface.blit(text_surf, text_rect)

# ================================================================
#  Button
# ================================================================

class Button:
    def __init__(self, rect: pygame.Rect, text: str, color, hover_color=None):
        self.rect = rect
        self.text = text
        self.color = color
        self.hover_color = hover_color or (
            min(color[0] + 30, 255),
            min(color[1] + 30, 255),
            min(color[2] + 30, 255),
        )
        self.font = pygame.font.SysFont('Arial', 20, bold=True)

    def draw(self, surface: pygame.Surface, mouse_pos):
        hover = self.rect.collidepoint(mouse_pos)
        color = self.hover_color if hover else self.color
        pygame.draw.rect(surface, color, self.rect, border_radius=8)
        text_surf = self.font.render(self.text, True, WHITE)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)

    def is_clicked(self, event) -> bool:
        return (event.type == pygame.MOUSEBUTTONDOWN and
                event.button == 1 and
                self.rect.collidepoint(event.pos))

# ================================================================
#  Main Menu
# ================================================================

class MainMenu:
    """
    Menu chính "Thần kinh Nhãn khoa".

    Hiển thị:
      - Tiêu đề
      - Nút "Bão hoà màu đỏ" (placeholder)
      - Nút "OKN Test" (mở form cấu hình)
    """

    def __init__(self, screen: pygame.Surface, screen_info: ScreenInfo):
        self.screen = screen
        self.screen_info = screen_info
        self.clock = pygame.time.Clock()
        self.running = True

        sw, sh = screen.get_size()
        cx, cy = sw // 2, sh // 2

        # Menu panel
        self.panel_rect = pygame.Rect(cx - MENU_WIDTH // 2, cy - MENU_HEIGHT // 2,
                                      MENU_WIDTH, MENU_HEIGHT)

        # Title
        self.title_font = pygame.font.SysFont('Arial', 32, bold=True)
        self.subtitle_font = pygame.font.SysFont('Arial', 18)

        # Red Desaturation button (placeholder)
        btn_y1 = cy - 60
        self.red_desat_btn = Button(
            pygame.Rect(cx - 180, btn_y1, 360, 50),
            "🟥 Bão hoà màu đỏ (Placeholder)",
            (80, 60, 60), (110, 80, 80),
        )

        # OKN button
        btn_y2 = cy + 20
        self.okn_btn = Button(
            pygame.Rect(cx - 180, btn_y2, 360, 50),
            "🧪 OKN — Optokinetic Nystagmus",
            ACCENT, HIGHLIGHT,
        )

        # Quit button
        btn_y3 = cy + 100
        self.quit_btn = Button(
            pygame.Rect(cx - 120, btn_y3, 240, 44),
            "Thoát",
            (80, 80, 90), (100, 100, 110),
        )

        # Current sub-screen
        self.sub_screen = None  # None | 'okn_config' | 'red_desat' | 'okn_test'

        # OKN parameters
        self.okn_cpd = 2.0
        self.okn_vel = 20.0
        self.okn_direction = Direction.LEFT_TO_RIGHT

        # Input fields (created when OKN config is shown)
        self.input_fields = []
        self.config_okn_btn = None
        self.config_back_btn = None

    # ================================================================
    #  Run
    # ================================================================

    def run(self):
        while self.running:
            mouse_pos = pygame.mouse.get_pos()
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                    return

                if self.sub_screen is None:
                    self._handle_menu_event(event)
                elif self.sub_screen == 'okn_config':
                    self._handle_config_event(event)
                elif self.sub_screen == 'red_desat':
                    self._handle_placeholder_event(event)

            # Draw
            self.screen.fill(BG_COLOR)

            if self.sub_screen is None:
                self._draw_menu(mouse_pos)
            elif self.sub_screen == 'okn_config':
                self._draw_config(mouse_pos)
            elif self.sub_screen == 'red_desat':
                self._draw_placeholder(mouse_pos)

            pygame.display.flip()
            self.clock.tick(60)

    # ================================================================
    #  Menu Events
    # ================================================================

    def _handle_menu_event(self, event):
        if self.red_desat_btn.is_clicked(event):
            self.sub_screen = 'red_desat'
        elif self.okn_btn.is_clicked(event):
            self.sub_screen = 'okn_config'
            self._create_config_ui()
        elif self.quit_btn.is_clicked(event):
            self.running = False

        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            self.running = False

    def _handle_placeholder_event(self, event):
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.sub_screen = None

    # ================================================================
    #  OKN Configuration UI
    # ================================================================

    def _create_config_ui(self):
        sw, sh = self.screen.get_size()
        cx = sw // 2
        self.input_fields = []

        y_base = sh // 2 - 140
        field_w = 200
        field_h = 34

        # Tần số không gian (0.5 - 40 cpd)
        self.input_fields.append(InputField(
            pygame.Rect(cx - 160, y_base, field_w, field_h),
            "Tần số không gian (cpd)  [0.5 - 40]",
            self.okn_cpd, 0.5, 40.0, 0.5,
        ))

        # Vận tốc góc (15 - 40 deg/s)
        self.input_fields.append(InputField(
            pygame.Rect(cx - 160, y_base + 70, field_w, field_h),
            "Vận tốc góc (°/s)  [15 - 40]",
            self.okn_vel, 15.0, 40.0, 1.0,
        ))

        # Khoảng cách (mm)
        self.input_fields.append(InputField(
            pygame.Rect(cx - 160, y_base + 140, field_w, field_h),
            "Khoảng cách (mm)",
            self.screen_info.distance_mm, 100.0, 3000.0, 50.0, ".0f",
        ))

        # Đường chéo màn hình (inch)
        self.input_fields.append(InputField(
            pygame.Rect(cx - 160, y_base + 210, field_w, field_h),
            "Đường chéo màn hình (inch)",
            self.screen_info.diagonal_inches, 5.0, 100.0, 0.5,
        ))

        # Direction selector as buttons on the right
        self.dir_buttons = {}
        dir_y = y_base
        for d in Direction:
            rect = pygame.Rect(cx + 60, dir_y, 280, 32)
            self.dir_buttons[d] = rect
            dir_y += 38

        # OKN Start button
        self.config_okn_btn = Button(
            pygame.Rect(cx - 120, y_base + 260, 240, 48),
            "▶ BẮT ĐẦU OKN TEST",
            SUCCESS, (100, 230, 100),
        )

        # Back button
        self.config_back_btn = Button(
            pygame.Rect(cx - 120, y_base + 320, 240, 38),
            "← Quay lại",
            (80, 80, 90), (100, 100, 110),
        )

    def _handle_config_event(self, event):
        for field in self.input_fields:
            field.handle_event(event)

        # Direction selection
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for d, rect in self.dir_buttons.items():
                if rect.collidepoint(event.pos):
                    self.okn_direction = d

        if self.config_okn_btn and self.config_okn_btn.is_clicked(event):
            # Apply parameters
            self.okn_cpd = self.input_fields[0].value
            self.okn_vel = self.input_fields[1].value
            self.screen_info.set_distance(self.input_fields[2].value)
            self.screen_info.set_diagonal(self.input_fields[3].value)

            # Show warning dialog then start test
            from .warning_dialog import WarningDialog
            dialog = WarningDialog(self.screen)
            confirmed = dialog.run()

            if confirmed:
                self.sub_screen = 'okn_test'
                self._run_okn_test()

        if self.config_back_btn and self.config_back_btn.is_clicked(event):
            self.sub_screen = None

        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            self.sub_screen = None

    def _run_okn_test(self):
        """Run OKN test and return to config when done."""
        test = OKNTest(
            screen=self.screen,
            screen_info=self.screen_info,
            cpd=self.okn_cpd,
            ang_vel=self.okn_vel,
            direction=self.okn_direction,
        )
        test.run()
        self.sub_screen = 'okn_config'

    # ================================================================
    #  Drawing — Menu
    # ================================================================

    def _draw_menu(self, mouse_pos):
        # Panel
        pygame.draw.rect(self.screen, PANEL_COLOR, self.panel_rect, border_radius=16)
        pygame.draw.rect(self.screen, (60, 75, 95), self.panel_rect, 2, border_radius=16)

        cx = self.panel_rect.centerx

        # Title
        title_surf = self.title_font.render("🧠 Thần kinh Nhãn khoa", True, TITLE_COLOR)
        title_rect = title_surf.get_rect(center=(cx, self.panel_rect.top + 50))
        self.screen.blit(title_surf, title_rect)

        # Subtitle
        sub_surf = self.subtitle_font.render(
            "Neuro-Ophthalmology — Clinical Test Suite", True, TEXT_COLOR
        )
        sub_rect = sub_surf.get_rect(center=(cx, self.panel_rect.top + 85))
        self.screen.blit(sub_surf, sub_rect)

        # Screen info
        info_lines = self.screen_info.summary_lines()
        y = self.panel_rect.top + 120
        for line in info_lines:
            surf = self.subtitle_font.render(line, True, TEXT_COLOR)
            surf_rect = surf.get_rect(midleft=(self.panel_rect.left + 30, y))
            self.screen.blit(surf, surf_rect)
            y += 22

        # Buttons
        self.red_desat_btn.draw(self.screen, mouse_pos)
        self.okn_btn.draw(self.screen, mouse_pos)
        self.quit_btn.draw(self.screen, mouse_pos)

    # ================================================================
    #  Drawing — OKN Configuration
    # ================================================================

    def _draw_config(self, mouse_pos):
        # Dim background
        overlay = pygame.Surface(self.screen.get_size(), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (0, 0))

        # Config panel
        sw, sh = self.screen.get_size()
        panel_w, panel_h = 620, 480
        panel_rect = pygame.Rect(
            (sw - panel_w) // 2, (sh - panel_h) // 2, panel_w, panel_h
        )
        pygame.draw.rect(self.screen, PANEL_COLOR, panel_rect, border_radius=12)
        pygame.draw.rect(self.screen, ACCENT, panel_rect, 2, border_radius=12)

        cx = panel_rect.centerx
        title_surf = self.title_font.render("⚙ Cấu hình OKN Test", True, TITLE_COLOR)
        title_rect = title_surf.get_rect(center=(cx, panel_rect.top + 35))
        self.screen.blit(title_surf, title_rect)

        # Draw input fields
        for field in self.input_fields:
            field.draw(self.screen)

        # Draw direction buttons (radio style)
        dir_font = pygame.font.SysFont('Arial', 16)
        for d, rect in self.dir_buttons.items():
            is_selected = d == self.okn_direction
            color = ACCENT if is_selected else (60, 70, 85)
            pygame.draw.rect(self.screen, color, rect, border_radius=6)
            pygame.draw.rect(self.screen, (100, 120, 150), rect, 1, border_radius=6)

            prefix = "●" if is_selected else "○"
            text_surf = dir_font.render(
                f"{prefix}  {DIRECTION_LABELS[d]}", True, WHITE
            )
            text_rect = text_surf.get_rect(midleft=(rect.left + 12, rect.centery))
            self.screen.blit(text_surf, text_rect)

        # Direction label
        dir_label_surf = pygame.font.SysFont('Arial', 14, bold=True).render(
            "Hướng chuyển động", True, TEXT_COLOR
        )
        first_dir_rect = list(self.dir_buttons.values())[0]
        self.screen.blit(dir_label_surf, (first_dir_rect.left, first_dir_rect.top - 18))

        # PPD preview
        ppd = self.screen_info.ppd
        preview_font = pygame.font.SysFont('Arial', 14)
        preview_texts = [
            f"PPD: {ppd:.1f} px/°",
            f"Stripe width: {self.screen_info.get_stripe_width(self.input_fields[0].value)} px",
            f"Vel: {self.screen_info.get_velocity_px_s(self.input_fields[1].value):.0f} px/s",
        ]
        y_preview = panel_rect.top + 170
        for t in preview_texts:
            surf = preview_font.render(t, True, HIGHLIGHT)
            self.screen.blit(surf, (panel_rect.right - 200, y_preview))
            y_preview += 20

        # Buttons
        if self.config_okn_btn:
            self.config_okn_btn.draw(self.screen, mouse_pos)
        if self.config_back_btn:
            self.config_back_btn.draw(self.screen, mouse_pos)

    # ================================================================
    #  Drawing — Red Desaturation (Placeholder)
    # ================================================================

    def _draw_placeholder(self, mouse_pos):
        overlay = pygame.Surface(self.screen.get_size(), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (0, 0))

        sw, sh = self.screen.get_size()
        panel_w, panel_h = 450, 200
        panel_rect = pygame.Rect(
            (sw - panel_w) // 2, (sh - panel_h) // 2, panel_w, panel_h
        )
        pygame.draw.rect(self.screen, PANEL_COLOR, panel_rect, border_radius=12)

        title_surf = self.title_font.render(
            "🟥 Bão hoà màu đỏ", True, TITLE_COLOR
        )
        title_rect = title_surf.get_rect(center=(panel_rect.centerx, panel_rect.top + 50))
        self.screen.blit(title_surf, title_rect)

        msg_surf = pygame.font.SysFont('Arial', 18).render(
            "Module đang được phát triển. Nhấn ESC để quay lại.", True, TEXT_COLOR
        )
        msg_rect = msg_surf.get_rect(center=(panel_rect.centerx, panel_rect.top + 100))
        self.screen.blit(msg_surf, msg_rect)