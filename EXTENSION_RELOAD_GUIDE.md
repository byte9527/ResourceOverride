# Chrome扩展清理和重新安装指南

## 🐛 问题描述

在点击"管理扩展程序"时出现错误：
```
Extension connection check failed: Error: Extension context invalidated.
上下文： devtools://devtools/bundled/devtools_app.html
堆叠追踪： src/ui/tabGroup.js:30 (checkExtensionConnection)
```

这个错误表明Chrome DevTools仍在尝试访问已删除的旧文件`tabGroup.js`。

## 🔍 问题原因

1. **扩展上下文缓存**：Chrome缓存了旧版本的扩展文件
2. **DevTools缓存**：开发者工具保留了对已删除文件的引用
3. **不完整的重新加载**：扩展没有完全重新初始化

## ✅ 解决方案

### 步骤1：完全移除扩展

1. **打开扩展管理页面**
   ```
   chrome://extensions/
   ```

2. **找到"Resource Override"扩展**
   - 在扩展列表中找到该扩展

3. **完全删除扩展**
   - 点击"移除"按钮
   - 确认删除

### 步骤2：清理Chrome缓存

1. **清理浏览器缓存**
   - 按 `Ctrl+Shift+Delete` (Windows/Linux) 或 `Cmd+Shift+Delete` (Mac)
   - 选择"缓存的图片和文件"
   - 点击"清除数据"

2. **重启Chrome浏览器**
   - 完全关闭所有Chrome窗口
   - 重新启动Chrome

### 步骤3：重新安装扩展

1. **确认构建文件**
   ```bash
   # 在项目目录中运行
   npm run build
   ```

2. **重新加载扩展**
   - 打开 `chrome://extensions/`
   - 确保"开发者模式"已启用
   - 点击"加载已解压的扩展程序"
   - 选择项目的`dist`目录

### 步骤4：验证修复

1. **检查扩展加载状态**
   - 扩展应该正常显示在工具栏
   - 没有错误标识

2. **测试Options页面**
   - 右键点击扩展图标
   - 选择"选项"
   - 应该打开新的React界面

3. **测试DevTools功能**
   - 打开任意网页的开发者工具
   - 查看是否有"Resource Override"标签页
   - 应该显示React应用界面

## 🔧 高级清理方法

如果上述方法仍然无效，可以尝试以下高级清理：

### 方法1：清理扩展数据目录

1. **找到Chrome用户数据目录**
   - Windows: `C:\Users\[用户名]\AppData\Local\Google\Chrome\User Data\Default\Extensions`
   - Mac: `~/Library/Application Support/Google/Chrome/Default/Extensions`
   - Linux: `~/.config/google-chrome/Default/Extensions`

2. **删除扩展目录**
   - 找到Resource Override的扩展ID目录
   - 删除整个目录

3. **重启Chrome**

### 方法2：使用Chrome开发者模式

1. **开启开发者模式调试**
   ```javascript
   // 在Chrome控制台中运行
   chrome.management.getAll(function(extensions) {
     extensions.forEach(function(ext) {
       if (ext.name.includes('Resource Override')) {
         console.log('Extension ID:', ext.id);
         chrome.management.setEnabled(ext.id, false);
         setTimeout(() => chrome.management.setEnabled(ext.id, true), 1000);
       }
     });
   });
   ```

### 方法3：创建新的Chrome配置文件

1. **创建新的Chrome用户配置文件**
   - Chrome设置 → 管理用户 → 添加用户
   - 切换到新配置文件

2. **在新配置文件中安装扩展**
   - 这将避免所有缓存问题

## 📋 验证清单

完成清理和重新安装后，验证以下项目：

- [ ] 扩展在`chrome://extensions/`中正常显示
- [ ] 没有错误或警告信息
- [ ] Service Worker状态为"active"
- [ ] Options页面可以正常打开
- [ ] DevTools标签页可以正常显示
- [ ] 所有React组件正常渲染
- [ ] 控制台中没有`tabGroup.js`相关错误

## 🛠️ 预防措施

为避免类似问题再次发生：

1. **使用扩展ID固定**
   - 考虑使用固定的扩展ID进行开发

2. **定期清理**
   - 开发过程中定期清理Chrome缓存

3. **版本管理**
   - 在manifest.json中更新版本号以强制更新

4. **构建验证**
   - 每次构建后运行验证脚本确认文件正确性

## 💡 开发建议

### 检查构建完整性
```bash
# 运行构建验证
node -e "
const fs = require('fs');
const files = ['dist/manifest.json', 'dist/src/ui/devtools.html', 'dist/src/ui/options.html'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log('✅', file);
  } else {
    console.log('❌', file);
  }
});
"
```

### 实时监控
```bash
# 监控构建文件变化
npm run build && echo "Build completed at $(date)"
```

---

**记住**：彻底删除和重新安装是解决扩展缓存问题最可靠的方法！ 
