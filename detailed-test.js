#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试用例定义
const testCases = [
  {
    function: 'user-login',
    tests: [
      {
        name: '获取用户信息',
        params: { action: 'get_user_info' },
        expected: 'success'
      }
    ]
  },
  {
    function: 'user-profile',
    tests: [
      {
        name: '获取用户资料',
        params: { action: 'get_profile' },
        expected: 'success'
      }
    ]
  },
  {
    function: 'posts',
    tests: [
      {
        name: '获取帖子列表',
        params: { action: 'list', data: { page: 1, pageSize: 10 } },
        expected: 'success'
      }
    ]
  },
  {
    function: 'user-follow',
    tests: [
      {
        name: '获取关注统计',
        params: { action: 'follow_stats' },
        expected: 'success'
      }
    ]
  },
  {
    function: 'messages',
    tests: [
      {
        name: '获取未读消息数',
        params: { action: 'unread_count' },
        expected: 'success'
      }
    ]
  },
  {
    function: 'activities',
    tests: [
      {
        name: '获取活动列表',
        params: { action: 'list', data: { page: 1, pageSize: 10 } },
        expected: 'success'
      }
    ]
  },
  {
    function: 'search',
    tests: [
      {
        name: '获取热门搜索',
        params: { action: 'hot_searches' },
        expected: 'success'
      }
    ]
  },
  {
    function: 'collections',
    tests: [
      {
        name: '获取收藏统计',
        params: { action: 'stats' },
        expected: 'success'
      }
    ]
  }
];

// 执行单个测试
async function runTest(functionName, testCase) {
  try {
    console.log(`🧪 测试: ${functionName} - ${testCase.name}`);
    
    // 创建临时参数文件
    const tempFile = `temp-params-${Date.now()}.json`;
    fs.writeFileSync(tempFile, JSON.stringify(testCase.params));
    
    try {
      // 使用文件输入
      const command = `Get-Content ${tempFile} | tcb fn invoke ${functionName}`;
      const result = execSync(command, { 
        encoding: 'utf8',
        shell: 'powershell.exe',
        timeout: 15000
      });
      
      // 解析结果
      let response = null;
      const lines = result.split('\n');
      
      for (const line of lines) {
        if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
          try {
            response = JSON.parse(line.trim());
            break;
          } catch (e) {
            // 继续寻找
          }
        }
      }
      
      if (response) {
        if (response.code === 0) {
          console.log(`   ✅ 成功: ${response.message || '无消息'}`);
          return { status: 'success', response };
        } else {
          console.log(`   ⚠️  业务错误: ${response.message} (code: ${response.code})`);
          return { status: 'warning', response };
        }
      } else {
        console.log(`   ⚠️  返回格式异常`);
        console.log(`   原始输出: ${result.substring(0, 200)}...`);
        return { status: 'warning', error: '返回格式异常' };
      }
      
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ 调用失败: ${error.message.substring(0, 100)}...`);
    return { status: 'failed', error: error.message };
  }
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始详细云函数测试...\n');
  
  const results = {
    total: 0,
    success: 0,
    warning: 0,
    failed: 0,
    details: []
  };
  
  for (const testCase of testCases) {
    console.log(`📋 测试函数: ${testCase.function}`);
    console.log('='.repeat(50));
    
    for (const test of testCase.tests) {
      results.total++;
      const result = await runTest(testCase.function, test);
      
      results.details.push({
        function: testCase.function,
        test: test.name,
        ...result
      });
      
      if (result.status === 'success') {
        results.success++;
      } else if (result.status === 'warning') {
        results.warning++;
      } else {
        results.failed++;
      }
      
      // 等待1秒
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('');
  }
  
  // 生成报告
  console.log('📊 详细测试报告');
  console.log('='.repeat(50));
  console.log(`📈 总计测试: ${results.total}`);
  console.log(`✅ 成功: ${results.success}`);
  console.log(`⚠️  警告: ${results.warning}`);
  console.log(`❌ 失败: ${results.failed}`);
  
  const successRate = ((results.success / results.total) * 100).toFixed(1);
  console.log(`📊 成功率: ${successRate}%`);
  
  console.log('\n📋 详细结果:');
  results.details.forEach(detail => {
    const icon = detail.status === 'success' ? '✅' : detail.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${detail.function} - ${detail.test}`);
  });
  
  if (results.success === results.total) {
    console.log('\n🎉 所有测试都成功通过！云函数运行正常。');
  } else if (results.success > 0) {
    console.log('\n⚠️  部分测试通过，可能需要检查权限或数据状态。');
  } else {
    console.log('\n❌ 所有测试都失败，请检查云函数代码或部署状态。');
  }
}

// 运行测试
runAllTests().catch(console.error); 