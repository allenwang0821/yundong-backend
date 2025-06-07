// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 用户登录/注册云函数
 * 支持微信授权登录和手机号登录
 */
exports.main = async (event, context) => {
  // 对于非微信环境，使用自定义用户标识
  const openid = event.openid || context.SOURCE || 'anonymous';
  
  // 添加调试日志
  console.log('Received event:', JSON.stringify(event));
  console.log('Received context:', JSON.stringify(context));
  
  try {
    const { action, data } = event;
    
    if (!action) {
      return {
        code: 4001,
        message: '缺少action参数',
        data: null,
        timestamp: Date.now()
      };
    }

    switch (action) {
      case 'wechat_login':
        return await handleWechatLogin(openid, data);
      case 'phone_login':
        return await handlePhoneLogin(openid, data);
      case 'register':
        return await handleRegister(openid, data);
      case 'get_user_info':
        return await getUserInfo(openid);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('用户登录云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 微信授权登录
 */
async function handleWechatLogin(openid, data) {
  try {
    // 查询用户是否已存在
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    let user;
    if (userResult.data.length === 0) {
      // 用户不存在，创建新用户
      const newUser = {
        _openid: openid,
        nickname: data.userInfo?.nickName || '运动搭子用户',
        avatar: data.userInfo?.avatarUrl || '',
        gender: data.userInfo?.gender === 1 ? 'male' : data.userInfo?.gender === 2 ? 'female' : 'unknown',
        location: {
          province: data.userInfo?.province || '',
          city: data.userInfo?.city || '',
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
    } else {
      // 用户已存在，更新登录时间
      user = userResult.data[0];
      await db.collection('users').doc(user._id).update({
        data: {
          updatedAt: new Date()
        }
      });
    }

    return {
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
        isNewUser: userResult.data.length === 0
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('微信登录处理错误:', error);
    throw error;
  }
}

/**
 * 手机号登录
 */
async function handlePhoneLogin(openid, data) {
  try {
    const { phone, code } = data;
    
    if (!phone || !code) {
      return {
        code: 4001,
        message: '手机号和验证码不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 这里应该验证短信验证码，暂时跳过验证码校验
    // TODO: 接入短信验证服务

    // 查询用户是否已存在
    const userResult = await db.collection('users').where({
      phone: phone
    }).get();

    let user;
    if (userResult.data.length === 0) {
      return {
        code: 4002,
        message: '用户不存在，请先注册',
        data: null,
        timestamp: Date.now()
      };
    } else {
      user = userResult.data[0];
      // 更新openid绑定
      await db.collection('users').doc(user._id).update({
        data: {
          _openid: openid,
          updatedAt: new Date()
        }
      });
    }

    return {
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
    };
  } catch (error) {
    console.error('手机号登录处理错误:', error);
    throw error;
  }
}

/**
 * 用户注册
 */
async function handleRegister(openid, data) {
  try {
    const { phone, code, nickname, gender, birthday } = data;
    
    if (!phone || !code || !nickname) {
      return {
        code: 4001,
        message: '手机号、验证码和昵称不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查手机号是否已注册
    const existUser = await db.collection('users').where({
      phone: phone
    }).get();

    if (existUser.data.length > 0) {
      return {
        code: 4003,
        message: '手机号已注册',
        data: null,
        timestamp: Date.now()
      };
    }

    // 创建新用户
    const newUser = {
      _openid: openid,
      phone: phone,
      nickname: nickname,
      avatar: '',
      gender: gender || 'unknown',
      birthday: birthday || '',
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

    return {
      code: 0,
      message: 'success',
      data: {
        user: {
          id: createResult._id,
          openid: newUser._openid,
          phone: newUser.phone,
          nickname: newUser.nickname,
          avatar: newUser.avatar,
          gender: newUser.gender,
          birthday: newUser.birthday,
          location: newUser.location,
          sportsPreferences: newUser.sportsPreferences,
          level: newUser.level,
          bio: newUser.bio,
          followersCount: newUser.followersCount,
          followingCount: newUser.followingCount,
          postsCount: newUser.postsCount,
          likesCount: newUser.likesCount,
          isVerified: newUser.isVerified
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('用户注册处理错误:', error);
    throw error;
  }
}

/**
 * 获取用户信息
 */
async function getUserInfo(openid) {
  try {
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (userResult.data.length === 0) {
      return {
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const user = userResult.data[0];
    
    return {
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          openid: user._openid,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          birthday: user.birthday,
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
    };
  } catch (error) {
    console.error('获取用户信息错误:', error);
    throw error;
  }
} 