import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import OptionsApp from './components/OptionsApp';
import 'antd/dist/reset.css';

console.log('🎛️ React Options page loading...');

// 确保DOM已加载
const initializeReactApp = () => {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found!');
    return;
  }

  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <ConfigProvider locale={zhCN} theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        }
      }}>
        <OptionsApp />
      </ConfigProvider>
    </React.StrictMode>
  );

  console.log('✅ React Options app initialized');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReactApp);
} else {
  initializeReactApp();
} 
