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
  private usedRuleIds = new Set<number>(); // 跟踪已使用的ID
  private storageManager: StorageManager;

  constructor() {
    this.storageManager = new StorageManager();
  }

  async init(): Promise<void> {
    console.log('⚙️ Initializing Rule Manager...');
    await this.storageManager.init();
    
    // 初始化时获取现有规则的ID，避免冲突
    await this.initializeExistingRuleIds();
    
    await this.loadRules();
  }

  /**
   * 初始化现有规则ID，避免冲突
   */
  private async initializeExistingRuleIds(): Promise<void> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      this.usedRuleIds.clear();
      
      existingRules.forEach(rule => {
        this.usedRuleIds.add(rule.id);
      });
      
      // 确保计数器从未使用的ID开始
      while (this.usedRuleIds.has(this.ruleIdCounter)) {
        this.ruleIdCounter++;
      }
      
      console.log(`📋 Initialized with ${existingRules.length} existing rule IDs: [${Array.from(this.usedRuleIds).join(', ')}]`);
      console.log(`🔢 Starting rule ID counter from: ${this.ruleIdCounter}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize existing rule IDs:', error);
    }
  }

  /**
   * 生成唯一的规则ID
   */
  private generateUniqueRuleId(): number {
    // 找到下一个未使用的ID
    while (this.usedRuleIds.has(this.ruleIdCounter)) {
      this.ruleIdCounter++;
    }
    
    const newId = this.ruleIdCounter++;
    this.usedRuleIds.add(newId);
    
    console.log(`🆔 Generated unique rule ID: ${newId}`);
    return newId;
  }

  async loadRules(): Promise<void> {
    try {
      // Force refresh to ensure we get the latest data
      const storage = await this.storageManager.forceRefresh();
      
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
      const ruleId = this.generateUniqueRuleId();
      const baseRule: Partial<chrome.declarativeNetRequest.Rule> = {
        id: ruleId,
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
        console.log(`🗑️ About to clear ${ruleIds.length} existing rules: [${ruleIds.join(', ')}]`);
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
        
        // 清除已使用ID跟踪
        ruleIds.forEach(id => {
          this.usedRuleIds.delete(id);
        });
        
        console.log(`✅ Successfully cleared ${ruleIds.length} existing rules and updated ID tracking`);
        
        // 验证清除是否成功
        const verifyRules = await chrome.declarativeNetRequest.getDynamicRules();
        if (verifyRules.length > 0) {
          console.warn(`⚠️ Warning: ${verifyRules.length} rules still remain after clear!`);
          verifyRules.forEach(rule => {
            console.warn(`  🔍 Remaining rule ID: ${rule.id}, type: ${rule.action.type}`);
          });
        }
      } else {
        console.log(`🗑️ No existing rules to clear`);
      }
      
      // 重置ID计数器但保持高于任何现有ID
      this.ruleIdCounter = Math.max(1000, ...Array.from(this.usedRuleIds), 0) + 1;
      console.log(`🔢 Reset rule ID counter to: ${this.ruleIdCounter}`);
      
    } catch (error) {
      console.error('❌ Failed to clear dynamic rules:', error);
      Utils.simpleError(error);
    }
  }

  async updateRules(): Promise<void> {
    console.log('🔄 Updating rules...');
    
    try {
      // 重新加载规则
      await this.loadRules();
      
      // 验证规则确实被更新了
      const finalRules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log(`✅ Rules updated successfully: ${finalRules.length} rules now active`);
      
    } catch (error) {
      console.error('❌ Failed to update rules:', error);
      throw error;
    }
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
 