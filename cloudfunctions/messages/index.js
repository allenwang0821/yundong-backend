// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 消息通知云函数
 * 支持获取消息列表、标记已读、发送系统消息等功能
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
      case 'get_messages':
        return await getMessages(OPENID, data);
      case 'mark_read':
        return await markAsRead(OPENID, data);
      case 'mark_all_read':
        return await markAllAsRead(OPENID, data);
      case 'get_unread_count':
        return await getUnreadCount(OPENID, data);
      case 'delete_message':
        return await deleteMessage(OPENID, data);
      case 'send_system_message':
        return await sendSystemMessage(OPENID, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('消息通知云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 获取消息列表
 */
async function getMessages(openid, data) {
  try {
    const { type = 'all', page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    // 获取当前用户信息
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
      receiverId: user._id
    };

    if (type !== 'all') {
      whereCondition.type = type;
    }

    // 获取消息列表
    const messagesResult = await db.collection('messages')
      .where(whereCondition)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取发送者信息
    const messages = await Promise.all(messagesResult.data.map(async (message) => {
      let sender = null;
      
      if (message.senderId && message.type !== 'system') {
        const senderResult = await db.collection('users').doc(message.senderId).get();
        if (senderResult.data) {
          sender = {
            id: senderResult.data._id,
            nickname: senderResult.data.nickname,
            avatar: senderResult.data.avatar,
            isVerified: senderResult.data.isVerified
          };
        }
      }

      return {
        id: message._id,
        type: message.type,
        content: message.content,
        relatedId: message.relatedId,
        isRead: message.isRead,
        createdAt: message.createdAt,
        sender: sender
      };
    }));

    return {
      code: 0,
      message: 'success',
      data: {
        messages: messages,
        hasMore: messages.length === pageSize
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取消息列表错误:', error);
    throw error;
  }
}

/**
 * 标记消息为已读
 */
async function markAsRead(openid, data) {
  try {
    const { messageId } = data;
    
    if (!messageId) {
      return {
        code: 4001,
        message: '消息ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取当前用户信息
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

    // 标记消息为已读
    const updateResult = await db.collection('messages')
      .where({
        _id: messageId,
        _openid: openid,
        receiverId: user._id
      })
      .update({
        data: {
          isRead: true
        }
      });

    if (updateResult.stats.updated === 0) {
      return {
        code: 4005,
        message: '消息不存在或无权限',
        data: null,
        timestamp: Date.now()
      };
    }

    return {
      code: 0,
      message: 'success',
      data: {
        marked: true
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('标记消息已读错误:', error);
    throw error;
  }
}

/**
 * 标记全部消息为已读
 */
async function markAllAsRead(openid, data) {
  try {
    const { type = 'all' } = data;

    // 获取当前用户信息
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
      receiverId: user._id,
      isRead: false
    };

    if (type !== 'all') {
      whereCondition.type = type;
    }

    // 标记所有未读消息为已读
    const updateResult = await db.collection('messages')
      .where(whereCondition)
      .update({
        data: {
          isRead: true
        }
      });

    return {
      code: 0,
      message: 'success',
      data: {
        markedCount: updateResult.stats.updated
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('标记全部消息已读错误:', error);
    throw error;
  }
}

/**
 * 获取未读消息数量
 */
async function getUnreadCount(openid, data) {
  try {
    // 获取当前用户信息
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

    // 获取各类型未读消息数量
    const unreadCounts = {};
    const messageTypes = ['system', 'like', 'comment', 'follow', 'activity'];

    for (const type of messageTypes) {
      const countResult = await db.collection('messages')
        .where({
          _openid: openid,
          receiverId: user._id,
          type: type,
          isRead: false
        })
        .count();
      
      unreadCounts[type] = countResult.total;
    }

    // 获取总未读数量
    const totalCountResult = await db.collection('messages')
      .where({
        _openid: openid,
        receiverId: user._id,
        isRead: false
      })
      .count();

    unreadCounts.total = totalCountResult.total;

    return {
      code: 0,
      message: 'success',
      data: {
        unreadCounts: unreadCounts
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取未读消息数量错误:', error);
    throw error;
  }
}

/**
 * 删除消息
 */
async function deleteMessage(openid, data) {
  try {
    const { messageId } = data;
    
    if (!messageId) {
      return {
        code: 4001,
        message: '消息ID不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 获取当前用户信息
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

    // 删除消息
    const deleteResult = await db.collection('messages')
      .where({
        _id: messageId,
        _openid: openid,
        receiverId: user._id
      })
      .remove();

    if (deleteResult.stats.removed === 0) {
      return {
        code: 4005,
        message: '消息不存在或无权限',
        data: null,
        timestamp: Date.now()
      };
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
    console.error('删除消息错误:', error);
    throw error;
  }
}

/**
 * 发送系统消息
 */
async function sendSystemMessage(openid, data) {
  try {
    const { receiverId, content, relatedId = null } = data;
    
    if (!receiverId || !content) {
      return {
        code: 4001,
        message: '接收者ID和消息内容不能为空',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查接收者是否存在
    const receiverResult = await db.collection('users').doc(receiverId).get();
    
    if (!receiverResult.data) {
      return {
        code: 4004,
        message: '接收者不存在',
        data: null,
        timestamp: Date.now()
      };
    }

    const receiver = receiverResult.data;

    // 创建系统消息
    const newMessage = {
      _openid: receiver._openid,
      senderId: null,
      receiverId: receiverId,
      type: 'system',
      content: content,
      relatedId: relatedId,
      isRead: false,
      createdAt: new Date()
    };

    const createResult = await db.collection('messages').add({
      data: newMessage
    });

    return {
      code: 0,
      message: 'success',
      data: {
        messageId: createResult._id
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('发送系统消息错误:', error);
    throw error;
  }
} 