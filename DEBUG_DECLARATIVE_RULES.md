# declarativeNetRequest调试指南

## 🔍 检查规则是否正确注册

在Service Worker控制台运行：

```javascript
// 查看所有动态规则
chrome.declarativeNetRequest.getDynamicRules().then(rules => {
  console.log('📋 Active declarative rules:', rules.length);
  rules.forEach(rule => {
    console.log(`Rule ${rule.id}:`, {
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority
    });
  });
});
```

## 🎯 检查规则匹配

```javascript
// 测试URL是否匹配规则
const testUrl = "https://example.com/script.js";
chrome.declarativeNetRequest.testMatchOutcome({
  url: testUrl,
  type: "script"
}).then(result => {
  console.log(`🔍 Match result for ${testUrl}:`, result);
});
```

## 📊 常见问题

### 1. urlFilter不匹配
```javascript
// ❌ 错误的模式
"https://example.com/script.js"  // 太具体

// ✅ 正确的模式  
"*/script.js"                    // 匹配任何域名的script.js
"*://example.com/*"              // 匹配example.com的所有资源
```

### 2. resourceTypes不匹配
```javascript
// 确保包含正确的资源类型
resourceTypes: [
  chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,    // HTML页面
  chrome.declarativeNetRequest.ResourceType.SCRIPT,       // JS文件
  chrome.declarativeNetRequest.ResourceType.STYLESHEET,   // CSS文件
  chrome.declarativeNetRequest.ResourceType.IMAGE,        // 图片
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST // AJAX请求
]
```

### 3. 规则优先级
```javascript
// 更高的priority值 = 更高的优先级
{
  id: 1001,
  priority: 1,     // 低优先级
  // ...
}

{
  id: 1002, 
  priority: 100,   // 高优先级，会覆盖上面的规则
  // ...
}
```

## 🚀 验证步骤

1. **检查规则数量**: `getDynamicRules().length` 应该 > 0
2. **检查规则内容**: 确认`urlFilter`和`resourceTypes`正确
3. **检查匹配结果**: 使用`testMatchOutcome`测试
4. **检查网络面板**: 看是否有重定向发生
5. **检查控制台**: 看是否有declarativeNetRequest错误

## 💡 重要提醒

- declarativeNetRequest在Chrome内核层面工作
- 不需要JavaScript代码"执行"重定向
- 规则一旦注册，Chrome自动处理所有匹配的请求
- 如果不生效，99%是规则定义问题，不是执行问题 
