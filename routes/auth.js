const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 云开发SDK - 连接文档型数据库
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({
  env: process.env.TCB_ENV || 'yundong-backend-3gyx4mzr0c83f74f'
});
const db = app.database();
const _ = db.command;

const JWT_SECRET = process.env.JWT_SECRET || 'yundong-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * 账号密码登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({
        code: 4001,
        message: '手机号和密码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 查询用户
    const userResult = await db.collection('users').where({
      phone: phone
    }).get();

    if (userResult.data.length === 0) {
      return res.status(400).json({
        code: 4002,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const user = userResult.data[0];
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        code: 4003,
        message: '密码错误',
        data: null,
        timestamp: Date.now()
      });
    }

    // 生成token
    const accessToken = jwt.sign(
      { userId: user._id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 更新最后登录时间
    await db.collection('users').doc(user._id).update({
      data: {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          location: user.location,
          sportsPreferences: user.sportsPreferences,
          level: user.level,
          bio: user.bio,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, password, nickname, code } = req.body;
    
    if (!phone || !password || !nickname || !code) {
      return res.status(400).json({
        code: 4001,
        message: '手机号、密码、昵称和验证码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 验证码校验 (这里简化处理，实际需要对接短信服务)
    // TODO: 实现真实的验证码校验

    // 检查手机号是否已注册
    const existResult = await db.collection('users').where({
      phone: phone
    }).get();

    if (existResult.data.length > 0) {
      return res.status(400).json({
        code: 4003,
        message: '手机号已被注册',
        data: null,
        timestamp: Date.now()
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const newUser = {
      phone: phone,
      password: hashedPassword,
      nickname: nickname,
      avatar: '',
      gender: 'unknown',
      location: {
        province: '',
        city: '',
        district: ''
      },
      sportsPreferences: [],
      level: 'beginner',
      bio: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      likesCount: 0,
      isVerified: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createResult = await db.collection('users').add({
      data: newUser
    });

    // 生成token
    const accessToken = jwt.sign(
      { userId: createResult._id, phone: phone },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: createResult._id,
          phone: phone,
          nickname: nickname,
          avatar: '',
          gender: 'unknown',
          sportsPreferences: [],
          level: 'beginner'
        },
        accessToken
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 发送验证码
 * POST /api/auth/send-code
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phone, type = 'register' } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        code: 4001,
        message: '手机号不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // TODO: 接入真实的短信服务商（如腾讯云SMS、阿里云等）
    // 这里模拟发送验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 可以将验证码存储到数据库或Redis中，设置5分钟过期
    // 暂时返回成功状态
    
    res.json({
      code: 0,
      message: '验证码发送成功',
      data: {
        phone: phone,
        // 开发环境下返回验证码，生产环境不返回
        ...(process.env.NODE_ENV === 'development' && { testCode: code })
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      code: 5001,
      message: '验证码发送失败',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 验证码登录
 * POST /api/auth/login-code
 */
router.post('/login-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({
        code: 4001,
        message: '手机号和验证码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // TODO: 验证码校验
    
    // 查询用户
    const userResult = await db.collection('users').where({
      phone: phone
    }).get();

    if (userResult.data.length === 0) {
      return res.status(400).json({
        code: 4002,
        message: '用户不存在，请先注册',
        data: null,
        timestamp: Date.now()
      });
    }

    const user = userResult.data[0];
    
    // 生成token
    const accessToken = jwt.sign(
      { userId: user._id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar
        },
        accessToken
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('验证码登录错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        code: 4001,
        message: 'Refresh token不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 验证refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(400).json({
        code: 4002,
        message: '无效的refresh token',
        data: null,
        timestamp: Date.now()
      });
    }

    // 查询用户
    const userResult = await db.collection('users').doc(decoded.userId).get();
    
    if (!userResult.data) {
      return res.status(400).json({
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const user = userResult.data;
    
    // 生成新的access token
    const newAccessToken = jwt.sign(
      { userId: user._id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      code: 0,
      message: 'success',
      data: {
        accessToken: newAccessToken
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('刷新token错误:', error);
    res.status(401).json({
      code: 4001,
      message: '无效的refresh token',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 检查手机号是否已注册
 * GET /api/auth/check-phone
 */
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        code: 4001,
        message: '手机号不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    const userResult = await db.collection('users').where({
      phone: phone
    }).get();

    res.json({
      code: 0,
      message: 'success',
      data: {
        exists: userResult.data.length > 0
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('检查手机号错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 验证Token有效性
 * GET /api/auth/validate
 */
router.get('/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        code: 4001,
        message: 'Token不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({
      code: 0,
      message: 'Token有效',
      data: {
        userId: decoded.userId,
        phone: decoded.phone
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('验证token错误:', error);
    res.status(401).json({
      code: 4001,
      message: '无效的token',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    // 在实际应用中，可以将token加入黑名单
    // 这里简单返回成功
    res.json({
      code: 0,
      message: '登出成功',
      data: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

module.exports = router; 