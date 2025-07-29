/// <reference types="chrome"/>
import { Utils } from './utils';
import { StorageManager, Rule, Domain } from './storage';

interface ActiveRule {
  domainPattern: string;
  rule: Rule;
}

interface MatchingRule extends ActiveRule {
  ruleId: string;
}

/**
 * Request handler for intercepting and modifying web requests
 */
export class RequestHandler {
  private activeRules = new Map<string, ActiveRule>();
  private requestCache = new Map<string, any>();
  private storageManager: StorageManager;

  constructor() {
    this.storageManager = new StorageManager();
  }

  async init(): Promise<void> {
    console.log('🔗 Initializing Request Handler...');
    await this.storageManager.init();
    await this.loadActiveRules();
  }

  async loadActiveRules(): Promise<void> {
    try {
      const storage = await this.storageManager.get();
      this.activeRules.clear();
      
      storage.domains?.forEach(domain => {
        if (domain.on) {
          domain.rules?.forEach(rule => {
            if (rule.on) {
              this.activeRules.set(rule.id || Utils.generateId(), {
                domainPattern: domain.url,
                rule: rule
              });
            }
          });
        }
      });
      
      console.log(`📋 Loaded ${this.activeRules.size} active rules`);
    } catch (error) {
      Utils.simpleError(error);
    }
  }

  async handleBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): Promise<chrome.webRequest.BlockingResponse> {
    try {
      const { url, tabId } = details;
      
      // Check if this request matches any active rules
      const matchingRule = this.findMatchingRule(url, tabId || -1);
      
      if (matchingRule) {
        return await this.processRule(details, matchingRule);
      }
      
    } catch (error) {
      Utils.simpleError(error);
    }
    
    return {}; // No modification
  }

  private findMatchingRule(url: string, tabId: number): MatchingRule | null {
    for (const [ruleId, ruleData] of this.activeRules) {
      const { domainPattern, rule } = ruleData;
      
      // Check if URL matches the domain pattern
      if (this.urlMatches(url, domainPattern)) {
        // Check if the rule pattern matches
        if (this.urlMatches(url, rule.from)) {
          return { ruleId, ...ruleData };
        }
      }
    }
    return null;
  }

  private urlMatches(url: string, pattern: string): boolean {
    try {
      // Handle different pattern types
      if (pattern.includes('*')) {
        // Wildcard pattern
        const regexPattern = pattern
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
          .replace(/\\\*/g, '.*'); // Convert * to .*
        
        return new RegExp(`^${regexPattern}$`).test(url);
      } else if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(url);
      } else {
        // Exact match or contains
        return url.includes(pattern);
      }
    } catch (error) {
      Utils.simpleError(error);
      return false;
    }
  }

  private async processRule(
    details: chrome.webRequest.WebRequestBodyDetails, 
    matchingRule: MatchingRule
  ): Promise<chrome.webRequest.BlockingResponse> {
    const { rule } = matchingRule;
    
    console.log(`🎯 Processing rule: ${rule.type} for ${details.url}`);
    
    switch (rule.type) {
      case 'urlRedirect':
        return this.handleUrlRedirect(details, rule);
      
      case 'fileOverride':
        return this.handleFileOverride(details, rule);
      
      case 'contentModification':
        return this.handleContentModification(details, rule);
      
      default:
        console.log(`⚠️ Unknown rule type: ${rule.type}`);
        return {};
    }
  }

  private handleUrlRedirect(
    details: chrome.webRequest.WebRequestBodyDetails, 
    rule: Rule
  ): chrome.webRequest.BlockingResponse {
    if (rule.to) {
      console.log(`🔀 Redirecting ${details.url} to ${rule.to}`);
      return { redirectUrl: rule.to };
    }
    return {};
  }

  private handleFileOverride(
    details: chrome.webRequest.WebRequestBodyDetails, 
    rule: Rule
  ): chrome.webRequest.BlockingResponse {
    if (rule.file) {
      // Create data URL from file content
      const dataUrl = `data:${this.getMimeType(rule.fileType)};base64,${btoa(rule.file)}`;
      console.log(`📁 Overriding file: ${details.url}`);
      return { redirectUrl: dataUrl };
    }
    return {};
  }

  private handleContentModification(
    details: chrome.webRequest.WebRequestBodyDetails, 
    rule: Rule
  ): chrome.webRequest.BlockingResponse {
    // Content modification will be handled by content scripts
    // Just log for now
    console.log(`📝 Content modification rule matched: ${details.url}`);
    return {};
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

  /**
   * Update rules when storage changes
   */
  async updateRules(): Promise<void> {
    await this.loadActiveRules();
  }

  /**
   * Clear request cache for a specific tab
   */
  clearTabCache(tabId: number): void {
    for (const [key, value] of this.requestCache) {
      if (value.tabId === tabId) {
        this.requestCache.delete(key);
      }
    }
  }
} 
