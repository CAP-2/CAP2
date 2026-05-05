import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../../services/api";
import { resolveImageUrl } from "../../utils/media";
import { formatDateVN } from "../../utils/dateFormat";
import "../FundDesign.css";

export default function MemberFundPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showGeneralForm, setShowGeneralForm] = useState(false);
  
  const [formData, setFormData] = useState({ amount: "", note: "", method: "Chuyển khoản", evidence_media_id: null });
  const [generalData, setGeneralData] = useState({ amount: "", note: "", method: "Tiền mặt" });
  
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const campData = await apiRequest("/api/member/fund/campaigns");
      setCampaigns(campData.campaigns);
      const txData = await apiRequest("/api/member/fund/transactions");
      setTransactions(txData.transactions);
    } catch (error) {
      console.error("Error loading member fund data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openPayModal = async (campaign) => {
    try {
      const details = await apiRequest(`/api/member/fund/campaigns/${campaign.id}`);
      setSelectedCampaign(details);
      setFormData({ 
        amount: details.campaign.amount_per_dinh, 
        note: `Đóng góp ${details.campaign.name}`, 
        method: "Chuyển khoản",
        evidence_media_id: null
      });
      setShowPayModal(true);
    } catch (error) {
      alert("Không thể tải chi tiết đợt thu");
    }
  };

  const handleUploadBill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);
    uploadFormData.append("usage_type", "other");

    try {
      const res = await apiRequest("/api/upload", {
        method: "POST",
        body: uploadFormData,
        headers: {}
      });
      setFormData(prev => ({ ...prev, evidence_media_id: res.mediaId }));
    } catch (error) {
      alert("Lỗi khi upload ảnh bill");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest("/api/member/fund/report-payment", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          campaign_id: selectedCampaign.campaign.id
        })
      });
      setSuccessMsg("Gửi báo cáo thành công! Chờ trưởng họ xác nhận.");
      setTimeout(() => {
        setShowPayModal(false);
        setSuccessMsg("");
        loadData();
      }, 2500);
    } catch (error) {
      alert(error.message || "Lỗi khi gửi báo cáo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest("/api/member/fund/income", {
        method: "POST",
        body: JSON.stringify({
          ...generalData,
          date: new Date().toISOString().split('T')[0]
        })
      });
      setSuccessMsg("Đã ghi nhận đóng góp của bạn.");
      setTimeout(() => {
        setShowGeneralForm(false);
        setSuccessMsg("");
        loadData();
      }, 2500);
    } catch (error) {
      alert(error.message || "Lỗi khi gửi báo cáo");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="fund-container glass-bg">
      {/* Hero Header */}
      <header className="glass-card mb-4" style={{textAlign: 'center', background: 'rgba(17, 20, 32, 0.6)'}}>
        <h1 style={{color: '#fff', fontSize: '2.5rem', marginBottom: '0.5rem'}}>Quỹ Dòng Họ</h1>
        <p style={{fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '600px', margin: '0 auto 1.5rem'}}>
          Góp sức xây dựng dòng họ vững mạnh qua các hoạt động đóng góp minh bạch.
        </p>
        <button className="btn-premium btn-gold" onClick={() => setShowGeneralForm(true)}>
          <span className="material-symbols-outlined">volunteer_activism</span> Đóng Góp Tự Nguyện
        </button>
      </header>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', marginTop: '3rem'}}>
        {/* Active Campaigns */}
        <section>
          <h2 className="section-title">Nghĩa Vụ Đóng Góp</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem'}}>
            {campaigns.filter(c => c.status === 'open').map(c => (
              <div key={c.id} className="glass-card campaign-member-v2">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                  <span className="year-pill">{c.year}</span>
                  <span className="deadline-tag" style={{fontSize: '0.8rem', color: '#ff7675', fontWeight: 'bold'}}>
                    Hạn: {formatDateVN(c.deadline)}
                  </span>
                </div>
                <h4 style={{fontSize: '1.3rem', marginBottom: '1rem', color: '#fff'}}>{c.name}</h4>
                <div className="card-info-box">
                  <div className="info-row">
                    <label>Mức đóng (1 đinh)</label>
                    <strong style={{color: '#fff'}}>{formatCurrency(c.amount_per_dinh)}</strong>
                  </div>
                  <div className="info-row">
                    <label>Đối tượng</label>
                    <span style={{color: '#fff'}}>{c.dinh_definition === 'males_only' ? 'Nam giới' : 'Người trưởng thành'}</span>
                  </div>
                </div>
                <button className="btn-premium btn-green" style={{width: '100%', marginTop: '1.5rem'}} onClick={() => openPayModal(c)}>
                  Đóng Quỹ Ngay
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Global Ledger (Transparency) */}
        <section>
          <h2 className="section-title">Minh Bạch Thu Chi</h2>
          <div className="glass-card ledger-box" style={{padding: '1rem', background: 'rgba(17, 20, 32, 0.6)'}}>
            <div className="tx-scroller" style={{maxHeight: '600px', overflowY: 'auto'}}>
              {transactions.map(tx => (
                <div key={`${tx.type}-${tx.id}`} className={`tx-card-v2 ${tx.type}`}>
                  <div className="tx-main">
                    <div className="tx-note">{tx.note || 'Đóng góp dòng họ'}</div>
                    <div className="tx-meta">{formatDateVN(tx.date)} • {tx.method}</div>
                  </div>
                  <div className="tx-amount" style={{textAlign: 'right'}}>
                    <div style={{fontWeight: 'bold', color: tx.type === 'income' ? '#2ecc71' : '#ff7675'}}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                    {tx.status === 'pending' && <span className="pending-label">Đang duyệt</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Payment Modal */}
      {showPayModal && selectedCampaign && (
        <div className="fund-modal-v2" onClick={() => setShowPayModal(false)}>
          <div className="modal-glass" style={{maxWidth: '850px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3>Xác Nhận Đóng Quỹ</h3>
              <button onClick={() => setShowPayModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body-v2">
              {successMsg ? (
                <div className="success-screen">
                  <span className="material-symbols-outlined">check_circle</span>
                  <h3>Cảm ơn bạn!</h3>
                  <p>{successMsg}</p>
                </div>
              ) : (
                <div className="pay-container-v3">
                  {/* Method Switcher */}
                  <div className="method-switcher-v3">
                    <label className={formData.method === 'Chuyển khoản' ? 'active' : ''}>
                       <input type="radio" value="Chuyển khoản" checked={formData.method === 'Chuyển khoản'} onChange={e => setFormData({...formData, method: e.target.value})} />
                       <span className="material-symbols-outlined">account_balance</span> Chuyển khoản
                    </label>
                    <label className={formData.method === 'Tiền mặt' ? 'active' : ''}>
                       <input type="radio" value="Tiền mặt" checked={formData.method === 'Tiền mặt'} onChange={e => setFormData({...formData, method: e.target.value})} />
                       <span className="material-symbols-outlined">payments</span> Tiền mặt
                    </label>
                  </div>

                  <div className="pay-layout-v3">
                    {formData.method === 'Chuyển khoản' ? (
                      <div className="bank-details-v3">
                        <div className="bank-card-v3">
                          <div className="bank-row"><label>Ngân hàng:</label> <span>{selectedCampaign.campaign.bank_name}</span></div>
                          <div className="bank-row"><label>STK:</label> <strong>{selectedCampaign.campaign.bank_account}</strong></div>
                          <div className="bank-row"><label>Chủ TK:</label> <span>{selectedCampaign.campaign.bank_owner}</span></div>
                          <div className="bank-row total-row">
                            <label>Số tiền:</label> <strong>{formatCurrency(selectedCampaign.campaign.amount_per_dinh)}</strong>
                          </div>
                        </div>
                        {selectedCampaign.campaign.qr_code_media_id && (
                          <div className="qr-box-v3">
                            <img src={resolveImageUrl({mediaId: selectedCampaign.campaign.qr_code_media_id})} alt="QR Code" />
                            <p>Quét mã QR để thanh toán nhanh</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="cash-info-v3">
                         <div className="cash-card-v3">
                            <span className="material-symbols-outlined large-icon">info</span>
                            <h4>Thanh toán tiền mặt</h4>
                            <p>Vui lòng nộp tiền trực tiếp cho Trưởng họ hoặc người phụ trách ngân quỹ.</p>
                            <p>Sau khi nộp, hãy gửi báo cáo này để Trưởng họ xác nhận vào sổ quỹ.</p>
                         </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="premium-form">
                      <h4>Báo cáo đóng góp</h4>
                      <div className="form-group"><label>Số tiền đóng</label><input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                      
                      {formData.method === 'Chuyển khoản' && (
                        <div className="form-group">
                          <label>Ảnh Bill chuyển khoản</label>
                          <div className="upload-box-v2">
                            <input type="file" onChange={handleUploadBill} id="bill-upload" hidden />
                            <label htmlFor="bill-upload" className="upload-label-v3">
                              <span className="material-symbols-outlined">image</span>
                              {formData.evidence_media_id ? "Đã đính kèm ảnh" : "Tải ảnh bill"}
                            </label>
                          </div>
                        </div>
                      )}

                      <div className="form-group"><label>Ghi chú</label><textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Nhập ghi chú nếu có..."></textarea></div>
                      
                      <button type="submit" className="btn-premium btn-green" style={{width: '100%', marginTop: '1rem'}} disabled={submitting || (formData.method === 'Chuyển khoản' && !formData.evidence_media_id)}>
                        Gửi Báo Cáo
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* General Modal */}
      {showGeneralForm && (
        <div className="fund-modal-v2" onClick={() => setShowGeneralForm(false)}>
          <div className="modal-glass" style={{maxWidth: '450px'}} onClick={e => e.stopPropagation()}>
             <div className="modal-header-v2">
              <h3>Đóng Góp Tự Nguyện</h3>
              <button onClick={() => setShowGeneralForm(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body-v2">
               {successMsg ? <div className="success-screen"><h3>{successMsg}</h3></div> : (
                  <form onSubmit={handleGeneralSubmit} className="premium-form">
                    <div className="form-group"><label>Số tiền</label><input type="number" required value={generalData.amount} onChange={e => setGeneralData({...generalData, amount: e.target.value})} /></div>
                    <div className="form-group"><label>Nội dung</label><textarea required value={generalData.note} onChange={e => setGeneralData({...generalData, note: e.target.value})}></textarea></div>
                    <button type="submit" className="btn-premium btn-gold" style={{width: '100%'}}>Gửi Đóng Góp</button>
                  </form>
               )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-bg { background: rgba(0, 0, 0, 0.2); }
        .section-title { font-size: 1.5rem; color: #fff; margin-bottom: 1.5rem; position: relative; padding-left: 1rem; opacity: 0.9; }
        .section-title::before { content: ''; position: absolute; left: 0; top: 0.2rem; bottom: 0.2rem; width: 4px; background: var(--fund-gold); border-radius: 2px; }
        .year-pill { background: rgba(255, 255, 255, 0.1); color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; }
        .card-info-box { background: rgba(0, 0, 0, 0.2); padding: 1rem; border-radius: 12px; }
        .info-row { display: flex; justify-content: space-between; margin: 0.5rem 0; font-size: 0.9rem; }
        .info-row label { color: rgba(255, 255, 255, 0.5); }
        .tx-card-v2 { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tx-note { font-weight: 600; font-size: 0.95rem; color: #fff; }
        .tx-meta { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
        .pending-label { font-size: 0.65rem; color: var(--fund-gold); font-style: italic; display: block; }
        
        .method-switcher-v3 { display: flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.1); }
        .method-switcher-v3 label { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem; cursor: pointer; border-radius: 10px; color: rgba(255,255,255,0.5); transition: 0.3s; }
        .method-switcher-v3 label.active { background: rgba(255,255,255,0.1); color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .method-switcher-v3 input { display: none; }
        
        .pay-layout-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
        .bank-card-v3 { background: rgba(0, 0, 0, 0.3); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); color: #fff; }
        .bank-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; }
        .total-row { border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 1rem; margin-top: 1rem; }
        .total-row strong { color: #ff7675; font-size: 1.1rem; }
        
        .qr-box-v3 { text-align: center; margin-top: 1.5rem; }
        .qr-box-v3 img { max-width: 180px; border: 5px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .qr-box-v3 p { font-size: 0.85rem; color: rgba(255,255,255,0.4); margin-top: 0.8rem; }
        
        .cash-card-v3 { background: rgba(255,255,255,0.03); padding: 2rem; border-radius: 20px; border: 1px dashed rgba(255,255,255,0.2); text-align: center; color: #fff; }
        .large-icon { font-size: 3rem; color: var(--fund-gold); margin-bottom: 1rem; }
        
        .upload-label-v3 { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 1rem; border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; transition: 0.3s; color: rgba(255,255,255,0.4); }
        .upload-label-v3:hover { border-color: var(--fund-gold); color: #fff; background: rgba(255,255,255,0.05); }
        
        .success-screen { text-align: center; padding: 2rem; color: #fff; }
        .success-screen span { font-size: 4rem; color: #2ecc71; }
        .close-btn { background: none; border: none; color: #fff; font-size: 2.2rem; cursor: pointer; opacity: 0.5; transition: 0.3s; }
        .close-btn:hover { opacity: 1; transform: rotate(90deg); }
        .premium-form label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: rgba(255,255,255,0.7); }
        .premium-form input, .premium-form textarea { width: 100%; padding: 0.8rem; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; outline: none; background: rgba(0, 0, 0, 0.2); color: #fff; }
        .premium-form input:focus { border-color: var(--fund-gold); background: rgba(0, 0, 0, 0.4); }
        @media (max-width: 768px) { .pay-layout-v3 { grid-template-columns: 1fr; } }
      `}} />
    </div>
  );
}
