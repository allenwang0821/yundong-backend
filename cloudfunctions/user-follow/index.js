// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 用户关注系统云函数
 * 支持关注、取消关注、获取关注列表等功能
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
      case 'follow':
        return await followUser(OPENID, data);
      case 'unfollow':
        return await unfollowUser(OPENID, data);
      case 'followers':
        return await getFollowers(OPENID, data);
      case 'following':
        return await getFollowing(OPENID, data);
      case 'check_follow_status':
        return await checkFollowStatus(OPENID, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('关注系统云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 关注用户
 */
async function followUser(openid, data) {
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

    // 获取当前用户信息
    const currentUserResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        code: 4004,
        message: '当前用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const currentUser = currentUserResult.data[0];

    // 检查要关注的用户是否存在
    const targetUserResult = await db.collection('users').doc(userId).get();
    
    if (!targetUserResult.data) {
      return {
        code: 4004,
        message: '要关注的用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    // 不能关注自己
    if (currentUser._id === userId) {
      return {
        code: 4002,
        message: '不能关注自己',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否已经关注
    const existFollow = await db.collection('follows').where({
      followerId: currentUser._id,
      followingId: userId,
      status: 'active'
    }).get();

    if (existFollow.data.length > 0) {
      return {
        code: 4003,
        message: '已经关注过该用户',
        data: null,
        timestamp: Date.now()
      };
    }

    // 创建关注关系
    await db.collection('follows').add({
      data: {
        followerId: currentUser._id,
        followingId: userId,
        status: 'active',
        createdAt: new Date()
      }
    });

    // 更新关注者的关注数
    await db.collection('users').doc(currentUser._id).update({
      data: {
        followingCount: _.inc(1)
      }
    });

    // 更新被关注者的粉丝数
    await db.collection('users').doc(userId).update({
      data: {
        followersCount: _.inc(1)
      }
    });

    // 发送关注通知
    await db.collection('messages').add({
      data: {
        _openid: targetUserResult.data._openid,
        senderId: currentUser._id,
        receiverId: userId,
        type: 'follow',
        content: `${currentUser.nickname} 关注了你`,
        relatedId: currentUser._id,
        isRead: false,
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        isFollowing: true,
        followersCount: targetUserResult.data.followersCount + 1
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('关注用户错误:', error);
    throw error;
  }
}

/**
 * 取消关注用户
 */
async function unfollowUser(openid, data) {
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

    // 获取当前用户信息
    const currentUserResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        code: 4004,
        message: '当前用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const currentUser = currentUserResult.data[0];

    // 删除关注关系
    const deleteResult = await db.collection('follows').where({
      followerId: currentUser._id,
      followingId: userId,
      status: 'active'
    }).remove();

    if (deleteResult.stats.removed === 0) {
      return {
        code: 4005,
        message: '未关注该用户',
        data: null,
        timestamp: Date.now()
      };
    }

    // 更新关注者的关注数
    await db.collection('users').doc(currentUser._id).update({
      data: {
        followingCount: _.inc(-1)
      }
    });

    // 更新被关注者的粉丝数
    const targetUserResult = await db.collection('users').doc(userId).get();
    if (targetUserResult.data) {
      await db.collection('users').doc(userId).update({
        data: {
          followersCount: _.inc(-1)
        }
      });
    }

    return {
      code: 0,
      message: 'success',
      data: {
        isFollowing: false,
        followersCount: targetUserResult.data ? targetUserResult.data.followersCount - 1 : 0
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('取消关注用户错误:', error);
    throw error;
  }
}

/**
 * 获取粉丝列表
 */
async function getFollowers(openid, data) {
  try {
    const { userId, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    // 如果没有指定userId，获取当前用户的粉丝
    let targetUserId = userId;
    if (!targetUserId) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();

      if (currentUserResult.data.length === 0) {
        return {
          code: 4004,
          message: '用户不存在',
          data: null,
          timestamp: Date.now()
        };
      }

      targetUserId = currentUserResult.data[0]._id;
    }

    // 获取关注关系
    const followsResult = await db.collection('follows')
      .where({
        followingId: targetUserId,
        status: 'active'
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取粉丝用户信息
    const followers = await Promise.all(followsResult.data.map(async (follow) => {
      const userResult = await db.collection('users').doc(follow.followerId).get();
      const user = userResult.data;

      // 检查当前用户是否关注了该粉丝
      let isFollowing = false;
      if (openid) {
        const currentUserResult = await db.collection('users').where({
          _openid: openid
        }).get();
        
        if (currentUserResult.data.length > 0) {
          const followBackResult = await db.collection('follows').where({
            followerId: currentUserResult.data[0]._id,
            followingId: follow.followerId,
            status: 'active'
          }).get();
          
          isFollowing = followBackResult.data.length > 0;
        }
      }

      return {
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        isFollowing: isFollowing,
        followedAt: follow.createdAt
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        followers: followers,
        hasMore: followers.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取粉丝列表错误:', error);
    throw error;
  }
}

/**
 * 获取关注列表
 */
async function getFollowing(openid, data) {
  try {
    const { userId, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    // 如果没有指定userId，获取当前用户的关注
    let targetUserId = userId;
    if (!targetUserId) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();

      if (currentUserResult.data.length === 0) {
        return {
          code: 4004,
          message: '用户不存在',
          data: null,
          timestamp: Date.now()
        };
      }

      targetUserId = currentUserResult.data[0]._id;
    }

    // 获取关注关系
    const followsResult = await db.collection('follows')
      .where({
        followerId: targetUserId,
        status: 'active'
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取关注的用户信息
    const following = await Promise.all(followsResult.data.map(async (follow) => {
      const userResult = await db.collection('users').doc(follow.followingId).get();
      const user = userResult.data;

      // 检查当前用户是否关注了该用户
      let isFollowing = false;
      if (openid) {
        const currentUserResult = await db.collection('users').where({
          _openid: openid
        }).get();
        
        if (currentUserResult.data.length > 0) {
          // 如果查看的是自己的关注列表，肯定是已关注
          if (currentUserResult.data[0]._id === targetUserId) {
            isFollowing = true;
          } else {
            const followResult = await db.collection('follows').where({
              followerId: currentUserResult.data[0]._id,
              followingId: follow.followingId,
              status: 'active'
            }).get();
            
            isFollowing = followResult.data.length > 0;
          }
        }
      }

      return {
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        isFollowing: isFollowing,
        followedAt: follow.createdAt
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        following: following,
        hasMore: following.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取关注列表错误:', error);
    throw error;
  }
}

/**
 * 检查关注状态
 */
async function checkFollowStatus(openid, data) {
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

    // 获取当前用户信息
    const currentUserResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        code: 4004,
        message: '当前用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const currentUser = currentUserResult.data[0];

    // 检查是否关注
    const followResult = await db.collection('follows').where({
      followerId: currentUser._id,
      followingId: userId,
      status: 'active'
    }).get();

    const isFollowing = followResult.data.length > 0;

    // 检查是否被关注（互相关注）
    const followBackResult = await db.collection('follows').where({
      followerId: userId,
      followingId: currentUser._id,
      status: 'active'
    }).get();

    const isFollowedBy = followBackResult.data.length > 0;

    return {
      code: 0,
      message: 'success',
      data: {
        isFollowing: isFollowing,
        isFollowedBy: isFollowedBy,
        isMutualFollow: isFollowing && isFollowedBy
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('检查关注状态错误:', error);
    throw error;
  }
} 