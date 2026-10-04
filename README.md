# Vision Therapy Web Application

A comprehensive web-based vision therapy application with various optotype tests and diagnostic tools for ophthalmology and optometry practice.

## Features

- **Multiple Vision Tests**:
  - ETDRS Chart (LogMAR)
  - Snellen Chart
  - Landolt C
  - Tumbling E
  - HOTV
  - LEA Symbols
  - Duochrome Test
  - Red Desaturation Test
  - Worth 4 Dot Test
  - Neuro-ophthalmology Tests

- **Calibration System**:
  - Screen calibration with PPI calculation
  - Distance measurement
  - Optotype sizing based on LogMAR values

- **Responsive Design**:
  - Works on various screen sizes
  - Properly sized optotypes for accurate testing

## Installation

1. Clone the repository:
```bash
git clone https://github.com/drthe92/vneyechart.git
cd vneyechart
```

2. Serve tĩnh từ thư mục gốc rồi mở bằng trình duyệt (BẮT BUỘC qua
http/https — KHÔNG mở `index.html` trực tiếp bằng `file://` vì ES modules
và Service Worker bị trình duyệt chặn):
```bash
python3 -m http.server 8080
# mở http://localhost:8080/
```

3. Yêu cầu deploy: host ở **domain root** (vd `app.matcauvong.com`),
không host dưới sub-path (Service Worker + manifest đang dùng đường dẫn
tuyệt đối `/sw.js`, `/manifest.json`). Mỗi đợt release có đổi file tĩnh
thì tăng `CACHE_NAME` trong `sw.js` để client tự cập nhật.

## Usage

The application is designed to be used in clinical settings for vision testing. All optotypes are properly sized according to standard clinical protocols.

## Modules

- `modules/` - Core functionality modules
- `js/` - JavaScript utilities and controllers
- `css/` - Styling files
- `assets/` - Static assets
- `generated/` - Generated optotype files

## Development

This is a client-side web application built with HTML, CSS, and JavaScript. No server-side dependencies are required.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request