// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 用户信息管理云函数
 * 支持获取和更新用户信息
 */
exports.main = async (event, context) => {
  const openid = event.openid || context.SOURCE || 'anonymous';
  
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
      case 'get_profile':
        return await getProfile(OPENID, data);
      case 'update_profile':
        return await updateProfile(OPENID, data);
      case 'upload_avatar':
        return await uploadAvatar(OPENID, data);
      case 'get_user_by_id':
        return await getUserById(OPENID, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('用户信息管理云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 获取用户资料
 */
async function getProfile(openid, data) {
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
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          birthday: user.birthday,
          phone: user.phone,
          location: user.location,
          sportsPreferences: user.sportsPreferences,
          level: user.level,
          bio: user.bio,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          likesCount: user.likesCount,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取用户资料错误:', error);
    throw error;
  }
}

/**
 * 更新用户资料
 */
async function updateProfile(openid, data) {
  try {
    const { 
      nickname, 
      gender, 
      birthday, 
      location, 
      sportsPreferences, 
      level, 
      bio 
    } = data;

    // 参数验证
    if (nickname && nickname.length > 20) {
      return {
        code: 4001,
        message: '昵称长度不能超过20个字符',
        data: null,
        timestamp: Date.now()
      };
    }

    if (bio && bio.length > 200) {
      return {
        code: 4001,
        message: '个人简介长度不能超过200个字符',
        data: null,
        timestamp: Date.now()
      };
    }

    // 构建更新数据
    const updateData = {
      updatedAt: new Date()
    };

    if (nickname !== undefined) updateData.nickname = nickname;
    if (gender !== undefined) updateData.gender = gender;
    if (birthday !== undefined) updateData.birthday = birthday;
    if (location !== undefined) updateData.location = location;
    if (sportsPreferences !== undefined) updateData.sportsPreferences = sportsPreferences;
    if (level !== undefined) updateData.level = level;
    if (bio !== undefined) updateData.bio = bio;

    // 执行更新
    const updateResult = await db.collection('users').where({
      _openid: openid
    }).update({
      data: updateData
    });

    if (updateResult.stats.updated === 0) {
      return {
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    // 返回更新后的用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    const user = userResult.data[0];

    return {
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
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
    console.error('更新用户资料错误:', error);
    throw error;
  }
}

/**
 * 上传用户头像
 */
async function uploadAvatar(openid, data) {
  try {
    const { fileContent, fileName } = data;
    
    if (!fileContent || !fileName) {
      return {
        code: 4001,
        message: '文件内容和文件名不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 上传文件到云存储
    const timestamp = Date.now();
    const cloudPath = `avatars/${openid}/${timestamp}-${fileName}`;
    
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(fileContent, 'base64')
    });

    if (!uploadResult.fileID) {
      return {
        code: 5002,
        message: '文件上传失败',
        data: null,
        timestamp: Date.now()
      };
    }

    // 更新用户头像URL
    const updateResult = await db.collection('users').where({
      _openid: openid
    }).update({
      data: {
        avatar: uploadResult.fileID,
        updatedAt: new Date()
      }
    });

    if (updateResult.stats.updated === 0) {
      return {
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        avatarUrl: uploadResult.fileID
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('上传头像错误:', error);
    throw error;
  }
}

/**
 * 根据用户ID获取用户信息
 */
async function getUserById(openid, data) {
  try {
    const { userId } = data;
    
    if (!userId) {
      return {
        code: 4001,
        message: '用户ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const userResult = await db.collection('users').doc(userId).get();

    if (!userResult.data) {
      return {
        code: 4004,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const user = userResult.data;

    // 检查是否关注了该用户
    let isFollowing = false;
    if (openid) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();
      
      if (currentUserResult.data.length > 0) {
        const followResult = await db.collection('follows').where({
          followerId: currentUserResult.data[0]._id,
          followingId: userId,
          status: 'active'
        }).get();
        
        isFollowing = followResult.data.length > 0;
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        user: {
          id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          level: user.level,
          bio: user.bio,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          likesCount: user.likesCount,
          isVerified: user.isVerified,
          isFollowing: isFollowing
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取用户信息错误:', error);
    throw error;
  }
} 