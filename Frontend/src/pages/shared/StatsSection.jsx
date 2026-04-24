const stats = [
    ["1,200+", "Dòng họ tham gia"],
    ["500k+", "Thành viên kết nối"],
    ["250k+", "Tư liệu số hóa"],
    ["63", "Tỉnh thành phủ sóng"],
];

export default function StatsSection() {
    return ( <
        section className = "stats-section" >
        <
        div className = "container stats-grid" > {
            stats.map(([value, label]) => ( <
                div key = { label } >
                <
                strong > { value } < /strong> <
                p > { label } < /p> <
                /div>
            ))
        } <
        /div> <
        /section>
    );
}