import FamilyTree from "../../components/common/FamilyTree";

export default function FamilyTreePage() {
  return (
    <section className="container" style={{ padding: "40px 20px" }}>
      <div className="account-page-header">
        <h1>Cây gia phả</h1>
        <p>Xem nhanh mô hình cây phả hệ hiện tại.</p>
      </div>
      <FamilyTree />
    </section>
  );
}
