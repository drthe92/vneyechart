import CatchGame from './anti_suppression_catch.js';
import ShapeAlignmentGame from './shape_alignment.js';
import VergenceTrackerGame from './vergence_tracker_game.js';
import SaccadicTrackingGame from './saccadic_tracking_game.js';
import RDSTherapyGame from './rds_therapy_game.js';
import DivergenceTherapyGame from './divergence_therapy_game.js';
import CamVisualStimulatorGame from './cam_visual_stimulator_game.js';
import AntiCrowdingGame from './anti_crowding_game.js';
import RedConeStimulatorGame from './red_cone_stimulator_game.js';
import OKNStimulationGame from './okn_stimulation_game.js';
import GaborPerceptualLearningGame from './gabor_perceptual_learning_game.js';

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
 */

class TherapeuticMenuController {
    constructor() {
        this.currentGame = null;
        this.workspaceContainer = null;
        this.menuContainer = null;

        this.gameModules = [
            {
                id: 'catch',
                name: 'M1: Hứng hạt',
                classRef: CatchGame,
                stage: 'Giai đoạn 2: Phá vỡ Ức chế (Đeo kính Đỏ - Xanh)',
                parentTranslation: 'Dạy não bộ không được "bỏ rơi" mắt yếu. Game sẽ làm mờ hình ở mắt khỏe và làm rõ hình ở mắt yếu để bắt 2 mắt phải làm việc đều nhau.',
                medicalPurpose: 'Phá vỡ ức chế, khôi phục hợp thị thô.',
                indication: 'Trẻ đã nhìn khá hơn (> 2/10) nhưng khi mở cả 2 mắt vẫn hay nheo một mắt.',
                contraindication: 'Đeo ngược kính (Bắt buộc: Phải Đỏ - Trái Xanh).',
                gameplay: 'Di chuyển thanh ngang để hứng hạt rơi. Hứng trúng +1, trượt -1.',
                goal: 'Đạt 30 điểm. Khi đó độ tương phản của 2 mắt đạt mức cân bằng (50%).',
                settings: [
                    {
                        id: 'catch-fall-speed', key: 'fallSpeed', label: 'Tốc độ rơi', numeric: false,
                        options: [
                            { value: 'slow', label: 'Chậm', selected: true },
                            { value: 'medium', label: 'Vừa', selected: false },
                            { value: 'fast', label: 'Nhanh', selected: false }
                        ]
                    },
                    {
                        id: 'catch-bar-size', key: 'barSize', label: 'Kích thước thanh hứng', numeric: false,
                        options: [
                            { value: 'large', label: 'To', selected: true },
                            { value: 'medium', label: 'Vừa', selected: false },
                            { value: 'small', label: 'Nhỏ', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'align',
                name: 'M2: Khớp khung',
                classRef: ShapeAlignmentGame,
                stage: 'Giai đoạn 2: Phá vỡ Ức chế (Đeo kính Đỏ - Xanh)',
                parentTranslation: 'Rèn luyện sự tỉ mỉ. Ép mắt yếu phải khóa chặt mục tiêu trong khi mắt khỏe chỉ nhìn thấy khung nền.',
                medicalPurpose: 'Định thị trung tâm trong điều kiện 2 mắt.',
                indication: 'Thị lực >= 2/10, hết định thị lệch tâm.',
                contraindication: 'Không có.',
                gameplay: 'Dùng chuột kéo khối màu đặc thả lọt khít vào khung rỗng và giữ yên 2 giây.',
                goal: 'Hoàn thành 10 cấp độ mà không bị trượt tay.',
                settings: [
                    {
                        id: 'align-levels', key: 'levels', label: 'Số lượng cấp độ', numeric: true,
                        options: [
                            { value: '5', label: '5 bàn', selected: true },
                            { value: '10', label: '10 bàn', selected: false },
                            { value: '15', label: '15 bàn', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'vergence',
                name: 'M3: Vận nhãn',
                classRef: VergenceTrackerGame,
                stage: 'Giai đoạn 3: Tập gym cơ mắt (Vận nhãn cơ học)',
                parentTranslation: 'Giống như tập tạ, bài tập này giúp hai mắt có lực để kéo chụm vào nhau khi đọc sách, nhìn gần, chống mỏi mắt.',
                medicalPurpose: 'Tăng biên độ hội tụ (Base Out).',
                indication: 'Lác ngoài (Exotropia) ẩn, mỏi mắt khi học bài, lờ đờ.',
                contraindication: 'Đang bị liệt cơ vận nhãn.',
                gameplay: 'Nhìn tập trung để 2 khối màu chập thành 1. Khi 2 khối bị tách làm đôi (vỡ hình), bấm ngay phím SPACE.',
                goal: 'Chịu đựng được mức hội tụ 15 Đi-ốp (Δ).',
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
                classRef: SaccadicTrackingGame,
                stage: 'Giai đoạn 4: Thị giác 3D (Tinh chỉnh tối đa)',
                parentTranslation: 'Tăng tốc độ truyền tín hiệu từ mắt lên não. Trẻ sẽ phản xạ nhanh hơn trong học tập và chơi thể thao.',
                medicalPurpose: 'Tăng tốc độ đưa ảnh từ võng mạc ngoại vi vào hố hoàng điểm (Saccadic).',
                indication: 'Thị lực hai mắt đều, cần giảm độ trễ phản xạ.',
                contraindication: 'Không có.',
                gameplay: 'Mục tiêu xuất hiện ngẫu nhiên, click chuột vào mục tiêu càng nhanh càng tốt.',
                goal: 'Chạm mốc phản xạ dưới 500ms (Nửa giây) cho 20 mục tiêu.',
                settings: [
                    {
                        id: 'saccadic-size', key: 'targetSize', label: 'Kích thước mục tiêu', numeric: false,
                        options: [
                            { value: 'large', label: 'Lớn', selected: true },
                            { value: 'medium', label: 'Vừa', selected: false },
                            { value: 'small', label: 'Nhỏ', selected: false }
                        ]
                    },
                    {
                        id: 'saccadic-count', key: 'count', label: 'Số lượng mục tiêu', numeric: true,
                        options: [
                            { value: '20', label: '20', selected: true },
                            { value: '40', label: '40', selected: false },
                            { value: '60', label: '60', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ CẢNH BÁO: Đeo kính Đỏ-Lục Lam (Mắt phải ĐỎ / Mắt trái XANH) trước khi chơi.'
            },
            {
                id: 'rds_therapy',
                name: 'M5: Huấn luyện Thị giác nổi (RDS)',
                classRef: RDSTherapyGame,
                stage: 'Giai đoạn 4: Thị giác 3D (Tinh chỉnh tối đa)',
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
                classRef: DivergenceTherapyGame,
                stage: 'Giai đoạn 3: Tập gym cơ mắt (Vận nhãn cơ học)',
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
                id: 'cam-stim',
                name: 'M7: Kích thích Lưới quay CAM',
                classRef: CamVisualStimulatorGame,
                stage: 'Giai đoạn 1: Đánh thức Hoàng điểm (Bịt mắt lành)',
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
                        id: 'cam-stim-speed', key: 'rotationSpeed', label: 'Tốc độ xoay', numeric: true,
                        options: [
                            { value: '0.5', label: 'Chậm', selected: false },
                            { value: '1', label: 'Bình thường', selected: true },
                            { value: '2', label: 'Nhanh', selected: false }
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
                classRef: AntiCrowdingGame,
                stage: 'Giai đoạn 1: Đánh thức Hoàng điểm (Bịt mắt lành)',
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
                classRef: RedConeStimulatorGame,
                stage: 'Giai đoạn 1: Đánh thức Hoàng điểm (Monocular Pleoptics)',
                parentTranslation: 'Kích thích vùng hoàng điểm bằng ánh sáng đỏ, ép mắt yếu phải làm việc trong bóng tối.',
                medicalPurpose: 'Sử dụng phương pháp Brinker-Katz. Vô hiệu hóa tế bào que chu biên bằng ánh sáng đỏ thuần, ép kích hoạt tế bào nón hoàng điểm.',
                indication: 'Nhược thị sâu (Thị lực < 2/10), định thị ngoại tâm dai dẳng.',
                contraindication: 'KHÔNG DÙNG cho bệnh nhân động kinh ánh sáng.',
                gameplay: 'Tắt đèn phòng. Bịt mắt sáng. Tìm và chỉ hướng chữ E màu đỏ trên nền đen.',
                goal: 'Đạt độ chính xác > 85%, thời gian phản xạ < 1.5s.',
                settings: [
                    {
                        id: 'red-cone-target-size', key: 'targetSize', label: 'Kích thước mục tiêu', numeric: false,
                        options: [
                            { value: 'Lớn', label: 'Lớn', selected: false },
                            { value: 'Vừa', label: 'Vừa', selected: true },
                            { value: 'Nhỏ', label: 'Nhỏ', selected: false }
                        ]
                    },
                    {
                        id: 'red-cone-display-time', key: 'displayTime', label: 'Thời gian hiển thị', numeric: false,
                        options: [
                            { value: 'unlimited', label: 'Không giới hạn', selected: true },
                            { value: '3000', label: '3 giây', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ. Hãy TẮT ĐÈN phòng tập.'
            },
            {
                id: 'okn-stim',
                name: 'M10: Kích thích phản xạ OKN (Optokinetic)',
                classRef: OKNStimulationGame,
                stage: 'Giai đoạn 1: Đánh thức Hoàng điểm (Bịt mắt lành)',
                parentTranslation: 'Khi mắt nhược thị nhìn theo các sọc đen trắng chuyển động, não sẽ bật phản xạ rung giật nhãn cầu (OKN), giúp kéo điểm nhìn về đúng trung tâm võng mạc.',
                medicalPurpose: 'Kích thích phản xạ rung giật nhãn cầu (Optokinetic Nystagmus) để phá vỡ định thị ngoại tâm, rèn lại định thị trung tâm.',
                indication: 'Định thị ngoại tâm dai dẳng, nhược thị sâu cần tái lập hoàng điểm.',
                contraindication: 'TUYỆT ĐỐI KHÔNG dùng cho bệnh nhân động kinh ánh sáng (sọc chuyển động có thể kích phát cơn).',
                gameplay: 'Bịt mắt sáng. Nhìn theo sọc chuyển động, dùng chuột/ngón tay chạm vào đốm đỏ sáng xuất hiện ngẫu nhiên. Chạm trúng -> tiếng "Ting".',
                goal: 'Đạt độ chính xác > 80%, thời gian phản xạ < 1.5s.',
                settings: [
                    {
                        id: 'okn-stripe-size', key: 'stripeSize', label: 'Kích thước sọc', numeric: false,
                        options: [
                            { value: 'Lớn', label: 'Lớn', selected: false },
                            { value: 'Vừa', label: 'Vừa', selected: true },
                            { value: 'Nhỏ', label: 'Nhỏ', selected: false }
                        ]
                    },
                    {
                        id: 'okn-direction', key: 'direction', label: 'Hướng trôi sọc', numeric: false,
                        options: [
                            { value: 'LTR', label: 'Trái → Phải', selected: true },
                            { value: 'RTL', label: 'Phải → Trái', selected: false }
                        ]
                    },
                    {
                        id: 'okn-speed', key: 'speed', label: 'Tốc độ trôi', numeric: false,
                        options: [
                            { value: 'Chậm', label: 'Chậm', selected: false },
                            { value: 'Vừa', label: 'Vừa', selected: true },
                            { value: 'Nhanh', label: 'Nhanh', selected: false }
                        ]
                    }
                ],
                mandatoryWarning: '⚠️ BẮT BUỘC: CHỈ MỞ MẮT NHƯỢC THỊ (BỊT MẮT LÀNH). Chống chỉ định: Động kinh ánh sáng.'
            },
            {
                id: 'gabor-pl',
                name: 'M11: Học tri giác Gabor (Perceptual Learning)',
                classRef: GaborPerceptualLearningGame,
                stage: 'Giai đoạn 2: Tăng cường độ nhạy tương phản (Đơn nhãn)',
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

        // ============================================================
        // ĐỊNH TUYẾN Y KHOA: Chuyển module khi đạt điểm rơi lâm sàng
        // Lắng nghe sự kiện requestLaunchModule2 từ CatchGame._endGame()
        // ============================================================
        document.addEventListener('requestLaunchModule2', () => {
            const module2 = this.gameModules.find(m => m.id === 'align');
            if (module2) {
                console.log('[Therapeutic] Kích hoạt phác đồ tiếp theo: Module 2');
                this.launchGame(module2);
            }
        }, { once: true });

        // ============================================================
        // Lắng nghe sự kiện requestLaunchModule3 từ ShapeAlignmentGame._endGame()
        // ============================================================
        document.addEventListener('requestLaunchModule3', () => {
            const module3 = this.gameModules.find(m => m.id === 'vergence');
            if (module3) {
                console.log('[Therapeutic] Kích hoạt phác đồ tiếp theo: Module 3');
                this.launchGame(module3);
            }
        }, { once: true });

        // ============================================================
        // Lắng nghe sự kiện requestLaunchModule6 từ RDSTherapyGame._endGame()
        // ============================================================
        document.addEventListener('requestLaunchModule6', () => {
            const module6 = this.gameModules.find(m => m.id === 'divergence');
            if (module6) {
                console.log('[Therapeutic] Kích hoạt phác đồ tiếp theo: Module 6 (Phân kỳ)');
                this.launchGame(module6);
            }
        }, { once: true });
    }

    /**
     * Handle fullscreen exit event: stop game, cleanup DOM, restore SPA UI
     */
    _handleFullscreenExit() {
        if (!document.fullscreenElement) {
            this.stopCurrentGame();
            this.workspaceContainer.style = '';
            this.workspaceContainer.innerHTML = '';
        }
    }

    renderSidebar() {
        this.menuContainer.innerHTML = '';

        const isCalibrated = window.__anaglyphColors && window.__anaglyphColors.red;

        for (const module of this.gameModules) {
            const btn = document.createElement('button');
            btn.textContent = module.name;

            btn.style.width = '100%';
            btn.style.marginBottom = '10px';
            btn.style.padding = '15px';
            btn.style.border = 'none';
            btn.style.borderRadius = '8px';
            btn.style.textAlign = 'center';
            btn.style.fontSize = '14px';
            btn.style.fontWeight = '500';
            btn.style.cursor = 'pointer';

            if (!isCalibrated) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Chống chỉ định: Cần hiệu chuẩn kính';
                btn.style.backgroundColor = '#e0e0e0';
                btn.style.color = '#999';
            } else {
                btn.onclick = () => this.launchGame(module);
                btn.onmouseover = () => btn.style.backgroundColor = '#e8f4fc';
                btn.onmouseout = () => btn.style.backgroundColor = '#f5f5f5';
                btn.style.backgroundColor = '#f5f5f5';
            }

            this.menuContainer.appendChild(btn);
        }
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
        this.workspaceContainer.innerHTML = '';

        console.log("[Therapeutic] Request launch module:", module.name);

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
                        <h2 style="color: #38bdf8; margin-top: 0; font-size: 22px; border-bottom: 1px solid #1e293b; padding-bottom: 10px;">${game.title}</h2>

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

                        <!-- FORM CÀI ĐẶT ĐỘNG (theo từng game) -->
                        <div style="background: #1e293b; padding: 16px; border-radius: 8px;">
                            <h4 style="color: #38bdf8; margin: 0 0 10px 0; font-size: 14px;">⚙️ CÀI ĐẶT BÀI TẬP:</h4>
                            ${this.renderSettingsForm(module)}
                        </div>

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

        // Initialize and start game
        try {
            const GameClass = (typeof module.classRef === 'string') ? window[module.classRef] : module.classRef;
            this.currentGame = new GameClass();

            this.currentGame.start(config);
            console.log(`[Therapeutic] Started ${module.name} successfully`, config);
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
            console.log('[Therapeutic] Mount thành công');
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

// SPA Event Listener: Xử lý chuyển đổi workspace qua lại
document.addEventListener('onWorkspaceChanged', (e) => {
    if (e.detail.toWorkspace === 'therapeutic') {
        window.therapeuticMenu.init();
    } else {
        window.therapeuticMenu.stopCurrentGame();
    }
});
