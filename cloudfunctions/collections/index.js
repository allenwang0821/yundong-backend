// 云函数入口文件
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

/**
 * 收藏管理云函数
 * 支持收藏、取消收藏、获取收藏列表等功能
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
      case 'add':
        return await addCollection(openid, data);
      case 'remove':
        return await removeCollection(openid, data);
      case 'list':
        return await getCollectionsList(openid, data);
      case 'check':
        return await checkIsCollected(openid, data);
      default:
        return {
          code: 4001,
          message: '不支持的操作',
          data: null,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('收藏管理云函数执行错误:', error);
    return {
      code: 5001,
      message: '服务器内部错误',
      data: null,
      timestamp: Date.now()
    };
  }
};

/**
 * 添加收藏
 */
async function addCollection(openid, data) {
  try {
    const { targetId, targetType } = data;

    if (!targetId || !targetType) {
      return {
        code: 4001,
        message: '缺少收藏目标ID或类型',
        data: null,
        timestamp: Date.now()
      };
    }

    // 检查是否已收藏
    const existingCollection = await db.collection('collections').where({
      _openid: openid,
      targetId: targetId,
      targetType: targetType
    }).get();

    if (existingCollection.data.length > 0) {
      return {
        code: 4002,
        message: '已经收藏过了',
        data: null,
        timestamp: Date.now()
      };
    }

    // 添加收藏记录
    const addResult = await db.collection('collections').add({
      data: {
        _openid: openid,
        targetId: targetId,
        targetType: targetType,
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: {
        collectionId: addResult._id
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('添加收藏错误:', error);
    throw error;
  }
}

/**
 * 取消收藏
 */
async function removeCollection(openid, data) {
  try {
    const { targetId, targetType } = data;

    if (!targetId || !targetType) {
      return {
        code: 4001,
        message: '缺少收藏目标ID或类型',
        data: null,
        timestamp: Date.now()
      };
    }

    // 删除收藏记录
    const removeResult = await db.collection('collections').where({
      _openid: openid,
      targetId: targetId,
      targetType: targetType
    }).remove();

    return {
      code: 0,
      message: 'success',
      data: {
        removedCount: removeResult.stats.removed
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('取消收藏错误:', error);
    throw error;
  }
}

/**
 * 获取收藏列表
 */
async function getCollectionsList(openid, data) {
  try {
    const { targetType, page = 1, pageSize = 20 } = data;
    const skip = (page - 1) * pageSize;

    let query = db.collection('collections').where({
      _openid: openid
    });

    if (targetType) {
      query = query.where({
        targetType: targetType
      });
    }

    const result = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取收藏目标的详细信息
    const collections = await Promise.all(
      result.data.map(async (collection) => {
        let targetInfo = null;
        
        if (collection.targetType === 'post') {
          const postResult = await db.collection('posts').doc(collection.targetId).get();
          targetInfo = postResult.data;
        } else if (collection.targetType === 'activity') {
          const activityResult = await db.collection('activities').doc(collection.targetId).get();
          targetInfo = activityResult.data;
        }

        return {
          ...collection,
          targetInfo: targetInfo
        };
      })
    );

    return {
      code: 0,
      message: 'success',
      data: {
        collections: collections,
        pagination: {
          page: page,
          pageSize: pageSize,
          total: collections.length
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('获取收藏列表错误:', error);
    throw error;
  }
}

/**
 * 检查是否已收藏
 */
async function checkIsCollected(openid, data) {
  try {
    const { targetId, targetType } = data;

    if (!targetId || !targetType) {
      return {
        code: 4001,
        message: '缺少收藏目标ID或类型',
        data: null,
        timestamp: Date.now()
      };
    }

    const result = await db.collection('collections').where({
      _openid: openid,
      targetId: targetId,
      targetType: targetType
    }).get();

    return {
      code: 0,
      message: 'success',
      data: {
        isCollected: result.data.length > 0
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('检查收藏状态错误:', error);
    throw error;
  }
} 