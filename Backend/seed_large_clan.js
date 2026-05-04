const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

/**
 * Script Seeder Nâng cấp: Tạo dòng họ 10 ĐỜI
 * Tác giả: Antigravity
 */

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : null
    });

    console.log('🚀 Đang bắt đầu quá trình tạo dòng họ 10 ĐỜI...');

    try {
        // 0. Dọn dẹp dữ liệu cũ
        console.log('🧹 Đang dọn dẹp dữ liệu cũ...');
        await connection.query("DELETE FROM accounts WHERE email = ?", ["manager.nguyen@gmail.com"]);
        await connection.query("DELETE FROM clans WHERE clan_name = ?", ["Nguyễn Đại Tộc"]);

        // 1. Tạo Dòng họ
        const [clanResult] = await connection.query(
            "INSERT INTO clans (clan_name, history, hall_address) VALUES (?, ?, ?)",
            ["Nguyễn Đại Tộc", "Dòng họ Nguyễn với lịch sử huy hoàng trải dài 10 thế hệ.", "Từ Đường Họ Nguyễn, Hà Nội"]
        );
        const clanId = clanResult.insertId;

        let totalPeople = 0;
        const MAX_GEN = 10;

        // Hàm tạo người
        async function createPerson(firstName, gen, gender) {
            const surname = "Nguyễn";
            const middleName = gender === 1 ? "Văn" : "Thị";
            const displayName = `${surname} ${middleName} ${firstName}`;
            const [result] = await connection.query(
                `INSERT INTO people (clan_id, display_name, first_name, middle_name, surname, gender, generation, is_living) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [clanId, displayName, firstName, middleName, surname, gender, gen, gen > MAX_GEN - 2 ? 1 : 0]
            );
            totalPeople++;
            return { id: result.insertId, gen, gender, firstName };
        }

        // Tạo đời 1
        const cuTo = await createPerson("Tổ", 1, 1);
        const cuBa = await createPerson("Bà", 1, 2);
        const [fam1] = await connection.query("INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)", [clanId, cuTo.id, cuBa.id]);

        let currentGenFamilies = [fam1.insertId];
        
        // Vòng lặp tạo các đời tiếp theo
        for (let g = 2; g <= MAX_GEN; g++) {
            const nextGenFamilies = [];
            console.log(`⏳ Đang tạo đời thứ ${g}...`);

            for (let famId of currentGenFamilies) {
                // Mỗi gia đình có từ 1-3 con
                const numKids = Math.floor(Math.random() * 3) + 1;
                
                for (let k = 1; k <= numKids; k++) {
                    const kid = await createPerson(`Đời ${g}-${totalPeople}`, g, Math.random() > 0.5 ? 1 : 2);
                    await connection.query("INSERT INTO children (family_id, person_id, sort_order) VALUES (?, ?, ?)", [famId, kid.id, k]);

                    // Tạo Manager ở đời 2
                    if (g === 2 && k === 1) {
                        const hashedPassword = await bcrypt.hash("1", 10);
                        await connection.query(
                            "INSERT INTO accounts (email, password, person_id, role_id, status) VALUES (?, ?, ?, ?, ?)",
                            ["manager.nguyen@gmail.com", hashedPassword, kid.id, 2, 'active']
                        );
                    }

                    // Nếu chưa đến đời cuối, tạo gia đình cho người này (nếu là Nam hoặc tỉ lệ 50% nếu là Nữ)
                    if (g < MAX_GEN) {
                        const spouse = await createPerson(`Vợ/Chồng`, g, kid.gender === 1 ? 2 : 1);
                        const [newFam] = await connection.query(
                            "INSERT INTO families (clan_id, father_id, mother_id) VALUES (?, ?, ?)",
                            [clanId, kid.gender === 1 ? kid.id : spouse.id, kid.gender === 1 ? spouse.id : kid.id]
                        );
                        // Chỉ một số nhánh được tiếp tục để tránh quá tải
                        if (Math.random() > 0.3 || g < 4) {
                            nextGenFamilies.push(newFam.insertId);
                        }
                    }
                }
            }
            currentGenFamilies = nextGenFamilies;
            if (currentGenFamilies.length === 0) break;
            if (totalPeople > 300) break; // Giới hạn 300 người để đảm bảo hiệu năng
        }

        console.log(`✅ Hoàn tất! Đã tạo ${MAX_GEN} thế hệ.`);
        console.log(`📊 Tổng số thành viên: ${totalPeople}`);
        console.log(`🔑 Login: manager.nguyen@gmail.com / Pass: 1`);

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        await connection.end();
    }
}

seed();
