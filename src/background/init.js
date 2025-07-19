{
    // 在service worker环境中使用self，在window环境中使用window
    const globalObj = typeof window !== 'undefined' ? window : self;
    
    // 如果bgapp还没有定义，则初始化它
    if (!globalObj.bgapp) {
        globalObj.bgapp = {};
    }
    
    // 统一浏览器API访问
    globalObj.browser = globalObj.browser ? globalObj.browser : globalObj.chrome;
}
