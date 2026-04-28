import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAdminClans, getAdminPostsByClan } from "../../api/adminService";
import "./PostsPage.css";

export default function PostsPage() {
    const { clanId } = useParams();
    const navigate = useNavigate();
    const [clans, setClans] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchClans = async () => {
            try {
                const res = await getAdminClans();
                setClans(res.clans || []);
            } catch (err) {
                setError(err.message);
            } finally {
                if (!clanId) setLoading(false);
            }
        };
        fetchClans();
    }, [clanId]);

    useEffect(() => {
        if (clanId) {
            const fetchPosts = async () => {
                setLoading(true);
                try {
                    const res = await getAdminPostsByClan(clanId);
                    setPosts(res.posts || []);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchPosts();
        }
    }, [clanId]);

    const selectedClan = clans.find(c => String(c.id) === String(clanId));

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu...</p></div>;

    return (
        <div className="posts-management-page">
            <header className="page-header">
                <div className="breadcrumb-nav">
                    <Link to="/dashboard">Tổng quan</Link>
                    <span className="separator">/</span>
                    <Link to="/dashboard/posts" className={!clanId ? "active" : ""}>Quản lý bài viết</Link>
                    {clanId && (
                        <>
                            <span className="separator">/</span>
                            <span className="active">{selectedClan?.clan_name || `Clan #${clanId}`}</span>
                        </>
                    )}
                </div>
                <h1>{clanId ? `Bài viết dòng họ ${selectedClan?.clan_name}` : "Chọn dòng họ để quản lý"}</h1>
            </header>

            {!clanId ? (
                <div className="clan-folder-grid">
                    {clans.map(clan => (
                        <div key={clan.id} className="clan-folder-card" onClick={() => navigate(`/dashboard/posts/clan/${clan.id}`)}>
                            <div className="folder-icon">
                                <span className="material-symbols-outlined">folder_shared</span>
                                <span className="count-badge">{clan.post_count}</span>
                            </div>
                            <div className="folder-info">
                                <h3>{clan.clan_name}</h3>
                                <p>{clan.owner_name || "Chưa có chủ quản"}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="posts-list-container card-glass">
                    {posts.length === 0 ? (
                        <div className="empty-state">
                            <span className="material-symbols-outlined">article</span>
                            <p>Dòng họ này chưa có bài viết nào.</p>
                            <Link to="/dashboard/posts" className="btn-secondary">Quay lại danh sách</Link>
                        </div>
                    ) : (
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
                                {posts.map(post => (
                                    <tr key={post.id}>
                                        <td>
                                            <div className="author-cell">
                                                <div className="author-avatar">{post.author_name?.charAt(0) || "U"}</div>
                                                <span>{post.author_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="post-preview">
                                                <p>{post.content?.substring(0, 100)}{post.content?.length > 100 ? "..." : ""}</p>
                                                {post.image_url && <span className="has-image"><span className="material-symbols-outlined">image</span></span>}
                                            </div>
                                        </td>
                                        <td>{new Date(post.created_at).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <span className={`status-badge ${post.status}`}>
                                                {post.status === 'approved' ? 'Đã duyệt' : post.status === 'pending' ? 'Chờ duyệt' : 'Đã ẩn'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="icon-btn-check" title="Duyệt"><span className="material-symbols-outlined">check_circle</span></button>
                                                <button className="icon-btn-hide" title="Ẩn"><span className="material-symbols-outlined">visibility_off</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
