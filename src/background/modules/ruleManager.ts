/// <reference types="chrome"/>
import { Utils } from './utils';
import {
  StorageManager,
  Rule,
  Domain,
  RuleContext,
  RuleSource,
  RuleStats,
  TabRuleSession,
  TabRuleSessionMap
} from './storage';

const TAB_RULE_SESSIONS_KEY = 'tabRuleSessions';
const FIRST_RULE_ID = 1000;

interface RuleScopeCondition {
  tabIds?: number[];
  excludedTabIds?: number[];
}

/**
 * Owns all editable DNR rules and the per-tab rule-session lifecycle.
 */
export class RuleManager {
  private storageManager: StorageManager;
  private ruleIdCounter = FIRST_RULE_ID;
  private updateQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.storageManager = new StorageManager();
  }

  async init(): Promise<void> {
    console.log('⚙️ Initializing Rule Manager...');
    await this.storageManager.init();
    await this.enqueueUpdate(async () => {
      await this.pruneClosedTabSessions();
      await this.rebuildRulesNow();
    });
  }

  async getRuleContext(tabId?: number): Promise<RuleContext> {
    const globalDomains = await this.getGlobalDomains();
    if (tabId === undefined) {
      return {
        source: 'global',
        privateRulesEnabled: false,
        hasPrivateDraft: false,
        domains: this.cloneDomains(globalDomains)
      };
    }

    await this.assertValidTab(tabId);
    const sessions = await this.getTabRuleSessions();
    const session = sessions[String(tabId)];

    return {
      tabId,
      source: session?.enabled ? 'tab' : 'global',
      privateRulesEnabled: Boolean(session?.enabled),
      hasPrivateDraft: Boolean(session),
      domains: this.cloneDomains(session?.enabled ? session.domains : globalDomains)
    };
  }

  async setTabRulesEnabled(tabId: number, enabled: boolean): Promise<RuleContext> {
    return this.enqueueUpdate(async () => {
      await this.assertValidTab(tabId);
      const previousSessions = await this.getTabRuleSessions();
      const nextSessions = this.cloneSessions(previousSessions);
      const key = String(tabId);
      const now = Date.now();

      if (enabled) {
        const existing = nextSessions[key];
        if (existing) {
          existing.enabled = true;
          existing.updatedAt = now;
        } else {
          nextSessions[key] = {
            enabled: true,
            domains: this.cloneDomains(await this.getGlobalDomains()),
            createdAt: now,
            updatedAt: now
          };
        }
      } else if (nextSessions[key]) {
        nextSessions[key].enabled = false;
        nextSessions[key].updatedAt = now;
      }

      await this.commitSessionMutation(previousSessions, nextSessions);
      return this.getRuleContext(tabId);
    });
  }

  async saveRuleContext(
    source: RuleSource,
    domains: Domain[],
    tabId?: number
  ): Promise<RuleContext> {
    return this.enqueueUpdate(async () => {
      if (source === 'global') {
        const previousDomains = await this.getGlobalDomains();
        const nextDomains = this.cloneDomains(domains);
        try {
          await this.storageManager.set({ domains: nextDomains });
          this.storageManager.clearCache();
          await this.rebuildRulesNow();
        } catch (error) {
          await this.storageManager.set({ domains: previousDomains });
          this.storageManager.clearCache();
          await this.rebuildRulesNow();
          throw error;
        }
        return this.getRuleContext(tabId);
      }

      if (tabId === undefined) {
        throw new Error('Private rule context requires a tabId');
      }

      await this.assertValidTab(tabId);
      const previousSessions = await this.getTabRuleSessions();
      const nextSessions = this.cloneSessions(previousSessions);
      const session = nextSessions[String(tabId)];
      if (!session?.enabled) {
        throw new Error('The current tab is not using private rules');
      }

      session.domains = this.cloneDomains(domains);
      session.updatedAt = Date.now();
      await this.commitSessionMutation(previousSessions, nextSessions);
      return this.getRuleContext(tabId);
    });
  }

  async resetTabRulesFromGlobal(tabId: number): Promise<RuleContext> {
    return this.enqueueUpdate(async () => {
      await this.assertValidTab(tabId);
      const previousSessions = await this.getTabRuleSessions();
      const nextSessions = this.cloneSessions(previousSessions);
      const session = nextSessions[String(tabId)];
      if (!session) {
        throw new Error('No private rule draft exists for this tab');
      }

      session.domains = this.cloneDomains(await this.getGlobalDomains());
      session.updatedAt = Date.now();
      await this.commitSessionMutation(previousSessions, nextSessions);
      return this.getRuleContext(tabId);
    });
  }

  async discardTabRuleDraft(tabId: number): Promise<RuleContext> {
    return this.enqueueUpdate(async () => {
      await this.assertValidTab(tabId);
      const previousSessions = await this.getTabRuleSessions();
      const nextSessions = this.cloneSessions(previousSessions);
      delete nextSessions[String(tabId)];
      await this.commitSessionMutation(previousSessions, nextSessions);
      return this.getRuleContext(tabId);
    });
  }

  async getEffectiveRulesForTab(tabId: number): Promise<Domain[]> {
    const sessions = await this.getTabRuleSessions();
    const session = sessions[String(tabId)];
    if (session?.enabled) {
      return this.cloneDomains(session.domains);
    }
    return this.cloneDomains(await this.getGlobalDomains());
  }

  async updateRules(): Promise<void> {
    await this.enqueueUpdate(() => this.rebuildRulesNow());
  }

  async updateTabRules(_tabId: number, _url: string): Promise<void> {
    // Rules are scoped by stable tabId. Navigation does not require rebuilding.
  }

  async cleanupTabRules(tabId: number): Promise<void> {
    await this.enqueueUpdate(async () => {
      const sessions = await this.getTabRuleSessions();
      const session = sessions[String(tabId)];
      if (!session) return;

      delete sessions[String(tabId)];
      await this.setTabRuleSessions(sessions);
      if (session.enabled) {
        await this.rebuildRulesNow();
      }
      console.log(`🧹 Removed private rule session for tab ${tabId}`);
    });
  }

  async getRuleStats(): Promise<RuleStats> {
    try {
      const [dynamicRules, sessionRules, sessions] = await Promise.all([
        chrome.declarativeNetRequest.getDynamicRules(),
        chrome.declarativeNetRequest.getSessionRules(),
        this.getTabRuleSessions()
      ]);
      const values = Object.values(sessions);
      return {
        dynamicRules: dynamicRules.length,
        sessionRules: sessionRules.length,
        activePrivateTabs: values.filter(session => session.enabled).length,
        privateDraftTabs: values.length
      };
    } catch (error) {
      Utils.simpleError(error);
      return {
        dynamicRules: 0,
        sessionRules: 0,
        activePrivateTabs: 0,
        privateDraftTabs: 0
      };
    }
  }

  private async commitSessionMutation(
    previousSessions: TabRuleSessionMap,
    nextSessions: TabRuleSessionMap
  ): Promise<void> {
    try {
      await this.setTabRuleSessions(nextSessions);
      await this.rebuildRulesNow();
    } catch (error) {
      await this.setTabRuleSessions(previousSessions);
      await this.rebuildRulesNow();
      throw error;
    }
  }

  private async rebuildRulesNow(): Promise<void> {
    const globalDomains = await this.getGlobalDomains();
    const sessions = await this.getTabRuleSessions();
    const activeEntries = Object.entries(sessions)
      .filter(([, session]) => session.enabled)
      .map(([tabId, session]) => [Number(tabId), session] as const);
    const activeTabIds = activeEntries.map(([tabId]) => tabId);

    this.ruleIdCounter = FIRST_RULE_ID;
    const dynamicRules: chrome.declarativeNetRequest.Rule[] = [];
    const sessionRules: chrome.declarativeNetRequest.Rule[] = [];

    if (activeTabIds.length === 0) {
      dynamicRules.push(...this.convertDomains(globalDomains));
    } else {
      sessionRules.push(...this.convertDomains(globalDomains, {
        excludedTabIds: activeTabIds
      }));
      activeEntries.forEach(([tabId, session]) => {
        sessionRules.push(...this.convertDomains(session.domains, {
          tabIds: [tabId]
        }));
      });
    }

    this.validateRuleLimits(dynamicRules, sessionRules);
    await this.replaceBrowserRules(dynamicRules, sessionRules);
    console.log(
      `✅ Rules rebuilt: ${dynamicRules.length} dynamic, ${sessionRules.length} session, ${activeTabIds.length} private tabs`
    );
  }

  private convertDomains(
    domains: Domain[],
    scope: RuleScopeCondition = {}
  ): chrome.declarativeNetRequest.Rule[] {
    const result: chrome.declarativeNetRequest.Rule[] = [];
    domains.forEach(domain => {
      if (!domain.on) return;
      domain.rules?.forEach(rule => {
        if (!rule.on || !this.canConvertToDeclarative(rule)) return;
        const declarativeRule = this.convertToDeclarativeRule(rule, domain, scope);
        if (declarativeRule) result.push(declarativeRule);
      });
    });
    return result;
  }

  private canConvertToDeclarative(rule: Rule): boolean {
    return ['urlRedirect', 'fileOverride', 'headerModification'].includes(rule.type);
  }

  private convertToDeclarativeRule(
    rule: Rule,
    _domain: Domain,
    scope: RuleScopeCondition = {}
  ): chrome.declarativeNetRequest.Rule | null {
    try {
      const condition = this.buildCondition(rule.from);
      const baseRule: Partial<chrome.declarativeNetRequest.Rule> = {
        id: this.ruleIdCounter++,
        priority: 1,
        condition: {
          ...condition,
          ...scope,
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

      if (rule.type === 'urlRedirect' && rule.to) {
        const redirect = this.isRegexPattern(rule.from)
          ? { regexSubstitution: this.convertRegexSubstitution(rule.to) }
          : { url: rule.to };
        return {
          ...baseRule,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect
          }
        } as chrome.declarativeNetRequest.Rule;
      }

      if (rule.type === 'fileOverride' && rule.file) {
        const dataUrl = `data:${this.getMimeType(rule.fileType)};base64,${btoa(rule.file)}`;
        return {
          ...baseRule,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: { url: dataUrl }
          }
        } as chrome.declarativeNetRequest.Rule;
      }

      if (rule.type === 'headerModification' && rule.headers) {
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
          if (this.isRequestHeader(header.name)) requestHeaders.push(headerRule);
          else responseHeaders.push(headerRule);
        });
        const action: chrome.declarativeNetRequest.RuleAction = {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS
        };
        if (requestHeaders.length) action.requestHeaders = requestHeaders;
        if (responseHeaders.length) action.responseHeaders = responseHeaders;
        return { ...baseRule, action } as chrome.declarativeNetRequest.Rule;
      }

      return null;
    } catch (error) {
      Utils.simpleError(error);
      return null;
    }
  }

  private validateRuleLimits(
    dynamicRules: chrome.declarativeNetRequest.Rule[],
    sessionRules: chrome.declarativeNetRequest.Rule[]
  ): void {
    const allRules = [...dynamicRules, ...sessionRules];
    if (allRules.length > chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES) {
      throw new Error('规则数量超过 Chrome dynamic/session rules 上限');
    }
    const regexRuleCount = allRules.filter(rule => Boolean(rule.condition.regexFilter)).length;
    if (regexRuleCount > chrome.declarativeNetRequest.MAX_NUMBER_OF_REGEX_RULES) {
      throw new Error('正则规则数量超过 Chrome 上限');
    }
  }

  private async replaceBrowserRules(
    dynamicRules: chrome.declarativeNetRequest.Rule[],
    sessionRules: chrome.declarativeNetRequest.Rule[]
  ): Promise<void> {
    const [oldDynamicRules, oldSessionRules] = await Promise.all([
      chrome.declarativeNetRequest.getDynamicRules(),
      chrome.declarativeNetRequest.getSessionRules()
    ]);

    try {
      await this.clearBrowserRules(oldDynamicRules, oldSessionRules);
      if (dynamicRules.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dynamicRules });
      }
      if (sessionRules.length) {
        await chrome.declarativeNetRequest.updateSessionRules({ addRules: sessionRules });
      }
    } catch (error) {
      console.error('❌ Failed to replace DNR rules, restoring previous rules:', error);
      await this.restoreBrowserRules(oldDynamicRules, oldSessionRules);
      throw error;
    }
  }

  private async clearBrowserRules(
    dynamicRules: chrome.declarativeNetRequest.Rule[],
    sessionRules: chrome.declarativeNetRequest.Rule[]
  ): Promise<void> {
    if (dynamicRules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: dynamicRules.map(rule => rule.id)
      });
    }
    if (sessionRules.length) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: sessionRules.map(rule => rule.id)
      });
    }
  }

  private async restoreBrowserRules(
    dynamicRules: chrome.declarativeNetRequest.Rule[],
    sessionRules: chrome.declarativeNetRequest.Rule[]
  ): Promise<void> {
    const [currentDynamicRules, currentSessionRules] = await Promise.all([
      chrome.declarativeNetRequest.getDynamicRules(),
      chrome.declarativeNetRequest.getSessionRules()
    ]);
    await this.clearBrowserRules(currentDynamicRules, currentSessionRules);
    if (dynamicRules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dynamicRules });
    }
    if (sessionRules.length) {
      await chrome.declarativeNetRequest.updateSessionRules({ addRules: sessionRules });
    }
  }

  private buildCondition(pattern: string): chrome.declarativeNetRequest.RuleCondition {
    if (this.isRegexPattern(pattern)) {
      return { regexFilter: this.stripRegexDelimiters(pattern) };
    }
    return { urlFilter: pattern.includes('*') ? pattern : `*${pattern}*` };
  }

  private isRegexPattern(pattern: string): boolean {
    return pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 1;
  }

  private stripRegexDelimiters(pattern: string): string {
    return pattern.slice(1, -1);
  }

  private convertRegexSubstitution(targetUrl: string): string {
    return targetUrl.replace(/\$(\d+)/g, (_match, group) => `\\${group}`);
  }

  private getMimeType(fileType?: string): string {
    return {
      js: 'application/javascript',
      css: 'text/css',
      html: 'text/html',
      json: 'application/json',
      xml: 'application/xml'
    }[fileType || ''] || 'text/plain';
  }

  private isRequestHeader(headerName: string): boolean {
    return [
      'accept', 'accept-encoding', 'accept-language', 'authorization',
      'cache-control', 'content-type', 'cookie', 'origin', 'referer',
      'user-agent', 'x-requested-with'
    ].includes(headerName.toLowerCase());
  }

  private async getGlobalDomains(): Promise<Domain[]> {
    const storage = await this.storageManager.forceRefresh();
    return storage.domains || [];
  }

  private async getTabRuleSessions(): Promise<TabRuleSessionMap> {
    const result = await chrome.storage.session.get(TAB_RULE_SESSIONS_KEY);
    return (result[TAB_RULE_SESSIONS_KEY] || {}) as TabRuleSessionMap;
  }

  private async setTabRuleSessions(sessions: TabRuleSessionMap): Promise<void> {
    await chrome.storage.session.set({ [TAB_RULE_SESSIONS_KEY]: sessions });
  }

  private async pruneClosedTabSessions(): Promise<void> {
    const sessions = await this.getTabRuleSessions();
    const tabs = await chrome.tabs.query({});
    const openTabIds = new Set(
      tabs.map(tab => tab.id).filter((tabId): tabId is number => tabId !== undefined)
    );
    let changed = false;
    Object.keys(sessions).forEach(key => {
      if (!openTabIds.has(Number(key))) {
        delete sessions[key];
        changed = true;
      }
    });
    if (changed) await this.setTabRuleSessions(sessions);
  }

  private async assertValidTab(tabId: number): Promise<void> {
    if (!Number.isInteger(tabId) || tabId < 0) {
      throw new Error('Invalid tabId');
    }
    await chrome.tabs.get(tabId);
  }

  private cloneDomains(domains: Domain[]): Domain[] {
    return structuredClone(domains);
  }

  private cloneSessions(sessions: TabRuleSessionMap): TabRuleSessionMap {
    return structuredClone(sessions);
  }

  private enqueueUpdate<T>(task: () => Promise<T>): Promise<T> {
    const result = this.updateQueue.then(task, task);
    this.updateQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
