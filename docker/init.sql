-- 1. Đưa tất cả các đời của Họ Nguyễn (ID từ 100 đến 499) vào Cây số 1
INSERT IGNORE INTO family_tree_members (family_tree_id, user_id)
SELECT 1, user_id FROM users 
WHERE user_id BETWEEN 101 AND 405;

-- 2. Kiểm tra lại dữ liệu vừa chèn
SELECT f.family_tree_name, u.first_name, u.last_name 
FROM family_tree_members ftm
JOIN family_trees f ON ftm.family_tree_id = f.family_tree_id
JOIN users u ON ftm.user_id = u.user_id
WHERE f.family_tree_id = 1;