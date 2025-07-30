// DevTools 调试脚本
// 使用方法：在Chrome DevTools的Console中运行此脚本

console.log('🔍 DevTools调试脚本开始');

// 检查扩展是否正确加载
chrome.management.getAll(function(extensions) {
  const resourceOverride = extensions.find(ext => 
    ext.name.includes('Resource Override') || ext.name.includes('resource-override')
  );
  
  if (resourceOverride) {
    console.log('✅ 找到Resource Override扩展:', resourceOverride);
    console.log('扩展ID:', resourceOverride.id);
    console.log('启用状态:', resourceOverride.enabled);
    console.log('版本:', resourceOverride.version);
    
    if (!resourceOverride.enabled) {
      console.warn('⚠️ 扩展已安装但未启用');
    }
  } else {
    console.error('❌ 未找到Resource Override扩展');
  }
});

// 检查DevTools页面
console.log('🛠️ 检查DevTools配置...');

// 检查manifest
fetch(chrome.runtime.getURL('manifest.json'))
  .then(response => response.json())
  .then(manifest => {
    console.log('📄 Manifest配置:');
    console.log('devtools_page:', manifest.devtools_page);
    
    if (manifest.devtools_page) {
      // 检查DevTools页面是否可访问
      const devtoolsUrl = chrome.runtime.getURL(manifest.devtools_page);
      console.log('🔗 DevTools页面URL:', devtoolsUrl);
      
      fetch(devtoolsUrl)
        .then(response => {
          if (response.ok) {
            console.log('✅ DevTools页面可访问');
          } else {
            console.error('❌ DevTools页面无法访问，状态码:', response.status);
          }
        })
        .catch(error => {
          console.error('❌ DevTools页面加载失败:', error);
        });
    } else {
      console.error('❌ Manifest中未配置devtools_page');
    }
  })
  .catch(error => {
    console.error('❌ 无法读取manifest.json:', error);
  });

// 检查当前页面类型
console.log('📍 当前页面信息:');
console.log('URL:', window.location.href);
console.log('协议:', window.location.protocol);

// 给出调试建议
console.log(`
🔧 调试建议:
1. 确保扩展已启用
2. 刷新当前页面
3. 重新打开DevTools
4. 检查Chrome版本是否支持
5. 尝试在不同的网站上测试
`);

console.log('🔍 DevTools调试脚本结束');
