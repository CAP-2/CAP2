require('dotenv').config();
const db = require('./src/config/db');

async function runMigration() {
    try {
        console.log("Bắt đầu thay đổi cấu trúc bảng posts...");
        await db.query("ALTER TABLE posts ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'");
        console.log("Migration thêm cột status thành công!");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Cột status đã tồn tại trong bảng posts. Bỏ qua Migration.");
        } else {
            console.error("Lỗi khi chạy Migration:", e);
        }
    } finally {
        process.exit(0);
    }
}

runMigration();
