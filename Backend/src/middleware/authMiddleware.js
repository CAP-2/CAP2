const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Truy cập bị từ chối. Vui lòng đăng nhập!"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Lưu id và role_id vào req
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: "Token không hợp lệ hoặc đã hết hạn!"
        });
    }
};

exports.checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role_id)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện hành động này!"
            });
        }
        next();
    };
};