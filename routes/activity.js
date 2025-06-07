const express = require('express');
const router = express.Router();

// 临时数据存储
let activities = [];

// 获取活动列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, location } = req.query;
    
    let filteredActivities = activities;
    
    // 按分类筛选
    if (category) {
      filteredActivities = filteredActivities.filter(a => a.category === category);
    }
    
    // 按地点筛选
    if (location) {
      filteredActivities = filteredActivities.filter(a => 
        a.location.city.includes(location) || a.location.district.includes(location)
      );
    }
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedActivities = filteredActivities.slice(startIndex, endIndex);
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        activities: paginatedActivities,
        total: filteredActivities.length,
        page: parseInt(page),
        limit: parseInt(limit)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取活动列表错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 创建活动
router.post('/create', async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || 'test-openid';
    const {
      title,
      description,
      category,
      location,
      startTime,
      endTime,
      maxParticipants,
      price
    } = req.body;
    
    if (!title || !description || !category || !startTime) {
      return res.status(400).json({
        code: 4001,
        message: '必填字段不能为空',
        data: null,
        timestamp: Date.now()
      });
    }
    
    const newActivity = {
      _id: Date.now().toString(),
      creatorId: openid,
      title,
      description,
      category,
      location: {
        address: location?.address || '',
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        city: location?.city || '',
        district: location?.district || ''
      },
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      maxParticipants: maxParticipants || 10,
      currentParticipants: 1,
      price: price || 0,
      status: 'active',
      participants: [openid],
      tags: [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    activities.push(newActivity);
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        activity: newActivity
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('创建活动错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 参加活动
router.post('/:id/join', async (req, res) => {
  try {
    const openid = req.headers['x-wx-openid'] || 'test-openid';
    const { id } = req.params;
    
    const activity = activities.find(a => a._id === id);
    
    if (!activity) {
      return res.status(404).json({
        code: 4004,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      });
    }
    
    if (activity.participants.includes(openid)) {
      return res.status(400).json({
        code: 4002,
        message: '您已参加此活动',
        data: null,
        timestamp: Date.now()
      });
    }
    
    if (activity.currentParticipants >= activity.maxParticipants) {
      return res.status(400).json({
        code: 4003,
        message: '活动人数已满',
        data: null,
        timestamp: Date.now()
      });
    }
    
    activity.participants.push(openid);
    activity.currentParticipants++;
    activity.updatedAt = new Date();
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        activity
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('参加活动错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

// 获取活动详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const activity = activities.find(a => a._id === id);
    
    if (!activity) {
      return res.status(404).json({
        code: 4004,
        message: '活动不存在',
        data: null,
        timestamp: Date.now()
      });
    }
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        activity
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取活动详情错误:', error);
    res.status(500).json({
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    });
  }
});

module.exports = router; 