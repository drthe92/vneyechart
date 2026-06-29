#!/usr/bin/env python3
"""
main.py — Neuro-Ophthalmology Test Suite
==========================================

Entry point cho module "Thần kinh Nhãn khoa".

Khởi tạo Pygame với:
  - Video mode: HARDWARE ACCELERATION + VSync (pygame.HWSURFACE | pygame.DOUBLEBUF | pygame.SCALED)
  - Fullscreen mặc định
  - VSync enabled để loại bỏ screen tearing

Usage:
    python -m neuro_ophthalmology.main
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame

from neuro_ophthalmology.calibration import ScreenInfo
from neuro_ophthalmology.ui import MainMenu


# ================================================================
#  Pygame Initialization
# ================================================================

def init_pygame() -> pygame.Surface:
    """
    Khởi tạo Pygame với cấu hình đồ hoạ tối ưu.

    Returns:
        pygame.Surface — màn hình chính (fullscreen)
    """
    pygame.init()

    # Lấy thông tin màn hình
    info = pygame.display.Info()
    res_w, res_h = info.current_w, info.current_h

    # Flags: hardware acceleration, double buffer, fullscreen
    flags = pygame.HWSURFACE | pygame.DOUBLEBUF | pygame.FULLSCREEN | pygame.SCALED

    # Pygame 2.0+ hỗ trợ VSync qua display.set_mode(..., vsync=1)
    try:
        screen = pygame.display.set_mode(
            (res_w, res_h),
            flags=flags,
            vsync=1,  # VSync ON — loại bỏ screen tearing
        )
    except TypeError:
        # Fallback nếu vsync không được hỗ trợ
        screen = pygame.display.set_mode((res_w, res_h), flags=flags)

    pygame.display.set_caption("Neuro-Ophthalmology — Thần kinh Nhãn khoa")
    pygame.mouse.set_visible(True)

    return screen


# ================================================================
#  Main
# ================================================================

def main():
    """Hàm chính của ứng dụng."""
    try:
        screen = init_pygame()
    except pygame.error as e:
        print(f"Không thể khởi tạo Pygame: {e}")
        sys.exit(1)

    # Screen calibration
    screen_info = ScreenInfo()

    # Menu loop
    menu = MainMenu(screen, screen_info)
    menu.run()

    # Cleanup
    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()