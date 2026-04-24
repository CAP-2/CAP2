import { useState } from "react";
import FamilyTree from "../../components/common/FamilyTree";

export default function GenealogyManagement() {
    const [formData, setFormData] = useState({
        name: "",
        title: "",
        generation: "",
        birth: "",
        death: "",
        parentId: "",
    });

    const [members, setMembers] = useState([
        {
            id: 1,
            name: "THỦY TỔ NGUYỄN TRÍ",
            title: "Tổ Phúc Khánh",
            generation: "Đời 1",
            birth: null,
            death: null,
            children: [
                {
                    id: 2,
                    name: "NGUYỄN TRÍ CƯỜNG",
                    title: "Cụ Ông",
                    generation: "Đời 2",
                    birth: null,
                    death: null,
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
                {
                    id: 4,
                    name: "NGUYỄN TRÍ HẬU",
                    title: "Cụ Ông",
                    generation: "Đời 2",
                    birth: "1860",
                    death: "1935",
                    children: [],
                },
            ],
        },
    ]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Logic thêm thành viên mới
        alert("Thêm thành viên: " + formData.name);
        setFormData({
            name: "",
            title: "",
            generation: "",
            birth: "",
            death: "",
            parentId: "",
        });
    };

    return (
        <div className="genealogy-management">
            <div className="management-grid">
                <div className="add-member-panel">
                    <div className="panel-card">
                        <h2>Thêm thành viên mới</h2>
                        <form onSubmit={handleSubmit} className="member-form">
                            <div className="form-group">
                                <label htmlFor="name">Họ và tên *</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Nhập họ và tên"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="title">Chức danh</label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    placeholder="Ví dụ: Cụ Ông, Bà Nội..."
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="generation">Đời thứ</label>
                                <input
                                    type="text"
                                    id="generation"
                                    name="generation"
                                    value={formData.generation}
                                    onChange={handleInputChange}
                                    placeholder="Ví dụ: Đời 3"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="birth">Năm sinh</label>
                                    <input
                                        type="text"
                                        id="birth"
                                        name="birth"
                                        value={formData.birth}
                                        onChange={handleInputChange}
                                        placeholder="YYYY"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="death">Năm mất</label>
                                    <input
                                        type="text"
                                        id="death"
                                        name="death"
                                        value={formData.death}
                                        onChange={handleInputChange}
                                        placeholder="YYYY"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="parentId">Cha/Mẹ</label>
                                <select
                                    id="parentId"
                                    name="parentId"
                                    value={formData.parentId}
                                    onChange={handleInputChange}
                                >
                                    <option value="">-- Chọn cha/mẹ --</option>
                                    <option value="1">THỦY TỔ NGUYỄN TRÍ</option>
                                    <option value="2">NGUYỄN TRÍ CƯỜNG</option>
                                    <option value="3">NGUYỄN TRÍ NAM</option>
                                    <option value="4">NGUYỄN TRÍ HẬU</option>
                                </select>
                            </div>

                            <button type="submit" className="btn-primary">
                                <span className="material-symbols-outlined">add</span>
                                Thêm thành viên
                            </button>
                        </form>

                        <div className="quick-actions">
                            <h3>Thao tác nhanh</h3>
                            <button type="button" className="action-btn">
                                <span className="material-symbols-outlined">upload</span>
                                Import từ Excel
                            </button>
                            <button type="button" className="action-btn">
                                <span className="material-symbols-outlined">download</span>
                                Export dữ liệu
                            </button>
                            <button type="button" className="action-btn ai-btn">
                                <span className="material-symbols-outlined">auto_awesome</span>
                                AI tạo phả hệ
                            </button>
                        </div>
                    </div>
                </div>

                <div className="tree-preview-panel">
                    <div className="panel-card">
                        <div className="panel-header">
                            <h2>Xem trước phả hệ</h2>
                            <div className="view-controls">
                                <button type="button" className="control-btn">
                                    <span className="material-symbols-outlined">zoom_in</span>
                                </button>
                                <button type="button" className="control-btn">
                                    <span className="material-symbols-outlined">zoom_out</span>
                                </button>
                                <button type="button" className="control-btn">
                                    <span className="material-symbols-outlined">fullscreen</span>
                                </button>
                            </div>
                        </div>
                        <div className="tree-container">
                            <FamilyTree data={members[0]} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
