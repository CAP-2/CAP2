-- 1. Thiết lập môi trường
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- [NHÓM 1: GIỮ NGUYÊN]
CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT PRIMARY KEY, -- Bỏ AUTO_INCREMENT để fix cứng 1,2,3
    `role_name` VARCHAR(50) UNIQUE NOT NULL, 
    `description` VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `clans` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `clan_name` VARCHAR(200) NOT NULL,
    `history` TEXT,
    `hall_address` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- [NHÓM 2: CHỈ SỬA CLAN_ID THÀNH NULL]
CREATE TABLE IF NOT EXISTS `people` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `clan_id` INT NULL, -- SỬA TẠI ĐÂY: Để Admin có thể tồn tại mà không cần Clan
    `display_name` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100),
    `middle_name` VARCHAR(100),
    `surname` VARCHAR(100),
    `gender` TINYINT COMMENT '1: Nam, 2: Nữ',
    `generation` INT NOT NULL DEFAULT 1,
    `branch` INT COMMENT 'Chi thứ mấy',
    `birth_date` DATE,
    `death_date` DATE,
    `is_living` BOOLEAN DEFAULT 1,
    `phone` VARCHAR(20),
    `email` VARCHAR(255),
    `zalo` VARCHAR(50),
    `facebook` VARCHAR(255),
    `address` TEXT,
    `hometown` VARCHAR(255),
    `avatar_url` TEXT,
    `bio` TEXT,
    `note` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_People_Clan` FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON DELETE CASCADE,
    INDEX `idx_people_phone` (`phone`),
    INDEX `idx_people_email` (`email`),
    INDEX `idx_display_name` (`display_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `accounts` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `email` VARCHAR(255) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `person_id` INT UNIQUE NULL,
    `role_id` INT DEFAULT 3,
    `status` ENUM('pending', 'active', 'rejected') DEFAULT 'pending', -- THÊM: Để Manager có thể duyệt User
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Account_Person` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE SET NULL,
    CONSTRAINT `FK_Account_Role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `UK_pwd_reset_email` (`email`),
    INDEX `idx_pwd_reset_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NHÓM 3: QUAN HỆ GIA ĐÌNH
-- ============================================================

CREATE TABLE IF NOT EXISTS `families` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `clan_id` INT NOT NULL, -- THÊM: Để biết gia đình thuộc họ nào
    `father_id` INT NULL,
    `mother_id` INT NULL,
    `marriage_date` DATE,
    CONSTRAINT `FK_Fam_Clan` FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS `children` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `family_id` INT NOT NULL,
    `person_id` INT NOT NULL,
    `sort_order` INT DEFAULT 0,
    UNIQUE KEY `UK_family_person` (`family_id`, `person_id`),
    CONSTRAINT `FK_Child_Family` FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Child_Person` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NHÓM 4: MẠNG XÃ HỘI (BÀI VIẾT, LIKE, COMMENT)
-- ============================================================

CREATE TABLE IF NOT EXISTS `posts` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `clan_id` INT NOT NULL, -- THÊM: Bài viết thuộc phạm vi dòng họ nào
    `author_id` INT NOT NULL,
    `content` TEXT NOT NULL,
    `image_url` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Post_Clan` FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `post_likes` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `post_id` INT NOT NULL,
    `person_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `UK_post_person` (`post_id`, `person_id`),
    CONSTRAINT `FK_PostLikes_Post` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_PostLikes_Person` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `post_comments` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `post_id` INT NOT NULL,
    `person_id` INT NOT NULL,
    `parent_id` INT NULL DEFAULT NULL,
    `content` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_comment_post` (`post_id`),
    CONSTRAINT `FK_Comments_Post` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Comments_Person` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Comments_Parent` FOREIGN KEY (`parent_id`) REFERENCES `post_comments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NHÓM 5: SỰ KIỆN & TÀI CHÍNH
-- ============================================================
CREATE TABLE IF NOT EXISTS `events` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `clan_id` INT NOT NULL, -- THÊM: Sự kiện của dòng họ nào
    `title` VARCHAR(255) NOT NULL,
    `event_date` DATE,
    `description` TEXT,
    CONSTRAINT `FK_Event_Clan` FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `event_costs` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `event_id` INT NOT NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `note` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Costs_Event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_contributions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `event_id` INT NOT NULL,
    `person_id` INT NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `contribution_date` DATE,
    `method` VARCHAR(50) DEFAULT 'Tiền mặt',
    `note` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Contrib_Event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Contrib_Person` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NHÓM 6: THÔNG BÁO (NOTIFICATIONS)
-- ============================================================

CREATE TABLE IF NOT EXISTS `manager_announcements` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `manager_account_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Manager_Announce` FOREIGN KEY (`manager_account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `receiver_person_id` INT NOT NULL,
    `type` VARCHAR(50),
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` BOOLEAN DEFAULT 0,
    `link_url` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_notify_unread` (`receiver_person_id`, `is_read`),
    CONSTRAINT `FK_Notify_Receiver` FOREIGN KEY (`receiver_person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NHÓM 7: CÔNG CỤ AI
-- ============================================================

CREATE TABLE IF NOT EXISTS `conversations` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `account_id` INT NOT NULL,
    `title` VARCHAR(255) DEFAULT 'Cuộc hội thoại mới',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Chat_Account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `conversation_id` INT NOT NULL,
    `sender_type` ENUM('user', 'ai') NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `FK_Message_Chat` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;