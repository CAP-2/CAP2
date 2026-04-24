import { useState, useEffect } from "react";
import "./PendingApprovals.css";

export default function PendingApprovals() {
  const [activeTab, setActiveTab] = useState("users");
  const [pendingUsers, setPendingUsers] = useState([
    { account_id: 101, surname: "Nguyễn", first_name: "Thành", email: "thanh@gmail.com", date: "2024-04-20" },
    { account_id: 102, surname: "Trần", first_name: "Minh", email: "minh@gmail.com", date: "2024-04-21" },
  ]);
  const [pendingPosts, setPendingPosts] = useState([
    { id: 1, author_name: "Lê An", content: "Cập nhật tư liệu về giỗ tổ năm sau...", date: "2024-04-21" },
  ]);

  const handleApproveUser = (id) => {
    setPendingUsers(pendingUsers.filter(u => u.account_id !== id));
    // Toast notification would go here
  };

  return (
    <div className="pending-page animate-fade-in">
      <div className="tab-navigation glass-effect">
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span className="material-symbols-outlined">person_add</span>
          Tài khoản mới ({pendingUsers.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <span className="material-symbols-outlined">article</span>
          Bài viết đóng góp ({pendingPosts.length})
        </button>
      </div>

      <div className="pending-content">
        {activeTab === 'users' ? (
          <div className="pending-list">
            {pendingUsers.map((user) => (
              <div key={user.account_id} className="pending-item glass-effect">
                <div className="item-main">
                  <div className="item-avatar">
                    {user.first_name[0]}
                  </div>
                  <div className="item-info">
                    <h4>{user.surname} {user.first_name}</h4>
                    <p>{user.email}</p>
                    <span className="item-date">Yêu cầu: {user.date}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn" onClick={() => handleApproveUser(user.account_id)}>Phê duyệt</button>
                  <button className="reject-btn">Từ chối</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pending-list">
            {pendingPosts.map((post) => (
              <div key={post.id} className="pending-item glass-effect">
                <div className="item-main">
                  <div className="item-info">
                    <h4>{post.author_name}</h4>
                    <p className="post-preview">{post.content}</p>
                    <span className="item-date">{post.date}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="approve-btn">Duyệt bài</button>
                  <button className="reject-btn">Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
