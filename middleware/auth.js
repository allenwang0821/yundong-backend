const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'yundong-secret-key';

/**
 * JWT认证中间件
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      code: 4001,
      message: '缺少访问token',
      data: null,
      timestamp: Date.now()
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone
    };
    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    return res.status(401).json({
      code: 4001,
      message: '无效的token',
      data: null,
      timestamp: Date.now()
    });
  }
};

/**
 * 可选认证中间件 - 如果有token则验证，没有token也允许通过
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        userId: decoded.userId,
        phone: decoded.phone
      };
    } catch (error) {
      // Token无效但不阻止请求
      console.warn('可选认证中token无效:', error.message);
    }
  }
  
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth
}; 