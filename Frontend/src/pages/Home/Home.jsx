import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Navigation Header */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo">
            <div className="logo-icon">Đ</div>
            <span>Gia Phả Việt</span>
          </div>
          <ul className="nav-menu">
            <li><a href="#features">Về chúng tôi</a></li>
            <li><a href="#pricing">Tính năng</a></li>
            <li><a href="#benefits">Lợi ích</a></li>
            <li><a href="#blog">Tin tức</a></li>
            <li><a href="#faq">Hướng dẫn</a></li>
          </ul>
          <div className="nav-buttons">
            <button className="nav-btn login" onClick={() => navigate('/login')}>Đăng nhập</button>
            <button className="nav-btn register" onClick={() => navigate('/register')}>Đăng ký</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-left">
          <h1>Gìn giữ cổ nguyên, kết nối thế hệ</h1>
          <p>Nền tảng quản lý gia phả toàn diện giúp gìn giữ và chia sẻ lịch sử gia tộc một cách dễ dàng và an toàn</p>
          <button className="btn-primary" onClick={() => navigate('/clan-register')}>Tạo dòng họ ngay</button>
        </div>
        <div className="hero-right">
          <div className="hero-image">
            <div className="mockup-card">
              <div className="mockup-header"></div>
              <div className="mockup-content"></div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="about-content">
          <h2>Về chúng tôi</h2>
          <p>Gia Phả Việt là nền tảng toàn diện cho việc quản lý và bảo lưu lịch sử gia tộc. Chúng tôi tin rằng mỗi gia tộc đều có câu chuyện đáng được ghi lại và truyền thừa cho các thế hệ tương lai. Với công nghệ hiện đại, chúng tôi cung cấp các công cụ dễ sử dụng giúp xây dựng cây gia phả, lưu trữ tài liệu, và kết nối các thành viên dòng họ dù ở đâu.</p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <h2>✳ Các tính năng nổi bật ✳</h2>
        
        <div className="features-grid">
          {/* Feature 01 */}
          <div className="feature-item">
            <div className="feature-left">
              <div className="feature-number">01.</div>
              <h3>Phả đồ thông minh</h3>
              <div className="feature-list">
                <div className="feature-point">✓ Xuất phả đồ dưới dạng sơ đồ kích thước không giới hạn</div>
                <div className="feature-point">✓ Tạo phả đồ theo chủ đề và bộ lọc linh hoạt</div>
                <div className="feature-point">Giao diện nhập liệu siêu dễ: Nhấn vào từng hộp tìm kiếm, hoặc kéo thả các ô dữ liệu để điều chỉnh vị trí</div>
                <div className="feature-point">Chức năng chia sẻ an toàn cho các thành viên gia tộc</div>
                <div className="feature-point">Có thể thêm ghi chú, ảnh đại diện cho từng người</div>
              </div>
              <button className="btn-secondary">Xem thêm</button>
            </div>
            <div className="feature-right">
              <div className="feature-icon-circle">🌳</div>
            </div>
          </div>

          {/* Feature 02 */}
          <div className="feature-item alt">
            <div className="feature-left">
              <div className="feature-icon-circle">👥</div>
            </div>
            <div className="feature-right">
              <div className="feature-number">02.</div>
              <h3>Quản lý thành viên</h3>
              <div className="feature-highlight">✳ Tạo định kỳ tập hợp tất cả thành viên gia phát</div>
              <div className="feature-list">
                <div className="feature-point">Quản lý danh sách các cá nhân với thông tin cơ bản</div>
                <div className="feature-point">Xuất danh sách thành viên dưới dạng Excel</div>
                <div className="feature-point">Thiết lập thành viên bộ lọc dòng suy ra từ địa điểm địa phương cấp cơ sở</div>
                <div className="feature-point">Quản lý các sự kiện gia tộc một chia sẻ thông tin qua email, SMS không ngừng phút vào lúc nào đó</div>
              </div>
              <button className="btn-secondary">Xem thêm</button>
            </div>
          </div>

          {/* Feature 03 */}
          <div className="feature-item">
            <div className="feature-left">
              <div className="feature-number">03.</div>
              <h3>Website dòng họ</h3>
              <div className="feature-list">
                <div className="feature-point">✳ Cấu hình tên miền, logo, hình ảnh họ</div>
                <div className="feature-point">✳ Thiết kế, bố cục nhìn cách được gợi ý, xu hướng lạnh thực hành người dùng</div>
                <div className="feature-point">✓ Thiết thương sơ đồ trực quan và dễ dàng lựa chọn</div>
                <div className="feature-point">✓ Thiết thương bộ lọc Thành viên, Các tập tin và dòng sự kiện website</div>
                <div className="feature-point">✓ Thiết cài đặt, chỉnh đổi cho dòng họ</div>
              </div>
              <button className="btn-secondary">Xem thêm</button>
            </div>
            <div className="feature-right">
              <div className="feature-icon-circle">🌐</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section" id="benefits">
        <h2>✳ Những gia tộc đã sử dụng nền tảng của chúng tôi ✳</h2>
        <div className="benefits-carousel">
          <div className="benefit-item">
            <div className="benefit-circle">姓</div>
            <p>Dòng họ Nguyễn</p>
            <p className="benefit-region">Miền An</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-circle">姓</div>
            <p>Dòng họ Trần</p>
            <p className="benefit-region">Miền An</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-circle">姓</div>
            <p>Dòng họ Gia Hội</p>
            <p className="benefit-region">Miền An</p>
          </div>
          <div className="benefit-item">
            <div className="benefit-circle">姓</div>
            <p>Dòng họ Bế Tân</p>
            <p className="benefit-region">Miền An</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Đăng ký để phát triển nên tăng thông tin gia tộc</h2>
          <div className="cta-buttons">
            <button className="btn-dark" onClick={() => navigate('/register')}>Đăng ký</button>
            <button className="btn-outline" onClick={() => navigate('/login')}>Đăng nhập thông tin gia tộc</button>
          </div>
        </div>
        <div className="cta-image">
          <div className="cta-family-icon">👨‍👩‍👧‍👦</div>
        </div>
      </section>

      {/* Blog/News Section */}
      <section className="blog-section" id="blog">
        <h2>✳ Bài viết ✳</h2>
        <div className="blog-grid">
          <div className="blog-card">
            <div className="blog-image"></div>
            <div className="blog-content">
              <h3>Tại sao cần lập sơ bảo lưu gia phả dòng họ trong xã hội hiện đại?</h3>
              <p>Tại sao cần phải giữ gìn tích tích lịch sử gia tộc. Trong xã hội hiện đại ngày ấy chúng ta cần gọc cây công cộng diễn xuất trong quá nước ở nước ngoài...</p>
              <a href="#" className="read-more">Xem thêm</a>
            </div>
          </div>

          <div className="blog-card">
            <div className="blog-image alt"></div>
            <div className="blog-content">
              <h3>Sự kiến họp nhất dòng họ Nguyễn tại Hà Nội</h3>
              <p>Trong những ngày hôm nước nay đây ông tây theo Huffy nước tả. Mười hội Huệ nước tả tế Ái mười Thần Anh các nước na nước Huệ mười hội...</p>
              <a href="#" className="read-more">Xem thêm</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-section">
            <h4>Thông tin</h4>
            <p>Mục tiêu của chúng tôi là giữ gìn lịch sử gia tộc tìm digging vực...</p>
            <div className="social-links">
              <a href="#" className="social-icon">f</a>
              <a href="#" className="social-icon">𝕩</a>
            </div>
          </div>
          <div className="footer-section">
            <h4>C2.SE56</h4>
            <p>Địa chỉ: Đà Nẵng</p>
            <p>Công ty cổ phần wuân</p>
            <p>SDT: 0378029323</p>
            <p>Email: 16.nguyenquan2004@gmail.com</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 GiaPhảViet. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;