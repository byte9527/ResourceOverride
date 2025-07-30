/// <reference types="chrome"/>

/**
 * Utility functions for the background script
 */
export class Utils {
  /**
   * Log message to a specific tab
   */
  static async logOnTab(tabId: number, message: string, important = false): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['showLogs']);
      if (result.showLogs === "true") {
        await chrome.tabs.sendMessage(tabId, {
          action: "log",
          message: message,
          important: important
        });
      }
    } catch (error) {
      console.warn('Failed to send log message to tab:', error);
    }
  }

  /**
   * Simple error logging with stack trace
   */
  static simpleError(err: Error | any): void {
    if (err && err.stack) {
      console.error("=== Printing Stack ===");
      console.error(err.stack);
    }
    console.error(err);
  }

  /**
   * Promisified version of chrome.storage.local.get
   */
  static async getStorage<T = any>(keys: string | string[] | null = null): Promise<T> {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result as T);
      });
    });
  }

  /**
   * Promisified version of chrome.storage.local.set
   */
  static async setStorage(items: Record<string, any>): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, () => {
        resolve();
      });
    });
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    return (...args: Parameters<T>) => {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait) as unknown as number;
    };
  }

  /**
   * Generate unique ID (alphanumeric - for UI elements)
   */
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Generate numeric ID (for Chrome declarativeNetRequest rules)
   */
  static generateNumericId(): string {
    return (Date.now() + Math.floor(Math.random() * 1000)).toString();
  }
}

// Legacy compatibility - expose on global bgapp if it exists
if (typeof globalThis.bgapp !== 'undefined') {
  globalThis.bgapp.util = {
    logOnTab: Utils.logOnTab,
    simpleError: Utils.simpleError
  };
} 
 