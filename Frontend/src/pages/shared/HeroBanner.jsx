import { useNavigate } from "react-router-dom";
import LandingFamilyTree from "./LandingFamilyTree";

export default function HeroBanner() {
  const navigate = useNavigate();
  return (
    <section className="hero-banner">
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-left" data-aos="slide-right" data-aos-delay="120" data-aos-duration="1500">
          <h1 className="hero-title-cinzel" data-aos="slide-right" data-aos-delay="180" data-aos-duration="1500">Gìn giữ cội nguồn,<br />Kết nối thế hệ</h1>
          <p data-aos="slide-right" data-aos-delay="260" data-aos-duration="1500">Nền tảng giúp bạn kết nối và lưu giữ giá trị gia phả Việt Nam, từ cội nguồn đến tương lai.</p>
          <div className="hero-cta" data-aos="slide-up" data-aos-delay="340" data-aos-duration="1500">
            <button type="button">Khám phá ngay</button>
            <button type="button" onClick={() => navigate("/clan-register")}>Tạo Dòng Họ</button>
          </div>
        </div>
        <div className="hero-right"><LandingFamilyTree /></div>
      </div>
    </section>
  );
}
