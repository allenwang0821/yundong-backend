const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// 云开发SDK - 连接文档型数据库
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({
  env: process.env.TCB_ENV || 'yundong-backend-3gyx4mzr0c83f74f'
});
const db = app.database();
const _ = db.command;

/**
 * 微信授权登录
 * POST /api/user/wechat-login
 */
router.post('/wechat-login', async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || req.body.openid || 'test-openid';
    const { userInfo } = req.body;
    
    // 查询用户是否已存在
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    let user;
    let isNewUser = false;
    
    if (userResult.data.length === 0) {
      // 用户不存在，创建新用户
      const newUser = {
        _openid: openid,
        nickname: userInfo?.nickName || '运动搭子用户',
        avatar: userInfo?.avatarUrl || '',
        gender: userInfo?.gender === 1 ? 'male' : userInfo?.gender === 2 ? 'female' : 'unknown',
        location: {
          province: userInfo?.province || '',
          city: userInfo?.city || '',
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

      user = { _id: createResult._id, ...newUser };
      isNewUser = true;
    } else {
      // 用户已存在，更新登录时间
      user = userResult.data[0];
      await db.collection('users').doc(user._id).update({
        data: {
          updatedAt: new Date()
        }
      });
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          openid: user._openid,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          location: user.location,
          sportsPreferences: user.sportsPreferences,
          level: user.level,
          bio: user.bio,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          likesCount: user.likesCount,
          isVerified: user.isVerified
        },
        isNewUser
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 手机号登录
 * POST /api/user/phone-login
 */
router.post('/phone-login', async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || req.body.openid || 'test-openid';
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({
        code: 4001,
        message: '手机号和验证码不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 这里应该验证短信验证码，暂时跳过验证码校验
    // TODO: 接入短信验证服务

    // 查询用户是否已存在
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
    // 更新openid绑定
    await db.collection('users').doc(user._id).update({
      data: {
        _openid: openid,
        updatedAt: new Date()
      }
    });

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          openid: openid,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          location: user.location,
          sportsPreferences: user.sportsPreferences,
          level: user.level,
          bio: user.bio,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          likesCount: user.likesCount,
          isVerified: user.isVerified
        }
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('手机号登录错误:', error);
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
 * POST /api/user/register
 */
router.post('/register', async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || req.body.openid || 'test-openid';
    const { phone, code, nickname, sportsPreferences } = req.body;
    
    if (!phone || !code || !nickname) {
      return res.status(400).json({
        code: 4001,
        message: '手机号、验证码和昵称不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 检查手机号是否已被注册
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

    // 创建新用户
    const newUser = {
      _openid: openid,
      phone: phone,
      nickname: nickname,
      avatar: '',
      gender: 'unknown',
      location: {
        province: '',
        city: '',
        district: ''
      },
      sportsPreferences: sportsPreferences || [],
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

    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: createResult._id,
          ...newUser
        }
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('用户注册错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 获取用户信息
 * GET /api/user/profile/:id
 */
router.get('/profile/:id?', optionalAuth, async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || 'test-openid';
    const userId = req.params.id;
    
    let whereCondition;
    if (userId) {
      whereCondition = { _id: userId };
    } else {
      whereCondition = { _openid: openid };
    }

    const userResult = await db.collection('users').where(whereCondition).get();

    if (userResult.data.length === 0) {
      return res.status(404).json({
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    const user = userResult.data[0];
    res.json({
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          location: user.location,
          sportsPreferences: user.sportsPreferences,
          level: user.level,
          bio: user.bio,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          likesCount: user.likesCount,
          isVerified: user.isVerified
        }
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 更新用户资料
 * PUT /api/user/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || 'test-openid';
    const updateData = req.body;
    
    // 移除不允许直接更新的字段
    delete updateData._id;
    delete updateData._openid;
    delete updateData.followersCount;
    delete updateData.followingCount;
    delete updateData.postsCount;
    delete updateData.likesCount;
    delete updateData.createdAt;
    
    updateData.updatedAt = new Date();

    const updateResult = await db.collection('users').where({
      _openid: openid
    }).update({
      data: updateData
    });

    if (updateResult.stats.updated === 0) {
      return res.status(404).json({
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 0,
      message: 'success',
      data: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 关注用户
 * POST /api/user/:id/follow
 */
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const targetUserId = req.params.id;
    
    if (userId === targetUserId) {
      return res.status(400).json({
        code: 4001,
        message: '不能关注自己',
        data: null,
        timestamp: Date.now()
      });
    }

    // 检查目标用户是否存在
    const targetUser = await db.collection('users').doc(targetUserId).get();
    if (!targetUser.data) {
      return res.status(404).json({
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      });
    }

    // 检查是否已经关注
    const existingFollow = await db.collection('follows').where({
      followerId: userId,
      followingId: targetUserId
    }).get();

    if (existingFollow.data.length > 0) {
      return res.status(400).json({
        code: 4002,
        message: '已经关注过该用户',
        data: null,
        timestamp: Date.now()
      });
    }

    // 创建关注关系
    await db.collection('follows').add({
      data: {
        followerId: userId,
        followingId: targetUserId,
        createdAt: new Date()
      }
    });

    // 更新关注数和粉丝数
    await db.collection('users').doc(userId).update({
      data: {
        followingCount: _.inc(1)
      }
    });

    await db.collection('users').doc(targetUserId).update({
      data: {
        followersCount: _.inc(1)
      }
    });

    res.json({
      code: 0,
      message: '关注成功',
      data: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('关注用户错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 取消关注
 * DELETE /api/user/:id/follow
 */
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const targetUserId = req.params.id;

    // 删除关注关系
    const deleteResult = await db.collection('follows').where({
      followerId: userId,
      followingId: targetUserId
    }).remove();

    if (deleteResult.stats.removed === 0) {
      return res.status(400).json({
        code: 4002,
        message: '未关注该用户',
        data: null,
        timestamp: Date.now()
      });
    }

    // 更新关注数和粉丝数
    await db.collection('users').doc(userId).update({
      data: {
        followingCount: _.inc(-1)
      }
    });

    await db.collection('users').doc(targetUserId).update({
      data: {
        followersCount: _.inc(-1)
      }
    });

    res.json({
      code: 0,
      message: '取消关注成功',
      data: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('取消关注错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 获取关注列表
 * GET /api/user/:id/following
 */
router.get('/:id/following', optionalAuth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const followsResult = await db.collection('follows')
      .where({ followerId: targetUserId })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();

    // 获取被关注用户的详细信息
    const userIds = followsResult.data.map(follow => follow.followingId);
    const users = [];

    for (const userId of userIds) {
      const userResult = await db.collection('users').doc(userId).get();
      if (userResult.data) {
        users.push({
          id: userResult.data._id,
          nickname: userResult.data.nickname,
          avatar: userResult.data.avatar,
          bio: userResult.data.bio,
          isVerified: userResult.data.isVerified
        });
      }
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        users,
        hasMore: users.length === parseInt(limit)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取关注列表错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 获取粉丝列表
 * GET /api/user/:id/followers
 */
router.get('/:id/followers', optionalAuth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const followsResult = await db.collection('follows')
      .where({ followingId: targetUserId })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();

    // 获取粉丝用户的详细信息
    const userIds = followsResult.data.map(follow => follow.followerId);
    const users = [];

    for (const userId of userIds) {
      const userResult = await db.collection('users').doc(userId).get();
      if (userResult.data) {
        users.push({
          id: userResult.data._id,
          nickname: userResult.data.nickname,
          avatar: userResult.data.avatar,
          bio: userResult.data.bio,
          isVerified: userResult.data.isVerified
        });
      }
    }

    res.json({
      code: 0,
      message: 'success',
      data: {
        users,
        hasMore: users.length === parseInt(limit)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取粉丝列表错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

/**
 * 搜索用户
 * GET /api/user/search
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { keyword, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!keyword) {
      return res.status(400).json({
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      });
    }

    // 模糊搜索用户昵称
    const usersResult = await db.collection('users')
      .where({
        nickname: new RegExp(keyword, 'i')
      })
      .skip(skip)
      .limit(parseInt(limit))
      .get();

    const users = usersResult.data.map(user => ({
      id: user._id,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      isVerified: user.isVerified,
      followersCount: user.followersCount
    }));

    res.json({
      code: 0,
      message: 'success',
      data: {
        users,
        hasMore: users.length === parseInt(limit)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('搜索用户错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

module.exports = router; 