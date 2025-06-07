// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 活动管理云函数
 * 支持创建、获取、加入、管理活动等功能
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
      case 'create':
        return await createActivity(openid, data);
      case 'list':
        return await getActivitiesList(openid, data);
      case 'detail':
        return await getActivityDetail(openid, data);
      case 'join_request':
        return await joinActivity(openid, data);
      case 'approve_request':
        return await approveJoinRequest(openid, data);
      case 'reject_request':
        return await rejectJoinRequest(openid, data);
      case 'leave_activity':
        return await leaveActivity(openid, data);
      case 'my_activities':
        return await getMyActivities(openid, data);
      case 'my_joined_activities':
        return await getMyJoinedActivities(openid, data);
      case 'cancel_activity':
        return await cancelActivity(openid, data);
      case 'recommend':
        return await getRecommendedActivities(openid, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('活动管理云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 创建活动
 */
async function createActivity(openid, data) {
  try {
    const {
      title,
      description,
      sport,
      category,
      coverImage,
      images = [],
      location,
      dateTime,
      participants,
      fee,
      tags = [],
      contactInfo
    } = data;

    // 参数验证
    if (!title || !description || !sport || !location || !dateTime || !participants) {
      return {
        code: 4001,
        message: '活动标题、描述、运动类型、地点、时间和人数信息不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 验证活动时间
    const startTime = new Date(dateTime.startTime);
    if (startTime <= new Date()) {
      return {
        code: 4001,
        message: '活动开始时间不能早于当前时间',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取用户信息
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

    // 创建活动
    const newActivity = {
      _openid: openid,
      organizerId: user._id,
      title: title,
      description: description,
      sport: sport,
      category: category || '',
      coverImage: coverImage || '',
      images: images,
      location: location,
      dateTime: {
        startTime: new Date(dateTime.startTime),
        endTime: new Date(dateTime.endTime),
        duration: dateTime.duration || 120
      },
      participants: {
        maxCount: participants.maxCount,
        currentCount: 1, // 创建者自动加入
        minCount: participants.minCount || 2,
        genderLimit: participants.genderLimit || 'all',
        ageRange: participants.ageRange || [18, 60],
        levelRequirement: participants.levelRequirement || 'all'
      },
      fee: {
        amount: fee?.amount || 0,
        payType: fee?.payType || 'free',
        includeEquipment: fee?.includeEquipment || false
      },
      tags: tags,
      contactInfo: contactInfo || {},
      status: 'recruiting',
      joinRequests: [],
      participants: [user._id], // 创建者自动加入
      viewsCount: 0,
      likesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createResult = await db.collection('activities').add({
      data: newActivity
    });

    return {
      code: 0,
      message: 'success',
      data: {
        activityId: createResult._id,
        activity: {
          id: createResult._id,
          ...newActivity,
          organizer: {
            id: user._id,
            nickname: user.nickname,
            avatar: user.avatar,
            isVerified: user.isVerified
          }
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('创建活动错误:', error);
    throw error;
  }
}

/**
 * 获取活动列表
 */
async function getActivitiesList(openid, data) {
  try {
    const {
      page = 1,
      pageSize = 20,
      sport = 'all',
      location = null,
      timeRange = 'all',
      status = 'recruiting'
    } = data;

    const skip = (page - 1) * pageSize;

    // 构建查询条件
    let whereCondition = {};

    // 状态筛选
    if (status === 'recruiting') {
      whereCondition.status = 'recruiting';
    } else if (status === 'ongoing') {
      whereCondition.status = 'ongoing';
    } else if (status === 'all') {
      whereCondition.status = _.in(['recruiting', 'ongoing']);
    }

    // 运动类型筛选
    if (sport !== 'all') {
      whereCondition.sport = sport;
    }

    // 时间范围筛选
    if (timeRange === 'today') {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      whereCondition['dateTime.startTime'] = _.gte(today).and(_.lt(tomorrow));
    } else if (timeRange === 'week') {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      whereCondition['dateTime.startTime'] = _.gte(today).and(_.lt(nextWeek));
    }

    // 地理位置筛选（简化实现）
    if (location) {
      whereCondition['location.city'] = location.city;
    }

    // 查询活动
    const activitiesResult = await db.collection('activities')
      .where(whereCondition)
      .orderBy('dateTime.startTime', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取当前用户信息
    let currentUser = null;
    if (openid) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();
      currentUser = currentUserResult.data[0];
    }

    // 获取活动详细信息
    const activities = await Promise.all(activitiesResult.data.map(async (activity) => {
      // 获取组织者信息
      const organizerResult = await db.collection('users').doc(activity.organizerId).get();
      const organizer = organizerResult.data;

      // 检查当前用户状态
      let userStatus = 'none'; // none, requested, joined
      if (currentUser) {
        if (activity.participants.includes(currentUser._id)) {
          userStatus = 'joined';
        } else if (activity.joinRequests.includes(currentUser._id)) {
          userStatus = 'requested';
        }
      }

      return {
        id: activity._id,
        title: activity.title,
        description: activity.description,
        sport: activity.sport,
        coverImage: activity.coverImage,
        location: activity.location,
        dateTime: activity.dateTime,
        participants: activity.participants,
        fee: activity.fee,
        tags: activity.tags,
        status: activity.status,
        viewsCount: activity.viewsCount,
        likesCount: activity.likesCount,
        createdAt: activity.createdAt,
        organizer: {
          id: organizer._id,
          nickname: organizer.nickname,
          avatar: organizer.avatar,
          isVerified: organizer.isVerified
        },
        userStatus: userStatus
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        activities: activities,
        hasMore: activities.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取活动列表错误:', error);
    throw error;
  }
}

/**
 * 获取活动详情
 */
async function getActivityDetail(openid, data) {
  try {
    const { activityId } = data;
    
    if (!activityId) {
      return {
        code: 4001,
        message: '活动ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 增加浏览量
    await db.collection('activities').doc(activityId).update({
      data: {
        viewsCount: _.inc(1)
      }
    });

    // 获取组织者信息
    const organizerResult = await db.collection('users').doc(activity.organizerId).get();
    const organizer = organizerResult.data;

    // 获取参与者信息
    const participantsInfo = await Promise.all(
      activity.participants.map(async (participantId) => {
        const participantResult = await db.collection('users').doc(participantId).get();
        const participant = participantResult.data;
        return {
          id: participant._id,
          nickname: participant.nickname,
          avatar: participant.avatar,
          level: participant.level,
          isVerified: participant.isVerified
        };
      })
    );

    // 检查当前用户状态
    let currentUser = null;
    let userStatus = 'none';
    let isOrganizer = false;

    if (openid) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();
      currentUser = currentUserResult.data[0];

      if (currentUser) {
        isOrganizer = currentUser._id === activity.organizerId;
        
        if (activity.participants.includes(currentUser._id)) {
          userStatus = 'joined';
        } else if (activity.joinRequests.includes(currentUser._id)) {
          userStatus = 'requested';
        }
      }
    }

    // 如果是组织者，获取申请列表
    let joinRequests = [];
    if (isOrganizer && activity.joinRequests.length > 0) {
      joinRequests = await Promise.all(
        activity.joinRequests.map(async (requesterId) => {
          const requesterResult = await db.collection('users').doc(requesterId).get();
          const requester = requesterResult.data;
          return {
            id: requester._id,
            nickname: requester.nickname,
            avatar: requester.avatar,
            level: requester.level,
            bio: requester.bio,
            isVerified: requester.isVerified
          };
        })
      );
    }

    return {
      code: 0,
      message: 'success',
      data: {
        activity: {
          id: activity._id,
          title: activity.title,
          description: activity.description,
          sport: activity.sport,
          category: activity.category,
          coverImage: activity.coverImage,
          images: activity.images,
          location: activity.location,
          dateTime: activity.dateTime,
          participants: activity.participants,
          fee: activity.fee,
          tags: activity.tags,
          contactInfo: activity.contactInfo,
          status: activity.status,
          viewsCount: activity.viewsCount + 1,
          likesCount: activity.likesCount,
          createdAt: activity.createdAt,
          organizer: {
            id: organizer._id,
            nickname: organizer.nickname,
            avatar: organizer.avatar,
            level: organizer.level,
            bio: organizer.bio,
            isVerified: organizer.isVerified
          },
          participantsInfo: participantsInfo,
          joinRequests: joinRequests,
          userStatus: userStatus,
          isOrganizer: isOrganizer
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取活动详情错误:', error);
    throw error;
  }
}

/**
 * 申请加入活动
 */
async function joinActivity(openid, data) {
  try {
    const { activityId } = data;
    
    if (!activityId) {
      return {
        code: 4001,
        message: '活动ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取用户信息
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

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 检查活动状态
    if (activity.status !== 'recruiting') {
      return {
        code: 4002,
        message: '活动不在招募状态',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否是组织者
    if (activity.organizerId === user._id) {
      return {
        code: 4002,
        message: '不能加入自己组织的活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否已加入
    if (activity.participants.includes(user._id)) {
      return {
        code: 4002,
        message: '已经加入该活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否已申请
    if (activity.joinRequests.includes(user._id)) {
      return {
        code: 4002,
        message: '已经申请过该活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查人数限制
    if (activity.participants.currentCount >= activity.participants.maxCount) {
      return {
        code: 4002,
        message: '活动人数已满',
        data: null,
        timestamp: Date.now()
      };
    }

    // 添加到申请列表
    await db.collection('activities').doc(activityId).update({
      data: {
        joinRequests: _.push(user._id),
        updatedAt: new Date()
      }
    });

    // 发送通知给组织者
    await db.collection('messages').add({
      data: {
        _openid: activity._openid,
        senderId: user._id,
        receiverId: activity.organizerId,
        type: 'activity',
        content: `${user.nickname} 申请加入你的活动"${activity.title}"`,
        relatedId: activityId,
        isRead: false,
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        userStatus: 'requested'
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('申请加入活动错误:', error);
    throw error;
  }
}

/**
 * 审批加入申请
 */
async function approveJoinRequest(openid, data) {
  try {
    const { activityId, userId } = data;
    
    if (!activityId || !userId) {
      return {
        code: 4001,
        message: '活动ID和用户ID不能为空',
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
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const currentUser = currentUserResult.data[0];

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 检查是否是组织者
    if (activity.organizerId !== currentUser._id) {
      return {
        code: 4003,
        message: '只有组织者可以审批申请',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查用户是否在申请列表中
    if (!activity.joinRequests.includes(userId)) {
      return {
        code: 4002,
        message: '用户未申请该活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查人数限制
    if (activity.participants.currentCount >= activity.participants.maxCount) {
      return {
        code: 4002,
        message: '活动人数已满',
        data: null,
        timestamp: Date.now()
      };
    }

    // 审批通过，移动用户从申请列表到参与者列表
    await db.collection('activities').doc(activityId).update({
      data: {
        joinRequests: _.pull(userId),
        participants: _.push(userId),
        'participants.currentCount': _.inc(1),
        updatedAt: new Date()
      }
    });

    // 发送通知给申请者
    const applicantResult = await db.collection('users').doc(userId).get();
    const applicant = applicantResult.data;

    await db.collection('messages').add({
      data: {
        _openid: applicant._openid,
        senderId: currentUser._id,
        receiverId: userId,
        type: 'activity',
        content: `你的活动申请"${activity.title}"已通过`,
        relatedId: activityId,
        isRead: false,
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        approved: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('审批加入申请错误:', error);
    throw error;
  }
}

/**
 * 拒绝加入申请
 */
async function rejectJoinRequest(openid, data) {
  try {
    const { activityId, userId } = data;
    
    if (!activityId || !userId) {
      return {
        code: 4001,
        message: '活动ID和用户ID不能为空',
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
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const currentUser = currentUserResult.data[0];

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 检查是否是组织者
    if (activity.organizerId !== currentUser._id) {
      return {
        code: 4003,
        message: '只有组织者可以拒绝申请',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查用户是否在申请列表中
    if (!activity.joinRequests.includes(userId)) {
      return {
        code: 4002,
        message: '用户未申请该活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 拒绝申请，从申请列表中移除
    await db.collection('activities').doc(activityId).update({
      data: {
        joinRequests: _.pull(userId),
        updatedAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        rejected: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('拒绝加入申请错误:', error);
    throw error;
  }
}

/**
 * 退出活动
 */
async function leaveActivity(openid, data) {
  try {
    const { activityId } = data;
    
    if (!activityId) {
      return {
        code: 4001,
        message: '活动ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取用户信息
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

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 检查是否是组织者
    if (activity.organizerId === user._id) {
      return {
        code: 4002,
        message: '组织者不能退出自己的活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否已加入
    if (!activity.participants.includes(user._id)) {
      return {
        code: 4002,
        message: '未加入该活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 退出活动
    await db.collection('activities').doc(activityId).update({
      data: {
        participants: _.pull(user._id),
        'participants.currentCount': _.inc(-1),
        updatedAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        userStatus: 'none'
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('退出活动错误:', error);
    throw error;
  }
}

/**
 * 获取我创建的活动
 */
async function getMyActivities(openid, data) {
  try {
    const { page = 1, pageSize = 20, status = 'all' } = data;
    const skip = (page - 1) * pageSize;

    // 获取用户信息
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

    // 构建查询条件
    let whereCondition = {
      _openid: openid,
      organizerId: user._id
    };

    if (status !== 'all') {
      whereCondition.status = status;
    }

    // 获取活动列表
    const activitiesResult = await db.collection('activities')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const activities = activitiesResult.data.map(activity => ({
      id: activity._id,
      title: activity.title,
      description: activity.description,
      sport: activity.sport,
      coverImage: activity.coverImage,
      location: activity.location,
      dateTime: activity.dateTime,
      participants: activity.participants,
      fee: activity.fee,
      tags: activity.tags,
      status: activity.status,
      viewsCount: activity.viewsCount,
      likesCount: activity.likesCount,
      joinRequestsCount: activity.joinRequests?.length || 0,
      createdAt: activity.createdAt
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        activities: activities,
        hasMore: activities.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取我的活动错误:', error);
    throw error;
  }
}

/**
 * 获取我加入的活动
 */
async function getMyJoinedActivities(openid, data) {
  try {
    const { page = 1, pageSize = 20, status = 'all' } = data;
    const skip = (page - 1) * pageSize;

    // 获取用户信息
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

    // 构建查询条件
    let whereCondition = {
      participants: user._id
    };

    if (status !== 'all') {
      whereCondition.status = status;
    }

    // 获取活动列表
    const activitiesResult = await db.collection('activities')
      .where(whereCondition)
      .orderBy('dateTime.startTime', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取活动详细信息
    const activities = await Promise.all(activitiesResult.data.map(async (activity) => {
      // 获取组织者信息
      const organizerResult = await db.collection('users').doc(activity.organizerId).get();
      const organizer = organizerResult.data;

      return {
        id: activity._id,
        title: activity.title,
        description: activity.description,
        sport: activity.sport,
        coverImage: activity.coverImage,
        location: activity.location,
        dateTime: activity.dateTime,
        participants: activity.participants,
        fee: activity.fee,
        tags: activity.tags,
        status: activity.status,
        viewsCount: activity.viewsCount,
        likesCount: activity.likesCount,
        createdAt: activity.createdAt,
        organizer: {
          id: organizer._id,
          nickname: organizer.nickname,
          avatar: organizer.avatar,
          isVerified: organizer.isVerified
        }
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        activities: activities,
        hasMore: activities.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取我加入的活动错误:', error);
    throw error;
  }
}

/**
 * 取消活动
 */
async function cancelActivity(openid, data) {
  try {
    const { activityId } = data;
    
    if (!activityId) {
      return {
        code: 4001,
        message: '活动ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取用户信息
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

    // 获取活动信息
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        code: 4005,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const activity = activityResult.data;

    // 检查是否是组织者
    if (activity.organizerId !== user._id) {
      return {
        code: 4003,
        message: '只有组织者可以取消活动',
        data: null,
        timestamp: Date.now()
      };
    }

    // 取消活动
    await db.collection('activities').doc(activityId).update({
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    // 通知所有参与者
    if (activity.participants.length > 0) {
      const notificationPromises = activity.participants.map(async (participantId) => {
        if (participantId !== user._id) {
          const participantResult = await db.collection('users').doc(participantId).get();
          const participant = participantResult.data;
          
          return db.collection('messages').add({
            data: {
              _openid: participant._openid,
              senderId: user._id,
              receiverId: participantId,
              type: 'activity',
              content: `活动"${activity.title}"已被取消`,
              relatedId: activityId,
              isRead: false,
              createdAt: new Date()
            }
          });
        }
      });

      await Promise.all(notificationPromises.filter(Boolean));
    }

    return {
      code: 0,
      message: 'success',
      data: {
        cancelled: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('取消活动错误:', error);
    throw error;
  }
}

/**
 * 获取推荐活动
 */
async function getRecommendedActivities(openid, data) {
  try {
    const { page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    // 获取用户信息以进行个性化推荐
    let userPreferences = [];
    if (openid) {
      const userResult = await db.collection('users').where({
        _openid: openid
      }).get();
      
      if (userResult.data.length > 0) {
        userPreferences = userResult.data[0].sportsPreferences || [];
      }
    }

    // 构建推荐查询
    let whereCondition = {
      status: 'recruiting',
      'dateTime.startTime': _.gte(new Date())
    };

    // 如果用户有运动偏好，优先推荐相关活动
    if (userPreferences.length > 0) {
      whereCondition.sport = _.in(userPreferences);
    }

    const activitiesResult = await db.collection('activities')
      .where(whereCondition)
      .orderBy('dateTime.startTime', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 如果基于偏好的推荐结果不足，补充其他活动
    if (activitiesResult.data.length < pageSize) {
      const remainingCount = pageSize - activitiesResult.data.length;
      const existingIds = activitiesResult.data.map(item => item._id);
      
      const additionalResult = await db.collection('activities')
        .where({
          status: 'recruiting',
          'dateTime.startTime': _.gte(new Date()),
          _id: _.nin(existingIds)
        })
        .orderBy('viewsCount', 'desc')
        .limit(remainingCount)
        .get();
        
      activitiesResult.data = [...activitiesResult.data, ...additionalResult.data];
    }

    // 获取活动详细信息
    const activities = await Promise.all(activitiesResult.data.map(async (activity) => {
      // 获取组织者信息
      const organizerResult = await db.collection('users').doc(activity.organizerId).get();
      const organizer = organizerResult.data;

      return {
        id: activity._id,
        title: activity.title,
        description: activity.description,
        sport: activity.sport,
        coverImage: activity.coverImage,
        location: activity.location,
        dateTime: activity.dateTime,
        participants: activity.participants,
        fee: activity.fee,
        tags: activity.tags,
        status: activity.status,
        viewsCount: activity.viewsCount,
        likesCount: activity.likesCount,
        createdAt: activity.createdAt,
        organizer: {
          id: organizer._id,
          nickname: organizer.nickname,
          avatar: organizer.avatar,
          isVerified: organizer.isVerified
        }
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        activities: activities,
        hasMore: activities.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取推荐活动错误:', error);
    throw error;
  }
} 