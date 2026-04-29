const benefitCards = [
  {
    icon: "groups",
    title: "Kết Nối Huyết Thống",
    desc: "Theo dõi dòng mạch thế hệ trong một không gian trực quan, minh bạch và dễ cập nhật cho toàn bộ gia tộc.",
  },
  {
    icon: "menu_book",
    title: "Gìn Giữ Di Sản",
    desc: "Số hóa những trang gia phả cổ cùng hình ảnh, tư liệu và câu chuyện truyền thống để lưu giữ bền vững.",
  },
  {
    icon: "school",
    title: "Giáo Dục Truyền Thống",
    desc: "Lưu trữ sinh hoạt dòng họ giúp thế hệ trẻ hiểu nguồn cội, tiếp nối sứ mệnh và đạo lý gia tộc.",
  },
];

const reasons = [
  {
    icon: "tips_and_updates",
    title: "Gợi ý thành viên AI",
    desc: "Tự động đề xuất kết nối quan hệ dựa trên tên, đời và dữ liệu lịch sử của từng nhánh.",
  },
  {
    icon: "verified_user",
    title: "Bảo mật đa tầng",
    desc: "Dữ liệu được mã hóa theo nhiều lớp và xác thực nghiêm ngặt đến từng quyền truy cập.",
  },
  {
    icon: "diversity_3",
    title: "Nhắc nhở ngày giỗ tự động",
    desc: "Thông báo được gửi đều đặn theo âm lịch đến ứng dụng, email và nhóm thành viên liên quan.",
  },
  {
    icon: "history_edu",
    title: "Lưu trữ vĩnh viễn",
    desc: "Mọi hình ảnh, văn bản và phim tư liệu được sao lưu định kỳ trên hạ tầng đám mây.",
  },
];

export default function BenefitsDetailPage() {
  return (
    <section className="benefits-page">
      <div className="container benefits-container">
        <header className="benefits-hero">
          <h1>Lợi Ích Của Việc Lưu Giữ Gia Phả</h1>
          <p>
            "Cây có cội, nước có nguồn. Con người có tổ, có tông mới thành."<br />
            Hành trình kết nối tâm linh giữa quá khứ, hiện tại và tương lai.
          </p>
          <span className="benefits-divider" />
        </header>

        <section className="benefits-card-grid">
          {benefitCards.map((card) => (
            <article key={card.title} className="benefit-card">
              <span className="material-symbols-outlined">{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </article>
          ))}
        </section>

        <section className="benefits-why-card">
          <div className="benefits-why-head">
            <h2>Tại Sao Nên Chọn Gia Phả Việt?</h2>
            <span className="why-dot" />
          </div>

          <div className="benefits-why-grid">
            {reasons.map((item) => (
              <article key={item.title} className="benefits-why-item">
                <span className="material-symbols-outlined">{item.icon}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    </section>
  );
}
