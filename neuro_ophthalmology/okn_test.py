"""
okn_test.py — Optokinetic Nystagmus (OKN) Render Loop
========================================================

Thuật toán render sọc đen/trắng với:
  - VSync + hardware acceleration (OpenGL)
  - 100% contrast (đen tuyền / trắng tinh)
  - Chuyển động theo 4 hướng: Trái→Phải, Phải→Trái, Lên, Xuống
  - Tham số: spatial frequency (cpd), angular velocity (deg/s)
  - Delta-time frame compensation
"""

import math
import pygame
from enum import Enum

from .calibration import ScreenInfo

# ================================================================
#  Direction Enum
# ================================================================

class Direction(Enum):
    LEFT_TO_RIGHT = 0   # → chuyển động sang phải
    RIGHT_TO_LEFT = 1   # ← chuyển động sang trái
    UP = 2              # ↑ chuyển động lên trên
    DOWN = 3            # ↓ chuyển động xuống dưới

DIRECTION_LABELS = {
    Direction.LEFT_TO_RIGHT: "← Trái → Phải",
    Direction.RIGHT_TO_LEFT: "→ Phải → Trái",
    Direction.UP:            "↓ Dưới → Lên",
    Direction.DOWN:          "↑ Trên → Xuống",
}

DIRECTION_ARROW_KEYS = {
    Direction.LEFT_TO_RIGHT: pygame.K_RIGHT,
    Direction.RIGHT_TO_LEFT: pygame.K_LEFT,
    Direction.UP:            pygame.K_UP,
    Direction.DOWN:          pygame.K_DOWN,
}

# ================================================================
#  Colors
# ================================================================

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

# ================================================================
#  OKNTest — Main Render Loop
# ================================================================

