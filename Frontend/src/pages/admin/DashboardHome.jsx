import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminDashboardStats, getAdminClans } from "../../api/adminService";
import "./DashboardHome.css";

const periodOptions = [
    { value: "day", label: "Hôm nay", hint: "Dữ liệu trong ngày" },
    { value: "week", label: "Tuần này", hint: "7 ngày gần nhất" },
    { value: "month", label: "Tháng này", hint: "Từ đầu tháng" },
    { value: "all", label: "Từ trước đến nay", hint: "Toàn hệ thống" },
];

const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

const buildMonthlyClanData = (rows = []) => {
    const rowMap = new Map(rows.map((item) => [item.month_key, Number(item.total || 0)]));
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const key = `${date.getFullYear()}-${month}`;
        return { month_key: key, label: `${month}/${date.getFullYear()}`, total: rowMap.get(key) || 0 };
    });
};

function ClanLineChart({ data = [] }) {
    const width = 980;
    const height = 280;
    const padding = { top: 32, right: 34, bottom: 48, left: 46 };
    const points = data.length ? data : [{ label: "", total: 0 }];
    const maxValue = Math.max(1, ...points.map((item) => Number(item.total || 0)));
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const chartPoints = points.map((item, index) => {
        const x = padding.left + (points.length === 1 ? innerWidth / 2 : (index * innerWidth) / (points.length - 1));
        const y = padding.top + innerHeight - (Number(item.total || 0) / maxValue) * innerHeight;
        return { ...item, x, y };
    });

    const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const areaPath = `${path} L ${chartPoints[chartPoints.length - 1].x} ${height - padding.bottom} L ${chartPoints[0].x} ${height - padding.bottom} Z`;
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        y: padding.top + innerHeight - ratio * innerHeight,
        value: Math.round(maxValue * ratio),
    }));

    return (
        <div className="line-chart-wrap">
            <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ dòng họ tạo mới theo tháng">
                <defs>
                    <linearGradient id="clanLineFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#d4af37" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {gridLines.map((line) => (
                    <g key={line.y}>
                        <line x1={padding.left} x2={width - padding.right} y1={line.y} y2={line.y} className="chart-grid-line" />
                        <text x={padding.left - 14} y={line.y + 4} textAnchor="end" className="chart-axis-text">{line.value}</text>
                    </g>
                ))}
                <path d={areaPath} className="chart-area" />
                <path d={path} className="chart-line" />
                {chartPoints.map((point, index) => (
                    <g key={`${point.label}-${index}`} className="chart-point-group">
                        <circle cx={point.x} cy={point.y} r="4" className="chart-point" />
                        <text x={point.x} y={point.y - 12} textAnchor="middle" className="chart-value-text">{point.total}</text>
                        <text x={point.x} y={height - 18} textAnchor="middle" className="chart-axis-text chart-month-text">{point.label}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

export default function DashboardHome() {
    const [data, setData] = useState(null);
    const [clans, setClans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("all");

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError("");
                const [statsRes, clansRes] = await Promise.all([
                    getAdminDashboardStats(period),
                    getAdminClans(period)
                ]);
                setData(statsRes);
                setClans(clansRes.clans || []);
            } catch (err) {
                setError(err.message || "Không tải được dữ liệu dashboard");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period]);

    const activePeriod = useMemo(
        () => periodOptions.find((item) => item.value === period) || periodOptions[periodOptions.length - 1],
        [period]
    );

    if (loading && !data) {
        return <div className="loading-container"><div className="loader"></div><p>Đang tải dữ liệu hệ thống...</p></div>;
    }

    const { stats, monthly_clans = [] } = data || {};
    const monthlyClanChart = buildMonthlyClanData(monthly_clans);

    const statItems = [
        { icon: "manage_accounts", label: "Tài khoản người dùng", value: stats?.total_accounts || 0, color: "var(--primary-gradient)", note: activePeriod.hint },
        { icon: "account_tree", label: "Dòng họ", value: stats?.total_clans || 0, color: "var(--accent-gradient)", note: "Tổng số dòng họ" },
        { icon: "article", label: "Bài viết đã đăng", value: stats?.total_posts || 0, color: "var(--warm-gradient)", note: "Theo bộ lọc hiện tại" },
        { icon: "photo_library", label: "Hình ảnh", value: stats?.total_photos || 0, color: "var(--cool-gradient)", note: "Ảnh trong bài viết" },
    ];

    return (
        <div className="premium-dashboard premium-dashboard-v2">
            <section className="dashboard-hero-panel">
                <div>
                    <span className="eyebrow">Bảng điều khiển quản trị</span>
                    <h1>Tổng quan hệ thống</h1>
                    <p>Theo dõi tài khoản, dòng họ, bài viết và tốc độ tạo mới dòng họ trên toàn hệ thống.</p>
                </div>
                <div className="period-lock-panel" aria-label="Bộ lọc dashboard">
                    <span className="material-symbols-outlined lock-icon">lock</span>
                    <div className="period-tabs">
                        {periodOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className={`period-tab ${period === item.value ? "active" : ""}`}
                                onClick={() => setPeriod(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {error && <div className="dashboard-error">{error}</div>}

            <div className={`stats-grid-premium ${loading ? "is-refreshing" : ""}`}>
                {statItems.map((item, idx) => (
                    <div key={idx} className="stat-card-glass stat-card-v2">
                        <div className="stat-icon-wrap" style={{ background: item.color }}>
                            <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div className="stat-info">
                            <span className="label">{item.label}</span>
                            <h2 className="value">{formatNumber(item.value)}</h2>
                            <span className="trend">{item.note}</span>
                        </div>
                    </div>
                ))}
            </div>

            <section className="clans-overview card-glass dashboard-wide-card">
                <div className="card-header dashboard-card-header">
                    <div>
                        <span className="section-kicker">Dòng họ trong hệ thống</span>
                        <h2>Tổng quan bài viết theo dòng họ</h2>
                    </div>
                    <Link to="/dashboard/genealogy" className="btn-link">Quản lý tất cả</Link>
                </div>
                <div className="premium-table-wrapper">
                    <table className="premium-table clans-table-v2">
                        <thead>
                            <tr>
                                <th>Dòng họ</th>
                                <th>Chủ quản</th>
                                <th>Thành viên</th>
                                <th>Bài viết đã đăng</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clans.map((clan) => (
                                <tr key={clan.id}>
                                    <td className="font-bold">{clan.clan_name}</td>
                                    <td>{clan.owner_name || "Chưa có"}</td>
                                    <td>{formatNumber(clan.member_count)}</td>
                                    <td><span className="post-count-pill">{formatNumber(clan.post_count)} bài viết</span></td>
                                    <td>
                                        <Link to={`/dashboard/posts/clan/${clan.id}`} className="btn-action-small">
                                            Xem bài viết
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!clans.length && (
                                <tr>
                                    <td colSpan="5" className="empty-table-cell">Không có dữ liệu dòng họ cho bộ lọc này.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card-glass chart-card dashboard-wide-card">
                <div className="card-header dashboard-card-header">
                    <div>
                        <span className="section-kicker">Biểu đồ tăng trưởng</span>
                        <h2>Thống kê dòng họ tạo mới theo tháng</h2>
                    </div>
                    <span className="chart-badge">12 tháng gần nhất</span>
                </div>
                <ClanLineChart data={monthlyClanChart} />
            </section>
        </div>
    );
}
