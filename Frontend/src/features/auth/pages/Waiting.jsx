import { Link } from "react-router-dom";
import "./waiting.css";

const Waiting = () => {
  return (
    <div className="waiting-page">
      <div className="waiting-card">
        <h2>Đang chờ phê duyệt</h2>
        <Link to="/login">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
};

export default Waiting;