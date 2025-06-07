# API调用示例

## 用户登录相关

### 微信授权登录

```javascript
// 小程序端调用
wx.getUserProfile({
  desc: '用于完善用户资料',
  success: (res) => {
    wx.cloud.callFunction({
      name: 'user-login',
      data: {
        action: 'wechat_login',
        data: {
          userInfo: res.userInfo
        }
      },
      success: (result) => {
        console.log('登录成功:', result);
        const { user, isNewUser } = result.result.data;
        
        // 保存用户信息到本地
        wx.setStorageSync('userInfo', user);
        
        if (isNewUser) {
          // 新用户，引导完善资料
          wx.navigateTo({
            url: '/pages/profile/edit'
          });
        } else {
          // 老用户，进入首页
          wx.switchTab({
            url: '/pages/home/index'
          });
        }
      },
      fail: (error) => {
        console.error('登录失败:', error);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    });
  }
});
```

### 获取用户信息

```javascript
wx.cloud.callFunction({
  name: 'user-login',
  data: {
    action: 'get_user_info'
  },
  success: (result) => {
    if (result.result.code === 0) {
      const userInfo = result.result.data.user;
      console.log('用户信息:', userInfo);
      
      // 更新页面数据
      this.setData({
        userInfo: userInfo
      });
    }
  }
});
```

## 用户信息管理

### 更新用户资料

```javascript
wx.cloud.callFunction({
  name: 'user-profile',
  data: {
    action: 'update_profile',
    data: {
      nickname: '运动达人',
      gender: 'male',
      bio: '热爱运动，寻找运动搭子',
      sportsPreferences: ['跑步', '篮球', '游泳'],
      level: 'intermediate',
      location: {
        province: '北京市',
        city: '北京市',
        district: '朝阳区'
      }
    }
  },
  success: (result) => {
    if (result.result.code === 0) {
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      });
      
      // 更新本地用户信息
      const updatedUser = result.result.data.user;
      wx.setStorageSync('userInfo', updatedUser);
    } else {
      wx.showToast({
        title: result.result.message,
        icon: 'none'
      });
    }
  }
});
```

### 上传头像

```javascript
// 选择图片
wx.chooseImage({
  count: 1,
  sizeType: ['compressed'],
  sourceType: ['album', 'camera'],
  success: (res) => {
    const tempFilePath = res.tempFilePaths[0];
    
    // 显示加载中
    wx.showLoading({
      title: '上传中...'
    });
    
    // 读取文件内容
    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      encoding: 'base64',
      success: (fileRes) => {
        // 调用云函数上传
        wx.cloud.callFunction({
          name: 'user-profile',
          data: {
            action: 'upload_avatar',
            data: {
              fileContent: fileRes.data,
              fileName: 'avatar.jpg'
            }
          },
          success: (result) => {
            wx.hideLoading();
            
            if (result.result.code === 0) {
              wx.showToast({
                title: '上传成功',
                icon: 'success'
              });
              
              // 更新头像显示
              this.setData({
                avatarUrl: result.result.data.avatarUrl
              });
            } else {
              wx.showToast({
                title: result.result.message,
                icon: 'none'
              });
            }
          },
          fail: (error) => {
            wx.hideLoading();
            wx.showToast({
              title: '上传失败',
              icon: 'none'
            });
          }
        });
      }
    });
  }
});
```

## 动态管理

### 发布图片动态

```javascript
// 选择图片
wx.chooseImage({
  count: 9,
  sizeType: ['compressed'],
  sourceType: ['album', 'camera'],
  success: (res) => {
    const tempFilePaths = res.tempFilePaths;
    
    wx.showLoading({
      title: '发布中...'
    });
    
    // 上传图片到云存储
    const uploadPromises = tempFilePaths.map((filePath, index) => {
      return wx.cloud.uploadFile({
        cloudPath: `posts/${Date.now()}-${index}.jpg`,
        filePath: filePath
      });
    });
    
    Promise.all(uploadPromises).then((uploadResults) => {
      const imageUrls = uploadResults.map(result => result.fileID);
      
      // 发布动态
      wx.cloud.callFunction({
        name: 'posts',
        data: {
          action: 'create',
          data: {
            type: 'image',
            content: this.data.content,
            images: imageUrls,
            location: this.data.selectedLocation,
            visibility: 'public'
          }
        },
        success: (result) => {
          wx.hideLoading();
          
          if (result.result.code === 0) {
            wx.showToast({
              title: '发布成功',
              icon: 'success'
            });
            
            // 返回首页
            wx.navigateBack();
          } else {
            wx.showToast({
              title: result.result.message,
              icon: 'none'
            });
          }
        }
      });
    }).catch((error) => {
      wx.hideLoading();
      wx.showToast({
        title: '图片上传失败',
        icon: 'none'
      });
    });
  }
});
```

