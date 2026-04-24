import { useMemo, useState } from "react";
import FamilyTree from "../../components/common/FamilyTree";

const initialTreeData = {
    id: 1,
    name: "THỦY TỔ NGUYỄN TRÍ",
    title: "Tổ Phúc Khánh",
    generation: "Đời 1",
    birth: "1800",
    death: "1875",
    children: [
        {
            id: 2,
            name: "NGUYỄN TRÍ CƯỜNG",
            title: "Cụ Ông",
            generation: "Đời 2",
            birth: "1830",
            death: "1908",
            children: [],
        },
        {
            id: 3,
            name: "NGUYỄN TRÍ NAM",
            title: "Cụ Ông",
            generation: "Đời 2",
            birth: "1850",
            death: "1920",
            children: [],
        },
    ],
};

const defaultForm = {
    parentId: "1",
    name: "",
    title: "",
    generation: "",
    birth: "",
    death: "",
};

function findMaxId(node) {
    const childMax = (node.children || []).reduce((maxId, child) => Math.max(maxId, findMaxId(child)), 0);
    return Math.max(node.id, childMax);
}

function addChildToNode(node, parentId, newNode) {
    if (node.id === parentId) {
        return { ...node, children: [...(node.children || []), newNode] };
    }

    return {
        ...node,
        children: (node.children || []).map((child) => addChildToNode(child, parentId, newNode)),
    };
}

function updateNodeById(node, targetId, payload) {
    if (node.id === targetId) {
        return { ...node, ...payload };
    }

    return {
        ...node,
        children: (node.children || []).map((child) => updateNodeById(child, targetId, payload)),
    };
}

function deleteNodeById(node, targetId) {
    return {
        ...node,
        children: (node.children || [])
            .filter((child) => child.id !== targetId)
            .map((child) => deleteNodeById(child, targetId)),
    };
}

function flattenTree(node, result = []) {
    result.push({ id: node.id, name: node.name });
    (node.children || []).forEach((child) => flattenTree(child, result));
    return result;
}

