// 数据库初始化脚本
// 在云开发控制台的数据库管理中执行

// 1. 创建用户集合 (users)
// 索引配置
db.collection('users').createIndex({
  "_openid": 1
}, {
  "unique": true
});

db.collection('users').createIndex({
  "phone": 1
}, {
  "unique": true,
  "sparse": true
});

db.collection('users').createIndex({
  "nickname": 1
});

db.collection('users').createIndex({
  "createdAt": -1
});

// 2. 创建动态集合 (posts)
// 索引配置
db.collection('posts').createIndex({
  "_openid": 1
});

db.collection('posts').createIndex({
  "authorId": 1
});

db.collection('posts').createIndex({
  "status": 1
});

db.collection('posts').createIndex({
  "visibility": 1
});

db.collection('posts').createIndex({
  "createdAt": -1
});

db.collection('posts').createIndex({
  "tags": 1
});

db.collection('posts').createIndex({
  "isRecommended": 1,
  "recommendScore": -1
});

// 复合索引
db.collection('posts').createIndex({
  "status": 1,
  "visibility": 1,
  "createdAt": -1
});

db.collection('posts').createIndex({
  "authorId": 1,
  "status": 1,
  "createdAt": -1
});

// 3. 创建活动集合 (activities)
// 索引配置
db.collection('activities').createIndex({
  "_openid": 1
});

db.collection('activities').createIndex({
  "organizerId": 1
});

db.collection('activities').createIndex({
  "sport": 1
});

db.collection('activities').createIndex({
  "status": 1
});

db.collection('activities').createIndex({
  "dateTime.startTime": 1
});

db.collection('activities').createIndex({
  "createdAt": -1
});

// 地理位置索引
db.collection('activities').createIndex({
  "location.coordinates": "2dsphere"
});

// 复合索引
db.collection('activities').createIndex({
  "status": 1,
  "dateTime.startTime": 1
});

db.collection('activities').createIndex({
  "sport": 1,
  "status": 1,
  "dateTime.startTime": 1
});

// 4. 创建关注关系集合 (follows)
// 索引配置
db.collection('follows').createIndex({
  "followerId": 1
});

db.collection('follows').createIndex({
  "followingId": 1
});

db.collection('follows').createIndex({
  "status": 1
});

db.collection('follows').createIndex({
  "createdAt": -1
});

// 复合索引
db.collection('follows').createIndex({
  "followerId": 1,
  "followingId": 1,
  "status": 1
}, {
  "unique": true
});

db.collection('follows').createIndex({
  "followerId": 1,
  "status": 1,
  "createdAt": -1
});

db.collection('follows').createIndex({
  "followingId": 1,
  "status": 1,
  "createdAt": -1
});

// 5. 创建点赞集合 (likes)
// 索引配置
db.collection('likes').createIndex({
  "_openid": 1
});

db.collection('likes').createIndex({
  "userId": 1
});

db.collection('likes').createIndex({
  "targetType": 1
});

db.collection('likes').createIndex({
  "targetId": 1
});

db.collection('likes').createIndex({
  "createdAt": -1
});

// 复合索引
db.collection('likes').createIndex({
  "userId": 1,
  "targetType": 1,
  "targetId": 1
}, {
  "unique": true
});

db.collection('likes').createIndex({
  "targetType": 1,
  "targetId": 1,
  "createdAt": -1
});

// 6. 创建评论集合 (comments)
// 索引配置
db.collection('comments').createIndex({
  "_openid": 1
});

db.collection('comments').createIndex({
  "authorId": 1
});

db.collection('comments').createIndex({
  "targetType": 1
});

db.collection('comments').createIndex({
  "targetId": 1
});

db.collection('comments').createIndex({
  "parentId": 1
});

db.collection('comments').createIndex({
  "status": 1
});

db.collection('comments').createIndex({
  "createdAt": -1
});

// 复合索引
db.collection('comments').createIndex({
  "targetType": 1,
  "targetId": 1,
  "parentId": 1,
  "status": 1,
  "createdAt": -1
});

db.collection('comments').createIndex({
  "targetType": 1,
  "targetId": 1,
  "status": 1,
  "createdAt": -1
});

// 7. 创建消息集合 (messages)
// 索引配置
db.collection('messages').createIndex({
  "_openid": 1
});

db.collection('messages').createIndex({
  "senderId": 1
});

db.collection('messages').createIndex({
  "receiverId": 1
});

db.collection('messages').createIndex({
  "type": 1
});

db.collection('messages').createIndex({
  "isRead": 1
});

db.collection('messages').createIndex({
  "createdAt": -1
});

// 复合索引
db.collection('messages').createIndex({
  "receiverId": 1,
  "type": 1,
  "isRead": 1,
  "createdAt": -1
});

db.collection('messages').createIndex({
  "receiverId": 1,
  "isRead": 1,
  "createdAt": -1
});

// 8. 创建搜索历史集合 (search_history)
// 索引配置
db.collection('search_history').createIndex({
  "_openid": 1
});

db.collection('search_history').createIndex({
  "keyword": 1
});

db.collection('search_history').createIndex({
  "lastSearchAt": -1
});

// 复合索引
db.collection('search_history').createIndex({
  "_openid": 1,
  "keyword": 1
}, {
  "unique": true
});

db.collection('search_history').createIndex({
  "_openid": 1,
  "lastSearchAt": -1
});

// 9. 创建收藏集合 (collections)
// 索引配置
db.collection('collections').createIndex({
  "_openid": 1
});

db.collection('collections').createIndex({
  "userId": 1
});

db.collection('collections').createIndex({
  "targetType": 1
});

db.collection('collections').createIndex({
  "targetId": 1
});

db.collection('collections').createIndex({
  "createdAt": -1
});

// 复合索引
db.collection('collections').createIndex({
  "userId": 1,
  "targetType": 1,
  "targetId": 1
}, {
  "unique": true
});

db.collection('collections').createIndex({
  "userId": 1,
  "targetType": 1,
  "createdAt": -1
});

db.collection('collections').createIndex({
  "targetType": 1,
  "targetId": 1,
  "createdAt": -1
});

console.log("数据库初始化完成！");
console.log("请在云开发控制台的数据库管理页面，分别为以下集合创建索引：");
console.log("- users: _openid(唯一), phone(唯一), nickname, createdAt");
console.log("- posts: _openid, authorId, status, visibility, createdAt, tags");
console.log("- activities: _openid, organizerId, sport, status, dateTime.startTime, location.coordinates(2dsphere)");
console.log("- follows: followerId, followingId, status, createdAt");
console.log("- likes: _openid, userId, targetType, targetId, createdAt");
console.log("- comments: _openid, authorId, targetType, targetId, parentId, status, createdAt");
console.log("- messages: _openid, receiverId, type, isRead, createdAt"); 