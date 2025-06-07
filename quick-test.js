#!/usr/bin/env node

const { execSync } = require('child_process');

// 简单的云函数测试
const tests = [
  { name: 'user-login', desc: '用户登录服务' },
  { name: 'user-profile', desc: '用户资料服务' },
  { name: 'posts', desc: '帖子管理服务' },
  { name: 'user-follow', desc: '用户关注服务' },
  { name: 'messages', desc: '消息通知服务' },
  { name: 'activities', desc: '活动管理服务' },
  { name: 'search', desc: '搜索服务' },
  { name: 'collections', desc: '收藏服务' }
];

console.log('🚀 开始云函数健康检查...\n');

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  try {
    console.log(`🧪 测试 ${test.name} (${test.desc})...`);
    
    // 尝试简单调用云函数
    const result = execSync(`tcb fn invoke ${test.name}`, { 
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe'
    });
    
    // 简单判断是否成功调用
    if (result.includes('RetMsg') || result.includes('返回结果') || result.includes('error') === false) {
      console.log(`✅ ${test.name} - 可以调用`);
      passCount++;
    } else {
      console.log(`⚠️  ${test.name} - 调用返回异常`);
      console.log(`   响应: ${result.substring(0, 200)}...`);
      failCount++;
    }
    
  } catch (error) {
    console.log(`❌ ${test.name} - 调用失败`);
    console.log(`   错误: ${error.message.substring(0, 100)}...`);
    failCount++;
  }
  
  console.log(''); // 空行
}

console.log('📊 测试结果汇总:');
console.log(`✅ 通过: ${passCount}`);
console.log(`❌ 失败: ${failCount}`);
console.log(`📈 总数: ${tests.length}`);

const successRate = ((passCount / tests.length) * 100).toFixed(1);
console.log(`📊 成功率: ${successRate}%`);

if (passCount === tests.length) {
  console.log('\n🎉 所有云函数都可以正常调用！');
} else if (passCount > 0) {
  console.log('\n⚠️  部分云函数可能需要检查参数或业务逻辑');
} else {
  console.log('\n❌ 所有云函数都无法调用，请检查部署状态');
} 