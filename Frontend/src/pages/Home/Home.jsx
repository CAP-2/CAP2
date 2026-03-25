import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Hero Section: Phần giới thiệu chính */}
      <header className="hero-section">
        <div className="hero-content">
          <h1>Hệ Thống Quản Lý Gia Phả</h1>
          <p>Gìn giữ giá trị dòng họ - Kết nối các thế hệ tương lai</p>
          <div className="hero-btns">
            <button className="btn-login" onClick={() => navigate('/login')}>
              Đăng Nhập
            </button>
            <button className="btn-register" onClick={() => navigate('/register')}>
              Đăng Ký Tham Gia
            </button>
          </div>
        </div>
      </header>

      {/* Features Section: Các tính năng nổi bật */}
      <section className="features-section">
        <div className="feature-card">
          <div className="icon">🌳</div>
          <h3>Cây Gia Phả Trực Quan</h3>
          <p>Tự động vẽ sơ đồ dòng họ, chi phái một cách chi tiết và dễ hiểu.</p>
        </div>
        <div className="feature-card">
          <div className="icon">📱</div>
          <h3>Kết Nối Dòng Tộc</h3>
          <p>Mạng xã hội riêng biệt để chia sẻ hình ảnh, tin tức và sự kiện tâm linh.</p>
        </div>
        <div className="feature-card">
          <div className="icon">📜</div>
          <h3>Lưu Trữ Bền Vững</h3>
          <p>Số hóa các tài liệu cổ, sắc phong và tiểu sử của tổ tiên một cách an toàn.</p>
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; 2026 Dự án Quản Lý Gia Phả - Duy Tan University (CMU)</p>
      </footer>
    </div>
  );
};

export default Home;