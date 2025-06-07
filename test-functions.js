#!/usr/bin/env node

const { execSync } = require('child_process');

// 测试用例配置
const testCases = {
  // 用户登录测试
  'user-login': [
    {
      name: '获取用户信息',
      params: { action: 'get_user_info' }
    },
    {
      name: '微信登录',
      params: {
        action: 'wechat_login',
        data: {
          userInfo: {
            nickName: '运动达人',
            avatarUrl: 'https://example.com/avatar.jpg',
            gender: 1,
            province: '广东',
            city: '深圳'
          }
        }
      }
    }
  ],

  // 用户资料测试
  'user-profile': [
    {
      name: '获取用户资料',
      params: {
        action: 'get_profile'
      }
    },
    {
      name: '更新用户资料',
      params: {
        action: 'update_profile',
        data: {
          nickname: '测试用户',
          bio: '热爱运动的测试用户',
          birthday: '1990-01-01',
          gender: 1,
          location: '深圳市'
        }
      }
    }
  ],

  // 帖子管理测试
  'posts': [
    {
      name: '获取帖子列表',
      params: {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      }
    },
    {
      name: '获取热门帖子',
      params: {
        action: 'list',
        data: { 
          page: 1, 
          pageSize: 10,
          sortType: 'hot'
        }
      }
    }
  ],

  // 用户关注测试
  'user-follow': [
    {
      name: '获取关注列表',
      params: {
        action: 'following_list',
        data: { page: 1, pageSize: 10 }
      }
    },
    {
      name: '获取粉丝列表',
      params: {
        action: 'followers_list',
        data: { page: 1, pageSize: 10 }
      }
    },
    {
      name: '获取关注统计',
      params: {
        action: 'follow_stats'
      }
    }
  ],

  // 消息通知测试
  'messages': [
    {
      name: '获取通知列表',
      params: {
        action: 'list',
        data: { page: 1, pageSize: 20 }
      }
    },
    {
      name: '获取未读消息数',
      params: {
        action: 'unread_count'
      }
    },
    {
      name: '标记全部已读',
      params: {
        action: 'mark_all_read'
      }
    }
  ],

  // 活动管理测试
  'activities': [
    {
      name: '获取活动列表',
      params: {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      }
    },
    {
      name: '获取推荐活动',
      params: {
        action: 'recommend',
        data: { page: 1, pageSize: 5 }
      }
    },
    {
      name: '获取我的活动',
      params: {
        action: 'my_activities',
        data: { page: 1, pageSize: 10 }
      }
    }
  ],

  // 搜索功能测试
  'search': [
    {
      name: '综合搜索',
      params: {
        action: 'comprehensive',
        data: { 
          keyword: '篮球',
          page: 1,
          pageSize: 10
        }
      }
    },
    {
      name: '获取热门搜索',
      params: {
        action: 'hot_searches'
      }
    },
    {
      name: '获取搜索建议',
      params: {
        action: 'suggestions',
        data: { keyword: '足' }
      }
    }
  ],

  // 收藏功能测试
  'collections': [
    {
      name: '获取收藏列表',
      params: {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      }
    },
    {
      name: '获取收藏统计',
      params: {
        action: 'stats'
      }
    }
  ]
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

// 健康检查
async function healthCheck() {
  log('\n🏥 开始健康检查...', 'magenta');
  
  try {
    // 检查云开发CLI是否可用
    execSync('tcb --version', { stdio: 'pipe' });
    log('✅ 云开发CLI可用', 'green');
  } catch (error) {
    log('❌ 云开发CLI不可用，请确保已安装并登录', 'red');
    return false;
  }
  
  // 检查环境配置
  try {
    const config = require('./cloudbaserc.json');
    if (config.envId) {
      log(`✅ 环境ID: ${config.envId}`, 'green');
    }
  } catch (error) {
    log('⚠️  未找到cloudbaserc.json配置文件', 'yellow');
  }
  
  // 测试一个简单的云函数调用
  try {
    const testResult = execSync('tcb fn list', { encoding: 'utf8', stdio: 'pipe' });
    if (testResult.includes('user-login')) {
      log('✅ 云函数列表可访问', 'green');
    }
  } catch (error) {
    log('⚠️  无法访问云函数列表', 'yellow');
  }
  
  return true;
}

// 执行单个测试
async function runTest(functionName, testCase) {
  testResults.total++;
  
  try {
    log(`\n🧪 测试: ${functionName} - ${testCase.name}`, 'cyan');
    
    // 修复JSON参数格式问题
    const paramsJson = JSON.stringify(testCase.params);
    const command = `tcb fn invoke ${functionName} --params='${paramsJson}'`;
    
    log(`📝 参数: ${JSON.stringify(testCase.params, null, 2)}`, 'yellow');
    
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 30000
    });
    
    // 提取返回结果
    const lines = result.split('\n');
    let resultLine = '';
    for (const line of lines) {
      if (line.includes('返回结果：') || line.includes('RetMsg:') || line.trim().startsWith('{')) {
        resultLine = line;
        break;
      }
    }
    
    if (resultLine) {
      const jsonMatch = resultLine.match(/\{.*\}/);
      if (jsonMatch) {
        const response = JSON.parse(jsonMatch[0]);
        
        const testDetail = {
          function: functionName,
          test: testCase.name,
          status: 'unknown',
          response: response
        };
        
        if (response.code === 0) {
          log(`✅ 成功: ${response.message}`, 'green');
          testResults.passed++;
          testDetail.status = 'passed';
        } else if (response.code === 401 || response.code === 403) {
          log(`⚠️  权限问题: ${response.message} (code: ${response.code})`, 'yellow');
          testResults.warnings++;
          testDetail.status = 'warning';
        } else {
          log(`⚠️  业务错误: ${response.message} (code: ${response.code})`, 'yellow');
          testResults.warnings++;
          testDetail.status = 'warning';
        }
        
        log(`📊 响应: ${JSON.stringify(response, null, 2)}`, 'blue');
        testResults.details.push(testDetail);
      } else {
        // 尝试解析整行作为JSON
        try {
          const response = JSON.parse(resultLine.trim());
          const testDetail = {
            function: functionName,
            test: testCase.name,
            status: 'passed',
            response: response
          };
          log(`✅ 成功解析响应`, 'green');
          testResults.passed++;
          testResults.details.push(testDetail);
        } catch {
          log(`⚠️  无法解析返回结果: ${resultLine}`, 'yellow');
          testResults.warnings++;
          testResults.details.push({
            function: functionName,
            test: testCase.name,
            status: 'warning',
            error: '无法解析返回结果'
          });
        }
      }
    } else {
      log(`⚠️  未找到返回结果`, 'yellow');
      log(`原始输出: ${result}`, 'blue');
      testResults.warnings++;
      testResults.details.push({
        function: functionName,
        test: testCase.name,
        status: 'warning',
        error: '未找到返回结果'
      });
    }
    
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    testResults.failed++;
    testResults.details.push({
      function: functionName,
      test: testCase.name,
      status: 'failed',
      error: error.message
    });
    
    if (error.stdout) {
      log(`输出: ${error.stdout}`, 'yellow');
    }
    if (error.stderr) {
      log(`错误: ${error.stderr}`, 'red');
    }
  }
}

