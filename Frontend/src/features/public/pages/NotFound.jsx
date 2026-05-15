import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="container" style={{ padding: "80px 20px" }}>
      <h1>404 - Không tìm thấy trang</h1>
      <p>Liên kết bạn truy cập hiện không tồn tại.</p>
      <Link to="/">Quay về trang chủ</Link>
    </section>
  );
}
