# CloudBase部署指南

## 🎯 适用场景
本指南适用于Android和iOS移动应用的后端部署，不适用于微信小程序。

## 📋 准备工作

### 1. 购买CloudBase服务
1. 登录 [腾讯云官网](https://cloud.tencent.com/)
2. 进入 [CloudBase控制台](https://console.cloud.tencent.com/tcb)
3. 点击"新建环境"
4. 选择"按量计费"模式（推荐）
5. 填写环境名称，记录**环境ID**

### 2. 开通必要服务
在CloudBase控制台中开通以下服务：
- ✅ **云函数** - 核心业务逻辑
- ✅ **云数据库（文档型）** - 数据存储
- ✅ **云存储** - 图片/视频文件
- ✅ **云调用** - 短信验证码服务

### 3. 获取访问密钥
1. 进入 [访问管理控制台](https://console.cloud.tencent.com/cam/capi)
2. 创建新的API密钥
3. 记录 `SecretId` 和 `SecretKey`（用于短信服务）

## 🛠️ 本地环境配置

### 1. 安装工具
```bash
# 安装CloudBase CLI
npm install -g @cloudbase/cli

# 登录CloudBase
cloudbase login
```

### 2. 配置项目

#### 2.1 更新环境ID
编辑 `cloudbaserc.json`：
```json
{
  "envId": "你的CloudBase环境ID"
}
```

#### 2.2 配置环境变量（可选）
如需短信验证码功能，在云函数控制台设置环境变量：
- `SMS_SECRET_ID`: 你的腾讯云SecretId
- `SMS_SECRET_KEY`: 你的腾讯云SecretKey

## 🗄️ 数据库初始化

### 1. 创建集合
在CloudBase控制台的数据库管理页面，创建以下集合：

```javascript
// 1. users - 用户表
db.createCollection('users')

// 2. posts - 动态表  
db.createCollection('posts')

// 3. activities - 活动表
db.createCollection('activities')

// 4. follows - 关注关系表
db.createCollection('follows')

// 5. likes - 点赞表
db.createCollection('likes')

// 6. comments - 评论表
db.createCollection('comments')

// 7. messages - 消息表
db.createCollection('messages')

// 8. search_history - 搜索历史表
db.createCollection('search_history')

// 9. collections - 收藏表
db.createCollection('collections')
```

### 2. 创建索引
复制 `database/init.sql` 中的索引创建命令，在数据库控制台执行。

## ☁️ 云函数部署

### 1. 安装依赖
```bash
# 在项目根目录
cd cloudfunctions
npm install

# 为每个云函数安装依赖
cd user-login && npm install && cd ..
cd user-profile && npm install && cd ..
cd user-follow && npm install && cd ..
cd posts && npm install && cd ..
cd messages && npm install && cd ..
cd search && npm install && cd ..
cd collections && npm install && cd ..
cd activities && npm install && cd ..
```

### 2. 部署云函数
```bash
# 返回项目根目录
cd ..

# 部署所有云函数
cloudbase functions:deploy

# 或单独部署（推荐，便于调试）
cloudbase functions:deploy user-login
cloudbase functions:deploy user-profile
cloudbase functions:deploy user-follow
cloudbase functions:deploy posts
cloudbase functions:deploy messages
cloudbase functions:deploy search
cloudbase functions:deploy collections
cloudbase functions:deploy activities
```

### 3. 验证部署
在CloudBase控制台的云函数页面，确认所有函数都已成功部署。

## 📱 客户端配置

### Android/iOS 客户端接入

#### 1. 安装CloudBase SDK

**React Native:**
```bash
npm install @cloudbase/react-native-sdk
```

**Flutter:**
```yaml
dependencies:
  cloudbase_core: ^2.0.0
  cloudbase_auth: ^2.0.0
  cloudbase_function: ^2.0.0
  cloudbase_database: ^2.0.0
  cloudbase_storage: ^2.0.0
```

**Android原生:**
```gradle
implementation 'com.tencent.tcb:tcb-android-sdk:1.9.0'
```

**iOS原生:**
```
pod 'CloudBase'
```

#### 2. 初始化配置

**React Native示例:**
```javascript
import cloudbase from '@cloudbase/react-native-sdk';

// 初始化
cloudbase.init({
  env: '你的CloudBase环境ID'
});

// 调用云函数
const result = await cloudbase.callFunction({
  name: 'user-login',
  data: {
    action: 'phone_login',
    data: {
      phone: '13800138000',
      code: '123456'
    }
  }
});
```

**Flutter示例:**
```dart
import 'package:cloudbase_core/cloudbase_core.dart';
import 'package:cloudbase_function/cloudbase_function.dart';

// 初始化
CloudBaseCore core = CloudBaseCore.init({'env': '你的CloudBase环境ID'});

// 调用云函数
CloudBaseFunction function = CloudBaseFunction(core);
CloudBaseResponse response = await function.callFunction(
  'user-login',
  {
    'action': 'phone_login',
    'data': {
      'phone': '13800138000',
      'code': '123456'
    }
  }
);
```

## 🔒 安全配置

### 1. 设置安全规则
在CloudBase控制台的数据库安全规则页面，设置适当的读写权限：

```javascript
// 用户表 - 只有本人可以修改
{
  "read": true,
  "write": "auth.uid == resource.data._openid"
}

// 动态表 - 所有人可读，只有作者可写
{
  "read": true, 
  "write": "auth.uid == resource.data._openid"
}
```

### 2. 配置CORS（跨域）
如果有Web端，需要在CloudBase控制台设置跨域配置。

## 📊 监控与调试

### 1. 查看日志
- CloudBase控制台 → 云函数 → 选择函数 → 日志
- 可以查看函数执行日志和错误信息

### 2. 性能监控
- 监控函数调用次数、执行时间
- 数据库读写次数
- 存储空间使用情况

### 3. 本地调试
```bash
# 本地调试云函数
cloudbase functions:invoke user-login --params '{"action":"get_user_info"}'
```

## 💰 费用控制

### 1. 设置用量告警
在CloudBase控制台设置用量告警，避免超出预算。

### 2. 优化建议
- 合理设置云函数内存和超时时间
- 使用数据库索引提高查询效率
- 图片压缩后再上传到云存储

## 🚀 上线检查清单

- [ ] 数据库集合和索引已创建
- [ ] 所有云函数部署成功
- [ ] 环境变量配置正确
- [ ] 安全规则设置合理
- [ ] 客户端SDK配置正确
- [ ] 功能测试通过
- [ ] 性能测试通过
- [ ] 用量告警已设置

## 🆘 常见问题

### Q: 云函数调用失败
A: 检查环境ID是否正确，函数是否部署成功

### Q: 数据库操作失败  
A: 检查安全规则设置，确认有相应的读写权限

### Q: 图片上传失败
A: 确认云存储服务已开通，检查文件大小限制

### Q: 短信验证码发送失败
A: 检查环境变量中的SecretId和SecretKey是否正确

---

如有其他问题，请查看CloudBase官方文档或联系技术支持。 