const express = require('express');
const router = express.Router();

// 临时数据存储
let messages = [];
let conversations = [];

// 发送消息
router.post('/send', async (req, res) => {
  try {
    const senderId = req.headers['x-wx-openid'] || 'test-openid';
    const { receiverId, content, type = 'text' } = req.body;
    
    if (!receiverId || !content) {
      return res.status(400).json({
        code: 4001,
        message: '接收方ID和消息内容不能为空',
        data: null,
        timestamp: Date.now()
      });
    }
    
    const newMessage = {
      _id: Date.now().toString(),
      senderId,
      receiverId,
      content,
      type,
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    messages.push(newMessage);
    
    // 更新或创建会话
    let conversation = conversations.find(c => 
      (c.participants.includes(senderId) && c.participants.includes(receiverId))
    );
    
    if (!conversation) {
      conversation = {
        _id: Date.now().toString(),
        participants: [senderId, receiverId],
        lastMessage: newMessage,
        unreadCount: { [receiverId]: 1, [senderId]: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      conversations.push(conversation);
    } else {
      conversation.lastMessage = newMessage;
      conversation.unreadCount[receiverId]++;
      conversation.updatedAt = new Date();
    }
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        message: newMessage
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 获取会话列表
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.headers['x-wx-openid'] || 'test-openid';
    
    const userConversations = conversations
      .filter(c => c.participants.includes(userId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        conversations: userConversations
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取会话列表错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 获取会话消息
router.get('/conversation/:userId', async (req, res) => {
  try {
    const currentUserId = req.headers['x-wx-openid'] || 'test-openid';
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const conversationMessages = messages
      .filter(m => 
        (m.senderId === currentUserId && m.receiverId === userId) ||
        (m.senderId === userId && m.receiverId === currentUserId)
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMessages = conversationMessages.slice(startIndex, endIndex);
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        messages: paginatedMessages.reverse(),
        total: conversationMessages.length,
        page: parseInt(page),
        limit: parseInt(limit)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取会话消息错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 标记消息为已读
router.post('/read', async (req, res) => {
  try {
    const userId = req.headers['x-wx-openid'] || 'test-openid';
    const { conversationId } = req.body;
    
    const conversation = conversations.find(c => c._id === conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        code: 4004,
        message: '会话不存在',
        data: null,
        timestamp: Date.now()
      });
    }
    
    if (conversation.participants.includes(userId)) {
      conversation.unreadCount[userId] = 0;
      conversation.updatedAt = new Date();
    }
    
    res.json({
      code: 0,
      message: 'success',
      data: null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('标记已读错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

module.exports = router; 