### 获取动态列表

```javascript
// 获取推荐动态
loadPosts() {
  wx.cloud.callFunction({
    name: 'posts',
    data: {
      action: 'list',
      data: {
        type: 'recommend',
        page: this.data.currentPage,
        pageSize: 20,
        lastPostId: this.data.lastPostId
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        const { posts, hasMore } = result.result.data;
        
        this.setData({
          posts: this.data.currentPage === 1 ? posts : [...this.data.posts, ...posts],
          hasMore: hasMore,
          lastPostId: posts.length > 0 ? posts[posts.length - 1].id : null
        });
      }
    }
  });
}

// 下拉刷新
onPullDownRefresh() {
  this.setData({
    currentPage: 1,
    posts: [],
    lastPostId: null
  });
  
  this.loadPosts();
  wx.stopPullDownRefresh();
}

// 上拉加载更多
onReachBottom() {
  if (this.data.hasMore) {
    this.setData({
      currentPage: this.data.currentPage + 1
    });
    this.loadPosts();
  }
}
```

### 点赞动态

```javascript
// 点赞/取消点赞
toggleLike(e) {
  const { postId, isLiked } = e.currentTarget.dataset;
  
  const action = isLiked ? 'unlike' : 'like';
  
  wx.cloud.callFunction({
    name: 'posts',
    data: {
      action: action,
      data: {
        postId: postId
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        // 更新本地数据
        const posts = this.data.posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              isLiked: !isLiked,
              likesCount: isLiked ? post.likesCount - 1 : post.likesCount + 1
            };
          }
          return post;
        });
        
        this.setData({ posts });
      } else {
        wx.showToast({
          title: result.result.message,
          icon: 'none'
        });
      }
    }
  });
}
```

### 评论动态

```javascript
// 发表评论
submitComment() {
  const content = this.data.commentContent.trim();
  
  if (!content) {
    wx.showToast({
      title: '请输入评论内容',
      icon: 'none'
    });
    return;
  }
  
  wx.cloud.callFunction({
    name: 'posts',
    data: {
      action: 'comment',
      data: {
        postId: this.data.postId,
        content: content
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
        
        // 清空输入框
        this.setData({
          commentContent: ''
        });
        
        // 刷新评论列表
        this.loadComments();
      } else {
        wx.showToast({
          title: result.result.message,
          icon: 'none'
        });
      }
    }
  });
}
```

## 关注系统

### 关注用户

```javascript
// 关注/取消关注
toggleFollow(e) {
  const { userId, isFollowing } = e.currentTarget.dataset;
  
  const action = isFollowing ? 'unfollow' : 'follow';
  
  wx.cloud.callFunction({
    name: 'user-follow',
    data: {
      action: action,
      data: {
        userId: userId
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        wx.showToast({
          title: isFollowing ? '已取消关注' : '关注成功',
          icon: 'success'
        });
        
        // 更新按钮状态
        this.setData({
          isFollowing: !isFollowing,
          followersCount: result.result.data.followersCount
        });
      } else {
        wx.showToast({
          title: result.result.message,
          icon: 'none'
        });
      }
    }
  });
}
```

### 获取关注列表

```javascript
// 获取我的关注
loadFollowing() {
  wx.cloud.callFunction({
    name: 'user-follow',
    data: {
      action: 'following',
      data: {
        page: this.data.currentPage,
        pageSize: 20
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        const { following, hasMore } = result.result.data;
        
        this.setData({
          following: this.data.currentPage === 1 ? following : [...this.data.following, ...following],
          hasMore: hasMore
        });
      }
    }
  });
}
```

## 消息通知

### 获取消息列表

```javascript
// 获取消息列表
loadMessages() {
  wx.cloud.callFunction({
    name: 'messages',
    data: {
      action: 'get_messages',
      data: {
        type: this.data.currentTab, // 'all', 'like', 'comment', 'follow'
        page: this.data.currentPage,
        pageSize: 20
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        const { messages, hasMore } = result.result.data;
        
        this.setData({
          messages: this.data.currentPage === 1 ? messages : [...this.data.messages, ...messages],
          hasMore: hasMore
        });
      }
    }
  });
}

// 标记消息已读
markAsRead(e) {
  const { messageId } = e.currentTarget.dataset;
  
  wx.cloud.callFunction({
    name: 'messages',
    data: {
      action: 'mark_read',
      data: {
        messageId: messageId
      }
    },
    success: (result) => {
      if (result.result.code === 0) {
        // 更新本地数据
        const messages = this.data.messages.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, isRead: true };
          }
          return msg;
        });
        
        this.setData({ messages });
      }
    }
  });
}
```

### 获取未读消息数量

