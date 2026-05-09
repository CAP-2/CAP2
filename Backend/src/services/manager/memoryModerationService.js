const { db } = require('./commonService');

const ensureFamilyMemoriesSchemaForManager = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS family_memories (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            clan_id BIGINT UNSIGNED NOT NULL,
            author_account_id BIGINT UNSIGNED NULL,
            author_person_id BIGINT UNSIGNED NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NULL,
            media_id BIGINT UNSIGNED NULL,
            media_url TEXT NULL,
            media_type VARCHAR(30) NOT NULL DEFAULT 'text',
            mime_type VARCHAR(120) NULL,
            original_filename VARCHAR(255) NULL,
            status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
            rejection_reason TEXT NULL,
            approved_by_account_id BIGINT UNSIGNED NULL,
            approved_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_family_memories_clan_status (clan_id, status),
            KEY idx_family_memories_author (author_account_id),
            KEY idx_family_memories_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

const mapManagerMemoryRow = (row) => ({
    ...row,
    media_id: row.media_id || null,
    media_url: row.media_id ? `/api/media/${row.media_id}` : row.media_url || null,
    author_name: row.author_name || row.author_email || 'Thành viên dòng họ',
});

module.exports = {
    ensureFamilyMemoriesSchemaForManager,
    mapManagerMemoryRow,
};
