import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAdminClans, getAdminPostsByClan, updateAdminPostStatus, deleteAdminPost } from "../../../api/adminService";
import { formatDateVN } from "../../../shared/utils/dateFormat";
import { resolveImageUrl } from "../../../shared/utils/media";
import "./PostsPage.css";

export default function PostsPage() {
    const { clanId } = useParams();
    const navigate = useNavigate();
    const [clans, setClans] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Cấu hình phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const postsPerPage = 10;

    // Premium Custom Feedback State (Toast & Confirm Modal)
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });
    const [confirmDelete, setConfirmDelete] = useState({ show: false, postId: null });

    // Tự động tắt toast sau 3.5 giây
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

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
                    setCurrentPage(1); // Reset về trang 1 khi đổi clan
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchPosts();
        }
    }, [clanId]);

    const handleUpdateStatus = async (postId, newStatus) => {
        try {
            await updateAdminPostStatus(postId, newStatus);
            setPosts(prevPosts =>
                prevPosts.map(post =>
                    post.id === postId ? { ...post, status: newStatus } : post
                )
            );
            setToast({
                show: true,
                message: `Đã chuyển bài viết sang "${newStatus === 'approved' ? 'Đã duyệt' : 'Đã ẩn'}" thành công!`,
                type: "success"
            });
        } catch (err) {
            setToast({
                show: true,
                message: "Lỗi khi cập nhật bài viết: " + err.message,
                type: "error"
            });
        }
    };

    const confirmAndPerformDelete = async () => {
        const postId = confirmDelete.postId;
        // Đóng confirm trước
        setConfirmDelete({ show: false, postId: null });
        try {
            await deleteAdminPost(postId);
            setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
            
            // Điều chỉnh trang
            const newTotalPosts = posts.length - 1;
            const newMaxPage = Math.ceil(newTotalPosts / postsPerPage) || 1;
            if (currentPage > newMaxPage) {
                setCurrentPage(newMaxPage);
            }
            setToast({
                show: true,
                message: "Đã xóa vĩnh viễn bài viết hoàn tất!",
                type: "success"
            });
        } catch (err) {
            setToast({
                show: true,
                message: "Lỗi khi xóa bài viết: " + err.message,
                type: "error"
            });
        }
    };

    const selectedClan = clans.find(c => String(c.id) === String(clanId));

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu...</p></div>;

    // Tính toán dữ liệu phân trang
    const indexOfLastPost = currentPage * postsPerPage;
    const indexOfFirstPost = indexOfLastPost - postsPerPage;
    const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);
    const totalPages = Math.ceil(posts.length / postsPerPage);

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
                <div className="posts-list-container premium-dark-glass">
                    {posts.length === 0 ? (
                        <div className="empty-state">
                            <span className="material-symbols-outlined">article</span>
                            <p>Dòng họ này chưa có bài viết nào.</p>
                            <Link to="/dashboard/posts" className="btn-secondary">Quay lại danh sách</Link>
                        </div>
                    ) : (
                        <>
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
                                    {currentPosts.map(post => {
                                        const postImageUrl = resolveImageUrl({
                                            image_url: post.image_url,
                                            mediaId: post.image_media_id
                                        });

                                        return (
                                            <tr key={post.id}>
                                                <td>
                                                    <div className="author-cell">
                                                        <div className="author-avatar">{post.author_name?.charAt(0) || "U"}</div>
                                                        <span>{post.author_name || "Ẩn danh"}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="post-preview">
                                                        <p>{post.content?.substring(0, 80)}{post.content?.length > 80 ? "..." : ""}</p>
                                                        
                                                        {postImageUrl && (
                                                            <div className="image-preview-trigger">
                                                                <span className="material-symbols-outlined has-image-icon">image</span>
                                                                <div className="image-hover-popup">
                                                                    <img src={postImageUrl} alt="Preview" loading="lazy" />
                                                                    <div className="popup-caption">Xem trước ảnh</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>{formatDateVN(post.created_at)}</td>
                                                <td>
                                                    <span className={`status-badge ${post.status}`}>
                                                        {post.status === 'approved' ? 'Đã duyệt' : post.status === 'pending' ? 'Chờ duyệt' : 'Đã ẩn'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        {post.status !== 'approved' && (
                                                            <button 
                                                                className="icon-btn-check" 
                                                                title="Duyệt bài viết"
                                                                onClick={() => handleUpdateStatus(post.id, 'approved')}
                                                            >
                                                                <span className="material-symbols-outlined">check_circle</span>
                                                            </button>
                                                        )}
                                                        {post.status !== 'rejected' && (
                                                            <button 
                                                                className="icon-btn-hide" 
                                                                title="Ẩn bài viết"
                                                                onClick={() => handleUpdateStatus(post.id, 'rejected')}
                                                            >
                                                                <span className="material-symbols-outlined">visibility_off</span>
                                                            </button>
                                                        )}
                                                        <button 
                                                            className="icon-btn-delete" 
                                                            title="Xóa vĩnh viễn"
                                                            onClick={() => setConfirmDelete({ show: true, postId: post.id })}
                                                        >
                                                            <span className="material-symbols-outlined">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {totalPages > 1 && (
                                <div className="table-pagination">
                                    <span className="pagination-info">
                                        Hiển thị {indexOfFirstPost + 1} - {Math.min(indexOfLastPost, posts.length)} trong {posts.length} bài
                                    </span>
                                    <div className="pagination-controls">
                                        <button 
                                            disabled={currentPage === 1} 
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            className="page-nav-btn"
                                        >
                                            <span className="material-symbols-outlined">chevron_left</span>
                                        </button>
                                        
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                className={`page-num-btn ${currentPage === page ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(page)}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        <button 
                                            disabled={currentPage === totalPages} 
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            className="page-nav-btn"
                                        >
                                            <span className="material-symbols-outlined">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 🌟 Premium Glass Toast Notification */}
            <div className={`premium-glass-toast ${toast.type} ${toast.show ? "show" : ""}`}>
                <div className="toast-content">
                    <span className="material-symbols-outlined toast-icon">
                        {toast.type === "success" ? "check_circle" : "warning"}
                    </span>
                    <span className="toast-msg">{toast.message}</span>
                </div>
                <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="toast-close">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* 🌟 Premium Glass Confirm Dialog */}
            {confirmDelete.show && (
                <div className="premium-confirm-overlay">
                    <div className="premium-confirm-modal">
                        <div className="modal-glass-effect"></div>
                        <div className="modal-warning-icon">
                            <span className="material-symbols-outlined">warning</span>
                        </div>
                        <h2>Xác nhận xóa bài viết?</h2>
                        <p>Thao tác này sẽ xóa vĩnh viễn nội dung bài viết khỏi hệ thống và KHÔNG THỂ phục hồi lại.</p>
                        <div className="modal-buttons">
                            <button className="modal-btn-cancel" onClick={() => setConfirmDelete({ show: false, postId: null })}>
                                Hủy bỏ
                            </button>
                            <button className="modal-btn-danger" onClick={confirmAndPerformDelete}>
                                Xác nhận Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
