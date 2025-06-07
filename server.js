const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 导入路由模块
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const activityRoutes = require('./routes/activity');
const messageRoutes = require('./routes/message');
const uploadRoutes = require('./routes/upload');

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/upload', uploadRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路由
app.get('/', (req, res) => {
  res.json({ 
    message: '运动应用后端服务',
    version: '2.0.0',
    status: 'running',
    features: [
      '用户认证系统',
      '活动管理',
      '消息系统', 
      '文件上传',
      '云数据库集成'
    ]
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    code: 4004,
    message: '接口不存在',
    data: null,
    timestamp: Date.now()
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    code: 5001,
    message: '服务器内部错误',
    data: null,
    timestamp: Date.now()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 运动应用后端服务启动成功!`);
  console.log(`📡 服务器运行在端口: ${PORT}`);
  console.log(`🌐 本地访问地址: http://localhost:${PORT}`);
  console.log(`📋 API文档: http://localhost:${PORT}/`);
  console.log(`💾 数据库: 腾讯云文档型数据库`);
  console.log(`🔐 认证: JWT Token`);
  console.log(`🌍 监听地址: 0.0.0.0:${PORT}`);
});

module.exports = app; 