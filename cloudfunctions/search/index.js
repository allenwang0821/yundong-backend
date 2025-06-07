// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 综合搜索云函数
 * 支持搜索用户、动态、活动、话题等
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
      case 'comprehensive':
        return await comprehensiveSearch(openid, data);
      case 'users':
        return await searchUsers(openid, data);
      case 'posts':
        return await searchPosts(openid, data);
      case 'activities':
        return await searchActivities(openid, data);
      case 'topics':
        return await searchTopics(openid, data);
      case 'hot_search':
        return await getHotSearch(openid, data);
      case 'search_suggestions':
        return await getSearchSuggestions(openid, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('搜索云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 综合搜索
 */
async function comprehensiveSearch(openid, data) {
  try {
    const { keyword, page = 1, pageSize = 20 } = data;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();
    
    // 记录搜索历史
    await recordSearchHistory(openid, trimmedKeyword);

    // 并行搜索不同类型的内容
    const [usersResult, postsResult, activitiesResult, topicsResult] = await Promise.all([
      searchUsers(openid, { keyword: trimmedKeyword, page: 1, pageSize: 5 }),
      searchPosts(openid, { keyword: trimmedKeyword, page: 1, pageSize: 10 }),
      searchActivities(openid, { keyword: trimmedKeyword, page: 1, pageSize: 5 }),
      searchTopics(openid, { keyword: trimmedKeyword, page: 1, pageSize: 10 })
    ]);

    return {
      code: 0,
      message: 'success',
      data: {
        users: usersResult.code === 0 ? usersResult.data.users : [],
        posts: postsResult.code === 0 ? postsResult.data.posts : [],
        activities: activitiesResult.code === 0 ? activitiesResult.data.activities : [],
        topics: topicsResult.code === 0 ? topicsResult.data.topics : [],
        keyword: trimmedKeyword
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('综合搜索错误:', error);
    throw error;
  }
}

/**
 * 搜索用户
 */
async function searchUsers(openid, data) {
  try {
    const { keyword, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();

    // 搜索用户（昵称模糊匹配）
    const usersResult = await db.collection('users')
      .where({
        status: 'active',
        nickname: db.RegExp({
          regexp: trimmedKeyword,
          options: 'i'
        })
      })
      .orderBy('followersCount', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取当前用户信息，用于判断关注状态
    let currentUser = null;
    if (openid) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();
      currentUser = currentUserResult.data[0];
    }

    // 检查关注状态
    const users = await Promise.all(usersResult.data.map(async (user) => {
      let isFollowing = false;
      
      if (currentUser && currentUser._id !== user._id) {
        const followResult = await db.collection('follows').where({
          followerId: currentUser._id,
          followingId: user._id,
          status: 'active'
        }).get();
        isFollowing = followResult.data.length > 0;
      }

      return {
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        level: user.level,
        sportsPreferences: user.sportsPreferences,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        postsCount: user.postsCount,
        isVerified: user.isVerified,
        isFollowing: isFollowing
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        users: users,
        hasMore: users.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('搜索用户错误:', error);
    throw error;
  }
}

/**
 * 搜索动态
 */
async function searchPosts(openid, data) {
  try {
    const { keyword, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();

    // 搜索动态（标题和内容模糊匹配）
    const postsResult = await db.collection('posts')
      .where({
        status: 'published',
        visibility: 'public',
        content: db.RegExp({
          regexp: trimmedKeyword,
          options: 'i'
        })
      })
      .orderBy('createdAt', 'desc')
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

    // 获取动态详细信息
    const posts = await Promise.all(postsResult.data.map(async (post) => {
      // 获取作者信息
      const authorResult = await db.collection('users').doc(post.authorId).get();
      const author = authorResult.data;

      // 检查点赞状态
      let isLiked = false;
      if (currentUser) {
        const likeResult = await db.collection('likes').where({
          userId: currentUser._id,
          targetType: 'post',
          targetId: post._id
        }).get();
        isLiked = likeResult.data.length > 0;
      }

      return {
        id: post._id,
        type: post.type,
        title: post.title,
        content: post.content,
        images: post.images,
        video: post.video,
        tags: post.tags,
        location: post.location,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        viewsCount: post.viewsCount,
        createdAt: post.createdAt,
        author: {
          id: author._id,
          nickname: author.nickname,
          avatar: author.avatar,
          isVerified: author.isVerified
        },
        isLiked: isLiked
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        posts: posts,
        hasMore: posts.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('搜索动态错误:', error);
    throw error;
  }
}

/**
 * 搜索活动
 */
async function searchActivities(openid, data) {
  try {
    const { keyword, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();

    // 搜索活动（标题和描述模糊匹配）
    const activitiesResult = await db.collection('activities')
      .where(_.or([
        {
          title: db.RegExp({
            regexp: trimmedKeyword,
            options: 'i'
          })
        },
        {
          description: db.RegExp({
            regexp: trimmedKeyword,
            options: 'i'
          })
        },
        {
          sport: db.RegExp({
            regexp: trimmedKeyword,
            options: 'i'
          })
        }
      ]))
      .where({
        status: _.in(['recruiting', 'ongoing'])
      })
      .orderBy('createdAt', 'desc')
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
    console.error('搜索活动错误:', error);
    throw error;
  }
}

/**
 * 搜索话题
 */
async function searchTopics(openid, data) {
  try {
    const { keyword, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 4001,
        message: '搜索关键词不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();

    // 从动态中聚合话题统计
    const $ = db.command.aggregate;
    
    const topicsResult = await db.collection('posts')
      .aggregate()
      .match({
        status: 'published',
        visibility: 'public',
        tags: db.RegExp({
          regexp: trimmedKeyword,
          options: 'i'
        })
      })
      .unwind('$tags')
      .match({
        tags: db.RegExp({
          regexp: trimmedKeyword,
          options: 'i'
        })
      })
      .group({
        _id: '$tags',
        count: $.sum(1),
        latestPost: $.first('$$ROOT')
      })
      .sort({
        count: -1
      })
      .skip(skip)
      .limit(pageSize)
      .end();

    const topics = topicsResult.list.map(topic => ({
      name: topic._id,
      count: topic.count,
      latestPostId: topic.latestPost._id,
      latestContent: topic.latestPost.content.substring(0, 100),
      latestCreatedAt: topic.latestPost.createdAt
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        topics: topics,
        hasMore: topics.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('搜索话题错误:', error);
    throw error;
  }
}

/**
 * 获取热门搜索
 */
async function getHotSearch(openid, data) {
  try {
    // 这里应该从搜索历史中统计热门关键词
    // 为了简化，先返回固定的热门搜索
    const hotSearches = [
      { keyword: '跑步', count: 1250 },
      { keyword: '篮球', count: 980 },
      { keyword: '瑜伽', count: 750 },
      { keyword: '游泳', count: 680 },
      { keyword: '健身', count: 620 },
      { keyword: '羽毛球', count: 580 },
      { keyword: '足球', count: 520 },
      { keyword: '乒乓球', count: 480 }
    ];

    return {
      code: 0,
      message: 'success',
      data: {
        hotSearches: hotSearches
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取热门搜索错误:', error);
    throw error;
  }
}

/**
 * 获取搜索建议
 */
async function getSearchSuggestions(openid, data) {
  try {
    const { keyword } = data;
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        code: 0,
        message: 'success',
        data: {
          suggestions: []
        },
        timestamp: Date.now()
      };
    }

    const trimmedKeyword = keyword.trim();

    // 从话题中获取建议
    const $ = db.command.aggregate;
    
    const suggestionsResult = await db.collection('posts')
      .aggregate()
      .unwind('$tags')
      .match({
        tags: db.RegExp({
          regexp: trimmedKeyword,
          options: 'i'
        })
      })
      .group({
        _id: '$tags',
        count: $.sum(1)
      })
      .sort({
        count: -1
      })
      .limit(10)
      .end();

    const suggestions = suggestionsResult.list.map(item => ({
      keyword: item._id,
      count: item.count
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        suggestions: suggestions
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取搜索建议错误:', error);
    throw error;
  }
}

/**
 * 记录搜索历史
 */
async function recordSearchHistory(openid, keyword) {
  try {
    // 检查是否已存在该搜索记录
    const existResult = await db.collection('search_history').where({
      _openid: openid,
      keyword: keyword
    }).get();

    if (existResult.data.length > 0) {
      // 更新搜索时间
      await db.collection('search_history').doc(existResult.data[0]._id).update({
        data: {
          searchCount: _.inc(1),
          lastSearchAt: new Date()
        }
      });
    } else {
      // 创建新的搜索记录
      await db.collection('search_history').add({
        data: {
          _openid: openid,
          keyword: keyword,
          searchCount: 1,
          lastSearchAt: new Date(),
          createdAt: new Date()
        }
      });
    }

    // 清理过期的搜索历史（保留最近100条）
    const historyResult = await db.collection('search_history')
      .where({
        _openid: openid
      })
      .orderBy('lastSearchAt', 'desc')
      .skip(100)
      .get();

    if (historyResult.data.length > 0) {
      const expiredIds = historyResult.data.map(item => item._id);
      await db.collection('search_history').where({
        _id: _.in(expiredIds)
      }).remove();
    }
  } catch (error) {
    console.error('记录搜索历史错误:', error);
    // 不影响主要搜索功能，只记录错误
  }
} 