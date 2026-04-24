const features = [{
        icon: "bolt",
        title: "Lập phả hệ tự động",
        desc: "Nhập dữ liệu nhanh chóng từ file Excel hoặc thông tin rời rạc, hệ thống tự động liên kết.",
    },
    {
        icon: "notifications_active",
        title: "Quản lý và thông báo ngày lễ",
        desc: "Nhắc lịch đám giỗ, tết, các ngày kỷ niệm dòng tộc qua điện thoại và email.",
    },
    {
        icon: "security",
        title: "Bảo mật thông tin",
        desc: "Dữ liệu được mã hóa chuẩn quốc tế, phân quyền truy cập chi tiết cho từng thành viên.",
    },
];

export default function FeaturesSection() {
    return ( <
        section className = "features-section" >
        <
        div className = "container two-col" >
        <
        img src = "https://lh3.googleusercontent.com/aida-public/AB6AXuAd6zBRvZR3R4FNjtUr2lLEx9nhgeCvjODU75n1JNSZXsYbZbBF_gkjblSR6pitSFdONbGyENkDH6yqIi4uS-Ykb6p6ILCjP0nXnqvGTlFy9hTWmvVSDjpMIx7HWlHJsTVzyp8Eupx2Tm3Xyjng359b4cGX8X6_EDIt4xaLllWGrajQxWqaRni5VzHCLHVKEAERaVpCv2KL8n9_4GnV-fPjGCzGNfAwYlnkE_xJidn-Rg1rLL1S3goPoSirM6dhlbwjipscoiT16iOH"
        alt = "Công nghệ dẫn đầu" /
        >
        <
        div >
        <
        span className = "section-tag" > Công nghệ dẫn đầu < /span> <
        h3 > Tính năng vượt trội < /h3> <
        div className = "feature-list" > {
            features.map((item) => ( <
                article key = { item.title } >
                <
                span className = "material-symbols-outlined" > { item.icon } < /span> <
                div >
                <
                h4 > { item.title } < /h4> <
                p > { item.desc } < /p> <
                /div> <
                /article>
            ))
        } <
        /div> <
        /div> <
        /div> <
        /section>
    );
}