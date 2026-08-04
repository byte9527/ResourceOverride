console.log('🛠️ DevTools initializer loading...');

// 阻止DevTools协议调用
if (typeof window !== 'undefined') {
    // 禁用可能导致协议错误的功能
    window.addEventListener('error', function(e) {
        if (e.message && e.message.includes('Fetch.enable')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🛡️ Blocked Fetch.enable protocol call');
            return false;
        }
    });
    
    // 重写console.error以过滤协议错误
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('Fetch.enable') || message.includes('protocol_client')) {
            console.log('🛡️ Filtered protocol error:', message);
            return;
        }
        originalConsoleError.apply(console, args);
    };
}

// 只负责创建DevTools面板
if (chrome && chrome.devtools && chrome.devtools.panels) {
    console.log('✅ DevTools API available');
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
    const panelPage = `src/ui/options.html?source=devtools&tabId=${inspectedTabId}`;
    
    chrome.devtools.panels.create(
        'Resource Override',
        'icons/icon-16x16.png',
        panelPage,
        function(panel) {
            console.log('🎯 DevTools panel created successfully');
            
            // 确保面板显示后设置正确的环境
            if (panel) {
                panel.onShown.addListener(function(window) {
                    console.log('📋 Panel shown, setting up environment');
                    if (window && window.console) {
                        // 在面板窗口中也过滤协议错误
                        const panelConsoleError = window.console.error;
                        window.console.error = function(...args) {
                            const message = args.join(' ');
                            if (message.includes('Fetch.enable') || message.includes('protocol_client')) {
                                return;
                            }
                            panelConsoleError.apply(window.console, args);
                        };
                    }
                });
            }
        }
    );
} else {
    console.warn('⚠️ DevTools API not available');
} 
