import CatchGame from './anti_suppression_catch.js';
import ShapeAlignmentGame from './shape_alignment.js';
import VergenceTrackerGame from './vergence_tracker_game.js';
import SaccadicTrackingGame from './saccadic_tracking_game.js';
import RDSTherapyGame from './rds_therapy_game.js';
import DivergenceTherapyGame from './divergence_therapy_game.js';
import ConvergenceTherapyGame from './convergence_therapy_game.js';
import CamVisualStimulatorGame from './cam_visual_stimulator_game.js';
import AntiCrowdingGame from './anti_crowding_game.js';
import RedConeStimulatorGame from './red_cone_stimulator_game.js';
import OKNStimulationGame from './okn_stimulation_game.js';
import GaborPerceptualLearningGame from './gabor_perceptual_learning_game.js';
import DichopticPursuitGame from './dichoptic_pursuit_game.js';

/**
 * Therapeutic Menu Controller (Lazy Binding Architecture)
 *
 * Quản lý giao diện và vòng đời 11 Game module trong khu vực Huấn luyện Thị giác:
 * - M1: Hứng hạt (CatchGame)
 * - M2: Khớp khung (ShapeAlignmentGame)
 * - M3: Vận nhãn (VergenceTrackerGame)
 * - M4: Vận nhãn nhanh (SaccadicTrackingGame)
 * - M5: Huấn luyện Thị giác nổi (RDSTherapyGame)
 * - M6: Huấn luyện Phân kỳ (DivergenceTherapyGame)
 * - M7: Kích thích Lưới quay CAM (CamVisualStimulatorGame)
 * - M8: Khử hiện tượng chen chúc (AntiCrowdingGame)
 * - M9: Kích thích tế bào nón hoàng điểm (RedConeStimulatorGame)
 * - M10: Kích thích phản xạ OKN (OKNStimulationGame)
 * - M11: Học tri giác Gabor (GaborPerceptualLearningGame)
 * - M12: Bám đuôi phân thị (DichopticPursuitGame)
 */

