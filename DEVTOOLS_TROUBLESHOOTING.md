# DevTools 显示问题排查指南

## 🐛 问题描述

重装插件后，在Chrome DevTools中看不到"Resource Override"标签页。

## 🔍 可能原因

1. **扩展未正确加载**
2. **DevTools API权限问题**
3. **文件路径错误**
4. **Chrome版本兼容性**
5. **DevTools缓存问题**

## ✅ 排查步骤

### 1. 基础检查

**检查扩展状态**:
1. 打开 `chrome://extensions/`
2. 确认"Resource Override"扩展已启用
3. 查看是否有错误信息
4. 检查版本号是否为1.3.2

**检查控制台日志**:
1. 在任意网页打开DevTools
2. 切换到Console标签
3. 查找以下日志信息：
   - `🛠️ DevTools page loaded!`
   - `✅ Chrome DevTools API available`
   - `🎯 DevTools panel created successfully`

### 2. 手动调试

**在Console中运行调试脚本**:
```javascript
// 检查扩展是否正确加载
chrome.management.getAll(function(extensions) {
  const resourceOverride = extensions.find(ext => 
    ext.name.includes('Resource Override')
  );
  
  if (resourceOverride) {
    console.log('✅ 扩展已找到:', resourceOverride);
    console.log('ID:', resourceOverride.id);
    console.log('启用状态:', resourceOverride.enabled);
  } else {
    console.log('❌ 未找到扩展');
  }
});

// 检查DevTools API
if (chrome.devtools) {
  console.log('✅ DevTools API可用');
} else {
  console.log('❌ DevTools API不可用');
}
```

### 3. 完整重置步骤

**步骤1: 完全清理**
1. 删除扩展：`chrome://extensions/` → 移除扩展
2. 清理缓存：`Ctrl+Shift+Delete` → 清除缓存
3. 重启Chrome浏览器

**步骤2: 重新安装**
1. 确保项目已重新构建：`yarn build`
2. 重新加载扩展：加载`dist`目录
3. 确认扩展ID已更新

**步骤3: 验证功能**
1. 打开新的网页
2. 开启DevTools (F12)
3. 查找"Resource Override"标签页
4. 检查Console是否有错误日志

### 4. 常见问题解决

**问题1: 标签页不显示**
- 解决：检查`devtools_page`配置是否正确
- 验证：确认`dist/src/ui/devtools.html`文件存在

**问题2: 显示空白页面**
- 解决：检查devtools-panel.html是否存在
- 验证：查看Network标签是否有404错误

**问题3: 权限错误**
- 解决：确认manifest.json中有必要权限
- 验证：检查`permissions`数组是否包含相关权限

### 5. 文件检查清单

确认以下文件存在且内容正确：

**构建文件**:
- [ ] `dist/manifest.json` - 包含`devtools_page`配置
- [ ] `dist/src/ui/devtools.html` - DevTools入口页面
- [ ] `dist/src/ui/devtools-panel.html` - DevTools面板页面
- [ ] `dist/icons/icon-16x16.png` - 扩展图标

**配置检查**:
- [ ] `devtools_page: "src/ui/devtools.html"`
- [ ] 扩展权限配置正确
- [ ] 文件路径使用相对路径

### 6. 调试日志模板

期望在Console中看到的日志：
```
🛠️ DevTools page loaded!
🔗 URL: chrome-extension://[扩展ID]/src/ui/devtools.html
📄 Document ready state: complete
✅ Chrome DevTools API available
🎯 DevTools panel created successfully: [Panel对象]
```

### 7. 兜底方案

如果DevTools标签页仍然不显示，可以通过以下方式访问：

**方案1: Options页面**
- 右键扩展图标 → 选项
- 打开完整的规则管理界面

**方案2: 手动访问**
- 在地址栏输入：`chrome-extension://[扩展ID]/src/ui/options.html`

### 8. 联系技术支持

如果问题仍然存在，请提供以下信息：
- Chrome版本号
- 扩展版本号
- Console中的错误日志
- 扩展管理页面截图

## 🎯 快速解决方案

**最常见的解决方案**:
1. 完全删除扩展
2. 清理浏览器缓存
3. 重启Chrome
4. 重新运行`yarn build`
5. 重新加载扩展

**验证步骤**:
1. 打开新网页
2. 按F12打开DevTools
3. 查找"Resource Override"标签页
4. 点击标签页验证功能正常

---

**更新时间**: $(date)  
**适用版本**: 1.3.2+  
**状态**: 问题排查中
