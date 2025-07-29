/// <reference types="chrome"/>
import { Utils } from './utils';
import { StorageManager, Rule, Domain } from './storage';

interface RuleStats {
  dynamicRules: number;
  staticRules: number;
  tabRules: number;
}

/**
 * Rule manager for handling declarative net request rules
 */
export class RuleManager {
  private tabRules = new Map<number, { url: string; timestamp: number }>();
  private globalRules = new Map<string, any>();
  private ruleIdCounter = 1000; // Start from 1000 to avoid conflicts
  private storageManager: StorageManager;

  constructor() {
    this.storageManager = new StorageManager();
  }

  async init(): Promise<void> {
    console.log('⚙️ Initializing Rule Manager...');
    await this.storageManager.init();
    await this.loadRules();
  }

  async loadRules(): Promise<void> {
    try {
      const storage = await this.storageManager.get();
      
      // Clear existing rules
      await this.clearAllDynamicRules();
      
      // Convert storage rules to declarative net request rules
      const declarativeRules: chrome.declarativeNetRequest.Rule[] = [];
      
      storage.domains?.forEach(domain => {
        if (domain.on) {
          domain.rules?.forEach(rule => {
            if (rule.on && this.canConvertToDeclarative(rule)) {
              const declarativeRule = this.convertToDeclarativeRule(rule, domain);
              if (declarativeRule) {
                declarativeRules.push(declarativeRule);
              }
            }
          });
        }
      });
      
      // Add rules to Chrome's declarative net request
      if (declarativeRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: declarativeRules
        });
        
        console.log(`📜 Added ${declarativeRules.length} declarative rules`);
      }
      
    } catch (error) {
      Utils.simpleError(error);
    }
  }

  private canConvertToDeclarative(rule: Rule): boolean {
    // Some rule types can be converted to declarative net request rules
    const supportedTypes = ['urlRedirect', 'fileOverride', 'headerModification'];
    return supportedTypes.includes(rule.type);
  }

  private convertToDeclarativeRule(rule: Rule, domain: Domain): chrome.declarativeNetRequest.Rule | null {
    try {
      const baseRule: Partial<chrome.declarativeNetRequest.Rule> = {
        id: this.ruleIdCounter++,
        priority: 1,
        condition: {
          urlFilter: this.convertPattern(rule.from),
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.STYLESHEET,
            chrome.declarativeNetRequest.ResourceType.SCRIPT,
            chrome.declarativeNetRequest.ResourceType.IMAGE,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
          ]
        }
      };

      switch (rule.type) {
        case 'urlRedirect':
          if (rule.to) {
            return {
              ...baseRule,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                redirect: { url: rule.to }
              }
            } as chrome.declarativeNetRequest.Rule;
          }
          break;

        case 'fileOverride':
          if (rule.file) {
            // For file override, we'll use a data URL
            const mimeType = this.getMimeType(rule.fileType);
            const dataUrl = `data:${mimeType};base64,${btoa(rule.file)}`;
            
            return {
              ...baseRule,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                redirect: { url: dataUrl }
              }
            } as chrome.declarativeNetRequest.Rule;
          }
          break;

        case 'headerModification':
          if (rule.headers) {
            const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];
            const responseHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];
            
            rule.headers.forEach(header => {
              const headerRule: chrome.declarativeNetRequest.ModifyHeaderInfo = {
                header: header.name,
                operation: header.operation === 'remove' 
                  ? chrome.declarativeNetRequest.HeaderOperation.REMOVE 
                  : chrome.declarativeNetRequest.HeaderOperation.SET,
                value: header.operation !== 'remove' ? header.value : undefined
              };
              
              // Determine if it's a request or response header
              if (this.isRequestHeader(header.name)) {
                requestHeaders.push(headerRule);
              } else {
                responseHeaders.push(headerRule);
              }
            });
            
            const action: chrome.declarativeNetRequest.RuleAction = {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS
            };
            
            if (requestHeaders.length > 0) {
              action.requestHeaders = requestHeaders;
            }
            
            if (responseHeaders.length > 0) {
              action.responseHeaders = responseHeaders;
            }
            
            return {
              ...baseRule,
              action
            } as chrome.declarativeNetRequest.Rule;
          }
          break;
      }
      
      return null;
    } catch (error) {
      Utils.simpleError(error);
      return null;
    }
  }

  private convertPattern(pattern: string): string {
    // Convert our pattern format to declarative net request urlFilter
    if (pattern.includes('*')) {
      return pattern;
    } else if (pattern.startsWith('/') && pattern.endsWith('/')) {
      // Regex patterns need special handling in declarative net request
      return pattern.slice(1, -1);
    } else {
      // Exact match or contains
      return `*${pattern}*`;
    }
  }

  private getMimeType(fileType?: string): string {
    const mimeTypes: Record<string, string> = {
      'js': 'application/javascript',
      'css': 'text/css',
      'html': 'text/html',
      'json': 'application/json',
      'xml': 'application/xml'
    };
    
    return mimeTypes[fileType || ''] || 'text/plain';
  }

  private isRequestHeader(headerName: string): boolean {
    const requestHeaders = [
      'accept', 'accept-encoding', 'accept-language', 'authorization',
      'cache-control', 'content-type', 'cookie', 'origin', 'referer',
      'user-agent', 'x-requested-with'
    ];
    
    return requestHeaders.includes(headerName.toLowerCase());
  }

  private async clearAllDynamicRules(): Promise<void> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
        
        console.log(`🗑️ Cleared ${ruleIds.length} existing rules`);
      }
    } catch (error) {
      Utils.simpleError(error);
    }
  }

  async updateRules(): Promise<void> {
    console.log('🔄 Updating rules...');
    await this.loadRules();
  }

  async updateTabRules(tabId: number, url: string): Promise<void> {
    // Handle tab-specific rule updates
    console.log(`🏷️ Updating rules for tab ${tabId}: ${url}`);
    
    // Store tab URL for rule matching
    this.tabRules.set(tabId, { url, timestamp: Date.now() });
  }

  async cleanupTabRules(tabId: number): Promise<void> {
    // Clean up rules for closed tabs
    this.tabRules.delete(tabId);
    console.log(`🧹 Cleaned up rules for tab ${tabId}`);
  }

  /**
   * Get current rule statistics
   */
  async getRuleStats(): Promise<RuleStats> {
    try {
      const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
      const staticRules = await chrome.declarativeNetRequest.getEnabledRulesets();
      
      return {
        dynamicRules: dynamicRules.length,
        staticRules: staticRules.length,
        tabRules: this.tabRules.size
      };
    } catch (error) {
      Utils.simpleError(error);
      return { dynamicRules: 0, staticRules: 0, tabRules: 0 };
    }
  }
} 
