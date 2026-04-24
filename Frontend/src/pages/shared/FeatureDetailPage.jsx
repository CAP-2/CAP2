const advancedCards = [
  {
    icon: "bolt",
    title: "Lập phả hệ tự động",
    desc: "Nhập dữ liệu nhanh chóng từ file Excel hoặc thông tin rời rạc, hệ thống tự động liên kết.",
  },
  {
    icon: "notifications_active",
    title: "Quản lý ngày lễ",
    desc: "Nhắc lịch đám giỗ, tết, các ngày kỷ niệm dòng tộc qua điện thoại và email.",
  },
  {
    icon: "security",
    title: "Bảo mật & phân quyền",
    desc: "Dữ liệu được mã hóa chuẩn quốc tế, phân quyền truy cập chi tiết cho từng thành viên.",
  },
];

const eventCards = [
  {
    icon: "event_upcoming",
    title: "Thông báo tự động",
    desc: "Hệ thống tự động gửi nhắc qua SMS, email và app cho các dịp quan trọng của từng nhánh họ.",
  },
  {
    icon: "work_history",
    title: "Kết nối đại gia đình",
    desc: "Đồng bộ nhiều thế hệ, mời thành viên ở xa và cập nhật lịch chung theo từng chi tộc.",
  },
  {
    icon: "history",
    title: "Lưu trữ nghi thức",
    desc: "Tạo kho tư liệu về văn khấn, bài cúng và hướng dẫn nghi lễ chuẩn cho từng ngày lễ.",
  },
  {
    icon: "confirmation_number",
    title: "Tạo đề nghị tự chi",
    desc: "Quản lý công tác hậu cần, ngân sách và nguồn lực phục vụ các sự kiện của gia tộc.",
  },
];

const preservationPoints = [
  "Chuyển ngữ Hán-Nôm",
  "Lưu trữ đám mây bảo mật",
  "Phân quyền truy cập",
];

export default function FeatureDetailPage() {
  return (
    <section className="feature-page">
      <div className="container">
        <header className="feature-page-header stitch-like">
          <span className="section-tag">Frame tính năng chi tiết</span>
          <h1>Tính năng chi tiết</h1>
          <p>Hệ tính năng được thiết kế theo hướng trực quan, bảo mật và kết nối liên thế hệ cho toàn bộ dòng tộc.</p>
        </header>

        <section className="feature-detail-block stitch-split">
          <div className="feature-detail-copy">
            <h2>Sơ đồ phả hệ thông minh</h2>
            <p>Trực quan hóa cây phả hệ đa nhánh, theo dõi quan hệ trực hệ và thông tin từng thành viên ngay trên một màn hình.</p>

            <div className="feature-detail-actions">
              <button type="button">
                <span className="material-symbols-outlined">image</span>
                Xem dưới dạng hình ảnh
              </button>
              <button type="button">
                <span className="material-symbols-outlined">account_tree</span>
                Tạo nhiều thế hệ
              </button>
              <button type="button" className="ai">
                <span className="material-symbols-outlined">auto_awesome</span>
                AI generate
              </button>
            </div>

            <ul className="feature-detail-points">
              <li>Tự động sắp xếp thứ tự vai vế theo đời</li>
              <li>Đính kèm tiểu sử, ảnh chân dung và tư liệu gốc</li>
              <li>Tìm kiếm theo tên, chi họ, khu vực và mốc thời gian</li>
            </ul>
          </div>

          <div className="feature-detail-visual">
            <img src="/sodogiapha.png" alt="Sơ đồ phả hệ chi tiết" />
          </div>
        </section>

        <section className="feature-advanced stitch-split second">
          <div className="feature-advanced-image">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAd6zBRvZR3R4FNjtUr2lLEx9nhgeCvjODU75n1JNSZXsYbZbBF_gkjblSR6pitSFdONbGyENkDH6yqIi4uS-Ykb6p6ILCjP0nXnqvGTlFy9hTWmvVSDjpMIx7HWlHJsTVzyp8Eupx2Tm3Xyjng359b4cGX8X6_EDIt4xaLllWGrajQxWqaRni5VzHCLHVKEAERaVpCv2KL8n9_4GnV-fPjGCzGNfAwYlnkE_xJidn-Rg1rLL1S3goPoSirM6dhlbwjipscoiT16iOH"
              alt="Công nghệ dẫn đầu"
            />
          </div>

          <div>
          <div className="feature-advanced-heading">
            <span className="section-tag">Công nghệ dẫn đầu</span>
            <h2>Tính năng vượt trội</h2>
          </div>

          <div className="feature-advanced-grid">
            {advancedCards.map((card) => (
              <article key={card.title} className="feature-card-detail">
                <span className="material-symbols-outlined card-icon">{card.icon}</span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </article>
            ))}
          </div>
          </div>
        </section>

        <section className="feature-kpi-grid">
          <div>
            <strong>1,200+</strong>
            <p>Dòng họ tham gia</p>
          </div>
          <div>
            <strong>500k+</strong>
            <p>Thành viên kết nối</p>
          </div>
          <div>
            <strong>250k+</strong>
            <p>Tư liệu số hóa</p>
          </div>
          <div>
            <strong>63</strong>
            <p>Tỉnh thành phủ sóng</p>
          </div>
        </section>

        <section className="feature-event-section">
          <header className="feature-sub-header">
            <h2>Quản lý Sự kiện &amp; Ngày lễ</h2>
            <p>Lưu nhắc lễ hội con cháu, đám giỗ và nghi thức truyền thống qua hệ thống điện tử hiện đại.</p>
          </header>

          <div className="event-layout">
            <article className="event-timeline-card">
              <span className="event-timeline-label">LỊCH ÂM DƯƠNG</span>
              <div className="event-date-box">
                <strong>15</strong>
                <p>Tháng Tám, Giáp Thìn</p>
              </div>
              <ul>
                <li>
                  <span>Ngày giỗ Tổ họ Nguyễn</span>
                  <em>8:00 sáng</em>
                </li>
                <li>
                  <span>Lễ dâng hương từ đường</span>
                  <em>6:30 chiều</em>
                </li>
              </ul>
            </article>

            <div className="event-grid">
              {eventCards.map((card) => (
                <article key={card.title} className="event-item-card">
                  <span className="material-symbols-outlined">{card.icon}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="feature-preservation-section">
          <div className="preservation-media">
            <img
              src="https://images.unsplash.com/photo-1516410529446-2c777cb7366d?auto=format&fit=crop&w=900&q=80"
              alt="Tư liệu gia phả cổ"
            />
            <img
              src="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=900&q=80"
              alt="Bảo mật dữ liệu số"
            />
          </div>

          <div className="preservation-content">
            <h2>Số hóa &amp; Bảo mật di sản</h2>
            <p>
              Lưu trữ gia phả theo chuẩn số hóa hiện đại, bảo toàn tư liệu cổ và tăng cường khả năng truy cập an toàn
              cho từng thành viên trong họ tộc.
            </p>

            <div className="preservation-list">
              {preservationPoints.map((item, index) => (
                <div key={item} className="preservation-point">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="feature-bottom-cta">
          <h2>Sẵn sàng khởi tạo di sản số cho dòng họ?</h2>
          <p>Tham gia cùng hàng nghìn dòng tộc Việt Nam trong hành trình bảo tồn nguồn cội bền vững.</p>
          <div className="feature-bottom-actions">
            <a href="#">Bắt đầu ngay</a>
            <a href="#" className="outline">
              Tìm hiểu thêm
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
