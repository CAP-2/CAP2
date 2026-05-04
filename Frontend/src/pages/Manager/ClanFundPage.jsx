import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../../services/api";
import { resolveImageUrl } from "../../utils/media";
import "../FundDesign.css";
import FundAnalytics from "./FundAnalytics";

export default function ClanFundPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showGeneralForm, setShowGeneralForm] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "", description: "", year: new Date().getFullYear(),
    amount_per_dinh: "", deadline: "", dinh_definition: "males_only",
    bank_name: "", bank_account: "", bank_owner: "", qr_code_media_id: null
  });

  const [generalTx, setGeneralTx] = useState({
    type: "income", amount: "", note: "", method: "Tiền mặt", date: new Date().toISOString().split('T')[0], category: "Khác"
  });

  const [approvalData, setApprovalData] = useState({ transaction_id: null, status: 'approved', manager_note: '', evidence_media_id: null, person_name: '', amount: 0 });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const campData = await apiRequest("/api/manager/fund/campaigns");
      setCampaigns(campData.campaigns);
      const txData = await apiRequest("/api/manager/fund/transactions");
      setTransactions(txData.transactions);
    } catch (error) {
      console.error("Error loading fund data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportExcel = (campaignId = null) => {
    const url = campaignId 
      ? `${import.meta.env.VITE_API_URL || ""}/api/manager/fund/export?campaign_id=${campaignId}`
      : `${import.meta.env.VITE_API_URL || ""}/api/manager/fund/export?year=${new Date().getFullYear()}`;
    window.open(url, "_blank");
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await apiRequest("/api/manager/fund/import", { method: "POST", body: formData, headers: {} });
      alert("Nhập dữ liệu thành công!");
      loadData();
    } catch (error) {
      alert("Lỗi khi nhập Excel: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest("/api/manager/fund/campaigns", { method: "POST", body: JSON.stringify(formData) });
      setShowCampaignModal(false);
      loadData();
    } catch (error) {
      alert(error.message || "Lỗi khi tạo đợt thu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCampaign = async (campaignId, updates) => {
    try {
      await apiRequest(`/api/manager/fund/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      if (selectedCampaign) {
        const data = await apiRequest(`/api/manager/fund/campaigns/${campaignId}`);
        setSelectedCampaign(data);
      }
      loadData();
    } catch (error) {
      alert("Lỗi khi cập nhật đợt thu");
    }
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest("/api/manager/fund/approve", {
        method: "POST",
        body: JSON.stringify({
          transaction_id: approvalData.transaction_id,
          status: approvalData.status,
          manager_note: approvalData.manager_note
        })
      });
      setShowApprovalModal(false);
      if (selectedCampaign) {
        const data = await apiRequest(`/api/manager/fund/campaigns/${selectedCampaign.campaign.id}`);
        setSelectedCampaign(data);
      }
      loadData();
    } catch (error) {
      alert("Lỗi khi duyệt giao dịch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneralTx = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = generalTx.type === "income" ? "/api/manager/fund/income" : "/api/manager/fund/expense";
      await apiRequest(endpoint, { method: "POST", body: JSON.stringify(generalTx) });
      setShowGeneralForm(false);
      setGeneralTx({ type: "income", amount: "", note: "", method: "Tiền mặt", date: new Date().toISOString().split('T')[0], category: "Khác" });
      loadData();
    } catch (error) {
      alert(error.message || "Lỗi khi ghi nhận giao dịch");
    } finally {
      setSubmitting(false);
    }
  };

  const openCampaignLedger = async (campaign) => {
    try {
      const data = await apiRequest(`/api/manager/fund/campaigns/${campaign.id}`);
      setSelectedCampaign(data);
      setShowLedgerModal(true);
    } catch (error) {
      alert("Không thể tải chi tiết đợt thu");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="fund-container glass-bg">
      {/* Header Section */}
      <header className="glass-card premium-header">
        <div className="header-info">
          <h1>Hệ thống Quản trị Quỹ</h1>
          <p>Tối ưu hóa dòng tiền và quản lý chiến dịch minh bạch</p>
        </div>
        <div className="header-actions">
          <label className="btn-premium btn-outline">
            <span className="material-symbols-outlined">upload_file</span>
            {importing ? "Đang xử lý..." : "Nhập Excel"}
            <input type="file" hidden accept=".xlsx,.xls" onChange={handleImportExcel} disabled={importing} />
          </label>
          <button className="btn-premium btn-outline" onClick={() => handleExportExcel()}>
            <span className="material-symbols-outlined">download</span> Báo Cáo Năm
          </button>
          <button className="btn-premium btn-gold" onClick={() => setShowGeneralForm(true)}>
            <span className="material-symbols-outlined">payments</span> Thu Chi Mặt
          </button>
          <button className="btn-premium btn-green" onClick={() => setShowCampaignModal(true)}>
            <span className="material-symbols-outlined">add_circle</span> Đợt Thu Mới
          </button>
        </div>
      </header>

      <FundAnalytics />

      <div className="fund-main-grid">
        {/* Campaigns Grid */}
        <section>
          <h3 className="section-title">Danh Sách Đợt Thu</h3>
          <div className="campaign-grid-v3">
            {campaigns.map(c => (
              <div key={c.id} className="glass-card campaign-card-v3" onClick={() => openCampaignLedger(c)}>
                <div className="card-top">
                  <span className="year-pill">{c.year}</span>
                  <span className={`status-dot ${c.status}`}></span>
                </div>
                <h4>{c.name}</h4>
                <div className="progress-container-v3">
                  <div className="progress-bar-v3" style={{width: `${Math.min((c.collected_amount / (c.target_amount || 1)) * 100, 100)}%`}}></div>
                </div>
                <div className="card-bottom">
                  <span>{formatCurrency(c.collected_amount)}</span>
                  <span className="target-text">/ {formatCurrency(c.target_amount)}</span>
                </div>
                <div className="completion-rate">{((c.collected_amount / (c.target_amount || 1)) * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transaction Ledger */}
        <section>
          <h3 className="section-title">Nhật Ký Dòng Tiền</h3>
          <div className="glass-card ledger-box">
            <table className="fund-table-v3">
              <thead><tr><th>Giao dịch</th><th>Số tiền</th><th>Loại</th></tr></thead>
              <tbody>
                {transactions.slice(0, 10).map(tx => (
                  <tr key={`${tx.type}-${tx.id}`}>
                    <td>
                      <div className="tx-name">{tx.note || 'Chi chung'}</div>
                      <div className="tx-date">{new Date(tx.date).toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className={`tx-val ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                    <td><span className={`method-pill`}>{tx.method}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* MODALS */}

      {/* Modal 1: Create Campaign */}
      {showCampaignModal && (
        <div className="fund-modal-v2" onClick={() => setShowCampaignModal(false)}>
          <div className="modal-glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3>Tạo Đợt Thu Mới</h3>
              <button onClick={() => setShowCampaignModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body-v2">
              <form onSubmit={handleCreateCampaign} className="premium-form">
                <div className="form-row-2">
                  <div className="form-group"><label>Tên chiến dịch</label><input type="text" required placeholder="VD: Quỹ Khuyến Học 2026" onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="form-group"><label>Năm</label><input type="number" required value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} /></div>
                </div>
                <div className="form-row-2">
                  <div className="form-group"><label>Số tiền / Đinh</label><input type="number" required placeholder="50000" onChange={e => setFormData({...formData, amount_per_dinh: e.target.value})} /></div>
                  <div className="form-group"><label>Hạn đóng</label><input type="date" required onChange={e => setFormData({...formData, deadline: e.target.value})} /></div>
                </div>
                <div className="form-group">
                  <label>Định nghĩa "Đinh"</label>
                  <select onChange={e => setFormData({...formData, dinh_definition: e.target.value})}>
                    <option value="males_only">Chỉ nam giới (theo truyền thống)</option>
                    <option value="adults_all">Tất cả người trưởng thành (trên 18 tuổi)</option>
                    <option value="per_family">Tính theo từng hộ gia đình</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowCampaignModal(false)} className="btn-premium btn-outline">Hủy</button>
                  <button type="submit" className="btn-premium btn-green" disabled={submitting}>Tạo Chiến Dịch</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Campaign Ledger & Management */}
      {showLedgerModal && selectedCampaign && (
        <div className="fund-modal-v2" onClick={() => setShowLedgerModal(false)}>
          <div className="modal-glass ledger-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3>Quản lý: {selectedCampaign.campaign.name}</h3>
              <div className="header-actions-v2">
                <button className="btn-export-v2" onClick={() => handleExportExcel(selectedCampaign.campaign.id)}>Xuất Excel Đợt Thu</button>
                <button onClick={() => setShowLedgerModal(false)} className="close-btn">&times;</button>
              </div>
            </div>
            <div className="modal-body-v2">
              {/* Management Toolbar */}
              <div className="mgmt-toolbar glass-card">
                <div className="mgmt-item">
                  <label>Trạng thái</label>
                  <select 
                    value={selectedCampaign.campaign.status} 
                    onChange={(e) => handleUpdateCampaign(selectedCampaign.campaign.id, { status: e.target.value })}
                  >
                    <option value="open">Đang mở (Nhận đóng góp)</option>
                    <option value="closed">Đã đóng (Khóa chiến dịch)</option>
                  </select>
                </div>
                <div className="mgmt-item">
                  <label>Mức đóng hiện tại</label>
                  <div className="input-with-btn">
                    <input 
                      type="number" 
                      defaultValue={selectedCampaign.campaign.amount_per_dinh} 
                      onBlur={(e) => handleUpdateCampaign(selectedCampaign.campaign.id, { amount_per_dinh: e.target.value })}
                    />
                    <span>VNĐ / Đinh</span>
                  </div>
                </div>
              </div>

              <div className="ledger-stats-v3">
                <div className="l-stat"><span>Đã nộp</span><strong>{selectedCampaign.stats.paid_count}</strong></div>
                <div className="l-stat"><span>Tổng thu</span><strong>{formatCurrency(selectedCampaign.stats.collected_amount)}</strong></div>
                <div className="l-stat"><span>Hoàn thành</span><strong>{selectedCampaign.stats.completion_rate.toFixed(1)}%</strong></div>
              </div>

              <div className="ledger-table-wrapper">
                <table className="fund-table-v3">
                  <thead><tr><th>Người nộp</th><th>Ngày</th><th>Số tiền</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {selectedCampaign.transactions.map(tx => (
                      <tr key={tx.id}>
                        <td><strong>{tx.person_name}</strong></td>
                        <td>{new Date(tx.contribution_date).toLocaleDateString('vi-VN')}</td>
                        <td>{formatCurrency(tx.amount)}</td>
                        <td>
                          {tx.status === 'pending' ? (
                            <button 
                              onClick={() => { 
                                setApprovalData({ 
                                  transaction_id: tx.id, 
                                  status: 'approved', 
                                  manager_note: '', 
                                  evidence_media_id: tx.evidence_media_id,
                                  person_name: tx.person_name,
                                  amount: tx.amount
                                }); 
                                setShowApprovalModal(true); 
                              }} 
                              className="btn-approve-v3-active"
                            >
                              Duyệt ngay
                            </button>
                          ) : <span className="done-pill">Đã xong</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Approval & Evidence View */}
      {showApprovalModal && (
        <div className="fund-modal-v2" onClick={() => setShowApprovalModal(false)}>
          <div className="modal-glass" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3>Phê duyệt đóng góp</h3>
              <button onClick={() => setShowApprovalModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body-v2">
              <div className="approval-info glass-card">
                <div className="info-row"><span>Thành viên:</span> <strong>{approvalData.person_name}</strong></div>
                <div className="info-row"><span>Số tiền:</span> <strong style={{color: '#2ecc71'}}>{formatCurrency(approvalData.amount)}</strong></div>
              </div>

              {approvalData.evidence_media_id && (
                <div className="evidence-view">
                  <label>Ảnh xác nhận (Bill)</label>
                  <img src={resolveImageUrl({mediaId: approvalData.evidence_media_id})} alt="Evidence" className="bill-img-v3" />
                </div>
              )}

              <form onSubmit={handleApprove} className="premium-form">
                <div className="form-group">
                  <label>Ghi chú (không bắt buộc)</label>
                  <textarea value={approvalData.manager_note} onChange={e => setApprovalData({...approvalData, manager_note: e.target.value})} rows="2" placeholder="Ví dụ: Đã nhận đủ tiền mặt..."></textarea>
                </div>
                <div className="modal-footer" style={{display: 'flex', gap: '1rem'}}>
                  <button type="button" onClick={() => setShowApprovalModal(false)} className="btn-premium btn-outline">Để sau</button>
                  <button type="submit" className="btn-premium btn-green" style={{flex: 1}} disabled={submitting}>Xác nhận & Duyệt</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: General Tx */}
      {showGeneralForm && (
        <div className="fund-modal-v2" onClick={() => setShowGeneralForm(false)}>
           <div className="modal-glass" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
             <div className="modal-header-v2"><h3>Ghi nhận Thu/Chi</h3><button onClick={() => setShowGeneralForm(false)} className="close-btn">&times;</button></div>
             <div className="modal-body-v2">
                <form onSubmit={handleGeneralTx} className="premium-form">
                   <div className="form-group"><label>Loại</label>
                      <div className="radio-toggle">
                        <label className={generalTx.type === 'income' ? 'active' : ''}><input type="radio" value="income" checked={generalTx.type === 'income'} onChange={e => setGeneralTx({...generalTx, type: e.target.value})} /> Thu vào</label>
                        <label className={generalTx.type === 'expense' ? 'active' : ''}><input type="radio" value="expense" checked={generalTx.type === 'expense'} onChange={e => setGeneralTx({...generalTx, type: e.target.value})} /> Chi ra</label>
                      </div>
                   </div>
                   <div className="form-group"><label>Số tiền</label><input type="number" required value={generalTx.amount} onChange={e => setGeneralTx({...generalTx, amount: e.target.value})} /></div>
                   <div className="form-group"><label>Nội dung</label><textarea required value={generalTx.note} onChange={e => setGeneralTx({...generalTx, note: e.target.value})} rows="3"></textarea></div>
                   <button type="submit" className="btn-premium btn-green" style={{width: '100%', marginTop: '1rem'}}>Lưu Giao Dịch</button>
                </form>
             </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-bg { background: rgba(0, 0, 0, 0.2); }
        .premium-header { display: flex; justify-content: space-between; align-items: center; padding: 2rem; margin-bottom: 2rem; border-bottom: 2px solid rgba(255, 255, 255, 0.1); }
        .header-info h1 { font-size: 2.4rem; color: #fff; margin: 0; }
        .header-info p { color: rgba(255, 255, 255, 0.6); }
        .section-title { color: #fff; opacity: 0.9; }
        .header-actions { display: flex; gap: 1rem; }
        .fund-main-grid { display: grid; grid-template-columns: 1fr 450px; gap: 2.5rem; margin-top: 3rem; }
        .campaign-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .campaign-card-v3 { padding: 1.5rem; position: relative; border-left: 6px solid var(--fund-gold); background: rgba(255, 255, 255, 0.03); cursor: pointer; transition: 0.3s; }
        .campaign-card-v3:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-5px); }
        .card-top { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .year-pill { background: rgba(255, 255, 255, 0.1); color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; }
        .status-dot.open { background: #2ecc71; box-shadow: 0 0 10px #2ecc71; }
        .status-dot.closed { background: #95a5a6; }
        .progress-container-v3 { height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin: 1rem 0; overflow: hidden; }
        .progress-bar-v3 { height: 100%; background: linear-gradient(90deg, var(--fund-gold), var(--fund-green)); border-radius: 4px; }
        .card-bottom { display: flex; justify-content: space-between; font-weight: bold; color: #fff; }
        .target-text { opacity: 0.5; font-size: 0.8rem; }
        .completion-rate { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 1.2rem; font-weight: 800; color: var(--fund-gold); }
        .ledger-box { background: rgba(255, 255, 255, 0.02); }
        .fund-table-v3 { width: 100%; border-collapse: collapse; }
        .fund-table-v3 th { text-align: left; padding: 1rem; color: rgba(255, 255, 255, 0.5); font-size: 0.8rem; text-transform: uppercase; }
        .fund-table-v3 td { padding: 1.2rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .tx-name { font-weight: 600; color: #fff; }
        .tx-date { font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); }
        .tx-val.income { color: #2ecc71; }
        .tx-val.expense { color: #ff7675; }
        .method-pill { font-size: 0.7rem; background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px; color: rgba(255, 255, 255, 0.6); }
        .close-btn { background: none; border: none; color: #fff; font-size: 2.2rem; cursor: pointer; opacity: 0.5; transition: 0.3s; }
        .close-btn:hover { opacity: 1; transform: rotate(90deg); }
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .premium-form .form-group { margin-bottom: 1.2rem; }
        .premium-form label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); }
        .premium-form input, .premium-form select, .premium-form textarea { width: 100%; padding: 0.8rem; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; outline: none; background: rgba(0, 0, 0, 0.2); color: #fff; }
        .premium-form input:focus { border-color: var(--fund-gold); background: rgba(0, 0, 0, 0.4); }
        .mgmt-toolbar { display: flex; gap: 2rem; padding: 1.2rem; margin-bottom: 2rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); }
        .mgmt-item label { display: block; font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 0.4rem; }
        .input-with-btn { display: flex; align-items: center; gap: 0.5rem; }
        .input-with-btn input { width: 120px; padding: 0.4rem; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; }
        .ledger-stats-v3 { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .l-stat { flex: 1; background: rgba(255, 255, 255, 0.03); padding: 1.2rem; border-radius: 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05); }
        .l-stat span { display: block; font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); text-transform: uppercase; }
        .l-stat strong { font-size: 1.3rem; color: #2ecc71; }
        .radio-toggle { display: flex; background: rgba(0, 0, 0, 0.2); padding: 4px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); }
        .radio-toggle label { flex: 1; text-align: center; padding: 0.6rem; cursor: pointer; border-radius: 8px; margin: 0; color: rgba(255, 255, 255, 0.5); }
        .radio-toggle label.active { background: rgba(255, 255, 255, 0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.2); color: #fff; }
        .radio-toggle input { display: none; }
        .btn-export-v2 { background: var(--fund-blue); color: white; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.3s; }
        .btn-export-v2:hover { background: #2980b9; transform: translateY(-2px); }
        .btn-approve-v3-active { background: #2ecc71; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.3); }
        .btn-approve-v3-active:hover { transform: scale(1.05); background: #27ae60; }
        .done-pill { font-size: 0.8rem; color: #2ecc71; background: rgba(46, 204, 113, 0.1); padding: 2px 8px; border-radius: 4px; }
        .approval-info { padding: 1.2rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.05); }
        .approval-info .info-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .approval-info .info-row span { color: rgba(255,255,255,0.5); }
        .evidence-view { margin-bottom: 2rem; text-align: center; }
        .evidence-view label { display: block; text-align: left; margin-bottom: 1rem; font-weight: bold; color: rgba(255,255,255,0.7); }
        .bill-img-v3 { max-width: 100%; border-radius: 12px; border: 4px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .modal-header-v2 h3 { margin: 0; color: #fff; }
        .ledger-modal { max-width: 900px; width: 95%; }
        .ledger-table-wrapper { max-height: 400px; overflow-y: auto; padding-right: 10px; }
        .ledger-table-wrapper::-webkit-scrollbar { width: 6px; }
        .ledger-table-wrapper::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}
