#!/usr/bin/env python3
"""
Clinical Optotype Generator — Chuẩn lâm sàng, dựa trên lưới 5×5 (1 unit = 1 stroke_width)
=========================================================================================

Nguyên tắc quang học:
  1. Mỗi optotype nằm trong lưới 5×5, mỗi ô = 1 stroke_width (1/5 grid_size)
  2. Internal spacing = chính xác 1 stroke_width
  3. stroke-linecap="round" + stroke-linejoin="round" trên mọi <path>
  4. Ink Area Equilibrium: sai số ≤ 5% giữa các ký tự trong cùng bộ

Usage:
    python optotype_generator.py --type lea     --output lea_standard.svg
    python optotype_generator.py --type sloan   --output sloan_C.svg --optotype C
    python optotype_generator.py --type landolt --output landolt_c.svg
    python optotype_generator.py --type tumbling --output tumbling_e.svg
    python optotype_generator.py --type all     --output-dir ./generated --report-ink
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
from typing import Dict, List, Optional, Tuple


# ================================================================
#  SVG Path Length Parser (hỗ trợ M, L, C, A, Z)
# ================================================================

def _svg_path_length(path_str: str) -> float:
    """
    Tính chiều dài thực tế của một SVG path string.
    Hỗ trợ: M/m, L/l, C/c, A/a, Z/z.
    """
    tokens = re.findall(
        r"[MLCAZmlcaz]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?",
        path_str,
    )
    if not tokens:
        return 0.0

    def _hd(x1, y1, x2, y2):
        return math.hypot(x2 - x1, y2 - y1)

    total = 0.0
    cx = cy = sx = sy = 0.0
    idx, n = 0, len(tokens)

    def _num() -> float:
        nonlocal idx
        while idx < n:
            try:
                v = float(tokens[idx])
                idx += 1
                return v
            except ValueError:
                idx += 1
        return 0.0

    while idx < n:
        cmd = tokens[idx].upper()
        idx += 1

        if cmd == 'M':
            cx = _num()
            cy = _num()
            sx, sy = cx, cy

        elif cmd == 'L':
            nx = _num()
            ny = _num()
            total += _hd(cx, cy, nx, ny)
            cx, cy = nx, ny

        elif cmd == 'C':
            _num(); _num()  # x1 y1
            _num(); _num()  # x2 y2
            nx = _num(); ny = _num()
            total += _hd(cx, cy, nx, ny) * 1.1  # xấp xỉ cubic bezier
            cx, cy = nx, ny

        elif cmd == 'A':
            rx = _num()
            ry = _num()
            _num()  # x_rot
            large = int(_num())
            _num()  # sweep
            nx = _num()
            ny = _num()
            r = (rx + ry) / 2.0
            chord = _hd(cx, cy, nx, ny)
            if r > 0 and chord > 0:
                half_ang = math.asin(max(0.0, min(1.0, chord / (2.0 * r))))
                small = 2.0 * r * half_ang
                total += (2.0 * math.pi * r - small) if large == 1 else small
            else:
                total += chord
            cx, cy = nx, ny

        elif cmd == 'Z':
            total += _hd(cx, cy, sx, sy)
            cx, cy = sx, sy

    return total


# ================================================================
#  ClinicalOptotypeGenerator
# ================================================================

class ClinicalOptotypeGenerator:
    """
    Sinh optotype chuẩn lâm sàng dựa trên lưới 5×5.

    Parameters
    ----------
    grid_size : float
        Kích thước viewBox (mặc định 100).
    stroke_ratio : float
        Tỷ lệ stroke_width / grid_size (mặc định 0.2 = 1/5).
    """

    def __init__(self, grid_size: float = 100.0, stroke_ratio: float = 0.2):
        self.size = float(grid_size)
        self.sw = self.size * stroke_ratio            # stroke_width
        self.unit = self.sw                           # 1 MAR unit = stroke_width
        self.min_coord = self.sw / 2.0                # rìa trong (không bị cắt)
        self.max_coord = self.size - self.sw / 2.0    # rìa trong phải
        self.cx = self.size / 2.0
        self.cy = self.size / 2.0

    # ----------------------------------------------------------
    #  SVG wrapper — Rendering Engine
    # ----------------------------------------------------------

    def _path(self, d: str, optotype_family: str = "lea") -> str:
        """
        Chỉ định lâm sàng:
        - LEA: Dùng 'round' để đồng mức nhận diện hình khối khép kín.
        - ETDRS (Sloan, Landolt, Tumbling): PHẢI dùng 'butt' và 'miter'
          để bảo toàn góc vuông và khe sáng MAR.
        """
        linecap = "round" if optotype_family == "lea" else "butt"
        linejoin = "round" if optotype_family == "lea" else "miter"

        return (
            f'<path d="{d}" fill="none" stroke="#000" '
            f'stroke-width="{self.sw:.0f}" '
            f'stroke-linecap="{linecap}" stroke-linejoin="{linejoin}"/>'
        )

    def generate_svg(self, path_d_list: List[str],
                     optotype_family: str = "lea") -> str:
        """Kết xuất SVG hoàn chỉnh với đúng họ linecap/linejoin."""
        paths_str = "\n".join(
            f"  {self._path(d, optotype_family)}" for d in path_d_list
        )
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {self.size:.0f} {self.size:.0f}" '
            f'width="{self.size:.0f}" height="{self.size:.0f}">\n'
            f'{paths_str}\n'
            f'</svg>'
        )

    # ============================================================
    #  LANDOLT C
    # ============================================================

    def get_landolt_c(self) -> List[str]:
        """
        Vòng tròn hở Landolt C — khe hở = chính xác 1 unit (1 MAR).
        Khe hở nằm bên phải.
        """
        r = (self.max_coord - self.min_coord) / 2.0
        cx, cy = self.cx, self.cy

        gap_angle = math.degrees(self.unit / r)
        start_deg = gap_angle / 2.0
        end_deg = 360.0 - gap_angle / 2.0

        start_rad = math.radians(start_deg)
        end_rad = math.radians(end_deg)

        sx = cx + r * math.cos(start_rad)
        sy = cy + r * math.sin(start_rad)
        ex = cx + r * math.cos(end_rad)
        ey = cy + r * math.sin(end_rad)

        return [f"M {sx:.2f},{sy:.2f} A {r:.2f},{r:.2f} 0 1,1 {ex:.2f},{ey:.2f}"]

    # ============================================================
    #  TUMBLING E
    # ============================================================

    def get_tumbling_e(self) -> List[str]:
        """
        Chữ E chuẩn ETDRS — Khớp tuyệt đối vào viền Bounding Box 5x5 MAR.
        Khi linecap="butt", nét vẽ kết thúc chính xác tại tọa độ,
        không bị cộng thêm bán kính viền.
        Cột dọc X trải từ 0 đến stroke_width (20).
        """
        x_left = self.min_coord
        return [
            f"M {x_left:.2f},0 L {x_left:.2f},{self.size:.0f}",         # Cột dọc trái
            f"M 0,{self.min_coord:.2f} L {self.size:.0f},{self.min_coord:.2f}",  # Cạnh ngang trên
            f"M 0,{self.cy:.2f} L {self.size:.0f},{self.cy:.2f}",                # Cạnh ngang giữa
            f"M 0,{self.max_coord:.2f} L {self.size:.0f},{self.max_coord:.2f}",  # Cạnh ngang dưới
        ]

    # ============================================================
    #  LEA SYMBOLS
    # ============================================================

    def get_lea_circle(self) -> List[str]:
        """LEA Circle — vòng tròn khép kín."""
        r = (self.max_coord - self.min_coord) / 2.0
        return [
            f"M {self.min_coord:.2f},{self.cy:.2f} "
            f"A {r:.2f},{r:.2f} 0 1,1 {self.max_coord:.2f},{self.cy:.2f} "
            f"A {r:.2f},{r:.2f} 0 1,1 {self.min_coord:.2f},{self.cy:.2f}"
        ]

    def get_lea_square(self) -> List[str]:
        """LEA Square — hình vuông khép kín."""
        offset = self.unit * 0.2
        x1 = self.min_coord + offset
        y1 = self.min_coord + offset
        x2 = self.max_coord - offset
        y2 = self.max_coord - offset
        return [f"M {x1:.2f},{y1:.2f} L {x2:.2f},{y1:.2f} L {x2:.2f},{y2:.2f} L {x1:.2f},{y2:.2f} Z"]

    def get_lea_house(self) -> List[str]:
        """LEA House — đa giác 5 cạnh, không có cửa sổ."""
        offset = self.unit * 0.1
        top_x, top_y = self.cx, self.min_coord + offset
        bot_y = self.max_coord - offset
        left_x = self.min_coord + offset
        right_x = self.max_coord - offset
        mid_y = self.cy + offset
        return [
            f"M {top_x:.2f},{top_y:.2f} "
            f"L {right_x:.2f},{mid_y:.2f} L {right_x:.2f},{bot_y:.2f} "
            f"L {left_x:.2f},{bot_y:.2f} L {left_x:.2f},{mid_y:.2f} Z"
        ]

    def get_lea_heart(self) -> List[str]:
        """LEA Heart/Apple — trái tim đối xứng bằng Bezier."""
        bot = self.max_coord - self.unit * 0.15
        mid = self.size * 0.35
        lobe = self.size * 0.22
        c1x = self.size * 0.12
        return [
            f"M {self.cx:.2f},{bot:.2f} "
            f"C {c1x:.2f},{bot*0.90:.2f} {c1x:.2f},{mid:.2f} "
            f"  {self.cx-lobe:.2f},{mid*0.72:.2f} "
            f"C {self.cx-lobe:.2f},{self.min_coord*1.5:.2f} "
            f"  {self.cx-self.unit*0.20:.2f},{self.min_coord*0.8:.2f} "
            f"  {self.cx:.2f},{self.min_coord*2.0:.2f} "
            f"C {self.cx+self.unit*0.20:.2f},{self.min_coord*0.8:.2f} "
            f"  {self.cx+lobe:.2f},{self.min_coord*1.5:.2f} "
            f"  {self.cx+lobe:.2f},{mid*0.72:.2f} "
            f"C {self.size-c1x:.2f},{mid:.2f} "
            f"  {self.size-c1x:.2f},{bot*0.90:.2f} "
            f"  {self.cx:.2f},{bot:.2f} Z"
        ]

    def lea_symbols(self) -> Dict[str, List[str]]:
        return {
            "circle": self.get_lea_circle(),
            "square": self.get_lea_square(),
            "house": self.get_lea_house(),
            "heart": self.get_lea_heart(),
        }

    # ============================================================
    #  SLOAN LETTERS  (lưới 5×5)
    # ============================================================

    def _sloan_C(self) -> List[str]:
        return self.get_landolt_c()

    def _sloan_D(self) -> List[str]:
        x_stem = self.min_coord
        x_curve = x_stem + self.unit
        curve_w = self.max_coord - x_curve
        r = curve_w / 2.0
        return [f"M {x_stem:.2f},{self.min_coord:.2f} "
                f"L {x_curve:.2f},{self.min_coord:.2f} "
                f"A {r:.2f},{r:.2f} 0 0,1 {x_curve:.2f},{self.max_coord:.2f} "
                f"L {x_stem:.2f},{self.max_coord:.2f} Z"]

    def _sloan_H(self) -> List[str]:
        x_left = self.min_coord
        x_right = self.max_coord
        return [
            f"M {x_left:.2f},{self.min_coord:.2f} L {x_left:.2f},{self.max_coord:.2f}",
            f"M {x_right:.2f},{self.min_coord:.2f} L {x_right:.2f},{self.max_coord:.2f}",
            f"M {x_left + self.unit:.2f},{self.cy:.2f} L {x_right:.2f},{self.cy:.2f}",
        ]

    def _sloan_K(self) -> List[str]:
        x_stem = self.min_coord
        return [
            f"M {x_stem:.2f},{self.min_coord:.2f} L {x_stem:.2f},{self.max_coord:.2f}",
            f"M {x_stem:.2f},{self.cy:.2f} L {self.max_coord:.2f},{self.min_coord:.2f}",
            f"M {x_stem:.2f},{self.cy:.2f} L {self.max_coord:.2f},{self.max_coord:.2f}",
        ]

    def _sloan_N(self) -> List[str]:
        return [
            f"M {self.min_coord:.2f},{self.min_coord:.2f} L {self.min_coord:.2f},{self.max_coord:.2f}",
            f"M {self.max_coord:.2f},{self.min_coord:.2f} L {self.max_coord:.2f},{self.max_coord:.2f}",
            f"M {self.min_coord:.2f},{self.min_coord:.2f} L {self.max_coord:.2f},{self.max_coord:.2f}",
        ]

    def _sloan_O(self) -> List[str]:
        return self.get_lea_circle()

    def _sloan_R(self) -> List[str]:
        x_stem = self.min_coord
        r_loop = (self.max_coord - self.min_coord) / 4.0
        loop_cx = self.min_coord + r_loop
        return [
            f"M {x_stem:.2f},{self.min_coord:.2f} L {x_stem:.2f},{self.max_coord:.2f}",
            f"M {x_stem:.2f},{self.min_coord:.2f} "
            f"A {r_loop:.2f},{r_loop:.2f} 0 0,1 {x_stem:.2f},{self.cy:.2f}",
            f"M {loop_cx:.2f},{self.cy:.2f} L {self.max_coord:.2f},{self.max_coord:.2f}",
        ]

    def _sloan_S(self) -> List[str]:
        m = self.size * 0.35
        return [f"M {self.max_coord:.2f},{self.min_coord*1.3:.2f} "
                f"C {self.size*0.55:.2f},{self.min_coord*1.3:.2f} "
                f"  {m:.2f},{self.min_coord*2.2:.2f} "
                f"  {m:.2f},{self.cy*0.6:.2f} "
                f"C {m:.2f},{self.cy*0.8:.2f} "
                f"  {self.size*0.55:.2f},{self.cy:.2f} "
                f"  {self.size*0.65:.2f},{self.cy:.2f} "
                f"C {self.size*0.75:.2f},{self.cy:.2f} "
                f"  {self.max_coord:.2f},{self.cy*1.2:.2f} "
                f"  {self.max_coord:.2f},{self.cy*1.4:.2f} "
                f"C {self.max_coord:.2f},{self.max_coord-self.min_coord*2.2:.2f} "
                f"  {self.size*0.55:.2f},{self.max_coord-self.min_coord*1.3:.2f} "
                f"  {self.min_coord:.2f},{self.max_coord-self.min_coord*1.3:.2f}"]

    def _sloan_V(self) -> List[str]:
        return [f"M {self.min_coord:.2f},{self.min_coord:.2f} "
                f"L {self.cy:.2f},{self.max_coord:.2f} "
                f"L {self.max_coord:.2f},{self.min_coord:.2f}"]

    def _sloan_Z(self) -> List[str]:
        return [
            f"M {self.min_coord:.2f},{self.min_coord:.2f} L {self.max_coord:.2f},{self.min_coord:.2f}",
            f"M {self.min_coord:.2f},{self.max_coord:.2f} L {self.max_coord:.2f},{self.max_coord:.2f}",
            f"M {self.max_coord:.2f},{self.min_coord:.2f} L {self.min_coord:.2f},{self.max_coord:.2f}",
        ]

    def sloan_letters(self) -> Dict[str, List[str]]:
        return {
            "C": self._sloan_C(),
            "D": self._sloan_D(),
            "H": self._sloan_H(),
            "K": self._sloan_K(),
            "N": self._sloan_N(),
            "O": self._sloan_O(),
            "R": self._sloan_R(),
            "S": self._sloan_S(),
            "V": self._sloan_V(),
            "Z": self._sloan_Z(),
        }

    # ============================================================
    #  INK AREA VERIFICATION
    # ============================================================

    def verify_ink_area(self, optotype_dict: Dict[str, List[str]],
                        tolerance: float = 0.05) -> Dict[str, float]:
        """
        Kiểm định Ink Area Equilibrium.
        Sai số ≤ 5% (tolerance=0.05).

        Returns dict {name: area}
        Raises ValueError nếu vượt ngưỡng.
        """
        areas = {}
        for name, paths in optotype_dict.items():
            length = sum(_svg_path_length(p) for p in paths)
            areas[name] = length * self.sw

        avg = sum(areas.values()) / len(areas)

        print(f"\n--- BÁO CÁO KIỂM ĐỊNH QUANG HỌC (INK AREA) ---")
        print(f"Diện tích mục tiêu trung bình: {avg:.2f} px²")

        all_pass = True
        for name, area in areas.items():
            variance = abs(area - avg) / avg
            status = "✓ ĐẠT" if variance <= tolerance else "✗ LỖI"
            if variance > tolerance:
                all_pass = False
            print(f"  [{name:12s}] Area={area:>8.2f} px²  |  Sai số={variance:>5.1%}  →  {status}")

        if not all_pass:
            raise ValueError(
                "CẢNH BÁO LÂM SÀNG: Một số optotype có sai lệch diện tích vùng tối "
                f"vượt ngưỡng {tolerance:.0%}. Hãy điều chỉnh tọa độ đa giác."
            )
        print("✓ TOÀN BỘ KÝ TỰ ĐẠT CHUẨN ĐỒNG MỨC NHẬN DIỆN.\n")
        return areas

    # ============================================================
    #  CLI helpers
    # ============================================================

    def generate_svg_for(self, optotype_type: str,
                         specific: Optional[str] = None) -> str:
        """Generate SVG cho một optotype cụ thể."""
        map_ = {
            "lea": (self.lea_symbols(), "circle"),
            "sloan": (self.sloan_letters(), "C"),
            "landolt": ({"landolt_c": self.get_landolt_c()}, "landolt_c"),
            "tumbling": ({"tumbling_e": self.get_tumbling_e()}, "tumbling_e"),
        }
        if optotype_type not in map_:
            raise ValueError(f"Unknown type: {optotype_type}")
        symbols, default = map_[optotype_type]
        key = specific if specific in symbols else default
        return self.generate_svg(symbols[key], optotype_family=optotype_type)

    def export_json(self, output_dir: str = ".") -> None:
        """Xuất tất cả paths ra JSON cho frontend."""
        import json

        def _serialize(paths_list, family="lea"):
            return self.generate_svg(paths_list, optotype_family=family)

        data = {
            "meta": {
                "grid_size": self.size,
                "stroke_width": self.sw,
                "stroke_ratio": self.sw / self.size,
            },
            "lea": {k: _serialize(v, "lea") for k, v in self.lea_symbols().items()},
            "sloan": {k: _serialize(v, "sloan") for k, v in self.sloan_letters().items()},
            "landolt": {"landolt_c": _serialize(self.get_landolt_c(), "landolt")},
            "tumbling": {"tumbling_e": _serialize(self.get_tumbling_e(), "tumbling")},
        }
        os.makedirs(output_dir, exist_ok=True)
        path = os.path.join(output_dir, "optotypes.json")
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"✓ Exported → {path}")


# ================================================================
#  CLI
# ================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Clinical Optotype Generator — Chuẩn lâm sàng 5×5",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--type", "-t",
                        choices=["lea", "sloan", "landolt", "tumbling", "all"],
                        required=True)
    parser.add_argument("--optotype", "-o", default=None)
    parser.add_argument("--output", "-out", default=None)
    parser.add_argument("--output-dir", "-d", default="./generated")
    parser.add_argument("--grid-size", "-g", type=float, default=100.0)
    parser.add_argument("--stroke-ratio", "-sr", type=float, default=0.2)
    parser.add_argument("--report-ink", action="store_true")
    parser.add_argument("--strict", action="store_true",
                        help="Dừng nếu ink area > 5%")

    args = parser.parse_args()
    gen = ClinicalOptotypeGenerator(args.grid_size, args.stroke_ratio)

    if args.type == "all":
        outdir = args.output_dir
        os.makedirs(outdir, exist_ok=True)

        types = [
            ("lea", gen.lea_symbols(), "LEA"),
            ("sloan", gen.sloan_letters(), "Sloan"),
            ("landolt", {"LandoltC": gen.get_landolt_c()}, "Landolt"),
            ("tumbling", {"TumblingE": gen.get_tumbling_e()}, "Tumbling"),
        ]

        for tkey, symbols, label in types:
            for skey, paths in symbols.items():
                svg = gen.generate_svg(paths, optotype_family=tkey)
                fname = f"{tkey}_{skey}.svg"
                with open(os.path.join(outdir, fname), "w") as f:
                    f.write(svg)
                print(f"✓ {label} › {fname}")

        gen.export_json(outdir)

        if args.report_ink or args.strict:
            for tkey, symbols, label in types:
                print(f"\n── {label} ──")
                try:
                    gen.verify_ink_area(symbols, tolerance=0.05)
                except ValueError as e:
                    print(f"  {e}")
                    if args.strict:
                        sys.exit(1)

        print(f"\n✓ All → {outdir}/")
        return

    if not args.output:
        parser.error("--output required")

    svg = gen.generate_svg_for(args.type, args.optotype)
    with open(args.output, "w") as f:
        f.write(svg)
    print(f"✓ Generated → {args.output}")


if __name__ == "__main__":
    main()