```javascript
// 获取未读消息数量（用于显示红点）
loadUnreadCount() {
  wx.cloud.callFunction({
    name: 'messages',
    data: {
      action: 'get_unread_count'
    },
    success: (result) => {
      if (result.result.code === 0) {
        const unreadCounts = result.result.data.unreadCounts;
        
        // 设置tabBar红点
        if (unreadCounts.total > 0) {
          wx.showTabBarRedDot({
            index: 3 // 消息tab的索引
          });
        } else {
          wx.hideTabBarRedDot({
            index: 3
          });
        }
        
        this.setData({
          unreadCounts: unreadCounts
        });
      }
    }
  });
}
```

## 错误处理

### 统一错误处理

```javascript
// 封装云函数调用
function callCloudFunction(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data,
      success: (result) => {
        if (result.result.code === 0) {
          resolve(result.result.data);
        } else {
          // 统一错误处理
          handleError(result.result);
          reject(result.result);
        }
      },
      fail: (error) => {
        console.error('云函数调用失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
        reject(error);
      }
    });
  });
}

// 错误处理函数
function handleError(error) {
  switch (error.code) {
    case 4001:
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      break;
    case 4004:
      wx.showToast({
        title: '资源不存在',
        icon: 'none'
      });
      break;
    case 4003:
      wx.showToast({
        title: '权限不足',
        icon: 'none'
      });
      // 可能需要重新登录
      break;
    default:
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
  }
}
```

### 使用示例

```javascript
// 使用封装的函数
async loadData() {
  try {
    wx.showLoading({ title: '加载中...' });
    
    const data = await callCloudFunction('posts', {
      action: 'list',
      data: {
        type: 'recommend',
        page: 1,
        pageSize: 20
      }
    });
    
    this.setData({
      posts: data.posts,
      hasMore: data.hasMore
    });
    
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    wx.hideLoading();
  }
}
```

## 搜索功能

### 1. 综合搜索
```javascript
wx.cloud.callFunction({
  name: 'search',
  data: {
    action: 'comprehensive',
    data: {
      keyword: '篮球',
      page: 1,
      pageSize: 20
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('搜索结果:', res.result.data);
      console.log('用户:', res.result.data.users);
      console.log('动态:', res.result.data.posts);
      console.log('活动:', res.result.data.activities);
      console.log('话题:', res.result.data.topics);
    }
  }
});
```

### 2. 搜索用户
```javascript
wx.cloud.callFunction({
  name: 'search',
  data: {
    action: 'users',
    data: {
      keyword: '篮球',
      page: 1,
      pageSize: 20
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('用户搜索结果:', res.result.data.users);
    }
  }
});
```

### 3. 获取热门搜索
```javascript
wx.cloud.callFunction({
  name: 'search',
  data: {
    action: 'hot_search',
    data: {}
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('热门搜索:', res.result.data.hotSearches);
    }
  }
});
```

## 收藏功能

### 1. 收藏动态/活动
```javascript
wx.cloud.callFunction({
  name: 'collections',
  data: {
    action: 'collect',
    data: {
      targetType: 'post', // post 或 activity
      targetId: 'postId123'
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('收藏成功');
    }
  }
});
```

### 2. 获取我的收藏
```javascript
wx.cloud.callFunction({
  name: 'collections',
  data: {
    action: 'my_collections',
    data: {
      targetType: 'all', // all, post, activity
      page: 1,
      pageSize: 20
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('我的收藏:', res.result.data.collections);
    }
  }
});
```

## 活动管理

### 1. 创建活动
```javascript
wx.cloud.callFunction({
  name: 'activities',
  data: {
    action: 'create',
    data: {
      title: '篮球一对一',
      description: '寻找篮球伙伴，一起打球提升技术',
      sport: '篮球',
      location: {
        name: '某某体育馆',
        address: '北京市朝阳区xxx',
        coordinates: [116.404, 39.915]
      },
      dateTime: {
        startTime: '2024-01-20 19:00:00',
        endTime: '2024-01-20 21:00:00',
        duration: 120
      },
      participants: {
        maxCount: 4,
        minCount: 2,
        genderLimit: 'all'
      },
      fee: {
        amount: 50,
        payType: 'aa'
      },
      tags: ['技能提升', '新手友好']
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('活动创建成功:', res.result.data.activity);
    }
  }
});
```

### 2. 申请加入活动
```javascript
wx.cloud.callFunction({
  name: 'activities',
  data: {
    action: 'join_request',
    data: {
      activityId: 'activityId123'
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('申请成功');
    }
  }
});
```

### 3. 获取推荐活动
```javascript
wx.cloud.callFunction({
  name: 'activities',
  data: {
    action: 'recommend',
    data: {
      page: 1,
      pageSize: 20
    }
  },
  success: res => {
    if (res.result.code === 0) {
      console.log('推荐活动:', res.result.data.activities);
    }
  }
});
``` 