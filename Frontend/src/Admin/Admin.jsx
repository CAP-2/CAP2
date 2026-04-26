import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./admin.css";
import {
  createAdminManager,
  getAdminAccounts,
  getAdminClans,
  getAdminClanTree,
  updateAdminAccountAccess,
} from "../api/adminService";
import { getMemberDetail, updateMemberByManager } from "../api/managerService";
import { FamilyTreeNode, personTreeLabel } from "../components/PhadoFamilyTree/PhadoFamilyTree";

function roleLabel(r) {
  if (r === 1) return "Admin";
  if (r === 2) return "Manager";
  if (r === 3) return "Member";
  return String(r);
}

const Admin = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("access");
  const [error, setError] = useState("");
  const [clans, setClans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClanId, setSelectedClanId] = useState(null);
  const [clanTreeData, setClanTreeData] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [accessEdit, setAccessEdit] = useState(null);
  const [memberEdit, setMemberEdit] = useState(null);
  const [memberForm, setMemberForm] = useState({});
  const [managerForm, setManagerForm] = useState({
    email: "",
    password: "",
    surname: "",
    middle_name: "",
    first_name: "",
    gender: 1,
    birth_date: "",
    hometown: "",
    generation: 1,
    clan_id: "",
  });

  const readSession = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const u = readSession();
    const token = localStorage.getItem("token");
    if (!token || u.role_id !== 1) {
      navigate("/login", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, a] = await Promise.all([getAdminClans(), getAdminAccounts()]);
        if (!cancelled) {
          setClans(c.clans || []);
          setAccounts(a.accounts || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, readSession]);

  const refreshAccounts = async () => {
    const a = await getAdminAccounts();
    setAccounts(a.accounts || []);
  };

  const loadTree = async (clanId) => {
    setTreeLoading(true);
    setSelectedClanId(clanId);
    setSelectedPerson(null);
    setMemberEdit(null);
    setClanTreeData(null);
    setError("");
    try {
      const data = await getAdminClanTree(clanId);
      setClanTreeData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setTreeLoading(false);
    }
  };

  const openMemberEdit = async (person) => {
    setSelectedPerson(person);
    setMemberEdit(null);
    setMemberForm({});
    if (!person.account_id) return;
    setError("");
    try {
      const d = await getMemberDetail(person.account_id);
      const m = d.member;
      setMemberEdit(m);
      setMemberForm({
        email: m.email || "",
        surname: m.surname || "",
        middle_name: m.middle_name || "",
        first_name: m.first_name || "",
        gender: m.gender ?? "",
        birth_date: m.birth_date || "",
        hometown: m.hometown || "",
        generation: m.generation ?? "",
        new_password: "",
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const saveMemberEdit = async () => {
    if (!memberEdit) return;
    setError("");
    const genRaw = memberForm.generation === "" ? null : Number(memberForm.generation);
    try {
      await updateMemberByManager(memberEdit.account_id, {
        email: memberForm.email,
        surname: memberForm.surname,
        middle_name: memberForm.middle_name,
        first_name: memberForm.first_name,
        gender: memberForm.gender === "" ? null : Number(memberForm.gender),
        birth_date: memberForm.birth_date || null,
        hometown: memberForm.hometown,
        generation: genRaw != null && Number.isFinite(genRaw) ? genRaw : null,
        ...(memberForm.new_password.trim() ? { new_password: memberForm.new_password.trim() } : {}),
      });
      if (selectedClanId) await loadTree(selectedClanId);
      setMemberEdit(null);
      setSelectedPerson(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveAccess = async () => {
    if (!accessEdit) return;
    setError("");
    try {
      await updateAdminAccountAccess(accessEdit.account_id, {
        role_id: Number(accessEdit.role_id),
        status: accessEdit.status,
        clan_id: accessEdit.clan_id === "" || accessEdit.clan_id == null ? null : Number(accessEdit.clan_id),
      });
      setAccessEdit(null);
      await refreshAccounts();
      const c = await getAdminClans();
      setClans(c.clans || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const submitManager = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createAdminManager({
        ...managerForm,
        clan_id: Number(managerForm.clan_id),
        generation: Number(managerForm.generation) || 1,
        gender: Number(managerForm.gender) || 1,
      });
      setManagerForm((p) => ({
        ...p,
        email: "",
        password: "",
        surname: "",
        middle_name: "",
        first_name: "",
      }));
      await refreshAccounts();
      const c = await getAdminClans();
      setClans(c.clans || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const roots = clanTreeData?.familyTree?.roots || [];

  return (
    <div className="adm-page">
      <header className="adm-topbar">
        <div>
          <h1>Quản trị hệ thống</h1>
          <p className="adm-sub">Quản lý truy cập · Cây phả hệ theo dòng họ</p>
        </div>
        <div className="adm-topbar-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => navigate("/member")}>
            Giao diện thành viên
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            onClick={() => {
              localStorage.removeItem("auth_token");
              localStorage.removeItem("auth_user");
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              navigate("/login", { replace: true });
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <nav className="adm-tabs">
        <button
          type="button"
          className={tab === "access" ? "adm-tab adm-tab--on" : "adm-tab"}
          onClick={() => setTab("access")}
        >
          Quản lý truy cập
        </button>
        <button
          type="button"
          className={tab === "trees" ? "adm-tab adm-tab--on" : "adm-tab"}
          onClick={() => setTab("trees")}
        >
          Cây phả hệ (dòng họ)
        </button>
      </nav>

      {error ? (
        <div className="adm-alert adm-alert--err" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="adm-muted">Đang tải…</p>
      ) : tab === "access" ? (
        <div className="adm-grid">
          <section className="adm-card adm-card--wide">
            <h2>Tài khoản và quyền</h2>
            <p className="adm-muted">
              Chỉnh vai trò Manager / Member, trạng thái, và dòng họ gắn với hồ sơ người (person). Tài khoản Admin
              không chỉnh tại đây.
            </p>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Dòng họ</th>
                    <th> </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((row) => (
                    <tr key={row.account_id}>
                      <td>{row.account_id}</td>
                      <td>{row.email}</td>
                      <td>{roleLabel(row.role_id)}</td>
                      <td>{row.status}</td>
                      <td>{row.clan_name || "—"}</td>
                      <td>
                        {row.role_id === 1 ? (
                          <span className="adm-muted">—</span>
                        ) : (
                          <button type="button" className="adm-btn adm-btn--sm" onClick={() => setAccessEdit({ ...row })}>
                            Sửa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adm-card">
            <h2>Cấp quyền Manager mới</h2>
            <p className="adm-muted">Tạo tài khoản manager và gán một dòng họ.</p>
            <form className="adm-form" onSubmit={submitManager}>
              <label>
                Dòng họ *
                <select
                  required
                  value={managerForm.clan_id}
                  onChange={(e) => setManagerForm((p) => ({ ...p, clan_id: e.target.value }))}
                >
                  <option value="">Chọn…</option>
                  {clans.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} — {c.clan_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Email *
                <input
                  value={managerForm.email}
                  onChange={(e) => setManagerForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  type="email"
                />
              </label>
              <label>
                Mật khẩu *
                <input
                  value={managerForm.password}
                  onChange={(e) => setManagerForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              <div className="adm-form-row">
                <label>
                  Họ
                  <input value={managerForm.surname} onChange={(e) => setManagerForm((p) => ({ ...p, surname: e.target.value }))} />
                </label>
                <label>
                  Tên đệm
                  <input
                    value={managerForm.middle_name}
                    onChange={(e) => setManagerForm((p) => ({ ...p, middle_name: e.target.value }))}
                  />
                </label>
                <label>
                  Tên *
                  <input
                    value={managerForm.first_name}
                    onChange={(e) => setManagerForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <label>
                Giới tính
                <select value={managerForm.gender} onChange={(e) => setManagerForm((p) => ({ ...p, gender: Number(e.target.value) }))}>
                  <option value={1}>Nam</option>
                  <option value={2}>Nữ</option>
                </select>
              </label>
              <label>
                Ngày sinh
                <input
                  type="date"
                  value={managerForm.birth_date}
                  onChange={(e) => setManagerForm((p) => ({ ...p, birth_date: e.target.value }))}
                />
              </label>
              <label>
                Quê quán
                <input value={managerForm.hometown} onChange={(e) => setManagerForm((p) => ({ ...p, hometown: e.target.value }))} />
              </label>
              <label>
                Đời (thế hệ)
                <input
                  type="number"
                  min={1}
                  value={managerForm.generation}
                  onChange={(e) => setManagerForm((p) => ({ ...p, generation: e.target.value }))}
                />
              </label>
              <button type="submit" className="adm-btn adm-btn--primary">
                Tạo Manager
              </button>
            </form>
          </section>
        </div>
      ) : (
        <div className="adm-tree-layout">
          <aside className="adm-card adm-clan-list">
            <h2>Các cây phả hệ</h2>
            <p className="adm-muted">
              Tổng <strong>{clans.length}</strong> dòng họ. Chọn một dòng để xem sơ đồ.
            </p>
            <ul className="adm-clan-items">
              {clans.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={selectedClanId === c.id ? "adm-clan-pill adm-clan-pill--on" : "adm-clan-pill"}
                    onClick={() => loadTree(c.id)}
                  >
                    <span className="adm-clan-name">{c.clan_name}</span>
                    <span className="adm-clan-meta">
                      {c.member_count} người · {c.manager_count} manager
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <main className="adm-card adm-tree-main">
            {!selectedClanId ? (
              <p className="adm-muted">Chọn một dòng họ bên trái.</p>
            ) : treeLoading ? (
              <p>Đang tải cây…</p>
            ) : clanTreeData ? (
              <>
                <header className="adm-tree-head">
                  <h2>{clanTreeData.clan?.clan_name}</h2>
                  <p className="adm-muted">
                    {(clanTreeData.treeMembers || []).length} thành viên · Bấm thẻ để chỉnh người có tài khoản
                  </p>
                </header>
                <div className="usr-phado usr-phado--admin">
                  <div className="usr-phado-frame">
                    <header className="usr-phado-header">
                      <div className="usr-phado-ornament usr-phado-ornament--left" aria-hidden="true" />
                      <div className="usr-phado-titleBlock">
                        <div className="usr-phado-banner">GIA PHẢ</div>
                        <div className="usr-phado-clan">{clanTreeData.clan?.clan_name}</div>
                      </div>
                      <div className="usr-phado-ornament usr-phado-ornament--right" aria-hidden="true" />
                    </header>
                    <div className="usr-phado-treeWrap usr-phado-treeWrap--bloodline">
                      {roots.length === 0 ? (
                        <div className="usr-phado-empty">Chưa có dữ liệu cây (thêm thành viên và quan hệ).</div>
                      ) : (
                        <ul className="usr-phado-treeRoot" role="tree" aria-label="Cây gia phả dòng họ">
                          {roots.map((root) => (
                            <FamilyTreeNode key={root.person.id} node={root} onSelectPerson={openMemberEdit} />
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {selectedPerson ? (
                  <div className="adm-person-panel">
                    <h3>{personTreeLabel(selectedPerson)}</h3>
                    {!selectedPerson.account_id ? (
                      <p className="adm-muted">Chưa có tài khoản đăng nhập — chỉ xem trên cây.</p>
                    ) : memberEdit ? (
                      <div className="adm-form adm-form--compact">
                        <label>
                          Email
                          <input
                            value={memberForm.email}
                            onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                          />
                        </label>
                        <div className="adm-form-row">
                          <label>
                            Họ
                            <input
                              value={memberForm.surname}
                              onChange={(e) => setMemberForm((p) => ({ ...p, surname: e.target.value }))}
                            />
                          </label>
                          <label>
                            Tên đệm
                            <input
                              value={memberForm.middle_name}
                              onChange={(e) => setMemberForm((p) => ({ ...p, middle_name: e.target.value }))}
                            />
                          </label>
                          <label>
                            Tên
                            <input
                              value={memberForm.first_name}
                              onChange={(e) => setMemberForm((p) => ({ ...p, first_name: e.target.value }))}
                            />
                          </label>
                        </div>
                        <label>
                          Giới tính
                          <select
                            value={memberForm.gender === "" ? "" : String(memberForm.gender)}
                            onChange={(e) =>
                              setMemberForm((p) => ({
                                ...p,
                                gender: e.target.value === "" ? "" : Number(e.target.value),
                              }))
                            }
                          >
                            <option value="">—</option>
                            <option value="1">Nam</option>
                            <option value="2">Nữ</option>
                          </select>
                        </label>
                        <label>
                          Ngày sinh
                          <input
                            type="date"
                            value={memberForm.birth_date || ""}
                            onChange={(e) => setMemberForm((p) => ({ ...p, birth_date: e.target.value }))}
                          />
                        </label>
                        <label>
                          Quê quán
                          <input
                            value={memberForm.hometown}
                            onChange={(e) => setMemberForm((p) => ({ ...p, hometown: e.target.value }))}
                          />
                        </label>
                        <label>
                          Đời
                          <input
                            type="number"
                            min={1}
                            value={memberForm.generation}
                            onChange={(e) => setMemberForm((p) => ({ ...p, generation: e.target.value }))}
                          />
                        </label>
                        <label>
                          Mật khẩu mới (tuỳ chọn)
                          <input
                            type="password"
                            value={memberForm.new_password}
                            onChange={(e) => setMemberForm((p) => ({ ...p, new_password: e.target.value }))}
                            autoComplete="new-password"
                          />
                        </label>
                        <div className="adm-form-actions">
                          <button type="button" className="adm-btn adm-btn--primary" onClick={saveMemberEdit}>
                            Lưu thông tin
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn--ghost"
                            onClick={() => {
                              setSelectedPerson(null);
                              setMemberEdit(null);
                            }}
                          >
                            Đóng
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="adm-muted">Đang tải…</p>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </main>
        </div>
      )}

      {accessEdit ? (
        <div className="adm-modal-overlay" role="presentation" onClick={() => setAccessEdit(null)}>
          <div className="adm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Quyền tài khoản #{accessEdit.account_id}</h3>
            <p className="adm-muted">{accessEdit.email}</p>
            <div className="adm-form">
              <label>
                Vai trò
                <select
                  value={accessEdit.role_id}
                  onChange={(e) => setAccessEdit((p) => ({ ...p, role_id: Number(e.target.value) }))}
                >
                  <option value={2}>Manager</option>
                  <option value={3}>Member</option>
                </select>
              </label>
              <label>
                Trạng thái
                <select
                  value={accessEdit.status}
                  onChange={(e) => setAccessEdit((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">active</option>
                  <option value="pending">pending</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
              <label>
                Dòng họ
                {accessEdit.person_id == null ? (
                  <span className="adm-muted" style={{ fontWeight: 400 }}>
                    Tài khoản chưa liên kết hồ sơ người — không gán dòng họ được.
                  </span>
                ) : (
                  <select
                    value={accessEdit.clan_id ?? ""}
                    onChange={(e) =>
                      setAccessEdit((p) => ({
                        ...p,
                        clan_id: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">— Không gán —</option>
                    {clans.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} {c.clan_name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <div className="adm-form-actions">
                <button type="button" className="adm-btn adm-btn--primary" onClick={saveAccess}>
                  Lưu
                </button>
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setAccessEdit(null)}>
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Admin;