export default function GenealogySection({ isLoggedIn, onRequestLogin, showAdmin = true }) {
    const [treeData, setTreeData] = useState(initialTreeData);
    const [createForm, setCreateForm] = useState(defaultForm);
    const [editNodeId, setEditNodeId] = useState(null);
    const [editForm, setEditForm] = useState(defaultForm);

    const memberOptions = useMemo(() => flattenTree(treeData), [treeData]);

    const handleCreateChange = (event) => {
        const { name, value } = event.target;
        setCreateForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleEditChange = (event) => {
        const { name, value } = event.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddMember = (event) => {
        event.preventDefault();
        if (!isLoggedIn) {
            onRequestLogin();
            return;
        }

        const nextId = findMaxId(treeData) + 1;
        const parentId = Number(createForm.parentId);
        const newMember = {
            id: nextId,
            name: createForm.name.trim(),
            title: createForm.title.trim(),
            generation: createForm.generation.trim(),
            birth: createForm.birth.trim(),
            death: createForm.death.trim(),
            children: [],
        };

        setTreeData((prev) => addChildToNode(prev, parentId, newMember));
        setCreateForm(defaultForm);
    };

    const handleBeginEdit = (node) => {
        if (!isLoggedIn) {
            onRequestLogin();
            return;
        }

        setEditNodeId(node.id);
        setEditForm({
            parentId: String(node.id),
            name: node.name || "",
            title: node.title || "",
            generation: node.generation || "",
            birth: node.birth || "",
            death: node.death || "",
        });
    };

    const handleSaveEdit = (event) => {
        event.preventDefault();
        if (!editNodeId) {
            return;
        }

        setTreeData((prev) =>
            updateNodeById(prev, editNodeId, {
                name: editForm.name.trim(),
                title: editForm.title.trim(),
                generation: editForm.generation.trim(),
                birth: editForm.birth.trim(),
                death: editForm.death.trim(),
            })
        );
        setEditNodeId(null);
        setEditForm(defaultForm);
    };

    const handleDeleteNode = (nodeId) => {
        if (!isLoggedIn) {
            onRequestLogin();
            return;
        }

        if (nodeId === treeData.id) {
            return;
        }

        setTreeData((prev) => deleteNodeById(prev, nodeId));
    };

    return (
        <section className="genealogy-section">
            <div className="container genealogy-grid">
                <div>
                    <h3>Sơ đồ phả hệ thông minh</h3>
                    <p>
                        Trực quan hóa cây phả hệ với đa dạng góc nhìn, từ dòng tộc lớn đến các nhánh chi nhỏ.
                    </p>
                    <div className="genealogy-actions">
                        <button type="button">
                            <span className="material-symbols-outlined">image</span>
                            Xem dưới dạng hình ảnh
                        </button>
                        <button type="button">
                            <span className="material-symbols-outlined">account_tree</span>
                            Tạo nhiều thế hệ
                        </button>
                      
                    </div>
                    <ul>
                        <li>Tự động cấp xếp thứ tự vai vế</li>
                        <li>Đính kèm tiểu sử và hình ảnh thực tế</li>
                    </ul>

                    {showAdmin && (
                        <div className="genealogy-admin">
                            <h4>Quản lý thành viên phả hệ</h4>
                            {!isLoggedIn && (
                                <p className="genealogy-admin-note">
                                    Bạn cần đăng nhập để thêm, sửa, xóa thành viên.
                                    <button type="button" onClick={onRequestLogin}>
                                        Đăng nhập ngay
                                    </button>
                                </p>
                            )}

                            <form className="tree-form" onSubmit={handleAddMember}>
                                <h5>Thêm thành viên mới</h5>
                                <label htmlFor="parentId">Thêm vào nhánh</label>
                                <select id="parentId" name="parentId" value={createForm.parentId} onChange={handleCreateChange}>
                                    {memberOptions.map((member) => (
                                        <option key={member.id} value={String(member.id)}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    name="name"
                                    value={createForm.name}
                                    onChange={handleCreateChange}
                                    placeholder="Họ tên"
                                    required
                                />
                                <input
                                    name="title"
                                    value={createForm.title}
                                    onChange={handleCreateChange}
                                    placeholder="Vai vế"
                                    required
                                />
                                <input
                                    name="generation"
                                    value={createForm.generation}
                                    onChange={handleCreateChange}
                                    placeholder="Đời"
                                />
                                <div className="tree-form-inline">
                                    <input
                                        name="birth"
                                        value={createForm.birth}
                                        onChange={handleCreateChange}
                                        placeholder="Năm sinh"
                                    />
                                    <input
                                        name="death"
                                        value={createForm.death}
                                        onChange={handleCreateChange}
                                        placeholder="Năm mất"
                                    />
                                </div>
                                <button type="submit">Thêm thành viên</button>
                            </form>

                            {editNodeId && (
                                <form className="tree-form tree-edit-form" onSubmit={handleSaveEdit}>
                                    <h5>Chỉnh sửa thành viên</h5>
                                    <input name="name" value={editForm.name} onChange={handleEditChange} placeholder="Họ tên" required />
                                    <input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Vai vế" required />
                                    <input
                                        name="generation"
                                        value={editForm.generation}
                                        onChange={handleEditChange}
                                        placeholder="Đời"
                                    />
                                    <div className="tree-form-inline">
                                        <input
                                            name="birth"
                                            value={editForm.birth}
                                            onChange={handleEditChange}
                                            placeholder="Năm sinh"
                                        />
                                        <input
                                            name="death"
                                            value={editForm.death}
                                            onChange={handleEditChange}
                                            placeholder="Năm mất"
                                        />
                                    </div>
                                    <div className="tree-edit-actions">
                                        <button type="button" onClick={() => setEditNodeId(null)}>
                                            Hủy
                                        </button>
                                        <button type="submit">Lưu cập nhật</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
                <div className="genealogy-card">
                    <FamilyTree
                        data={treeData}
                        isLoggedIn={showAdmin ? isLoggedIn : false}
                        onEditNode={showAdmin ? handleBeginEdit : undefined}
                        onDeleteNode={showAdmin ? handleDeleteNode : undefined}
                    />
                </div>
            </div>
        </section>
    );
}