// 生成测试报告
function generateReport() {
  log('\n📊 测试报告', 'magenta');
  log('='.repeat(50), 'blue');
  
  log(`📈 总计测试: ${testResults.total}`, 'cyan');
  log(`✅ 通过: ${testResults.passed}`, 'green');
  log(`⚠️  警告: ${testResults.warnings}`, 'yellow');
  log(`❌ 失败: ${testResults.failed}`, 'red');
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  log(`📊 成功率: ${successRate}%`, successRate > 80 ? 'green' : successRate > 60 ? 'yellow' : 'red');
  
  // 按函数分组显示详情
  const functionGroups = {};
  testResults.details.forEach(detail => {
    if (!functionGroups[detail.function]) {
      functionGroups[detail.function] = [];
    }
    functionGroups[detail.function].push(detail);
  });
  
  log('\n📋 详细结果:', 'cyan');
  Object.entries(functionGroups).forEach(([functionName, tests]) => {
    log(`\n🔧 ${functionName}:`, 'magenta');
    tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
      const color = test.status === 'passed' ? 'green' : test.status === 'warning' ? 'yellow' : 'red';
      log(`  ${icon} ${test.test}`, color);
    });
  });
  
  // 生成建议
  log('\n💡 建议:', 'cyan');
  if (testResults.failed > 0) {
    log('• 检查失败的云函数部署状态', 'yellow');
    log('• 确认数据库连接和权限配置', 'yellow');
  }
  if (testResults.warnings > 0) {
    log('• 检查用户认证状态和权限', 'yellow');
    log('• 确认测试数据是否存在', 'yellow');
  }
  if (testResults.passed === testResults.total) {
    log('🎉 所有测试通过！可以进行生产部署', 'green');
  }
}

// 运行所有测试
async function runAllTests() {
  log('🚀 开始运行云函数测试...', 'magenta');
  
  // 先进行健康检查
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    log('\n❌ 健康检查失败，请解决上述问题后重试', 'red');
    return;
  }
  
  for (const [functionName, tests] of Object.entries(testCases)) {
    log(`\n📋 测试函数: ${functionName}`, 'magenta');
    log('='.repeat(50), 'blue');
    
    for (const testCase of tests) {
      await runTest(functionName, testCase);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    }
  }
  
  generateReport();
}

// 运行特定函数测试
async function runFunctionTest(functionName) {
  if (!testCases[functionName]) {
    log(`❌ 未找到函数 ${functionName} 的测试用例`, 'red');
    return;
  }
  
  log(`🚀 测试函数: ${functionName}`, 'magenta');
  
  for (const testCase of testCases[functionName]) {
    await runTest(functionName, testCase);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('📚 使用方法:', 'cyan');
    log('  node test-functions.js                    # 运行所有测试', 'blue');
    log('  node test-functions.js [function-name]    # 测试特定函数', 'blue');
    log('\n🔧 可用函数:', 'cyan');
    Object.keys(testCases).forEach(name => {
      log(`  - ${name}`, 'yellow');
    });
    return;
  }
  
  if (args[0] === 'all') {
    runAllTests();
  } else {
    runFunctionTest(args[0]);
  }
}

if (require.main === module) {
  main();
} 