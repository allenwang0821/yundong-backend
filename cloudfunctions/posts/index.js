// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 动态发布和管理云函数
 * 支持发布、获取、点赞、评论、收藏等功能
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
        return await createPost(openid, data);
      case 'list':
        return await getPostsList(openid, data);
      case 'detail':
        return await getPostDetail(openid, data);
      case 'like':
        return await likePost(openid, data);
      case 'unlike':
        return await unlikePost(openid, data);
      case 'comment':
        return await commentPost(openid, data);
      case 'get_comments':
        return await getComments(openid, data);
      case 'delete':
        return await deletePost(openid, data);
      case 'my_posts':
        return await getMyPosts(openid, data);
      case 'user_posts':
        return await getUserPosts(openid, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('动态管理云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 发布动态
 */
async function createPost(openid, data) {
  try {
    const { 
      type, 
      title, 
      content, 
      images, 
      video, 
      location, 
      activityInfo,
      visibility = 'public'
    } = data;

    // 参数验证
    if (!type || !content) {
      return {
        code: 4001,
        message: '动态类型和内容不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    if (type === 'image' && (!images || images.length === 0)) {
      return {
        code: 4001,
        message: '图片动态必须包含图片',
        data: null,
        timestamp: Date.now()
      };
    }

    if (type === 'video' && !video) {
      return {
        code: 4001,
        message: '视频动态必须包含视频',
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

    // 解析标签
    const tags = extractTags(content);

    // 创建动态
    const newPost = {
      _openid: openid,
      authorId: user._id,
      type: type,
      title: title || '',
      content: content,
      images: images || [],
      video: video || null,
      tags: tags,
      location: location || null,
      activityInfo: activityInfo || null,
      visibility: visibility,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      collectionsCount: 0,
      viewsCount: 0,
      isRecommended: false,
      recommendScore: 0,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createResult = await db.collection('posts').add({
      data: newPost
    });

    // 更新用户动态数
    await db.collection('users').doc(user._id).update({
      data: {
        postsCount: _.inc(1)
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        postId: createResult._id,
        post: {
          id: createResult._id,
          ...newPost,
          author: {
            id: user._id,
            nickname: user.nickname,
            avatar: user.avatar,
            isVerified: user.isVerified
          },
          isLiked: false,
          isCollected: false
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('发布动态错误:', error);
    throw error;
  }
}

/**
 * 获取动态列表
 */
async function getPostsList(openid, data) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      type = 'recommend', 
      lastPostId = null 
    } = data;

    let query = db.collection('posts').where({
      status: 'published',
      visibility: _.in(['public'])
    });

    // 根据类型设置查询条件
    if (type === 'following') {
      // 获取关注的用户列表
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

      const followingResult = await db.collection('follows').where({
        followerId: userResult.data[0]._id,
        status: 'active'
      }).get();

      const followingIds = followingResult.data.map(follow => follow.followingId);
      followingIds.push(userResult.data[0]._id); // 包含自己的动态

      if (followingIds.length === 0) {
        return {
          code: 0,
          message: 'success',
          data: {
            posts: [],
            hasMore: false
          },
          timestamp: Date.now()
        };
      }

      query = query.where({
        authorId: _.in(followingIds)
      });
    }

    // 分页处理
    if (lastPostId) {
      const lastPostResult = await db.collection('posts').doc(lastPostId).get();
      if (lastPostResult.data) {
        query = query.where({
          createdAt: _.lt(lastPostResult.data.createdAt)
        });
      }
    }

    // 执行查询
    const postsResult = await query
      .orderBy('createdAt', 'desc')
      .limit(pageSize)
      .get();

    // 获取作者信息和互动状态
    const posts = await Promise.all(postsResult.data.map(async (post) => {
      // 获取作者信息
      const authorResult = await db.collection('users').doc(post.authorId).get();
      const author = authorResult.data;

      // 检查当前用户是否点赞和收藏
      let isLiked = false;
      let isCollected = false;

      if (openid) {
        const currentUserResult = await db.collection('users').where({
          _openid: openid
        }).get();
        
        if (currentUserResult.data.length > 0) {
          const currentUserId = currentUserResult.data[0]._id;
          
          // 检查点赞状态
          const likeResult = await db.collection('likes').where({
            userId: currentUserId,
            targetType: 'post',
            targetId: post._id
          }).get();
          isLiked = likeResult.data.length > 0;

          // 检查收藏状态 (暂时用likes表代替，实际应该有单独的收藏表)
          // TODO: 创建收藏表
        }
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
        activityInfo: post.activityInfo,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        collectionsCount: post.collectionsCount,
        viewsCount: post.viewsCount,
        createdAt: post.createdAt,
        author: {
          id: author._id,
          nickname: author.nickname,
          avatar: author.avatar,
          isVerified: author.isVerified
        },
        isLiked: isLiked,
        isCollected: isCollected
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
    console.error('获取动态列表错误:', error);
    throw error;
  }
}

/**
 * 获取动态详情
 */
async function getPostDetail(openid, data) {
  try {
    const { postId } = data;
    
    if (!postId) {
      return {
        code: 4001,
        message: '动态ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取动态信息
    const postResult = await db.collection('posts').doc(postId).get();
    
    if (!postResult.data) {
      return {
        code: 4005,
        message: '动态不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const post = postResult.data;

    // 增加浏览量
    await db.collection('posts').doc(postId).update({
      data: {
        viewsCount: _.inc(1)
      }
    });

    // 获取作者信息
    const authorResult = await db.collection('users').doc(post.authorId).get();
    const author = authorResult.data;

    // 检查当前用户状态
    let isLiked = false;
    let isCollected = false;
    let isFollowing = false;

    if (openid) {
      const currentUserResult = await db.collection('users').where({
        _openid: openid
      }).get();
      
      if (currentUserResult.data.length > 0) {
        const currentUserId = currentUserResult.data[0]._id;
        
        // 检查点赞状态
        const likeResult = await db.collection('likes').where({
          userId: currentUserId,
          targetType: 'post',
          targetId: postId
        }).get();
        isLiked = likeResult.data.length > 0;

        // 检查关注状态
        const followResult = await db.collection('follows').where({
          followerId: currentUserId,
          followingId: post.authorId,
          status: 'active'
        }).get();
        isFollowing = followResult.data.length > 0;
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        post: {
          id: post._id,
          type: post.type,
          title: post.title,
          content: post.content,
          images: post.images,
          video: post.video,
          tags: post.tags,
          location: post.location,
          activityInfo: post.activityInfo,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          collectionsCount: post.collectionsCount,
          viewsCount: post.viewsCount + 1,
          createdAt: post.createdAt,
          author: {
            id: author._id,
            nickname: author.nickname,
            avatar: author.avatar,
            isVerified: author.isVerified,
            isFollowing: isFollowing
          },
          isLiked: isLiked,
          isCollected: isCollected
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取动态详情错误:', error);
    throw error;
  }
}

/**
 * 点赞动态
 */
async function likePost(openid, data) {
  try {
    const { postId } = data;
    
    if (!postId) {
      return {
        code: 4001,
        message: '动态ID不能为空',
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

    // 检查是否已点赞
    const existLike = await db.collection('likes').where({
      _openid: openid,
      userId: user._id,
      targetType: 'post',
      targetId: postId
    }).get();

    if (existLike.data.length > 0) {
      return {
        code: 4006,
        message: '已经点赞过了',
        data: null,
        timestamp: Date.now()
      };
    }

    // 添加点赞记录
    await db.collection('likes').add({
      data: {
        _openid: openid,
        userId: user._id,
        targetType: 'post',
        targetId: postId,
        createdAt: new Date()
      }
    });

    // 更新动态点赞数
    const updateResult = await db.collection('posts').doc(postId).update({
      data: {
        likesCount: _.inc(1)
      }
    });

    if (updateResult.stats.updated === 0) {
      return {
        code: 4005,
        message: '动态不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取动态作者，发送消息通知
    const postResult = await db.collection('posts').doc(postId).get();
    if (postResult.data && postResult.data.authorId !== user._id) {
      await db.collection('messages').add({
        data: {
          _openid: postResult.data._openid,
          senderId: user._id,
          receiverId: postResult.data.authorId,
          type: 'like',
          content: `${user.nickname} 赞了你的动态`,
          relatedId: postId,
          isRead: false,
          createdAt: new Date()
        }
      });
    }

    return {
      code: 0,
      message: 'success',
      data: {
        isLiked: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('点赞动态错误:', error);
    throw error;
  }
}

/**
 * 取消点赞
 */
async function unlikePost(openid, data) {
  try {
    const { postId } = data;
    
    if (!postId) {
      return {
        code: 4001,
        message: '动态ID不能为空',
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

    // 删除点赞记录
    const deleteResult = await db.collection('likes').where({
      _openid: openid,
      userId: user._id,
      targetType: 'post',
      targetId: postId
    }).remove();

    if (deleteResult.stats.removed === 0) {
      return {
        code: 4007,
        message: '未点赞过该动态',
        data: null,
        timestamp: Date.now()
      };
    }

    // 更新动态点赞数
    await db.collection('posts').doc(postId).update({
      data: {
        likesCount: _.inc(-1)
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        isLiked: false
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('取消点赞错误:', error);
    throw error;
  }
}

/**
 * 评论动态
 */
async function commentPost(openid, data) {
  try {
    const { postId, content, parentId = null, replyToUserId = null } = data;
    
    if (!postId || !content) {
      return {
        code: 4001,
        message: '动态ID和评论内容不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    if (content.length > 500) {
      return {
        code: 4001,
        message: '评论内容不能超过500个字符',
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

    // 创建评论
    const newComment = {
      _openid: openid,
      authorId: user._id,
      targetType: 'post',
      targetId: postId,
      content: content,
      parentId: parentId,
      replyToUserId: replyToUserId,
      likesCount: 0,
      repliesCount: 0,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createResult = await db.collection('comments').add({
      data: newComment
    });

    // 更新动态评论数
    await db.collection('posts').doc(postId).update({
      data: {
        commentsCount: _.inc(1)
      }
    });

    // 如果是回复评论，更新父评论的回复数
    if (parentId) {
      await db.collection('comments').doc(parentId).update({
        data: {
          repliesCount: _.inc(1)
        }
      });
    }

    // 发送消息通知
    const postResult = await db.collection('posts').doc(postId).get();
    if (postResult.data && postResult.data.authorId !== user._id) {
      await db.collection('messages').add({
        data: {
          _openid: postResult.data._openid,
          senderId: user._id,
          receiverId: postResult.data.authorId,
          type: 'comment',
          content: `${user.nickname} 评论了你的动态: ${content}`,
          relatedId: postId,
          isRead: false,
          createdAt: new Date()
        }
      });
    }

    return {
      code: 0,
      message: 'success',
      data: {
        commentId: createResult._id,
        comment: {
          id: createResult._id,
          content: content,
          author: {
            id: user._id,
            nickname: user.nickname,
            avatar: user.avatar,
            isVerified: user.isVerified
          },
          likesCount: 0,
          repliesCount: 0,
          createdAt: newComment.createdAt
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('评论动态错误:', error);
    throw error;
  }
}

/**
 * 获取评论列表
 */
async function getComments(openid, data) {
  try {
    const { postId, page = 1, pageSize = 20 } = data;
    
    if (!postId) {
      return {
        code: 4001,
        message: '动态ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const skip = (page - 1) * pageSize;

    // 获取评论列表（只获取一级评论）
    const commentsResult = await db.collection('comments')
      .where({
        targetType: 'post',
        targetId: postId,
        parentId: null,
        status: 'published'
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取评论作者信息
    const comments = await Promise.all(commentsResult.data.map(async (comment) => {
      const authorResult = await db.collection('users').doc(comment.authorId).get();
      const author = authorResult.data;

      // 获取部分回复（最新的3条）
      const repliesResult = await db.collection('comments')
        .where({
          parentId: comment._id,
          status: 'published'
        })
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

      const replies = await Promise.all(repliesResult.data.map(async (reply) => {
        const replyAuthorResult = await db.collection('users').doc(reply.authorId).get();
        const replyAuthor = replyAuthorResult.data;

        return {
          id: reply._id,
          content: reply.content,
          author: {
            id: replyAuthor._id,
            nickname: replyAuthor.nickname,
            avatar: replyAuthor.avatar,
            isVerified: replyAuthor.isVerified
          },
          createdAt: reply.createdAt
        };
      }));

      return {
        id: comment._id,
        content: comment.content,
        author: {
          id: author._id,
          nickname: author.nickname,
          avatar: author.avatar,
          isVerified: author.isVerified
        },
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        replies: replies,
        createdAt: comment.createdAt
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        comments: comments,
        hasMore: comments.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取评论列表错误:', error);
    throw error;
  }
}

/**
 * 删除动态
 */
async function deletePost(openid, data) {
  try {
    const { postId } = data;
    
    if (!postId) {
      return {
        code: 4001,
        message: '动态ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查动态是否存在且属于当前用户
    const postResult = await db.collection('posts').doc(postId).get();
    
    if (!postResult.data) {
      return {
        code: 4005,
        message: '动态不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    if (postResult.data._openid !== openid) {
      return {
        code: 4003,
        message: '只能删除自己的动态',
        data: null,
        timestamp: Date.now()
      };
    }

    // 软删除动态
    await db.collection('posts').doc(postId).update({
      data: {
        status: 'deleted',
        updatedAt: new Date()
      }
    });

    // 更新用户动态数
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    if (userResult.data.length > 0) {
      await db.collection('users').doc(userResult.data[0]._id).update({
        data: {
          postsCount: _.inc(-1)
        }
      });
    }

    return {
      code: 0,
      message: 'success',
      data: {
        deleted: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('删除动态错误:', error);
    throw error;
  }
}

/**
 * 获取我的动态
 */
async function getMyPosts(openid, data) {
  try {
    const { page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    const postsResult = await db.collection('posts')
      .where({
        _openid: openid,
        status: 'published'
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get();

    const user = userResult.data[0];

    const posts = postsResult.data.map(post => ({
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
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        isVerified: user.isVerified
      }
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
    console.error('获取我的动态错误:', error);
    throw error;
  }
}

/**
 * 获取用户动态
 */
async function getUserPosts(openid, data) {
  try {
    const { userId, page = 1, pageSize = 20 } = data;
    
    if (!userId) {
      return {
        code: 4001,
        message: '用户ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    const skip = (page - 1) * pageSize;

    const postsResult = await db.collection('posts')
      .where({
        authorId: userId,
        status: 'published',
        visibility: 'public'
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取用户信息
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

    const posts = postsResult.data.map(post => ({
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
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        isVerified: user.isVerified
      }
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
    console.error('获取用户动态错误:', error);
    throw error;
  }
}

/**
 * 从文本中提取标签
 */
function extractTags(content) {
  const tagRegex = /#([^#\s]+)#/g;
  const tags = [];
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1]);
  }
  
  return [...new Set(tags)]; // 去重
} 