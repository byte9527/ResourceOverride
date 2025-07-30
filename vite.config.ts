import { defineConfig } from 'vite';
import { resolve } from 'path';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import manifest from './src/manifest.json';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@background': resolve(__dirname, 'src/background'),
        '@ui': resolve(__dirname, 'src/ui'),
        '@inject': resolve(__dirname, 'src/inject'),
        '@lib': resolve(__dirname, 'lib')
      }
    },
    
    plugins: [
      // React支持
      react(),
      // Chrome扩展插件 - 使用@crxjs/vite-plugin
      crx({ manifest })
    ],
    
    base: './', // 使用相对路径作为基础路径
    
    build: {
      outDir: 'dist',
      sourcemap: isDev ? 'inline' : true, // 开发模式使用内联sourcemap，生产模式生成.map文件
      minify: !isDev, // 开发模式不压缩
      assetsDir: '', // 确保资源文件使用相对路径
      
      rollupOptions: {
        input: {
          // 这些入口点会被rollup-plugin-chrome-extension自动检测
          'devtools': 'src/ui/devtools.js'
        },
        output: {
          // 保持清晰的文件结构
          entryFileNames: (chunkInfo) => {
            const name = chunkInfo.name;
            if (name.includes('background') || name.includes('service-worker')) {
              return 'background/[name].js';
            }
            if (name.includes('content')) {
              return 'content/[name].js';
            }
            if (name.includes('popup') || name.includes('options') || name.includes('devtools')) {
              return 'ui/[name].js';
            }
            return '[name].js';
          },
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            if (name.endsWith('.css')) {
              return 'css/[name][extname]';
            }
            if (name.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
              return 'images/[name][extname]';
            }
            return 'assets/[name][extname]';
          }
        }
      },
      
      // 目标环境
      target: 'es2020',
      
      // 优化配置
      chunkSizeWarningLimit: 1000
    },
    
    // 开发服务器配置（虽然Chrome扩展不能直接使用，但对于调试有用）
    server: {
      hmr: false, // Chrome扩展不支持HMR
      watch: {
        ignored: ['**/dist/**']
      }
    },
    
    // 优化依赖
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd']
    },
    
    // 环境变量
    define: {
      __DEV__: isDev,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    }
  };
}); 
