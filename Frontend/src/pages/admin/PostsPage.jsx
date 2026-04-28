import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAdminClans, getAdminPostsByClan } from "../../api/adminService";
import "./DashboardHome.css"; // Reuse dashboard styles for consistency

export default function PostsPage() {
    const { clanId } = useParams();
    const navigate = useNavigate();
    const [clans, setClans] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClan, setSelectedClan] = useState(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const res = await getAdminClans();
                setClans(res.clans || []);
                
                if (clanId) {
                    const clan = res.clans.find(c => c.id === Number(clanId));
                    setSelectedClan(clan);
                    const postsRes = await getAdminPostsByClan(clanId);
                    setPosts(postsRes.posts || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [clanId]);

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu...</p></div>;

    // View 1: List of Clans
    if (!clanId) {
        return (
            <div className="premium-dashboard">
                <header className="dashboard-header">
                    <div className="welcome-text">
                        <h1>Quản lý bài viết</h1>
                        <p>Chọn một dòng họ để xem và quản lý bài viết chi tiết.</p>
                    </div>
                </header>

                <section className="clans-overview card-glass">
                    <div className="table-responsive">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Dòng họ</th>
                                    <th>Số lượng bài viết</th>
                                    <th>Chủ sở hữu</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clans.map(clan => (
                                    <tr key={clan.id}>
                                        <td>
                                            <div className="clan-name-cell">
                                                <span className="material-symbols-outlined">auto_stories</span>
                                                <strong>{clan.clan_name}</strong>
                                            </div>
                                        </td>
                                        <td>{clan.post_count || 0} bài viết</td>
                                        <td>{clan.owner_name || "Chưa có"}</td>
                                        <td>
                                            <button 
                                                className="btn-outline-sm"
                                                onClick={() => navigate(`/dashboard/posts/${clan.id}`)}
                                            >
                                                Xem bài viết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        );
    }

    // View 2: Posts for selected clan
    return (
        <div className="premium-dashboard">
            <header className="dashboard-header">
                <div className="welcome-text">
                    <nav className="breadcrumb">
                        <Link to="/dashboard">Admin</Link>
                        <span className="material-symbols-outlined">chevron_right</span>
                        <Link to="/dashboard/posts">Quản lý bài viết</Link>
                        <span className="material-symbols-outlined">chevron_right</span>
                        <span className="active">{selectedClan?.clan_name || "Chi tiết"}</span>
                    </nav>
                    <h1>Bài viết: {selectedClan?.clan_name}</h1>
                </div>
            </header>

            <section className="posts-list card-glass">
                <div className="table-responsive">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Người đăng</th>
                                <th>Nội dung</th>
                                <th>Ngày đăng</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>Dòng họ này chưa có bài viết nào.</td></tr>
                            ) : (
                                posts.map(post => (
                                    <tr key={post.id}>
                                        <td><strong>{post.author_name || "Ẩn danh"}</strong></td>
                                        <td>
                                            <div className="post-content-preview">
                                                {post.content || post.description || "Không có nội dung"}
                                                {post.image_url && <span className="image-badge">Có ảnh</span>}
                                            </div>
                                        </td>
                                        <td>{new Date(post.created_at).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <span className={`status-badge ${post.status}`}>
                                                {post.status === 'approved' ? 'Đã duyệt' : post.status === 'pending' ? 'Chờ duyệt' : 'Đã ẩn'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-group">
                                                <button className="btn-icon" title="Duyệt"><span className="material-symbols-outlined">check_circle</span></button>
                                                <button className="btn-icon" title="Ẩn"><span className="material-symbols-outlined">visibility_off</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; }
                .breadcrumb a { color: var(--text-muted); text-decoration: none; }
                .breadcrumb .active { color: #7f1d1d; font-weight: 600; }
                .breadcrumb .material-symbols-outlined { font-size: 1rem; }
                .status-badge { padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
                .status-badge.approved { background: #dcfce7; color: #166534; }
                .status-badge.pending { background: #fef9c3; color: #854d0e; }
                .status-badge.rejected { background: #fee2e2; color: #991b1b; }
                .image-badge { margin-left: 0.5rem; font-size: 0.7rem; background: #f3f4f6; padding: 0.1rem 0.4rem; border-radius: 4px; color: var(--text-muted); }
                .action-group { display: flex; gap: 0.5rem; }
                .btn-icon { background: transparent; border: none; cursor: pointer; color: var(--text-muted); }
                .btn-icon:hover { color: #7f1d1d; }
            `}} />
        </div>
    );
}
