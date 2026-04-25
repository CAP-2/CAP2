import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPersonAPI,
  getManagerTree,
  linkRelationsAPI,
} from "../../api/managerService";
import FamilyTree from "../../components/common/FamilyTree";
import { mapTreeNode, personName } from "./managerData";
import "./manager.css";

const emptyPersonForm = {
  surname: "",
  middle_name: "",
  first_name: "",
  gender: "1",
  generation: "1",
  birth_date: "",
  death_date: "",
  hometown: "",
  parent_id: "",
};

const emptyRelationForm = {
  person_id: "",
  parent_father_id: "",
  parent_mother_id: "",
  spouse_id: "",
  children_ids: "",
};

export default function GenealogySection() {
  const [treeData, setTreeData] = useState(null);
  const [people, setPeople] = useState([]);
  const [clan, setClan] = useState(null);
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [relationForm, setRelationForm] = useState(emptyRelationForm);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getManagerTree();
      const roots = data.familyTree?.roots || [];
      const mappedRoots = roots.map(mapTreeNode);
      const nextTree =
        mappedRoots.length === 1
          ? mappedRoots[0]
          : mappedRoots.length > 1
            ? {
                id: "clan-root",
                name: data.clan?.clan_name || "Dòng họ",
                title: `${mappedRoots.length} nhánh gốc`,
                generation: `${data.treeMembers?.length || 0} thành viên`,
                children: mappedRoots,
              }
            : null;
      setTreeData(nextTree);
      setPeople(Array.isArray(data.treeMembers) ? data.treeMembers : []);
      setClan(data.clan || null);
    } catch (err) {
      setError(err?.message || "Không thể tải cây gia phả từ database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const peopleOptions = useMemo(
    () =>
      people.map((person) => ({
        id: person.id,
        label: `#${person.id} - ${personName(person)}${person.generation ? ` (Đời ${person.generation})` : ""}`,
        gender: Number(person.gender),
      })),
    [people]
  );

  const setPersonField = (event) => {
    const { name, value } = event.target;
    setPersonForm((prev) => ({ ...prev, [name]: value }));
  };

  const setRelationField = (event) => {
    const { name, value } = event.target;
    setRelationForm((prev) => ({ ...prev, [name]: value }));
  };

  const createPerson = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const parent = people.find((p) => String(p.id) === String(personForm.parent_id));
      const parentPayload = {};
      if (parent) {
        if (Number(parent.gender) === 2) parentPayload.parent_mother_id = parent.id;
        else parentPayload.parent_father_id = parent.id;
      }
      await createPersonAPI({
        surname: personForm.surname.trim(),
        middle_name: personForm.middle_name.trim(),
        first_name: personForm.first_name.trim(),
        gender: personForm.gender,
        generation: personForm.generation,
        birth_date: personForm.birth_date || null,
        death_date: personForm.death_date || null,
        hometown: personForm.hometown.trim(),
        ...parentPayload,
      });
      setPersonForm(emptyPersonForm);
      setMessage("Đã thêm người vào database.");
      await loadTree();
    } catch (err) {
      setError(err?.message || "Không thể thêm người");
    } finally {
      setSaving(false);
    }
  };

  const saveRelations = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = { person_id: relationForm.person_id };
      if (relationForm.parent_father_id) payload.parent_father_id = relationForm.parent_father_id;
      if (relationForm.parent_mother_id) payload.parent_mother_id = relationForm.parent_mother_id;
      if (relationForm.spouse_id) payload.spouse_id = relationForm.spouse_id;
      if (relationForm.children_ids.trim()) payload.children_ids = relationForm.children_ids;
      await linkRelationsAPI(payload);
      setMessage("Đã lưu quan hệ vào database.");
      await loadTree();
    } catch (err) {
      setError(err?.message || "Không thể lưu quan hệ");
    } finally {
      setSaving(false);
    }
  };

  const beginEditNode = (node) => {
    if (!node?.person_id) return;
    const person = people.find((p) => p.id === node.person_id);
    setSelectedPerson(person || node.raw || null);
    setRelationForm((prev) => ({ ...prev, person_id: String(node.person_id) }));
  };

  return (
    <section className="manager-genealogy-page">
      <div className="manager-data-header">
        <div>
          <h2>{clan?.clan_name || "Cây gia phả"}</h2>
          <p>Toàn bộ cây, thành viên và quan hệ được lấy từ bảng people, families và children.</p>
        </div>
        <button className="mgr-btnGhost" type="button" onClick={loadTree} disabled={loading}>
          Tải lại
        </button>
      </div>

      {message && <div className="manager-inline-message">{message}</div>}
      {error && <div className="manager-inline-error">{error}</div>}

      <div className="management-grid">
        <div className="panel-card">
          <h2>Thêm người vào gia phả</h2>
          <form className="member-form" onSubmit={createPerson}>
            <div className="form-row">
              <input className="mgr-field" name="surname" value={personForm.surname} onChange={setPersonField} placeholder="Họ" />
              <input className="mgr-field" name="middle_name" value={personForm.middle_name} onChange={setPersonField} placeholder="Tên đệm" />
            </div>
            <input className="mgr-field" name="first_name" value={personForm.first_name} onChange={setPersonField} placeholder="Tên" required />
            <select className="mgr-field" name="parent_id" value={personForm.parent_id} onChange={setPersonField}>
              <option value="">Không chọn cha/mẹ</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <div className="form-row">
              <select className="mgr-field" name="gender" value={personForm.gender} onChange={setPersonField}>
                <option value="1">Nam</option>
                <option value="2">Nữ</option>
                <option value="">Không khai báo</option>
              </select>
              <input className="mgr-field" name="generation" type="number" min="1" value={personForm.generation} onChange={setPersonField} placeholder="Đời" />
            </div>
            <div className="form-row">
              <input className="mgr-field" name="birth_date" type="date" value={personForm.birth_date} onChange={setPersonField} />
              <input className="mgr-field" name="death_date" type="date" value={personForm.death_date} onChange={setPersonField} />
            </div>
            <input className="mgr-field" name="hometown" value={personForm.hometown} onChange={setPersonField} placeholder="Quê quán" />
            <button className="mgr-btnPrimary" type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Thêm vào database"}
            </button>
          </form>

          <h2 className="manager-panel-subtitle">Liên kết quan hệ</h2>
          <form className="member-form" onSubmit={saveRelations}>
            <select className="mgr-field" name="person_id" value={relationForm.person_id} onChange={setRelationField} required>
              <option value="">Chọn người cần liên kết</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <select className="mgr-field" name="parent_father_id" value={relationForm.parent_father_id} onChange={setRelationField}>
              <option value="">Không chọn cha</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <select className="mgr-field" name="parent_mother_id" value={relationForm.parent_mother_id} onChange={setRelationField}>
              <option value="">Không chọn mẹ</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <select className="mgr-field" name="spouse_id" value={relationForm.spouse_id} onChange={setRelationField}>
              <option value="">Không chọn vợ/chồng</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <input className="mgr-field" name="children_ids" value={relationForm.children_ids} onChange={setRelationField} placeholder="ID con, cách nhau bằng dấu phẩy" />
            <button className="mgr-btnPrimary" type="submit" disabled={saving}>
              Lưu quan hệ
            </button>
          </form>
          {selectedPerson && <p className="mgr-subtle">Đang chọn: #{selectedPerson.id} - {personName(selectedPerson)}</p>}
        </div>

        <div className="panel-card tree-preview-panel">
          <div className="panel-header">
            <h2>Cây gia phả từ database</h2>
            <span>{people.length} người</span>
          </div>
          <div className="tree-container">
            {loading ? (
              <div className="mgr-empty">Đang tải cây gia phả...</div>
            ) : treeData ? (
              <FamilyTree data={treeData} isLoggedIn onEditNode={beginEditNode} />
            ) : (
              <div className="mgr-empty">Database chưa có người nào trong dòng họ này.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
