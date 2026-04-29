const features = [
  { icon: "account_tree", title: "Lập phả hệ trực quan", desc: "Xây dựng cây gia phả rõ ràng, dễ theo dõi và phù hợp với cách tổ chức dòng họ Việt Nam." },
  { icon: "notifications_active", title: "Quản lý và thông báo ngày lễ", desc: "Nhắc lịch đám giỗ, tết, ngày kỷ niệm dòng tộc qua hệ thống để các thành viên không bỏ lỡ sự kiện quan trọng." },
  { icon: "security", title: "Bảo mật thông tin", desc: "Phân quyền theo vai trò, giúp dữ liệu gia đình được quản lý riêng tư và an toàn." },
];

export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="container two-col">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAd6zBRvZR3R4FNjtUr2lLEx9nhgeCvjODU75n1JNSZXsYbZbBF_gkjblSR6pitSFdONbGyENkDH6yqIi4uS-Ykb6p6ILCjP0nXnqvGTlFy9hTWmvVSDjpMIx7HWlHJsTVzyp8Eupx2Tm3Xyjng359b4cGX8X6_EDIt4xaLllWGrajQxWqaRni5VzHCLHVKEAERaVpCv2KL8n9_4GnV-fPjGCzGNfAwYlnkE_xJidn-Rg1rLL1S3goPoSirM6dhlbwjipscoiT16iOH"
          alt="Công nghệ dẫn đầu"
        />
        <div>
          <span className="section-tag">Công nghệ dẫn đầu</span>
          <h3>Tính năng vượt trội</h3>
          <div className="feature-list">
            {features.map((item) => (
              <article key={item.title}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