class OKNTest:
    """
    Vòng lặp kết xuất OKN.

    Args:
        screen:       Pygame display surface
        screen_info:  ScreenInfo instance (calibration data)
        cpd:          Spatial frequency (cycles per degree)
        ang_vel:      Angular velocity (degrees per second)
        direction:    Direction enum
    """

    def __init__(
        self,
        screen: pygame.Surface,
        screen_info: ScreenInfo,
        cpd: float = 2.0,
        ang_vel: float = 20.0,
        direction: Direction = Direction.LEFT_TO_RIGHT,
    ):
        self.screen = screen
        self.screen_info = screen_info
        self.cpd = cpd
        self.ang_vel = ang_vel
        self.direction = direction

        # Calculated parameters
        self._recalc()

        # Animation offset (pixels)
        self.offset = 0.0

        # Delta time tracking
        self.clock = pygame.time.Clock()

        # Font for HUD
        self.font = pygame.font.SysFont('Arial', 18, bold=True)
        self.font_small = pygame.font.SysFont('Arial', 14)

        # Running state
        self.running = True
        self.paused = False

    def _recalc(self):
        """Tính lại stripe width & velocity khi thay đổi tham số."""
        self.stripe_width = self.screen_info.get_stripe_width(self.cpd)
        self.velocity_px_s = self.screen_info.get_velocity_px_s(self.ang_vel)
        # Đảm bảo stripe không quá nhỏ
        if self.stripe_width < 1:
            self.stripe_width = 1

    def set_cpd(self, cpd: float):
        # Mở rộng dải kích thích lâm sàng: cho phép sọc rất lớn (0.1 cpd)
        # hoặc rất nhuyễn (60 cpd)
        self.cpd = max(0.1, min(60.0, cpd))
        self._recalc()

    def set_ang_vel(self, vel: float):
        # Mở rộng dải vận tốc góc cho bài test đo ngưỡng giật nhãn cầu
        self.ang_vel = max(2.0, min(120.0, vel))
        self._recalc()

    def set_direction(self, direction: Direction):
        self.direction = direction

    # ================================================================
    #  Stripe Rendering
    # ================================================================

    def _render_stripes(self, surface: pygame.Surface):
        """
        Vẽ các dải sọc đen/trắng lấp đầy surface dựa trên offset hiện tại.

        Với chuyển động ngang (LTR, RTL):
            - Các stripe chạy dọc (columns)
        Với chuyển động dọc (UP, DOWN):
            - Các stripe chạy ngang (rows)

        Dùng dirty rectangles: vẽ thừa 1 stripe mỗi bên để tránh khoảng trống.
        """
        sw, sh = surface.get_size()

        if self.direction in (Direction.LEFT_TO_RIGHT, Direction.RIGHT_TO_LEFT):
            # === Hướng ngang: stripe dọc ===
            # Tính offset theo trục X
            total_width = sw + 2 * self.stripe_width
            # Số stripe cần vẽ = total_width / stripe_width + 2
            num_stripes = total_width // self.stripe_width + 3

            for i in range(-1, num_stripes + 1):
                # Công thức tọa độ chuẩn: x_i = i * w - Δ_offset
                # Không dùng modulo => giữ nguyên toàn bộ trường nhìn (FOV)
                x = int(round(i * self.stripe_width - self.offset))

                # Xác định màu dựa trên index
                color = WHITE if (i % 2 == 0) else BLACK
                pygame.draw.rect(
                    surface, color,
                    (x, 0, self.stripe_width, sh),
                )
        else:
            # === Hướng dọc: stripe ngang ===
            total_height = sh + 2 * self.stripe_width
            num_stripes = total_height // self.stripe_width + 3

            for i in range(-1, num_stripes + 1):
                # Công thức tọa độ chuẩn: y_i = i * w - Δ_offset
                # Không dùng modulo => giữ nguyên toàn bộ trường nhìn (FOV)
                y = int(round(i * self.stripe_width - self.offset))

                color = WHITE if (i % 2 == 0) else BLACK
                pygame.draw.rect(
                    surface, color,
                    (0, y, sw, self.stripe_width),
                )

    # ================================================================
    #  HUD Overlay
    # ================================================================

    def _draw_hud(self, surface: pygame.Surface):
        """Vẽ thông tin lên góc trên bên trái."""
        lines = [
            f"OKN — {DIRECTION_LABELS[self.direction]}",
            f"Spatial Freq: {self.cpd:.1f} cpd  |  Stripe: {self.stripe_width} px",
            f"Angular Vel:  {self.ang_vel:.1f} °/s  |  PPD: {self.screen_info.ppd:.1f}",
            f"Distance: {self.screen_info.distance_mm:.0f} mm  |  Screen: {self.screen_info.res_w}x{self.screen_info.res_h}",
            "",
            "[ESC] Thoát  |  [SPACE] Tạm dừng  |  [↑↓] Tốc độ  |  [←→] Hướng  |  [+/-] Tần số",
        ]

        y = 16
        for i, line in enumerate(lines):
            is_title = (i == 0)
            font = self.font if is_title else self.font_small
            color = (255, 255, 200) if is_title else (200, 200, 200)
            if self.paused and i == 0:
                color = (255, 100, 100)

            surf = font.render(line, True, color)
            surface.blit(surf, (16, y))
            y += 24 if is_title else 20

    # ================================================================
    #  Animation Step
    # ================================================================

    def _update_offset(self, dt: float):
        """
        Cập nhật offset dựa trên vận tốc và delta time.

        dt: delta time (giây)
        """
        if self.paused:
            return

        displacement = self.velocity_px_s * dt

        # Vector vận tốc: với x_i = i * w - offset, để điểm ảnh chạy sang
        # phải (x tăng) thì offset phải GIẢM, và ngược lại.
        if self.direction == Direction.LEFT_TO_RIGHT:
            self.offset -= displacement
        elif self.direction == Direction.RIGHT_TO_LEFT:
            self.offset += displacement
        elif self.direction == Direction.UP:
            self.offset += displacement
        elif self.direction == Direction.DOWN:
            self.offset -= displacement

        # Reset offset để tránh tràn số
        period = 2 * self.stripe_width
        if period > 0:
            self.offset %= period

    # ================================================================
    #  Key Handling
    # ================================================================

    def _handle_keys(self):
        keys = pygame.key.get_pressed()

        # Điều chỉnh tần số không gian (+ / -)
        if keys[pygame.K_PLUS] or keys[pygame.K_EQUALS]:
            self.set_cpd(self.cpd + 0.1)
        if keys[pygame.K_MINUS]:
            self.set_cpd(self.cpd - 0.1)

        # Điều chỉnh vận tốc góc (↑ / ↓)
        if keys[pygame.K_UP]:
            self.set_ang_vel(self.ang_vel + 0.5)
        if keys[pygame.K_DOWN]:
            self.set_ang_vel(self.ang_vel - 0.5)

        # Điều chỉnh hướng (← / →)
        if keys[pygame.K_LEFT]:
            self.set_direction(Direction.RIGHT_TO_LEFT)
        if keys[pygame.K_RIGHT]:
            self.set_direction(Direction.LEFT_TO_RIGHT)

    def _handle_event(self, event: pygame.event.Event):
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.running = False
            elif event.key == pygame.K_SPACE:
                self.paused = not self.paused
            elif event.key == pygame.K_r:
                # Reset
                self.offset = 0.0

        if event.type == pygame.QUIT:
            self.running = False

    # ================================================================
    #  Main Loop
    # ================================================================

    def run(self):
        """
        Chạy vòng lặp render OKN.

        Returns khi bác sĩ thoát (ESC / Close).
        """
        self.running = True
        self.offset = 0.0

        # VSync: Pygame 2.0+ hỗ trợ vsync=1 trong display.set_mode()
        # Nếu đã có màn hình từ trước, ta không thể set lại.
        # Đảm bảo FPS được giới hạn chặt bằng clock.tick(monitor refresh).
        # Lấy refresh rate từ display info
        try:
            refresh_rate = pygame.display.Info().current_hz or 60
        except Exception:
            refresh_rate = 60

        # Tạo surface tạm để render stripe (full screen)
        sw, sh = self.screen.get_size()

        while self.running:
            # dt = delta time (seconds)
            dt = self.clock.tick(refresh_rate) / 1000.0

            # Events
            for event in pygame.event.get():
                self._handle_event(event)

            # Key state (continuous)
            self._handle_keys()

            # Update animation
            self._update_offset(dt)

            # === Render ===
            # 1. Fill nền đen
            self.screen.fill(BLACK)

            # 2. Vẽ stripe lên surface chính
            self._render_stripes(self.screen)

            # 3. Vẽ HUD overlay
            self._draw_hud(self.screen)

            # 4. Flip buffer (VSync)
            pygame.display.flip()

        return