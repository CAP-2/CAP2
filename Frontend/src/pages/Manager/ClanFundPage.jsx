import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../../services/api";
import { resolveImageUrl } from "../../utils/media";
import "../FundDesign.css";
import FundAnalytics from "./FundAnalytics";

export default function ClanFundPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [members, setMembers] = useState([]);
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
    type: "income", amount: "", note: "", method: "Tiền mặt", 
    date: new Date().toISOString().split('T')[0], category: "Khác",
    person_id: "", campaign_id: ""
  });

  const [approvalData, setApprovalData] = useState({ transaction_id: null, status: 'approved', manager_note: '', evidence_media_id: null, person_name: '', amount: 0 });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [campData, txData, memData] = await Promise.all([
        apiRequest("/api/manager/fund/campaigns"),
        apiRequest("/api/manager/fund/transactions"),
        apiRequest("/api/manager/members")
      ]);
      setCampaigns(campData.campaigns);
      setTransactions(txData.transactions);
      setMembers(memData.members || []);
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

  const handleQRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append("image", file);
    uploadData.append("usage_type", "other");

    try {
      const res = await apiRequest("/api/upload", {
        method: "POST",
        body: uploadData,
        headers: {}
      });
      setFormData(prev => ({ ...prev, qr_code_media_id: res.mediaId }));
    } catch (error) {
      alert("Lỗi khi tải mã QR lên");
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
      await apiRequest(endpoint, { 
        method: "POST", 
        body: JSON.stringify({
          ...generalTx,
          person_id: generalTx.person_id || null,
          campaign_id: generalTx.campaign_id || null
        }) 
      });
      setShowGeneralForm(false);
      setGeneralTx({ 
        type: "income", amount: "", note: "", method: "Tiền mặt", 
        date: new Date().toISOString().split('T')[0], category: "Khác",
        person_id: "", campaign_id: ""
      });
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
                {transactions.slice(0, 15).map(tx => (
                  <tr key={`${tx.type}-${tx.id}`}>
                    <td>
                      <div className="tx-name">{tx.note || 'Chi chung'}</div>
                      <div className="tx-date">
                        {tx.person_name && <span className="tx-person-pill">{tx.person_name}</span>}
                        {new Date(tx.date).toLocaleDateString('vi-VN')}
                      </div>
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
          <div className="modal-glass fund-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3>Tạo </h3>
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
                
                <h4 className="sub-title-v3">Thông tin nhận tiền</h4>
                <div className="form-row-2">
                   <div className="form-group"><label>Ngân hàng</label><input type="text" placeholder="Vietcombank" onChange={e => setFormData({...formData, bank_name: e.target.value})} /></div>
                   <div className="form-group"><label>Số tài khoản</label><input type="text" placeholder="10293..." onChange={e => setFormData({...formData, bank_account: e.target.value})} /></div>
                </div>
                <div className="form-row-2">
                   <div className="form-group"><label>Chủ tài khoản</label><input type="text" placeholder="NGUYEN VAN A" onChange={e => setFormData({...formData, bank_owner: e.target.value})} /></div>
                   <div className="form-group">
                     <label>Tải lên Mã QR</label>
                     <div className="upload-box-v2">
                        <input type="file" hidden id="qr-upload" onChange={handleQRUpload} />
                        <label htmlFor="qr-upload" className="upload-label-v3">
                           <span className="material-symbols-outlined">qr_code_2</span>
                           {formData.qr_code_media_id ? "Đã có QR" : "Chọn ảnh QR"}
                        </label>
                     </div>
                   </div>
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
                {selectedCampaign.campaign.qr_code_media_id && (
                  <div className="mgmt-item">
                    <label>QR Nhận tiền</label>
                    <div className="mini-qr">
                       <img src={resolveImageUrl({mediaId: selectedCampaign.campaign.qr_code_media_id})} alt="QR" onClick={() => window.open(resolveImageUrl({mediaId: selectedCampaign.campaign.qr_code_media_id}), '_blank')} />
                    </div>
                  </div>
                )}
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

      {/* Modal 3: General Tx (Manual Cash Payment) */}
      {showGeneralForm && (
        <div className="fund-modal-v2" onClick={() => setShowGeneralForm(false)}>
           <div className="modal-glass" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
             <div className="modal-header-v2"><h3>Ghi nhận Thu/Chi</h3><button onClick={() => setShowGeneralForm(false)} className="close-btn">&times;</button></div>
             <div className="modal-body-v2">
                <form onSubmit={handleGeneralTx} className="premium-form">
                   <div className="form-group"><label>Loại giao dịch</label>
                      <div className="radio-toggle">
                        <label className={generalTx.type === 'income' ? 'active' : ''}><input type="radio" value="income" checked={generalTx.type === 'income'} onChange={e => setGeneralTx({...generalTx, type: e.target.value})} /> Thu vào</label>
                        <label className={generalTx.type === 'expense' ? 'active' : ''}><input type="radio" value="expense" checked={generalTx.type === 'expense'} onChange={e => setGeneralTx({...generalTx, type: e.target.value})} /> Chi ra</label>
                      </div>
                   </div>
                   
                   <div className="form-group">
                     <label>Đợt thu (tùy chọn)</label>
                     <select value={generalTx.campaign_id} onChange={e => setGeneralTx({...generalTx, campaign_id: e.target.value})}>
                       <option value="">-- Không thuộc đợt nào --</option>
                       {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
                     </select>
                   </div>

                   {generalTx.type === 'income' && (
                     <div className="form-group">
                       <label>Người nộp (Thành viên họ)</label>
                       <select required value={generalTx.person_id} onChange={e => setGeneralTx({...generalTx, person_id: e.target.value})}>
                         <option value="">-- Chọn thành viên --</option>
                         {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                       </select>
                     </div>
                   )}

                   <div className="form-row-2">
                     <div className="form-group"><label>Số tiền</label><input type="number" required value={generalTx.amount} onChange={e => setGeneralTx({...generalTx, amount: e.target.value})} /></div>
                     <div className="form-group"><label>Ngày</label><input type="date" required value={generalTx.date} onChange={e => setGeneralTx({...generalTx, date: e.target.value})} /></div>
                   </div>

                   <div className="form-group"><label>Nội dung / Ghi chú</label><textarea required value={generalTx.note} onChange={e => setGeneralTx({...generalTx, note: e.target.value})} rows="2" placeholder="Ví dụ: Đóng quỹ khuyến học bằng tiền mặt..."></textarea></div>
                   
                   <button type="submit" className="btn-premium btn-green" style={{width: '100%', marginTop: '1rem'}} disabled={submitting}>
                     Lưu Giao Dịch
                   </button>
                </form>
             </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .premium-header { margin-bottom: 2rem; }
        .header-actions { display: flex; gap: 0.9rem; flex-wrap: wrap; justify-content: flex-end; }
        .fund-main-grid { margin-top: 2rem; }
        .campaign-grid-v3 { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
        .ledger-box { min-height: 100%; }
        .fund-table-v3 td strong { color: var(--fund-text); }
        .approval-info { margin-bottom: 1.25rem; }
        .ledger-table-wrapper { max-height: 420px; overflow-y: auto; padding-right: 0.25rem; }
        .bill-img-v3 { display: block; margin: 0 auto; }
      `}} />
    </div>
  );
}
