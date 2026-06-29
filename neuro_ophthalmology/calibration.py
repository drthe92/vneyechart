"""
calibration.py — Screen Calibration & PPD Calculation
=======================================================

Công thức PPD (Pixels Per Degree):
    PPD = d × tan(π/180) × R / W

Trong đó:
    d  — Khoảng cách từ mắt đến màn hình (mm)
    W  — Chiều rộng vật lý màn hình (mm)
    R  — Độ phân giải ngang (pixels)

Spatial Frequency -> Stripe Width:
    stripe_width_px = PPD / (2 × cpd)

Angular Velocity -> Pixel Velocity:
    velocity_px_s   = PPD × ang_vel_deg_s
"""

import math
import pygame

# ================================================================
#  Constants
# ================================================================

MM_PER_INCH = 25.4

DEFAULT_DISTANCE_MM = 400.0      # 40 cm (thị lực gần)
DEFAULT_DIAGONAL_IN = 15.6       # Laptop phổ biến

# ================================================================
#  PPD Calculation
# ================================================================

def calculate_ppi(diagonal_inches: float, res_w: int, res_h: int) -> float:
    """Tính PPI (Pixels Per Inch) từ đường chéo và độ phân giải."""
    diag_px = math.sqrt(res_w ** 2 + res_h ** 2)
    return diag_px / diagonal_inches


def calculate_physical_width_mm(diagonal_inches: float, res_w: int, res_h: int) -> float:
    """Tính chiều rộng vật lý màn hình (mm) từ đường chéo và aspect ratio."""
    aspect = res_w / res_h
    diag_mm = diagonal_inches * MM_PER_INCH
    # diag^2 = w^2 + h^2 = h^2 * (aspect^2 + 1)
    h_mm = diag_mm / math.sqrt(aspect ** 2 + 1)
    w_mm = h_mm * aspect
    return w_mm


def calculate_ppd(distance_mm: float, physical_width_mm: float, res_w: int) -> float:
    """
    Tính PPD (Pixels Per Degree).

    PPD = d × tan(1°) × R / W
         = d × tan(π/180) × R / W

    Args:
        distance_mm:       Khoảng cách mắt-màn (mm)
        physical_width_mm: Chiều rộng vật lý (mm)
        res_w:             Độ phân giải ngang (pixels)

    Returns:
        PPD (pixels per degree visual angle)
    """
    if physical_width_mm <= 0 or res_w <= 0:
        return 0.0
    one_deg_mm = distance_mm * math.tan(math.pi / 180.0)
    px_per_mm = res_w / physical_width_mm
    return one_deg_mm * px_per_mm


def stripe_width_px(ppd: float, spatial_frequency_cpd: float) -> int:
    """
    Tính bề rộng 1 sọc (stripe) đơn — đen hoặc trắng.

    1 cycle = 2 stripes (1 đen + 1 trắng).
    stripe_width (px) = PPD / (2 × cpd)

    Returns:
        int — stripe width in pixels (tối thiểu 1)
    """
    if spatial_frequency_cpd <= 0 or ppd <= 0:
        return 1
    width = ppd / (2.0 * spatial_frequency_cpd)
    return max(1, int(round(width)))


def angular_velocity_to_px_per_sec(ppd: float, ang_vel_deg_s: float) -> float:
    """
    Chuyển vận tốc góc (deg/s) sang vận tốc pixel (px/s).

    velocity_px_s = PPD × ang_vel_deg_s
    """
    return ppd * ang_vel_deg_s


# ================================================================
#  ScreenInfo — lấy thông tin màn hình từ Pygame
# ================================================================

class ScreenInfo:
    """Lưu thông số màn hình hiện tại."""

    def __init__(self):
        # Mặc định
        self.distance_mm = DEFAULT_DISTANCE_MM
        self.diagonal_inches = DEFAULT_DIAGONAL_IN

        # Lấy từ pygame display
        info = pygame.display.Info()
        self.res_w = info.current_w
        self.res_h = info.current_h

        # Tính toán
        self._recalc()

    def _recalc(self):
        self.physical_width_mm = calculate_physical_width_mm(
            self.diagonal_inches, self.res_w, self.res_h
        )
        self.ppi = calculate_ppi(self.diagonal_inches, self.res_w, self.res_h)
        self.ppd = calculate_ppd(self.distance_mm, self.physical_width_mm, self.res_w)
        self.px_per_mm = self.res_w / self.physical_width_mm if self.physical_width_mm > 0 else 0

    def set_distance(self, mm: float):
        self.distance_mm = mm
        self._recalc()

    def set_diagonal(self, inches: float):
        self.diagonal_inches = inches
        self._recalc()

    def get_stripe_width(self, cpd: float) -> int:
        return stripe_width_px(self.ppd, cpd)

    def get_velocity_px_s(self, ang_vel_deg_s: float) -> float:
        return angular_velocity_to_px_per_sec(self.ppd, ang_vel_deg_s)

    def summary_lines(self) -> list[str]:
        """Trả về list các dòng text để hiển thị summary."""
        return [
            f"Độ phân giải:    {self.res_w} x {self.res_h} px",
            f"Đường chéo:       {self.diagonal_inches:.1f}\"",
            f"Rộng vật lý:      {self.physical_width_mm:.1f} mm",
            f"Khoảng cách:      {self.distance_mm:.0f} mm",
            f"PPI:              {self.ppi:.1f}",
            f"PPD:              {self.ppd:.2f} px/°",
        ]