# 运动搭子App - Cloudbase后端

## 📋 项目简介

运动搭子App是一个基于腾讯云开发(Cloudbase)的运动社交应用后端服务，提供类似小红书的运动内容分享和社交互动体验。支持Android和iOS移动应用。

## 🚀 技术栈

- **云开发平台**: 腾讯云开发 (Cloudbase)
- **运行时**: Node.js 16+
- **数据库**: 云数据库 (MongoDB文档型)
- **存储**: 云存储 (图片/视频文件)
- **认证**: 自定义登录 (手机号验证码/第三方登录)
- **云函数**: Serverless架构
- **客户端**: Android/iOS App (React Native/Flutter/原生)

## 📁 项目结构

```
yundong-backend/
├── cloudfunctions/          # 云函数目录
│   ├── user-login/         # 用户登录/注册
│   ├── user-profile/       # 用户信息管理
│   ├── user-follow/        # 关注系统
│   ├── posts/              # 动态发布和管理
│   ├── messages/           # 消息通知
│   ├── search/             # 搜索功能
│   ├── collections/        # 收藏功能
│   ├── activities/         # 活动管理
│   └── package.json        # 云函数依赖
├── database/               # 数据库相关
│   └── init.sql           # 数据库初始化脚本
├── docs/                   # 文档目录
│   └── api-examples.md    # API使用示例
├── cloudbaserc.json        # CloudBase CLI配置
├── DEPLOYMENT.md           # 详细部署指南
├── PROGRESS.md             # 开发进度
└── README.md              # 项目文档
```

## 🏗️ 核心功能

### 第一阶段 - 核心功能 ✅
- [x] 用户认证登录系统 (手机号验证码、第三方登录)
- [x] 用户信息管理 (资料编辑、头像上传)
- [x] 动态发布和浏览 (图片/视频动态)
- [x] 基础互动功能 (点赞、评论)
- [x] 关注系统 (关注、取消关注)
- [x] 消息通知 (点赞、评论、关注通知)

### 第二阶段 - 社交功能 ✅
- [x] 搜索功能 (用户、动态、活动、话题搜索)
- [x] 话题系统 (标签管理)
- [x] 收藏功能
- [x] 搜索历史和建议

### 第三阶段 - 活动功能 ✅
- [x] 活动创建和管理
- [x] 活动参与系统
- [x] 地理位置服务
- [x] 推荐算法

### 第四阶段 - 高级功能 🔮
- [ ] 实时聊天
- [ ] 数据统计分析
- [ ] 内容审核
- [ ] 运营管理后台

## 🛠️ 安装部署

### 1. 环境准备

1. 安装 [CloudBase CLI](https://docs.cloudbase.net/cli-v1/install.html)
2. 购买并开通腾讯云CloudBase环境
3. 获取CloudBase环境ID

### 2. 项目配置

1. 克隆项目到本地
2. 安装CloudBase CLI: `npm install -g @cloudbase/cli`
3. 登录CloudBase: `cloudbase login`
4. 修改 `cloudbaserc.json` 中的环境ID

### 3. 数据库初始化

1. 登录腾讯云CloudBase控制台
2. 进入数据库管理页面
3. 按照 `database/init.sql` 创建集合和索引

### 4. 云函数部署

使用CloudBase CLI部署云函数：

```bash
# 部署所有云函数
cloudbase functions:deploy

# 或单独部署
cloudbase functions:deploy user-login
cloudbase functions:deploy user-profile
cloudbase functions:deploy user-follow
cloudbase functions:deploy posts
cloudbase functions:deploy messages
cloudbase functions:deploy search
cloudbase functions:deploy collections
cloudbase functions:deploy activities
```

## 📖 详细文档

- 📘 **[完整部署指南](./DEPLOYMENT.md)** - Android/iOS应用CloudBase部署详细步骤
- 📗 **[API使用示例](./docs/api-examples.md)** - 详细的接口调用示例
- 📙 **[开发进度报告](./PROGRESS.md)** - 项目功能完成情况和技术架构

## 📚 API文档

### 统一响应格式

```javascript
// 成功响应
{
  code: 0,
  message: "success",
  data: {}, // 具体数据
  timestamp: 1642867200000
}

// 错误响应
{
  code: 4001, // 错误码
  message: "参数错误", // 错误信息
  data: null,
  timestamp: 1642867200000
}
```

### 错误码说明

- `0`: 成功
- `4001`: 参数错误
- `4002`: 业务逻辑错误
- `4003`: 权限错误
- `4004`: 资源不存在
- `5001`: 服务器内部错误

### 主要API接口

#### 用户登录 (user-login)

```javascript
// 微信授权登录
wx.cloud.callFunction({
  name: 'user-login',
  data: {
    action: 'wechat_login',
    data: {
      userInfo: userInfo // 微信用户信息
    }
  }
})

// 手机号登录
wx.cloud.callFunction({
  name: 'user-login',
  data: {
    action: 'phone_login',
    data: {
      phone: '13800138000',
      code: '123456'
    }
  }
})
```

#### 用户信息 (user-profile)

```javascript
// 获取用户资料
wx.cloud.callFunction({
  name: 'user-profile',
  data: {
    action: 'get_profile'
  }
})

// 更新用户资料
wx.cloud.callFunction({
  name: 'user-profile',
  data: {
    action: 'update_profile',
    data: {
      nickname: '新昵称',
      bio: '个人简介'
    }
  }
})
```

#### 动态管理 (posts)

```javascript
// 发布动态
wx.cloud.callFunction({
  name: 'posts',
  data: {
    action: 'create',
    data: {
      type: 'image',
      content: '今天跑步10公里 #跑步# #运动搭子#',
      images: ['cloud://xxx.jpg']
    }
  }
})

// 获取动态列表
wx.cloud.callFunction({
  name: 'posts',
  data: {
    action: 'list',
    data: {
      type: 'recommend', // recommend/following
      page: 1,
      pageSize: 20
    }
  }
})
```

## 🗄️ 数据库设计

### 主要集合

1. **users** - 用户表
2. **posts** - 动态表  
3. **activities** - 活动表
4. **follows** - 关注关系表
5. **likes** - 点赞表
6. **comments** - 评论表
7. **messages** - 消息表
8. **search_history** - 搜索历史表
9. **collections** - 收藏表

详细字段说明请参考项目开头的技术规范文档。

## 🔒 安全机制

- 所有云函数都进行身份验证
- 敏感操作需要额外权限校验
- 输入参数严格验证
- 防SQL注入和XSS攻击
- API调用频率限制

## 🚀 性能优化

- 数据库查询使用索引
- 大列表分页加载
- 图片/视频CDN加速
- 热点数据缓存
- 云函数冷启动优化

## 📈 监控运维

- 云函数执行日志
- 数据库性能监控
- 错误告警机制
- 资源使用统计

## 🤝 开发规范

### 代码风格
- 使用ES6+语法
- 遵循Airbnb JavaScript规范
- 每个函数都要有详细注释
- 完善的错误处理

### Git提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 其他修改

## 📞 联系方式

如有问题或建议，请联系开发团队。

## �� 许可证

MIT License 