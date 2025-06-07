const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'yundong-backend',
    version: '2.1.0'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({ 
    message: '运动应用后端服务 - 简化版',
    version: '2.1.0',
    status: 'running',
    endpoints: [
      'GET /health - 健康检查',
      'GET / - 服务信息',
      'POST /api/test - 测试接口'
    ]
  });
});

// 测试接口
app.post('/api/test', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      received: req.body,
      timestamp: Date.now()
    }
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
  console.log(`🌍 监听地址: 0.0.0.0:${PORT}`);
});

module.exports = app; 