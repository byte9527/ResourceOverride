/// <reference types="chrome"/>
/**
 * Service Worker Entry Point - Modular Chrome Extension with Vite
 * 
 * This is the main entry point for the background service worker.
 * It uses ES modules and TypeScript for better development experience.
 */

import { Utils } from './modules/utils';
import { StorageManager } from './modules/storage';
import { RequestHandler } from './modules/requestHandler';
import { RuleManager } from './modules/ruleManager';

console.log('🚀 Service Worker starting with Vite + TypeScript...');

// Global declarations for Chrome extension
declare global {
  var bgapp: any;
  var browser: typeof chrome;
  var __DEV__: boolean;
  var __VERSION__: string;
}

// Initialize global objects for legacy compatibility
globalThis.bgapp = {};
globalThis.browser = globalThis.chrome;

/**
 * Main Extension Service Worker Class
 */
class ExtensionServiceWorker {
  private storageManager: StorageManager;
  private requestHandler: RequestHandler;
  private ruleManager: RuleManager;
  private isInitialized = false;

  constructor() {
    this.storageManager = new StorageManager();
    this.requestHandler = new RequestHandler();
    this.ruleManager = new RuleManager();
    
    this.init().catch(error => {
      console.error('❌ Service Worker initialization failed:', error);
      Utils.simpleError(error);
    });
  }

  /**
   * Initialize the service worker
   */
  private async init(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🔧 Initializing Extension Service Worker...');
    console.log(`📦 Version: ${__VERSION__} | Dev Mode: ${__DEV__}`);
    
    try {
      // Setup legacy compatibility
      this.setupLegacyCompatibility();
      
      // Initialize modules
      await this.initializeModules();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Service Worker initialized successfully');
      
    } catch (error) {
      console.error('❌ Service Worker initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup legacy bgapp compatibility
   */
  private setupLegacyCompatibility(): void {
    globalThis.bgapp = {
      util: {
        logOnTab: Utils.logOnTab,
        simpleError: Utils.simpleError
      },
      storage: {
        get: this.storageManager.legacyGet.bind(this.storageManager),
        set: this.storageManager.legacySet.bind(this.storageManager)
      },
      requestHandling: {
        handleRequest: this.requestHandler.handleBeforeRequest.bind(this.requestHandler)
      }
    };
  }

  /**
   * Initialize all modules
   */
  private async initializeModules(): Promise<void> {
    console.log('🔧 Initializing modules...');
    
    // Initialize storage first
    await this.storageManager.init();
    
    // Initialize request handler
    await this.requestHandler.init();
    
    // Initialize rule manager
    await this.ruleManager.init();
    
    console.log('📦 All modules initialized');
  }

  /**
   * Setup Chrome API event listeners
   */
  private setupEventListeners(): void {
    console.log('🎧 Setting up event listeners...');
    
    // Runtime events
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
    
    // Tab events
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    
    // Storage events
    chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
    
    // Web request events
    chrome.webRequest.onBeforeRequest.addListener(
      this.requestHandler.handleBeforeRequest.bind(this.requestHandler),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );
    
    // Message handling
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    console.log('🎧 Event listeners registered');
  }

  /**
   * Handle extension installation/update
   */
  private async handleInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
    console.log('📦 Extension installed/updated:', details);
    
    if (details.reason === 'install') {
      await this.initializeDefaultSettings();
    } else if (details.reason === 'update') {
      await this.handleUpdate(details);
    }
  }

  /**
   * Handle Chrome startup
   */
  private async handleStartup(): Promise<void> {
    console.log('🔄 Chrome startup detected');
    await this.storageManager.clearCache();
  }

  /**
   * Handle tab updates
   */
  private async handleTabUpdated(
    tabId: number, 
    changeInfo: chrome.tabs.TabChangeInfo, 
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (changeInfo.url && tab.url) {
      console.log(`🌐 Tab ${tabId} navigated to: ${changeInfo.url}`);
      await this.ruleManager.updateTabRules(tabId, tab.url);
    }
  }

  /**
   * Handle tab removal
   */
  private async handleTabRemoved(tabId: number): Promise<void> {
    console.log(`❌ Tab ${tabId} removed`);
    await this.ruleManager.cleanupTabRules(tabId);
  }

  /**
   * Handle storage changes
   */
  private async handleStorageChanged(
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: 'sync' | 'local' | 'managed'
  ): Promise<void> {
    if (areaName === 'local') {
      console.log('💾 Storage changed:', Object.keys(changes));
      this.storageManager.clearCache();
      
      if (changes.domains) {
        await this.ruleManager.updateRules();
      }
    }
  }

  /**
   * Handle runtime messages
   */
  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      console.log('📨 Received message:', message.action);
      
      switch (message.action) {
        case 'getRuleStats':
          const stats = await this.ruleManager.getRuleStats();
          sendResponse({ success: true, data: stats });
          break;
          
        case 'clearCache':
          this.storageManager.clearCache();
          sendResponse({ success: true });
          break;
          
        case 'getVersion':
          sendResponse({ 
            success: true, 
            data: { 
              version: __VERSION__, 
              dev: __DEV__ 
            } 
          });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Initialize default settings
   */
  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = {
      domains: [],
      showLogs: "false",
      version: __VERSION__,
      installDate: new Date().toISOString()
    };
    
    await this.storageManager.set(defaultSettings);
    console.log('🎯 Default settings initialized');
  }

  /**
   * Handle extension update
   */
  private async handleUpdate(details: chrome.runtime.InstalledDetails): Promise<void> {
    console.log(`📈 Extension updated from ${details.previousVersion} to ${__VERSION__}`);
    
    // Perform data migration if needed
    const storage = await this.storageManager.get();
    storage.version = __VERSION__;
    storage.updateDate = new Date().toISOString();
    
    await this.storageManager.set(storage);
  }
}

// Initialize the service worker
const extensionServiceWorker = new ExtensionServiceWorker();

// Export for potential external access (useful for debugging)
export default extensionServiceWorker;

// Development helpers
if (__DEV__) {
  // Expose to global scope for debugging
  (globalThis as any).extensionServiceWorker = extensionServiceWorker;
  console.log('🔍 Development mode: extensionServiceWorker available globally');
} 
