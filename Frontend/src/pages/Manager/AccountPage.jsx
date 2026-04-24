import GenealogySection from "./GenealogySection";

export default function AccountPage({ isLoggedIn, onRequestLogin }) {
    return (
        <section className="account-page">
            <div className="container account-page-header">
                <h1>Tài khoản dòng họ</h1>
                <p>Quản lý thành viên và cập nhật cây phả hệ tại một nơi riêng biệt.</p>
            </div>
            <GenealogySection isLoggedIn={isLoggedIn} onRequestLogin={onRequestLogin} />
        </section>
    );
}