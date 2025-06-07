const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 创建上传目录
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: function (req, file, cb) {
    // 允许的文件类型
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 上传单个文件
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 4001,
        message: '没有上传文件',
        data: null,
        timestamp: Date.now()
      });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({
      code: 5001,
      message: error.message || '文件上传失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 上传多个文件
router.post('/multiple', upload.array('files', 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        code: 4001,
        message: '没有上传文件',
        data: null,
        timestamp: Date.now()
      });
    }
    
    const files = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      type: file.mimetype
    }));
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        files
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({
      code: 5001,
      message: error.message || '文件上传失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 头像上传
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 4001,
        message: '没有上传头像文件',
        data: null,
        timestamp: Date.now()
      });
    }
    
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        code: 4002,
        message: '头像只支持 JPG、PNG 格式',
        data: null,
        timestamp: Date.now()
      });
    }
    
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        avatarUrl,
        originalName: req.file.originalname,
        size: req.file.size
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('头像上传错误:', error);
    res.status(500).json({
      code: 5001,
      message: error.message || '头像上传失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 静态文件服务
router.use('/uploads', express.static(uploadDir));

module.exports = router; 