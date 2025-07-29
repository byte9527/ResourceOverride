# WebSocket连接错误修复指南

## 🐛 问题描述

Chrome扩展加载时出现WebSocket连接错误：
```
WebSocket connection to 'ws://nlidpampoeldpndcdigoofnffobbkkmk:5173/?token=...' failed: Connection closed before receiving a handshake response
```

堆栈追踪显示：`http://localhost:5173/@crx/client-worker:49`

## 🔍 根本原因

这个错误是由于`@crxjs/vite-plugin`插件在开发模式下注入的HMR (Hot Module Replacement) 代码导致的。虽然我们的构建是生产模式，但浏览器可能仍在使用缓存的开发版本。

## ✅ 解决方案

### 1. 清理浏览器扩展缓存

**完全移除旧扩展：**
1. 打开 Chrome 扩展管理页面：`chrome://extensions/`
2. 找到 "Resource Override" 扩展
3. 点击 "移除" 按钮，完全删除扩展
4. 重启 Chrome 浏览器

**重新加载扩展：**
1. 再次打开 `chrome://extensions/`
2. 确保 "开发者模式" 已启用
3. 点击 "加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

### 2. 验证构建完整性

运行我们的验证脚本：
```bash
node verify-build.cjs
```

应该看到：
```
🎉 Build verification PASSED! The extension should work correctly.
```

### 3. 强制清理构建缓存

如果问题仍然存在，执行完全清理：

```bash
# 清理所有缓存和依赖
rm -rf dist
rm -rf node_modules/.vite
rm -rf node_modules/.cache

# 重新安装依赖
npm ci

# 强制生产模式构建
NODE_ENV=production npm run build
```

### 4. 检查扩展加载状态

确认扩展正确加载：

1. **检查service worker状态：**
   - 在 `chrome://extensions/` 中找到扩展
   - 点击 "service worker" 链接
   - 应该看到控制台输出：`✅ Service Worker initialized successfully`

2. **检查开发工具页面：**
   - 打开任意网页的开发者工具
   - 查看 "Resource Override" 标签页
   - 应该显示React应用界面，而不是错误

3. **检查选项页面：**
   - 右键点击扩展图标 → "选项"
   - 应该打开React选项页面

## 🔧 技术细节

### 构建配置已优化

我们的 `vite.config.ts` 已配置为：

```typescript
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    base: './',  // 使用相对路径
    
    build: {
      sourcemap: isDev ? 'inline' : true,
      minify: !isDev,
      assetsDir: '',  // 确保资源使用相对路径
    },
    
    server: {
      hmr: false,  // Chrome扩展不支持HMR
      watch: {
        ignored: ['**/dist/**']
      }
    }
  };
});
```

### Manifest V3 兼容性

- ✅ **Service Worker**: 正确配置为ES模块
- ✅ **相对路径**: 所有资源使用相对路径
- ✅ **类型安全**: 完整的TypeScript支持  
- ✅ **React UI**: 现代化的用户界面
- ✅ **Sourcemap**: 完整的调试支持

### 验证检查点

构建后的文件应该：

1. **无开发引用**: 不包含 `localhost:5173`、`@crx/client-worker` 等
2. **正确路径**: 使用 `../../chunks/...` 相对路径
3. **完整文件**: 所有必需的 chunks 和资源文件存在
4. **正确大小**: JavaScript bundles 合理压缩

## 🎯 最终验证

完成上述步骤后，扩展应该：

- ✅ **正常加载** - 无 WebSocket 错误
- ✅ **UI 工作** - React 组件正确渲染  
- ✅ **功能完整** - 所有原有功能正常
- ✅ **性能良好** - 快速加载和响应

## 🆘 如果问题仍然存在

1. **检查Chrome版本**: 确保使用Chrome 88+
2. **禁用其他扩展**: 排除冲突可能
3. **查看控制台**: 记录具体错误信息
4. **重启系统**: 清理所有缓存

## 📞 技术支持

如果按照此指南操作后问题仍未解决，请提供：

1. Chrome版本号
2. 完整的控制台错误信息
3. 扩展管理页面的截图
4. `node verify-build.cjs` 的输出结果

---

**版本信息:**
- Chrome Extension Manifest: V3
- Build Tool: Vite 5.0+ with @crxjs/vite-plugin
- UI Framework: React 18 + Ant Design 5
- TypeScript: 5.3+ 