class TherapeuticMenuController {
    constructor() {
        this.currentGame = null;
        this.workspaceContainer = null;
        this.menuContainer = null;

        // Ánh xạ mã hiệu y khoa Mx -> id module game
        this._moduleIdByM = {
            M1: 'catch', M2: 'align', M3: 'vergence', M4: 'saccadic',
            M5: 'rds_therapy', M6: 'divergence', M7: 'cam-stim', M8: 'anti-crowding',
            M9: 'red-cone', M10: 'okn-stim', M11: 'gabor-pl', M12: 'dichoptic-pursuit',
            M13: 'convergence'
        };

        this.gameModules = [
            {
                id: 'catch',
                name: 'M1: Hứng hạt',
                icon: '🍎',
                classRef: CatchGame,
                stage: 'Giai đoạn 2 · Phá vỡ ức chế hợp thị cảm giác (Phân thị Anaglyph)',
                parentTranslation: 'Dạy não bộ không được "bỏ rơi" mắt yếu. Game sẽ làm mờ hình ở mắt khỏe và làm rõ hình ở mắt yếu để bắt 2 mắt phải làm việc đều nhau.',
                medicalPurpose: 'Phá vỡ ức chế, khôi phục hợp thị thô.',
                indication: 'Trẻ đã nhìn khá hơn (> 2/10) nhưng khi mở cả 2 mắt vẫn hay nheo một mắt.',
                contraindication: 'Đeo ngược kính (Bắt buộc: Phải Đỏ - Trái Xanh).',
                gameplay: 'Di chuyển thanh ngang để hứng hạt rơi. Hứng trúng +1, trượt -1.',
                goal: 'Hoàn thành Level hiện tại với tỷ lệ hứng trúng ≥ 80% để mở khóa Level kế tiếp.',
                settings: [
                    {
                        id: 'catch-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m1-max-level',
                        help: 'Level càng cao: hạt rơi nhanh hơn, thanh hứng hẹp hơn, hạt nhỏ hơn. Mỗi phiên kết thúc khi đủ 30 điểm.'
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'align',
                name: 'M2: Khớp khung',
                icon: '🧩',
                classRef: ShapeAlignmentGame,
                stage: 'Giai đoạn 2 · Phá vỡ ức chế hợp thị cảm giác (Phân thị Anaglyph)',
                parentTranslation: 'Rèn luyện sự tỉ mỉ. Ép mắt yếu phải khóa chặt mục tiêu trong khi mắt khỏe chỉ nhìn thấy khung nền.',
                medicalPurpose: 'Định thị trung tâm trong điều kiện 2 mắt.',
                indication: 'Thị lực >= 2/10, hết định thị lệch tâm.',
                contraindication: 'Không có.',
                gameplay: 'Dùng chuột kéo khối màu đặc thả lọt khít vào khung rỗng và giữ yên đủ Hold Time để khớp khung.',
                goal: 'Khớp khung 5 lần LIÊN TIẾP (không trượt giữa chừng khi đang đếm giữ) để qua màn và mở khóa Level kế tiếp.',
                settings: [
                    {
                        id: 'align-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m2-max-level',
                        help: 'Level càng cao: khung & khối nhỏ hơn, thời gian giữ yên lâu hơn, nền nhiễu động nhiều hơn.'
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'vergence',
                name: 'M3: Vận nhãn',
                icon: '🔀',
                classRef: VergenceTrackerGame,
                stage: 'Giai đoạn 3 · Hợp thị Vận động & Theo vết (Motor Oculomotor)',
                parentTranslation: 'Giống như tập tạ, bài tập này giúp hai mắt có lực để kéo chụm vào nhau khi đọc sách, nhìn gần, chống mỏi mắt.',
                medicalPurpose: 'Đo lường và tăng cường dự trữ hợp thị Hội tụ (PFV) và Phân kỳ (NFV).',
                indication: 'Lác ngoài (Exotropia) ẩn, mỏi mắt khi học bài, lờ đờ.',
                contraindication: 'Đang bị liệt cơ vận nhãn.',
                gameplay: 'Nhìn tập trung để 2 khối màu chập thành 1. Khi 2 khối bị tách làm đôi (vỡ hình), bấm ngay phím SPACE.',
                goal: 'Đạt mức dự trữ Hội tụ (Base-Out) ≥ 15 Δ và Phân kỳ (Base-In) ≥ 8 Δ.',
                settings: [
                    {
                        id: 'vergence-start', key: 'startDiopter', label: 'Mức lăng kính xuất phát (Δ)', numeric: true,
                        options: [
                            { value: '2', label: '2 Δ', selected: true },
                            { value: '4', label: '4 Δ', selected: false },
                            { value: '6', label: '6 Δ', selected: false },
                            { value: '8', label: '8 Δ', selected: false }
                        ]
                    },
                    {
                        id: 'vergence-target', key: 'targetDiopter', label: 'Mức lăng kính mục tiêu (Δ)', numeric: true,
                        options: [
                            { value: '8', label: '8 Δ', selected: true },
                            { value: '10', label: '10 Δ', selected: false },
                            { value: '12', label: '12 Δ', selected: false },
                            { value: '15', label: '15 Δ', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'saccadic',
                name: 'M4: Vận nhãn nhanh (Saccadic)',
                icon: '⚡',
                classRef: SaccadicTrackingGame,
                stage: 'Giai đoạn 4 · Thị giác 3D & Phản xạ Cấp cao',
                parentTranslation: 'Tăng tốc độ truyền tín hiệu từ mắt lên não. Trẻ sẽ phản xạ nhanh hơn trong học tập và chơi thể thao.',
                medicalPurpose: 'Tăng tốc độ đưa ảnh từ võng mạc ngoại vi vào hố hoàng điểm (Saccadic).',
                indication: 'Thị lực hai mắt đều, cần giảm độ trễ phản xạ.',
                contraindication: 'Không có.',
                gameplay: 'Mục tiêu xuất hiện ngẫu nhiên, click chuột vào mục tiêu càng nhanh càng tốt.',
                goal: 'Vượt Tiêu chí qua màn động theo Chặng: L1-3 cần chính xác > 90%; L4-6 thêm phản xạ ≤ 1500ms; L7-9 ≤ 1000ms; L10 tốt nghiệp với > 90% và ≤ 600ms (cảm ứng)/800ms (chuột).',
                settings: [
                    {
                        id: 'saccadic-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m4-max-level',
                        help: 'Bảng độ khó 10 mức: Kích thước 150px→30px | Biên độ: Gần → Nửa màn → Toàn màn → Vắt chéo | Thời gian chờ: Vô hạn (L1-3) → 800ms (L10). Vượt tiêu chí Chặng để mở khóa.'
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'rds_therapy',
                name: 'M5: Huấn luyện Thị giác nổi (RDS)',
                icon: '🧊',
                classRef: RDSTherapyGame,
                stage: 'Giai đoạn 4 · Thị giác 3D & Phản xạ Cấp cao',
                parentTranslation: 'Đánh thức khả năng nhìn không gian 3 chiều. Qua lớp kính Đỏ-Xanh, não bộ sẽ ghép các đốm nhiễu thành một hình khối nổi bồng bềnh lên khỏi màn hình.',
                medicalPurpose: 'Tinh chỉnh thị giác nổi toàn cục (Global Stereopsis).',
                indication: 'Giai đoạn cuối cùng. Yêu cầu hai mắt đã khá đều nhau.',
                contraindication: 'Không dùng nếu chưa có hợp thị.',
                gameplay: 'Tìm khối vuông đang "nổi" lên khỏi nền nhiễu và click vào nó.',
                goal: 'Đạt ngưỡng thị giác nổi 40 Giây cung (Arcsec). Trẻ thực sự khỏi nhược thị hoàn toàn.',
                settings: [
                    {
                        id: 'rds-time', key: 'searchTimeMs', label: 'Thời gian tìm kiếm tối đa', numeric: true,
                        options: [
                            { value: '300000', label: '300 giây', selected: true }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'divergence',
                name: 'M6: Huấn luyện Phân kỳ (Divergence)',
                icon: '↔️',
                classRef: DivergenceTherapyGame,
                stage: 'Module Chuyên biệt (Tùy chọn)',
                parentTranslation: 'Giúp hai mắt biết cách nhả cơ, giãn lỏng ra khi nhìn xa. Chữa tật hay bị lác chéo vào trong (lé kim).',
                medicalPurpose: 'Tăng biên độ phân kỳ (Base In).',
                indication: 'Lác trong ẩn.',
                contraindication: 'Đang bị liệt cơ vận nhãn.',
                gameplay: 'Tập trung giữ 2 khối màu chập 1 khi chúng tách xa nhau.',
                goal: 'Chịu đựng được mức phân kỳ 8 Đi-ốp (Δ) trong 5 chu kỳ.',
                settings: [
                    {
                        id: 'divergence-start', key: 'startDiopter', label: 'Mức lăng kính xuất phát (Δ)', numeric: true,
                        options: [
                            { value: '2', label: '2 Δ', selected: true },
                            { value: '4', label: '4 Δ', selected: false },
                            { value: '6', label: '6 Δ', selected: false },
                            { value: '8', label: '8 Δ', selected: false }
                        ]
                    },
                    {
                        id: 'divergence-target', key: 'targetDiopter', label: 'Mức lăng kính mục tiêu (Δ)', numeric: true,
                        options: [
                            { value: '8', label: '8 Δ', selected: true },
                            { value: '10', label: '10 Δ', selected: false },
                            { value: '12', label: '12 Δ', selected: false },
                            { value: '15', label: '15 Δ', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'convergence',
                name: 'M13: Mở rộng Hội tụ (Convergence)',
                icon: '👉👈',
                classRef: ConvergenceTherapyGame,
                stage: 'Module Chuyên biệt (Tùy chọn)',
                parentTranslation: 'Giúp hai mắt tăng lực hội tụ — như tập tạ cho cơ hội tụ, giúp kéo chụm hai mắt vào nhau khi nhìn gần, chống mỏi mắt khi đọc sách.',
                medicalPurpose: 'Đo lường và tăng cường dự trữ hợp thị Hội tụ (PFV - Positive Fusional Vergence).',
                indication: 'Suy giảm dự trữ hội tụ, mỏi mắt khi học bài, nhìn gần.',
                contraindication: 'Đang bị liệt cơ vận nhãn.',
                gameplay: 'Tập trung giữ 2 khối màu chập 1 khi chúng tách xa nhau.',
                goal: 'Đạt mức dự trữ hợp thị Hội tụ 15 Δ.',
                settings: [
                    {
                        id: 'convergence-start', key: 'startDiopter', label: 'Mức lăng kính xuất phát (Δ)', numeric: true,
                        options: [
                            { value: '3', label: '3 Δ', selected: true },
                            { value: '6', label: '6 Δ', selected: false },
                            { value: '9', label: '9 Δ', selected: false },
                            { value: '12', label: '12 Δ', selected: false },
                            { value: '15', label: '15 Δ', selected: false },
                            { value: '18', label: '18 Δ', selected: false },
                            { value: '21', label: '21 Δ', selected: false },
                            { value: '24', label: '24 Δ', selected: false },
                            { value: '27', label: '27 Δ', selected: false },
                            { value: '30', label: '30 Δ', selected: false }
                        ]
                    },
                    {
                        id: 'convergence-target', key: 'targetDiopter', label: 'Mức lăng kính mục tiêu (Δ)', numeric: true,
                        options: [
                            { value: '3', label: '3 Δ', selected: false },
                            { value: '6', label: '6 Δ', selected: false },
                            { value: '9', label: '9 Δ', selected: false },
                            { value: '12', label: '12 Δ', selected: false },
                            { value: '15', label: '15 Δ', selected: true },
                            { value: '18', label: '18 Δ', selected: false },
                            { value: '21', label: '21 Δ', selected: false },
                            { value: '24', label: '24 Δ', selected: false },
                            { value: '27', label: '27 Δ', selected: false },
                            { value: '30', label: '30 Δ', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'cam-stim',
                name: 'M7: Kích thích Lưới quay CAM',
                icon: '🌀',
                classRef: CamVisualStimulatorGame,
                stage: 'Giai đoạn 1 · Đánh thức Hoàng điểm (Đơn thị)',
                parentTranslation: 'Đánh thức vùng trung tâm của mắt nhược thị, giúp mắt học cách tập trung vào một điểm duy nhất thay vì nhìn lệch.',
                medicalPurpose: 'Kích hoạt cưỡng bức tế bào vỏ não thị giác (V1) nhạy cảm hướng. Ép dồn chú ý tâm điểm để phá vỡ hiện tượng định thị ngoại tâm.',
                indication: 'Mắt nhược thị rất nặng (Thị lực < 2/10). Trẻ hay nhìn nghiêng đầu, liếc mắt.',
                contraindication: 'TUYỆT ĐỐI KHÔNG dùng nếu trẻ có tiền sử động kinh, co giật khi nhìn ánh sáng nhấp nháy.',
                gameplay: 'Bịt mắt sáng, chỉ dùng mắt mờ nhìn thẳng vào chấm tròn giữa vòng xoáy. Khi chấm tròn đổi màu, bấm SPACE ngay lập tức.',
                goal: 'Đạt độ chính xác > 85%. Chơi 1-2 lần/ngày.',
                settings: [
                    {
                        id: 'cam-stim-stripe', key: 'stripeWidth', label: 'Kích thước sọc (SF)', numeric: true,
                        options: [
                            { value: '80', label: 'Sọc to (Low SF)', selected: false },
                            { value: '40', label: 'Sọc vừa (Medium SF)', selected: true },
                            { value: '20', label: 'Sọc nhỏ (High SF)', selected: false }
                        ]
                    },
                    {
                        id: 'cam-stim-speed', key: 'rotationSpeed', label: 'Tốc độ xoay (vòng/phút)', numeric: true,
                        options: [
                            { value: '1.5', label: 'Chậm (1.5 vòng/phút)', selected: false },
                            { value: '2', label: 'Chuẩn lâm sàng (2 vòng/phút)', selected: true },
                            { value: '2.5', label: 'Nhanh (2.5 vòng/phút)', selected: false }
                        ]
                    },
                    {
                        id: 'cam-stim-duration', key: 'durationMs', label: 'Thời gian', numeric: true,
                        options: [
                            { value: '120000', label: '120 giây', selected: false },
                            { value: '180000', label: '180 giây', selected: false },
                            { value: '300000', label: '300 giây (mặc định)', selected: true },
                            { value: '600000', label: '600 giây', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ (BỊT MẮT LÀNH). Tuyệt đối không sử dụng kính Đỏ-Lục Lam (Anaglyph).'
            },
            {
                id: 'anti-crowding',
                name: 'M8: Khử hiện tượng chen chúc (Anti-Crowding)',
                icon: '🔠',
                classRef: AntiCrowdingGame,
                stage: 'Giai đoạn 1 · Đánh thức Hoàng điểm (Đơn thị)',
                parentTranslation: 'Giúp mắt trẻ hết bị "loạn", không còn hiện tượng các chữ cái dính chùm vào nhau khi đọc sách.',
                medicalPurpose: 'Phá vỡ hiệu ứng tương tác viền (Contour Interaction / Crowding Effect). Huấn luyện vỏ não khả năng bóc tách tín hiệu.',
                indication: 'Mắt nhược thị nhìn từng chữ thì rõ, nhưng nhìn cả hàng chữ thì mờ.',
                contraindication: 'Trẻ chưa biết phân biệt các hướng Lên/Xuống/Trái/Phải.',
                gameplay: 'Bịt mắt sáng. Chỉ tập trung vào chữ E ở chính giữa (bỏ qua 4 chữ E xung quanh). Bấm phím mũi tên theo hướng hở của chữ E giữa. Trả lời đúng, các chữ xung quanh sẽ ép sát vào để thử thách thêm.',
                goal: 'Chịu đựng được khoảng cách ép sát ở mức 1.2x.',
                settings: [
                    {
                        id: 'anti-crowding-target-size', key: 'targetSize', label: 'Kích thước vật tiêu', numeric: false,
                        options: [
                            { value: 'Lớn', label: 'Lớn', selected: false },
                            { value: 'Vừa', label: 'Vừa', selected: true },
                            { value: 'Nhỏ', label: 'Nhỏ', selected: false }
                        ]
                    },
                    {
                        id: 'anti-crowding-display-time', key: 'displayTime', label: 'Thời gian hiển thị', numeric: false,
                        options: [
                            { value: 'unlimited', label: 'Không giới hạn', selected: true },
                            { value: '2000', label: '2 giây', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ (BỊT MẮT LÀNH). Tuyệt đối không sử dụng kính Đỏ-Lục Lam (Anaglyph).'
            },
            {
                id: 'red-cone',
                name: 'M9: Kích thích tế bào nón hoàng điểm (RED-Cone)',
                icon: '🔴',
                classRef: RedConeStimulatorGame,
                stage: 'Giai đoạn 1 · Đánh thức Hoàng điểm (Đơn thị)',
                parentTranslation: 'Kích thích vùng hoàng điểm bằng ánh sáng đỏ, ép mắt yếu phải làm việc trong bóng tối.',
                medicalPurpose: 'Sử dụng phương pháp Brinker-Katz. Vô hiệu hóa tế bào que chu biên bằng ánh sáng đỏ thuần, ép kích hoạt tế bào nón hoàng điểm.',
                indication: 'Nhược thị sâu (Thị lực < 2/10), định thị ngoại tâm dai dẳng.',
                contraindication: 'KHÔNG DÙNG cho bệnh nhân động kinh ánh sáng.',
                gameplay: 'Tắt đèn phòng. Bịt mắt sáng. Tìm và chỉ hướng chữ E màu đỏ trên nền đen.',
                goal: 'Đạt Chính xác > 85% VÀ phản xạ < 1200ms tại Level hiện tại để mở khóa Level kế tiếp.',
                settings: [
                    {
                        id: 'redcone-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m9-max-level',
                        help: 'Level càng cao: chữ E nhỏ hơn, thời gian hiển thị ngắn hơn (Vô hạn → 0.8s chớp). 40 lượt/phiên. Vượt tiêu chí để mở khóa.'
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ. Hãy TẮT ĐÈN phòng tập.'
            },
            {
                id: 'okn-stim',
                name: 'M10: Kích thích phản xạ OKN (Optokinetic)',
                icon: '🚆',
                classRef: OKNStimulationGame,
                stage: 'Giai đoạn 1 · Đánh thức Hoàng điểm (Đơn thị)',
                parentTranslation: 'Khi mắt nhược thị nhìn theo các sọc đen trắng chuyển động, não sẽ bật phản xạ rung giật nhãn cầu (OKN), giúp kéo điểm nhìn về đúng trung tâm võng mạc.',
                medicalPurpose: 'Kích thích phản xạ rung giật nhãn cầu (Optokinetic Nystagmus) để phá vỡ định thị ngoại tâm, rèn lại định thị trung tâm.',
                indication: 'Định thị ngoại tâm dai dẳng, nhược thị sâu cần tái lập hoàng điểm.',
                contraindication: 'TUYỆT ĐỐI KHÔNG dùng cho bệnh nhân động kinh ánh sáng (sọc chuyển động có thể kích phát cơn).',
                gameplay: 'Bịt mắt sáng. Nhìn theo sọc chuyển động, dùng chuột/ngón tay chạm vào đốm đỏ sáng xuất hiện ngẫu nhiên. Chạm trúng -> tiếng "Ting".',
                goal: 'Đạt độ chính xác ≥ 80% tại Level hiện tại để mở khóa Level kế tiếp (phản xạ < 1.5s).',
                settings: [
                    {
                        id: 'okn-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m10-max-level',
                        help: 'Level càng cao: sọc nhỏ hơn, trôi nhanh hơn, đốm đỏ biến mất nhanh hơn. Mỗi phiên 30 đốm. Hoàn thành ≥ 80% để mở khóa Level tiếp theo.'
                    },
                    {
                        id: 'okn-direction', key: 'direction', label: 'Hướng trôi sọc', numeric: false,
                        options: [
                            { value: 'LTR', label: 'Trái → Phải', selected: true },
                            { value: 'RTL', label: 'Phải → Trái', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ (BỊT MẮT LÀNH). Chống chỉ định: Động kinh ánh sáng.'
            },
            {
                id: 'gabor-pl',
                name: 'M11: Học tri giác Gabor (Perceptual Learning)',
                icon: '🦓',
                classRef: GaborPerceptualLearningGame,
                stage: 'Giai đoạn 1 · Đánh thức Hoàng điểm (Đơn thị)',
                parentTranslation: 'Giống như tập tạ cho não, bài tập này dùng các vằn sáng tối (Gabor) để ép tế bào V1 của mắt yếu nhạy hơn với độ tương phản, giúp trẻ nhìn rõ vật mờ.',
                medicalPurpose: 'Kích thích trực tiếp tế bào V1 bằng mảng Gabor, tăng cường độ nhạy tương phản (Neuroplasticity) qua thuật toán Cầu thang 3-Down/1-Up.',
                indication: 'Nhược thị đã ổn định định thị, giảm độ nhạy tương phản (Contrast Sensitivity).',
                contraindication: 'Chưa bịt mắt lành (Bắt buộc đơn nhãn).',
                gameplay: 'Bịt mắt sáng. Nhìn dấu (+) ở giữa. Khi vằn Gabor loé lên, hãy quan sát các đường sọc chéo chạy từ trên xuống dưới: nếu sọc rẽ sang Trái thì bấm mũi tên Trái, nếu rẽ sang Phải thì bấm mũi tên Phải.',
                goal: 'Xác định ngưỡng tương phản (Contrast Threshold) đạt mức thấp (< 10%).',
                settings: [
                    {
                        id: 'gabor-flash-duration', key: 'flashDuration', label: 'Thời gian flash', numeric: false,
                        options: [
                            { value: '200', label: '200 ms - Khó hơn', selected: true },
                            { value: '500', label: '500 ms - Dễ hơn', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ (BỊT MẮT LÀNH).'
            },
            {
                id: 'dichoptic-pursuit',
                name: 'M12: Bám đuôi phân thị (Smooth Pursuit)',
                icon: '🎢',
                classRef: DichopticPursuitGame,
                stage: 'Giai đoạn 3 · Hợp thị Vận động & Theo vết (Motor Oculomotor)',
                parentTranslation: 'Rèn cho hai mắt biết "bám đuôi" một vật mượt mà không nhảy hình. Qua kính Đỏ-Lục Lam, não buộc phải dung hợp hai ảnh thành một đường ray sáng để Tàu luôn đi đúng vệt.',
                medicalPurpose: 'Rèn luyện cử động nhãn cầu theo vết (Smooth Pursuit) kết hợp triệt tiêu ức chế vỏ não qua môi trường phân thị.',
                indication: 'Hợp thị đã ổn định, cần tăng chất lượng vận nhãn theo vết (theo dõi vật động).',
                contraindication: 'Động kinh ánh sáng (do đường ray nhấp nháy qua kính).',
                gameplay: 'Di chuyển chuột / vuốt để lái Tàu Lục Lam bám sát đường ray Đỏ trôi dọc màn hình. Giữ Tàu trong băng đường ray càng lâu càng tốt.',
                goal: 'Chính xác bám đuôi > 85% (tàu nằm an toàn trong đường ray trên 85% thời lượng) để mở khóa Level kế tiếp.',
                settings: [
                    {
                        id: 'pursuit-level', key: 'level', label: 'Cấp độ', type: 'levels',
                        min: 1, max: 10,
                        storageKey: 'vision-therapy-m12-max-level',
                        help: 'Đường ray Rộng→Rất hẹp | Tốc độ Chậm→Siêu nhanh | Thoải→Chữ S→Zic-zac từ Level 7. Mỗi phiên 180 giây. Vượt > 85% để mở khóa Level tiếp theo.'
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: ĐEO KÍNH ĐỎ (MẮT PHẢI) - LỤC LAM (MẮT TRÁI) TRONG SUỐT QUÁ TRÌNH TẬP.'
            }
        ];

        // Bind fullscreen exit handler
        this._handleFullscreenExit = this._handleFullscreenExit.bind(this);
    }

    init() {
        this.menuContainer = document.getElementById('menu-therapeutic');
        this.workspaceContainer = document.getElementById('workspace-therapeutic');

        if (!this.menuContainer || !this.workspaceContainer) {
            return;
        }

        this.renderSidebar();

        // Listen for fullscreen exit to auto-cleanup game
        document.addEventListener('fullscreenchange', this._handleFullscreenExit);
    }

    /**
     * Handle fullscreen exit event: stop game, cleanup DOM, restore SPA UI
     * [SỬA LỖI TRẮNG MÀN HÌNH] Sau khi dọn dẹp, lập tức vẽ lại Sảnh game
     * (Lobby) vào vùng hiển thị chính — không để lại vùng trắng trơn.
     */
    _handleFullscreenExit() {
        if (!document.fullscreenElement) {
            this.stopCurrentGame();
            this.workspaceContainer.style = '';
            this.workspaceContainer.innerHTML = '';
            this._restoreTherapeuticLobby();
        }
    }

    /**
     * [SỬA LỖI TRẮNG MÀN HÌNH] Khôi phục Sảnh game (Lobby) vào vùng hiển thị
     * chính (#therapeutic-content bên trong #workspace-therapeutic).
     * - Dọn dẹp canvas / nút thoát còn sót (nếu có)
     * - Tái tạo #therapeutic-content (game đã xóa bằng innerHTML='')
     * - Gọi window.renderTherapeuticLobby() để vẽ lại danh sách game
     * Idempotent: gọi nhiều lần (fullscreenchange + closeTherapyModule)
     * không gây lỗi — nội dung chỉ được thay thế toàn bộ.
     */
    _restoreTherapeuticLobby() {
        const ws = this.workspaceContainer || document.getElementById('workspace-therapeutic');
        if (!ws) return;

        // Chỉ vẽ lại khi workspace Huấn luyện đang thực sự hiển thị
        // (tránh render vào vùng đang ẩn khi đang ở workspace Khám)
        try {
            if (ws.offsetParent === null && getComputedStyle(ws).display === 'none') return;
        } catch (e) { /* tiếp tục render — phòng hờ */ }

        // 1. Dọn canvas / nút thoát còn sót
        ws.querySelectorAll('canvas, button[aria-label="Thoát bài tập"]').forEach((el) => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });

        // 2. Đảm bảo #therapeutic-content tồn tại
        let content = document.getElementById('therapeutic-content');
        if (!content) {
            content = document.createElement('div');
            content.id = 'therapeutic-content';
            ws.appendChild(content);
        } else {
            content.innerHTML = '';
        }
        content.style.cssText = 'width: 100%; height: 100%; overflow-y: auto;';

        // 3. Vẽ lại danh sách menu game (Sảnh Lobby)
        if (typeof window.renderTherapeuticLobby === 'function') {
            window.renderTherapeuticLobby(content);
        }
    }

    renderSidebar() {
        // Giao diện Sảnh (Lobby) được render động theo Phác đồ điều trị
        // (Phác đồ Nhược thị / Phác đồ Hậu phẫu Lác) bằng CSS Grid.
        window.renderTherapeuticLobby(this.menuContainer);
    }

    /**
     * Render giao diện Sảnh (Lobby) dạng lưới Grid, phân luồng theo Phác đồ.
     * Mỗi hàng (Row) = 1 giai đoạn: cột trái là thẻ Giai đoạn (220px),
     * tối đa 5 module phía sau => tổng cộng tối đa 6 ô trên một hàng ngang.
     * @param {HTMLElement} container - Phần tử chứa (menu-therapeutic)
     */
    // ============================================================
    // PHÁC ĐỒ ĐIỀU TRỊ (Source of Truth) — ánh xạ Mx -> module id
    // ============================================================
    _getModuleByMId(mId) {
        const moduleId = this._moduleIdByM[mId];
        return this.gameModules.find(m => m.id === moduleId) || null;
    }

    stopCurrentGame() {
        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
        }
    }

    /**
     * Launch game with Lobby (Instruction) screen before entering fullscreen
     * @param {Object} module - Game module object with metadata
     */
    launchGame(module) {
        // A. Stop any running game and clean workspace
        this.stopCurrentGame();

        // Đảm bảo workspace container đã sẵn sàng (auto-mount có thể chưa chạy init)
        if (!this.workspaceContainer) {
            this.workspaceContainer = document.getElementById('workspace-therapeutic');
        }
        if (!this.workspaceContainer) {
            console.warn('[Therapeutic] Không tìm thấy workspace-therapeutic, hủy launch.');
            return;
        }

        this.workspaceContainer.innerHTML = '';

        // B. Render Lobby (Instruction) interface
        this._renderLobby(module);
    }

    /**
     * Sinh chuỗi HTML Form cài đặt ĐỘNG cho từng module game.
     * @param {Object} module - Game module (chứa mảng `settings`)
     * @returns {string} HTML của các thẻ <label> + <select>
     */
    renderSettingsForm(module) {
        if (!module.settings || module.settings.length === 0) {
            return '<p style="font-size:13px;color:#94a3b8;margin:0;">Không có cài đặt bổ sung.<br>Nhấn <b>BẮT ĐẦU TẬP</b> để vào bài tập.</p>';
        }

        let html = '';
        for (const setting of module.settings) {
            // === BỘ CHỌN CẤP ĐỘ (Level Picker) — thay thế dropdown rời rạc ===
            if (setting.type === 'levels') {
                const min = setting.min || 1;
                const max = setting.max || 10;
                const stored = parseInt(localStorage.getItem(setting.storageKey || '') || '', 10);
                const maxUnlocked = !isNaN(stored) ? Math.max(min, Math.min(max, stored)) : min;
                // Ưu tiên Level đang được chọn trước đó trong phiên, mặc định = Level cao nhất đã mở khóa
                const current = Math.max(min, Math.min(max, maxUnlocked));

                let levelBtns = '';
                for (let lv = min; lv <= max; lv++) {
                    const locked = lv > maxUnlocked;
                    levelBtns += `
                        <button type="button" class="pursuit-level-btn" data-level="${lv}"
                            style="flex:1;min-width:44px;padding:10px 0;border-radius:8px;font-size:15px;font-weight:bold;cursor:${locked ? 'not-allowed' : 'pointer'};border:1px solid ${lv === current ? '#3b82f6' : '#475569'};background:${lv === current ? '#3b82f6' : '#0f172a'};color:${locked ? '#475569' : (lv === current ? '#fff' : '#e2e8f0')};${locked ? 'opacity:0.4;' : ''}"
                            ${locked ? 'disabled' : ''}>${lv}</button>`;
                }

                html += `
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px;" for="${setting.id}">${setting.label} (1 = Dễ nhất, ${max} = Khó nhất):</label>
                        <div id="${setting.id}-wrap" style="display:flex;gap:6px;align-items:stretch;">
                            ${levelBtns}
                        </div>
                        <input type="hidden" id="${setting.id}" value="${current}">
                        <p style="font-size:12px;color:#64748b;margin:6px 0 0 0;">${setting.help || ''}</p>
                    </div>
                `;
                continue;
            }

            const optionsHtml = setting.options.map(o =>
                `<option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>`
            ).join('');

            html += `
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px;" for="${setting.id}">${setting.label}:</label>
                    <select id="${setting.id}" style="width:100%;padding:8px;border-radius:6px;background:#0f172a;color:white;border:1px solid #475569;font-size:15px;">
                        ${optionsHtml}
                    </select>
                </div>
            `;
        }
        return html;
    }

    /**
     * Ánh xạ ID module -> đường dẫn tài liệu y khoa tương ứng trong /docs.
     * Mapping linh hoạt: mỗi module tự động trỏ tới file HTML cùng tên.
     * @param {string} moduleId - ID của module (vd: 'gabor-pl')
     * @returns {string} href tuyệt đối tới trang tài liệu (vd: '/docs/m11_gabor.html')
     */
    _docHrefFor(moduleId) {
        const docMap = {
            'catch':             '/docs/m01_catch.html',
            'align':             '/docs/m02_align.html',
            'vergence':          '/docs/m03_vergence.html',
            'saccadic':          '/docs/m04_saccadic.html',
            'rds_therapy':       '/docs/m05_rds.html',
            'divergence':        '/docs/m06_divergence.html',
            'cam-stim':          '/docs/m07_cam.html',
            'anti-crowding':     '/docs/m08_anticrowding.html',
            'red-cone':          '/docs/m09_redcone.html',
            'okn-stim':          '/docs/m10_okn.html',
            'gabor-pl':          '/docs/m11_gabor.html',
            'dichoptic-pursuit': '/docs/m12_pursuit.html'
        };
        return docMap[moduleId] || '/docs/index.html';
    }

    /**
     * Render the Lobby/Instruction screen for a game
     * @param {Object} module - Game module with metadata
     */
    _renderLobby(module) {
        // ============================================================
        // NỘI SUY DỮ LIỆU CHUẨN HÓA VÀO SPLIT-PANE RENDER
        // ============================================================
        const game = {
            title: module.name,
            stage: module.stage || '',
            parentTranslation: module.parentTranslation || '',
            medicalPurpose: module.medicalPurpose || '',
            indication: module.indication || '',
            contraindication: module.contraindication || '',
            gameplay: module.gameplay || '',
            goal: module.goal || '',
            mandatory_warning_html: module.mandatoryWarning || '⚠️ CẢNH BÁO: Tuân thủ quy định an toàn trước khi chơi.'
        };

        const distM = parseFloat(localStorage.getItem('vision-therapy-calibrate-distance-m')) || 0.5;
        const distCm = Math.round(distM * 100);

        // Liên kết tài liệu y khoa: mapping linh hoạt href theo ID module
        const docHref = this._docHrefFor(module.id);

        const lobbyHtml = `
            <div style="position: fixed; inset: 0; z-index: 9998; background: rgba(15, 23, 42, 0.97); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; font-family: sans-serif;">

                <!-- NÚT TẮT (ĐÓNG) LOBBY: cố định góc màn hình, ngoài Split-Pane -->
                <button id="btn-close-lobby" title="Nhấn ESC để thoát" style="position: fixed; top: 24px; right: 24px; width: 44px; height: 44px; font-size: 20px; background: rgba(255,255,255,0.1); border: none; color: #cbd5e1; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; z-index: 9999;">
                    ✖
                </button>

                <!-- BANNER KHOẢNG CÁCH BẮT BUỘC -->
                <div style="width: 100%; max-width: 1200px; margin-bottom: 14px; padding: 10px 14px; background: #fee2e2; border-left: 4px solid #ef4444; color: #991b1b; font-weight: bold; font-size: 14px; border-radius: 6px;">
                    ⚠️ YÊU CẦU BẮT BUỘC: Bệnh nhân ngồi cách màn hình chính xác ${distCm} cm.
                </div>

                <!-- SPLIT-PANE CONTAINER -->
                <div style="position: relative; display: flex; gap: 24px; width: 90%; max-width: 1200px; min-height: 70vh; background: #0f172a; padding: 32px; border-radius: 12px; border: 1px solid #1e293b; color: #cbd5e1; text-align: left;">

                    <!-- CỘT TRÁI (60%): THÔNG TIN LÂM SÀNG (SCROLLABLE) -->
                    <div style="flex: 6; overflow-y: auto; padding-right: 15px; border-right: 1px solid #1e293b;">
                        <h2 style="color: #38bdf8; margin-top: 0; font-size: 22px; border-bottom: 1px solid #1e293b; padding-bottom: 10px;">${game.title}<a href="${docHref}" target="_blank" title="Xem tài liệu y khoa (mở trang mới)" style="text-decoration:none; margin-left:10px;">ℹ️</a></h2>

                        <p style="font-size: 12px; color: #a78bfa; margin: 0 0 16px 0; font-weight: bold;">${game.stage}</p>

                        <div style="margin-bottom: 16px; background: rgba(167, 139, 250, 0.08); padding: 12px; border-radius: 6px; border: 1px solid #6d28d9;">
                            <h4 style="color: #c4b5fd; margin-top: 0; margin-bottom: 6px;">👪 DÀNH CHO PHỤ HUYNH:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0;">${game.parentTranslation}</p>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #10b981; margin-bottom: 4px;">🎯 MỤC ĐÍCH Y KHOA:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0;">${game.medicalPurpose}</p>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #3b82f6; margin-bottom: 4px;">👥 CHỈ ĐỊNH:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0;">${game.indication}</p>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #ef4444; margin-bottom: 4px;">🚫 CHỐNG CHỈ ĐỊNH:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0; color: #fca5a5;">${game.contraindication}</p>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <h4 style="color: #f59e0b; margin-bottom: 4px;">🎮 CÁCH CHƠI:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0;">${game.gameplay}</p>
                        </div>

                        <div style="margin-bottom: 16px; background: rgba(56, 189, 248, 0.05); padding: 12px; border-radius: 6px; border: 1px solid #0369a1;">
                            <h4 style="color: #e2e8f0; margin-top: 0; margin-bottom: 6px;">🏆 MỤC TIÊU:</h4>
                            <p style="font-size: 13px; line-height: 1.5; margin: 0;">${game.goal}</p>
                        </div>
                    </div>

                    <!-- CỘT PHẢI (40%): ĐIỀU KHIỂN & HÀNH ĐỘNG (STICKY) -->
                    <div style="flex: 4; display: flex; flex-direction: column; gap: 16px; padding-left: 10px;">

                        <!-- FORM CÀI ĐẶT ĐỘNG (theo từng game) — Ẩn với M3 (không cần cấu hình) -->
                        ${module.id !== 'vergence' ? `
                        <div style="background: #1e293b; padding: 16px; border-radius: 8px;">
                            <h4 style="color: #38bdf8; margin: 0 0 10px 0; font-size: 14px;">⚙️ CÀI ĐẶT BÀI TẬP:</h4>
                            ${this.renderSettingsForm(module)}
                        </div>
                        ` : ''}

                        <!-- CẢNH BÁO Y KHOA ĐỘNG -->
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 12px; border-radius: 6px; text-align: center; margin-top: auto;">
                            <span style="color: #ef4444; font-weight: bold; font-size: 13px;">
                                ${game.mandatory_warning_html}
                            </span>
                        </div>

                        <!-- ACTION BUTTONS -->
                        <button id="btn-start-fullscreen" style="width: 100%; background: #3b82f6; color: white; padding: 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s;">
                            BẮT ĐẦU TẬP
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.workspaceContainer.innerHTML = lobbyHtml;

        // B.1 Handler đóng Lobby (hủy chọn game, quay về menu danh sách)
        this._handleLobbyKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this._closeLobby();
            }
        };

        const closeLobbyHandler = () => this._closeLobby();

        // Handler chọn Level: cập nhật nút active + ghi vào hidden input (hoạt động cho MỌI module có Level Picker)
        document.querySelectorAll('[id$="-level-wrap"]').forEach(levelWrap => {
            const settingId = levelWrap.id.replace('-wrap', '');
            levelWrap.addEventListener('click', (e) => {
                const btn = e.target.closest('.pursuit-level-btn');
                if (!btn || btn.disabled) return;
                const hidden = document.getElementById(settingId);
                if (!hidden) return;
                hidden.value = btn.dataset.level;
                levelWrap.querySelectorAll('.pursuit-level-btn').forEach(b => {
                    const active = b === btn;
                    b.style.background = active ? '#3b82f6' : '#0f172a';
                    b.style.borderColor = active ? '#3b82f6' : '#475569';
                    b.style.color = active ? '#fff' : (b.disabled ? '#475569' : '#e2e8f0');
                });
            });
        });

        // Attach close button handler
        const closeBtn = document.getElementById('btn-close-lobby');
        if (closeBtn) {
            closeBtn.onclick = closeLobbyHandler;
        }

        // Attach fullscreen + game start handler (đọc cấu hình động từ form)
        const startBtn = document.getElementById('btn-start-fullscreen');
        if (startBtn) {
            startBtn.onclick = () => {
                // B.2 Đọc giá trị từ các <select> được sinh động
                const config = {};
                if (module.settings) {
                    for (const setting of module.settings) {
                        const el = document.getElementById(setting.id);
                        if (el) {
                            config[setting.key] = setting.numeric ? Number(el.value) : el.value;
                        }
                    }
                }
                this._startFullscreenGame(module, config);
            };
        }

        // Bắt sự kiện ESC toàn cục khi Lobby đang mở
        document.addEventListener('keydown', this._handleLobbyKeydown);
    }

    /**
     * Đóng Lobby: xóa nội dung HTML vùng chứa và gỡ bỏ sự kiện ESC
     * để tránh vô tình kích hoạt khi đang chơi game (Memory Leak / false trigger).
     */
    _closeLobby() {
        // Gỡ bỏ sự kiện keydown ESC ngay khi đóng Lobby
        if (this._handleLobbyKeydown) {
            document.removeEventListener('keydown', this._handleLobbyKeydown);
            this._handleLobbyKeydown = null;
        }

        // Xóa nội dung Lobby, trả về trạng thái menu danh sách game
        this.workspaceContainer.innerHTML = '';
        this.stopCurrentGame();
    }

    /**
     * Enter fullscreen mode, apply CSS overrides, and start the game
     * @param {Object} module - Game module with classRef
     * @param {Object} config - Cấu hình đã được đọc từ form cài đặt động
     */
    _startFullscreenGame(module, config = {}) {
        // [LÍNH GÁC: BẢO VỆ CUSTOM LAUNCHERS M6/M13 & MỌI MODULE]
        if (!localStorage.getItem('currentPatientId')) {
            if (window.examSessionManager && typeof window.examSessionManager.showToast === 'function') {
                window.examSessionManager.showToast("Vui lòng 'Bắt đầu khám' (hoặc chọn Khám ẩn danh) trước khi tập.");
            }
            const startBtn = document.getElementById('start-exam-btn');
            if (startBtn) startBtn.click();
            return; // Chặn khởi chạy game
        }

        // Gỡ bỏ sự kiện keydown ESC khi bước vào game (tránh false trigger)
        if (this._handleLobbyKeydown) {
            document.removeEventListener('keydown', this._handleLobbyKeydown);
            this._handleLobbyKeydown = null;
        }

        // Request fullscreen on workspace container
        this.workspaceContainer.requestFullscreen().catch(err => {
            console.warn("[Therapeutic] Fullscreen request failed:", err);
        });

        // Force CSS for workspace: full viewport, white background, cover all UI
        this.workspaceContainer.style.cssText = 'width: 100vw; height: 100vh; background: #FFFFFF; position: fixed; inset: 0; z-index: 9999;';

        // Remove Lobby
        this.workspaceContainer.innerHTML = '';

        // [SỬA LỖI CỰ LY KHÁM] Chốt lại mốc Nhìn Gần NGAY TRƯỚC khi khởi tạo
        // game (new classRef()) — bảo hiểm cho mọi đường khởi chạy
        // (custom launcher M6/M13, deep-link, v.v.) chứ không chỉ startTherapyModule.
        if (window.__calibrator) {
            window.__calibrator.distanceM = window.__calibrator.distanceNearM || 0.4;
        }

        // Initialize and start game
        try {
            const GameClass = (typeof module.classRef === 'string') ? window[module.classRef] : module.classRef;
            this.currentGame = new GameClass();

            this.currentGame.start(config);
        } catch (error) {
            console.error("[LỖI ENGINE NGHIÊM TRỌNG]:", error);
            alert((error && error.message) ? error.message : "Không thể khởi động bài tập. Vui lòng xem Console.");
        }
    }
}

// ============================================================
// Auto-Mount (Active Polling for SPA Race Condition)
// ============================================================

// Khởi tạo instance global
window.therapeuticMenu = new TherapeuticMenuController();

// ============================================================
// SẢNH (LOBBY) DẠNG LƯỚI GRID — PHÂN LUỒNG THEO PHÁC ĐỒ ĐIỀU TRỊ
// ============================================================

/**
 * Kích hoạt module game theo mã hiệu y khoa (M1..M12).
 * Hàm global để inline onclick trong thẻ module-card gọi được.
 * @param {string} id - Mã hiệu module (vd: 'M7')
 */
window.startTherapyModule = function(id) {
    // [SỬA LỖI CỰ LY KHÁM] Ép buộc mốc Nhìn Gần trước khi khởi tạo game:
    // Phác đồ huấn luyện (M1-M13) diễn ra ở cự ly gần (đọc sách/thiết bị) nên
    // mọi tính toán Góc thị giác, kích thước px và Lăng kính (Δ) phải dựa trên
    // distanceNearM (VD 40cm) — không phải cự ly Nhìn Xa (VD 4m = 400cm).
    if (window.__calibrator) {
        window.__calibrator.distanceM = window.__calibrator.distanceNearM || 0.4;
    }

    const mod = window.therapeuticMenu ? window.therapeuticMenu._getModuleByMId(id) : null;
    if (mod) {
        window.therapeuticMenu.launchGame(mod);
    } else {
        console.warn('[Therapeutic] Không tìm thấy module:', id);
    }
};

/**
 * Render giao diện sảnh (Lobby) dạng lưới Grid, phân luồng theo Phác đồ:
 * - amblyopia: Phác đồ Nhược thị (4 giai đoạn)
 * - strabismus_postop: Phác đồ Hậu phẫu Lác (3 bước, KHÔNG bịt mắt)
 * Mỗi hàng = 1 giai đoạn: cột trái là thẻ Giai đoạn (220px) + tối đa
 * 5 module => tổng cộng tối đa 6 ô trên một hàng ngang.
 * @param {HTMLElement} container - Phần tử chứa (menu-therapeutic)
 */
window.renderTherapeuticLobby = function(container) {
    const protocol = localStorage.getItem("currentProtocol") || "amblyopia";

    // Phòng mọi đường gọi trực tiếp (init/renderSidebar): chỉ hiển thị menu
    // Huấn luyện, ẩn menu Khám để tránh chia đôi sidebar.
    const diagnosticMenu = document.getElementById('menu-diagnostic');
    if (diagnosticMenu) diagnosticMenu.style.display = 'none';

    // Định nghĩa cấu trúc động
    const config = {
        'amblyopia': {
            title: "Phác đồ Điều trị Nhược thị",
            rows: [
                { title: "Giai đoạn 1: Đánh thức Hoàng điểm (Đơn thị)", modules: [
                    { id: 'M7', name: 'Kích thích Lưới CAM', icon: '🌀' },
                    { id: 'M8', name: 'Khử chen chúc (Anti-Crowding)', icon: '🔠' },
                    { id: 'M9', name: 'Kích thích tế bào nón', icon: '🔴' },
                    { id: 'M10', name: 'Phản xạ OKN', icon: '🚆' },
                    { id: 'M11', name: 'Học tri giác Gabor', icon: '🦓' }
                ]},
                { title: "Giai đoạn 2: Chống ức chế", modules: [
                    { id: 'M1', name: 'Hứng hạt', icon: '🧺' },
                    { id: 'M2', name: 'Khớp khung', icon: '🧩' },
                    { id: 'M12', name: 'Bám đuôi động', icon: '🎯' }
                ]},
                { title: "Giai đoạn 3: Hợp thị Vận động", modules: [
                    { id: 'M3', name: 'Theo vết Vận nhãn', icon: '👁️' },
                    { id: 'M6', name: 'Mở rộng Phân kỳ', icon: '↔️' },
                    { id: 'M13', name: 'Mở rộng Hội tụ', icon: '👉👈' }
                ]},
                { title: "Giai đoạn 4: Thị giác nổi 3D", modules: [
                    { id: 'M4', name: 'Vận nhãn nhanh Saccadic', icon: '⚡' },
                    { id: 'M5', name: 'Thị giác nổi RDS', icon: '🧊' }
                ]}
            ]
        },
        'strabismus_postop': {
            title: "Phác đồ Hậu phẫu Lác (Post-op Vision Therapy)",
            rows: [
                { title: "Bước 1: Phá vỡ ức chế + Hợp thị cảm giác", modules: [
                    { id: 'M1', name: 'Hứng hạt', icon: '🧺' },
                    { id: 'M2', name: 'Khớp khung', icon: '🧩' },
                    { id: 'M12', name: 'Bám đuôi động', icon: '🎯' }
                ]},
                { title: "Bước 2: Hợp thị Vận động", modules: [
                    { id: 'M3', name: 'Theo vết Vận nhãn', icon: '👁️' },
                    { id: 'M6', name: 'Mở rộng Phân kỳ', icon: '↔️' },
                    { id: 'M13', name: 'Mở rộng Hội tụ', icon: '👉👈' }
                ]},
                { title: "Bước 3: Keo 3D (Củng cố hai mắt)", modules: [
                    { id: 'M4', name: 'Vận nhãn nhanh Saccadic', icon: '⚡' },
                    { id: 'M5', name: 'Thị giác nổi RDS', icon: '🧊' }
                ]}
            ]
        }
    };

    const currentSetup = config[protocol] || config['amblyopia'];
    const isCalibrated = window.__anaglyphColors && window.__anaglyphColors.red;

    // Khởi tạo HTML với CSS Grid nội tuyến
    let html = `<div style="padding: 20px; color: #fff;">
        <h2 style="color: #00e676; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">${currentSetup.title}</h2>
        <style>
            .grid-row { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px; align-items: stretch; }
            @media (min-width: 1024px) {
                /* Cột 1: Cố định 220px. Các cột sau: Chia đều, tối đa 5 module = tổng 6 cột */
                .grid-row { grid-template-columns: 220px repeat(auto-fit, minmax(130px, 1fr)); }
            }
            .stage-card { background: rgba(77,166,255,0.1); border-left: 4px solid #4da6ff; padding: 15px; border-radius: 8px; font-weight: 600; font-size: 14px; color: #4da6ff; display: flex; align-items: center; }
            .module-card { background: #2a2a3e; border: 1px solid #444; border-radius: 8px; padding: 15px 10px; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .module-card:hover { border-color: #4da6ff; background: #32324a; transform: translateY(-3px); }
            .module-icon { font-size: 28px; margin-bottom: 8px; }
            .module-name { font-size: 12px; line-height: 1.4; color: #ddd; font-weight: 500; }
        </style>
        <div class="protocol-container">
    `;

    // Render từng hàng (Row)
    currentSetup.rows.forEach(row => {
        html += `<div class="grid-row">
                    <div class="stage-card">${row.title}</div>`;

        row.modules.forEach(mod => {
            const clickAttr = isCalibrated
                ? `onclick="startTherapyModule('${mod.id}')"`
                : `title="Chống chỉ định: Cần hiệu chuẩn kính"`;
            const disabledStyle = isCalibrated ? '' : 'opacity: 0.5; cursor: not-allowed;';
            html += `<div class="module-card" role="button" tabindex="0" style="${disabledStyle}" ${clickAttr}>
                        <div class="module-icon">${mod.icon}</div>
                        <div class="module-name">${mod.id}: ${mod.name}</div>
                     </div>`;
        });
        html += `</div>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;

    // Combo Banner: chèn lại vào đầu menu Luyện tập sau khi lobby render (innerHTML bị xóa)
    if (typeof window.updateComboBanner === 'function') {
        window.updateComboBanner();
    }

    // Dọn dẹp style container: Grid nằm trong luồng cuộn dọc của menu
    container.style.display = 'block';
    container.style.padding = '0';
    container.style.overflowY = 'auto';
    container.style.maxHeight = 'calc(100vh - 120px)';
};

/**
 * Render LẠI toàn bộ menu Luyện tập (Lobby) theo đúng bố cục của Phác đồ hiện tại.
 * - Đặt lại mọi style inline của #menu-therapeutic có thể gây lệch bố cục
 *   (VD: display:flex + center do toggleWorkspace để lại ở lần chuyển trước).
 * - Gọi an toàn nhiều lần (idempotent), dùng chung cho cả 2 luồng:
 *   1) Khi người bệnh đăng nhập / đổi Phác đồ (exam_session_manager).
 *   2) Khi nhấn nút toggle chuyển Khám → Luyện tập (main.js toggleWorkspace).
 * @returns {HTMLElement|null} Container menu đã render, hoặc null nếu chưa có DOM.
 */
window.refreshTherapeuticMenu = function() {
    const container = document.getElementById('menu-therapeutic');
    if (!container) return null;

    // Chỉ hiển thị menu Huấn luyện: ẩn menu Khám (display:none) để tránh hai menu
    // cùng lúc xếp dọc chia đôi sidebar sau khi đăng nhập bệnh nhân.
    const diagnosticMenu = document.getElementById('menu-diagnostic');
    if (diagnosticMenu) diagnosticMenu.style.display = 'none';

    // Đảm bảo controller đã khởi tạo (gắn menuContainer/workspaceContainer +
    // bind fullscreenchange). Auto-mount có thể bỏ cuộc nếu workspace-therapeutic
    // chưa hiển thị (offsetParent === null), khiến workspaceContainer = null và
    // launchGame() ném lỗi khi nhấn Enter — nên phải init lại tại đây.
    if (window.therapeuticMenu && typeof window.therapeuticMenu.init === 'function') {
        window.therapeuticMenu.init();
    }

    // Reset mọi style inline để bố cục luôn theo đúng CSS/renderTherapeuticLobby
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.display = 'block';
    container.style.padding = '0';
    container.style.overflowY = 'auto';
    container.style.maxHeight = 'calc(100vh - 120px)';

    // Render lại đúng bố cục theo Phác đồ đang lưu trong localStorage
    if (typeof window.renderTherapeuticLobby === 'function') {
        window.renderTherapeuticLobby(container);
    }
    return container;
};

// Active Polling: Kiểm tra DOM mỗi 200ms, tối đa 25 chu kỳ (5 giây)
(function autoMountTherapeutic() {
    let cycles = 0;
    const maxCycles = 25;
    const pollInterval = 200;

    const mountCheck = setInterval(() => {
        cycles++;

        const menuEl = document.getElementById('menu-therapeutic');
        const workspaceEl = document.getElementById('workspace-therapeutic');

        // Kiểm tra DOM tồn tại VÀ đã hiển thị thật (offsetParent !== null)
        if (menuEl && workspaceEl && menuEl.offsetParent !== null && workspaceEl.offsetParent !== null) {
            window.therapeuticMenu.init();
            clearInterval(mountCheck);
            return;
        }

        // Giới hạn 25 chu kỳ (5 giây) — chống rò rỉ bộ nhớ
        if (cycles >= maxCycles) {
            console.warn('[Therapeutic] Không tìm thấy DOM sau 5 giây. Hủy auto-mount.');
            clearInterval(mountCheck);
        }
    }, pollInterval);
})();

// ============================================================
// ĐỒNG BỘ TIẾN TRÌNH TỪ FIREBASE (khôi phục Level đã mở khóa)
// ============================================================
const M12_LEVEL_KEY = 'vision-therapy-m12-max-level';
const M1_LEVEL_KEY = 'vision-therapy-m1-max-level';
const M2_LEVEL_KEY = 'vision-therapy-m2-max-level';
const M10_LEVEL_KEY = 'vision-therapy-m10-max-level';
const M9_LEVEL_KEY = 'vision-therapy-m9-max-level';
const M4_LEVEL_KEY = 'vision-therapy-m4-max-level';

/**
 * Truy vấn Firestore để tìm Level cao nhất mà bệnh nhân đã chinh phục ở module gamify
 * (dùng chung mã Level cho cả thiết bị), sau đó ghi đè localStorage tương ứng.
 * Không block luồng — thất bại (mất mạng) sẽ im lặng giữ nguyên dữ liệu cục bộ.
 * @param {string} patientId - Patient ID (đã lưu trong localStorage 'currentPatientId')
 * @param {string} moduleKey - Tên module để lọc ('M1', 'M4', 'M10', 'M12'...)
 * @returns {Promise<number>} Level tối đa đã khôi phục (mặc định 1)
 */
window.syncM12ProgressFromFirebase = async function(patientId, moduleKey = 'M12') {
    const LEVEL_KEY_MAP = {
        'M1': M1_LEVEL_KEY, 'M2': M2_LEVEL_KEY, 'M4': M4_LEVEL_KEY,
        'M9': M9_LEVEL_KEY, 'M10': M10_LEVEL_KEY, 'M12': M12_LEVEL_KEY
    };
    const LEVEL_KEY = LEVEL_KEY_MAP[moduleKey] || M12_LEVEL_KEY;
    try {
        const pid = patientId || localStorage.getItem('currentPatientId');
        if (!pid || !window.db) return 1;

        const snapshot = await window.db.collection("Patients")
            .doc(pid)
            .collection("Sessions")
            .get();

        let maxLevel = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const gName = data.gameName || '';
            if (!gName.includes(moduleKey)) return;
            // payload lưu metrics = customData (phẳng); đọc an toàn cả 2 cấu trúc
            const lvl = data.metrics?.level ?? data.metrics?.customData?.level;
            const num = parseInt(lvl, 10);
            if (!isNaN(num) && num > maxLevel) maxLevel = num;
        });

        maxLevel = Math.max(1, Math.min(10, maxLevel));
        localStorage.setItem(LEVEL_KEY, String(maxLevel));

        // Nếu Lobby module đang mở, làm mới trạng thái khóa/mở khóa các nút Level
        const WRAP_ID_MAP = {
            'M1': 'catch-level-wrap', 'M2': 'align-level-wrap', 'M4': 'saccadic-level-wrap',
            'M9': 'redcone-level-wrap', 'M10': 'okn-level-wrap', 'M12': 'pursuit-level-wrap'
        };
        const wrapId = WRAP_ID_MAP[moduleKey] || `${moduleKey.toLowerCase()}-level-wrap`;
        const levelWrap = document.getElementById(wrapId);
        if (levelWrap) {
            levelWrap.querySelectorAll('.pursuit-level-btn').forEach(btn => {
                const lv = parseInt(btn.dataset.level, 10);
                const locked = lv > maxLevel;
                const isCurrent = parseInt(levelWrap.parentElement?.querySelector('input[type=hidden]')?.value || '1', 10) === lv;
                btn.disabled = locked;
                btn.style.opacity = locked ? '0.4' : '1';
                btn.style.cursor = locked ? 'not-allowed' : 'pointer';
                btn.style.background = isCurrent ? '#3b82f6' : '#0f172a';
                btn.style.borderColor = isCurrent ? '#3b82f6' : '#475569';
                btn.style.color = isCurrent ? '#fff' : (locked ? '#475569' : '#e2e8f0');
            });
        }
        return maxLevel;
    } catch (err) {
        console.warn(`[${moduleKey} Progress] Không thể đồng bộ từ Firebase (giữ localStorage hiện tại):`, err);
        return parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10) || 1;
    }
};

// SPA Event Listener: Xử lý chuyển đổi workspace qua lại
document.addEventListener('onWorkspaceChanged', (e) => {
    if (e.detail.toWorkspace === 'therapeutic') {
        // Render lại đúng bố cục Phác đồ + reset style inline có thể gây lệch
        if (typeof window.refreshTherapeuticMenu === 'function') {
            window.refreshTherapeuticMenu();
        } else {
            window.therapeuticMenu.init();
        }
    } else {
        window.therapeuticMenu.stopCurrentGame();
    }
});

/**
 * Đóng Module trị liệu sau khi người dùng xác nhận kết quả trên Global Result Modal.
 * [SỬA LỖI TRẮNG MÀN HÌNH] Không điều hướng đi nơi khác (dashboard) nữa —
 * thay vào đó: dọn dẹp canvas còn sót rồi vẽ lại Sảnh game (Lobby) ngay
 * trong vùng hiển thị chính, đưa bác sĩ về sảnh ngay lập tức.
 */
window.closeTherapyModule = function() {
    // 1. Dừng game đang chạy + reset overlay fullscreen của workspace
    if (window.therapeuticMenu) {
        window.therapeuticMenu.stopCurrentGame();
        window.therapeuticMenu._handleFullscreenExit();
    }

    // Thoát fullscreen nếu vẫn còn (fullscreenchange sẽ tự dọn + vẽ lại Lobby)
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    // 2. Dọn dẹp thẻ canvas còn sót (nếu có) trong workspace Huấn luyện
    const ws = document.getElementById('workspace-therapeutic');
    if (!ws) return;

    ws.style = '';
    ws.querySelectorAll('canvas, button[aria-label="Thoát bài tập"]').forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
    });

    // 3. Đảm bảo #therapeutic-content tồn tại (game đã xóa bằng innerHTML='')
    let content = document.getElementById('therapeutic-content');
    if (!content) {
        content = document.createElement('div');
        content.id = 'therapeutic-content';
        ws.appendChild(content);
    } else {
        content.innerHTML = '';
    }
    content.style.cssText = 'width: 100%; height: 100%; overflow-y: auto;';

    // 4. BẮT BUỘC vẽ lại danh sách menu game vào vùng hiển thị chính
    if (typeof window.renderTherapeuticLobby === 'function') {
        window.renderTherapeuticLobby(content);
    }
};
