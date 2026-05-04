import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function FundAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiRequest("/api/manager/fund/stats");
        setStats(data);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(val);

  if (loading || !stats) return <div style={{textAlign: 'center', padding: '2rem'}}>Đang tải phân tích dữ liệu...</div>;

  const yearlyData = stats.yearly.income.map(i => {
    const exp = stats.yearly.expense.find(e => e.year === i.year);
    return {
      year: i.year,
      income: i.total,
      expense: exp ? exp.total : 0
    };
  });

  const curYear = new Date().getFullYear();
  const prevYear = curYear - 1;
  const categories = [...new Set(stats.categories.map(c => c.category))];
  const categoryData = categories.map(cat => ({
    name: cat,
    current: stats.categories.find(c => c.category === cat && c.year === curYear)?.total || 0,
    previous: stats.categories.find(c => c.category === cat && c.year === prevYear)?.total || 0
  }));

  return (
    <div className="fund-analytics-v5">
      <div className="stats-header" style={{marginBottom: '2rem'}}>
        <h2 className="section-title">Thống Kê & Phân Tích</h2>
      </div>

      <div className="charts-container-v5">
        <div className="glass-card chart-box">
          <h3>Tăng trưởng Quỹ theo Năm</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                  formatter={(v) => formatCurrency(v)} 
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Thu vào" fill="#2c5f2d" radius={[6, 6, 0, 0]} barSize={40} />
                <Bar dataKey="expense" name="Chi ra" fill="#e74c3c" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card chart-box">
          <h3>Hạng mục Chi ({prevYear} vs {curYear})</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 12}} width={100} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                  formatter={(v) => formatCurrency(v)} 
                />
                <Legend iconType="circle" />
                <Bar dataKey="previous" name={`Năm ${prevYear}`} fill="#c99a2c" radius={[0, 6, 6, 0]} barSize={25} />
                <Bar dataKey="current" name={`Năm ${curYear}`} fill="#2c5f2d" radius={[0, 6, 6, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .charts-container-v5 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .chart-box h3 { font-size: 1.1rem; color: #444; margin-bottom: 2rem; text-align: center; font-weight: 600; }
        @media (max-width: 1100px) { .charts-container-v5 { grid-template-columns: 1fr; } }
      `}} />
    </div>
  );
}
