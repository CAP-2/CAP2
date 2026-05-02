const steps = [
    {
        number: "01",
        title: "Tạo Dòng Họ",
        desc: "Bước đầu tiên là tạo tài khoản và thiết lập tên dòng họ. Hệ thống sẽ tạo không gian riêng cho gia tộc của bạn.",
        icon: "group_add",
    },
    {
        number: "02",
        title: "Thêm Thành Viên",
        desc: "Nhập thông tin các thành viên gia tộc: tên, ngày sinh, mối quan hệ. Bạn có thể thêm từng người hoặc nhập danh sách từ file Excel.",
        icon: "person_add",
    },
    {
        number: "03",
        title: "Kết Nối Quan Hệ",
        desc: "Định nghĩa mối quan hệ giữa các thành viên: cha mẹ, vợ chồng, anh chị em. Hệ thống tự động vẽ sơ đồ phả hệ.",
        icon: "schema",
    },
    {
        number: "04",
        title: "Lưu Trữ Tư Liệu",
        desc: "Tải lên hình ảnh, tài liệu, video của gia phả cổ. Mọi file được mã hóa và lưu trữ an toàn trên đám mây.",
        icon: "cloud_upload",
    },
    {
        number: "05",
        title: "Mời Thành Viên",
        desc: "Gửi lời mời cho các thành viên gia tộc để họ tham gia và cập nhật thông tin cá nhân của mình.",
        icon: "mail_outline",
    },
    {
        number: "06",
        title: "Quản Lý Sự Kiện",
        desc: "Thiết lập các ngày giỗ, lễ hội, sự kiện dòng họ. Nhận thông báo tự động vào những dịp quan trọng.",
        icon: "calendar_today",
    },
];

const faqs = [
    {
        q: "Tôi có thể bắt đầu từ đâu nếu chưa biết toàn bộ thành viên gia tộc?",
        a: "Bạn hoàn toàn có thể bắt đầu với những thành viên gần nhất như bố mẹ, anh chị em. Sau đó, dần dần thêm những người khác khi có thông tin.",
    },
    {
        q: "Dữ liệu của tôi có được bảo vệ?",
        a: "Tất cả dữ liệu gia phả được mã hóa theo chuẩn quốc tế (AES-256). Chỉ những người được phép mới có thể truy cập.",
    },
    {
        q: "Có thể nhập dữ liệu từ gia phả cũ có sẵn không?",
        a: "Có, bạn có thể tải lên file Excel hoặc hình ảnh gia phả cũ. Hệ thống có thể giúp bạn chuyển đổi sang định dạng số hóa.",
    },
    {
        q: "Thành viên khác cần làm gì để tham gia?",
        a: "Họ chỉ cần nhận email mời, đăng ký tài khoản và đăng nhập. Không cần kỹ năng kỹ thuật gì đặc biệt.",
    },
    {
        q: "Tôi có thể xóa hoặc chỉnh sửa thông tin không?",
        a: "Có thể, nhưng mọi chỉnh sửa sẽ được ghi lại để bảo toàn tính lịch sử. Quản trị viên gia tộc có thể quản lý quyền hạn.",
    },
    {
        q: "Giá cước là bao nhiêu?",
        a: "Hiện tại, Gia Phả Việt đang ở giai đoạn beta miễn phí. Bạn có thể sử dụng đầy đủ tính năng mà không tốn chi phí.",
    },
];

export default function GuideDetailPage() {
    return (
        <section className="guide-page">
            <div className="guide-hero">
                <div className="container guide-hero-content">
                    <h1>Hướng dẫn sử dụng</h1>
                    <p>Từng bước khám phá và quản lý gia phả Việt</p>
                    <span className="guide-hero-divider" />
                </div>
            </div>

            <div className="guide-surface">
                <div className="container">
                    <section className="guide-steps">
                        <h2 className="guide-section-title">6 Bước Dễ Dàng Để Bắt Đầu</h2>
                        <div className="steps-grid">
                            {steps.map((step) => (
                                <article key={step.number} className="guide-step-card">
                                    <div className="step-number">{step.number}</div>
                                    <span className="material-symbols-outlined step-icon">{step.icon}</span>
                                    <h3>{step.title}</h3>
                                    <p>{step.desc}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="guide-video-section">
                        <h2 className="guide-section-title">Xem Video Hướng Dẫn</h2>
                        <div className="video-grid">
                            <article className="video-card">
                                <div className="video-thumb">
                                    <span className="material-symbols-outlined play-icon">play_circle</span>
                                </div>
                                <h3>Cách tạo dòng họ trong 2 phút</h3>
                                <p>Hướng dẫn nhanh gọn cho người mới</p>
                            </article>
                            <article className="video-card">
                                <div className="video-thumb">
                                    <span className="material-symbols-outlined play-icon">play_circle</span>
                                </div>
                                <h3>Nhập dữ liệu từ file Excel</h3>
                                <p>Thêm hàng trăm thành viên cùng lúc</p>
                            </article>
                            <article className="video-card">
                                <div className="video-thumb">
                                    <span className="material-symbols-outlined play-icon">play_circle</span>
                                </div>
                                <h3>Quản lý quyền truy cập</h3>
                                <p>Kiểm soát ai được xem hoặc chỉnh sửa</p>
                            </article>
                        </div>
                    </section>

                    <section className="guide-faq">
                        <h2 className="guide-section-title">Câu Hỏi Thường Gặp</h2>
                        <div className="faq-list">
                            {faqs.map((item, idx) => (
                                <details key={idx} className="faq-item">
                                    <summary className="faq-question">
                                        <span>{item.q}</span>
                                        <span className="faq-icon">›</span>
                                    </summary>
                                    <div className="faq-answer">
                                        <p>{item.a}</p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>

                    <section className="guide-support">
                        <div className="support-card">
                            <h2>Cần Giúp Đỡ ?</h2>
                            <p>Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng trả lời mọi câu hỏi.</p>
                            <div className="support-actions">
                                <a href="mailto:support@giaphaviet.com" className="support-link">
                                    <span className="material-symbols-outlined">mail_outline</span>
                                    Gửi Email
                                </a>
                                <a href="#" className="support-link">
                                    <span className="material-symbols-outlined">chat_bubble_outline</span>
                                    Chat Trực Tiếp
                                </a>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </section>
    );
}