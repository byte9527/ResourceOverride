import test from 'node:test';
import assert from 'node:assert/strict';

import { RuleManager } from './ruleManager.ts';
import type { Domain, Rule } from './storage.ts';

(globalThis as any).chrome = {
  storage: {
    session: {
      get: async () => ({}),
      set: async () => undefined
    }
  },
  tabs: {
    get: async (tabId: number) => ({ id: tabId })
  },
  declarativeNetRequest: {
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5000,
    MAX_NUMBER_OF_REGEX_RULES: 1000,
    ResourceType: {
      MAIN_FRAME: 'main_frame',
      SUB_FRAME: 'sub_frame',
      STYLESHEET: 'stylesheet',
      SCRIPT: 'script',
      IMAGE: 'image',
      XMLHTTPREQUEST: 'xmlhttprequest'
    },
    RuleActionType: {
      REDIRECT: 'redirect',
      MODIFY_HEADERS: 'modifyHeaders'
    },
    HeaderOperation: {
      REMOVE: 'remove',
      SET: 'set'
    }
  }
};

const domain: Domain = {
  id: 'd1',
  url: '*',
  on: true,
  rules: []
};

test('regex urlRedirect rules use regexFilter and regexSubstitution', () => {
  const manager = new RuleManager() as any;
  const rule: Rule = {
    on: true,
    type: 'urlRedirect',
    from: '/dist/(.*)/',
    to: 'http://localhost:8090/dist/$1'
  };

  const declarativeRule = manager.convertToDeclarativeRule(rule, domain);

  assert.ok(declarativeRule);
  assert.equal(declarativeRule.condition.regexFilter, 'dist/(.*)');
  assert.equal(declarativeRule.condition.urlFilter, undefined);
  assert.equal(declarativeRule.action.type, 'redirect');
  assert.equal(declarativeRule.action.redirect.regexSubstitution, 'http://localhost:8090/dist/\\1');
  assert.equal(declarativeRule.action.redirect.url, undefined);
});

test('plain urlRedirect rules keep fixed redirect urls', () => {
  const manager = new RuleManager() as any;
  const rule: Rule = {
    on: true,
    type: 'urlRedirect',
    from: 'example.com/app.js',
    to: 'http://localhost:8090/app.js'
  };

  const declarativeRule = manager.convertToDeclarativeRule(rule, domain);

  assert.ok(declarativeRule);
  assert.equal(declarativeRule.condition.urlFilter, '*example.com/app.js*');
  assert.equal(declarativeRule.condition.regexFilter, undefined);
  assert.equal(declarativeRule.action.redirect.url, 'http://localhost:8090/app.js');
  assert.equal(declarativeRule.action.redirect.regexSubstitution, undefined);
});

test('tab-scoped rules include tabIds', () => {
  const manager = new RuleManager() as any;
  const rule: Rule = {
    on: true,
    type: 'urlRedirect',
    from: 'example.com/app.js',
    to: 'http://localhost:8090/app.js'
  };

  const declarativeRule = manager.convertToDeclarativeRule(rule, domain, { tabIds: [12] });

  assert.deepEqual(declarativeRule.condition.tabIds, [12]);
  assert.equal(declarativeRule.condition.excludedTabIds, undefined);
});

test('global session rules exclude private tabs', () => {
  const manager = new RuleManager() as any;
  const rule: Rule = {
    on: true,
    type: 'urlRedirect',
    from: 'example.com/app.js',
    to: 'http://localhost:8090/app.js'
  };

  const declarativeRule = manager.convertToDeclarativeRule(rule, domain, {
    excludedTabIds: [12, 34]
  });

  assert.deepEqual(declarativeRule.condition.excludedTabIds, [12, 34]);
  assert.equal(declarativeRule.condition.tabIds, undefined);
});

test('disabling private rules keeps the tab draft and restores it on enable', async () => {
  let sessionData: Record<string, any> = {};
  (globalThis as any).chrome.storage.session.get = async () => ({
    tabRuleSessions: sessionData
  });
  (globalThis as any).chrome.storage.session.set = async (items: Record<string, any>) => {
    sessionData = structuredClone(items.tabRuleSessions);
  };

  const manager = new RuleManager() as any;
  manager.storageManager = {
    forceRefresh: async () => ({ domains: [domain] }),
    clearCache: () => undefined
  };
  manager.rebuildRulesNow = async () => undefined;

  await manager.setTabRulesEnabled(12, true);
  sessionData['12'].domains[0].description = 'private edit';
  await manager.setTabRulesEnabled(12, false);

  assert.equal(sessionData['12'].enabled, false);
  assert.equal(sessionData['12'].domains[0].description, 'private edit');

  await manager.setTabRulesEnabled(12, true);
  assert.equal(sessionData['12'].enabled, true);
  assert.equal(sessionData['12'].domains[0].description, 'private edit');
});

test('overwriting global rules copies the active tab rules and keeps the tab private', async () => {
  const globalDomain: Domain = {
    ...domain,
    description: 'global rules'
  };
  const privateDomain: Domain = {
    ...domain,
    description: 'private rules'
  };
  let storedDomains = [structuredClone(globalDomain)];
  let sessionData: Record<string, any> = {
    '12': {
      enabled: true,
      domains: [structuredClone(privateDomain)],
      createdAt: 1,
      updatedAt: 1
    }
  };
  (globalThis as any).chrome.storage.session.get = async () => ({
    tabRuleSessions: sessionData
  });
  (globalThis as any).chrome.storage.session.set = async (items: Record<string, any>) => {
    sessionData = structuredClone(items.tabRuleSessions);
  };

  const manager = new RuleManager() as any;
  manager.storageManager = {
    forceRefresh: async () => ({ domains: structuredClone(storedDomains) }),
    set: async (items: Record<string, any>) => {
      storedDomains = structuredClone(items.domains);
    },
    clearCache: () => undefined
  };
  manager.rebuildRulesNow = async () => undefined;

  const context = await manager.overwriteGlobalRulesFromTab(12);

  assert.deepEqual(storedDomains, [privateDomain]);
  assert.equal(sessionData['12'].enabled, true);
  assert.deepEqual(sessionData['12'].domains, [privateDomain]);
  assert.equal(context.source, 'tab');
  assert.equal(context.privateRulesEnabled, true);
});

test('rebuild combines excluded global rules with independent per-tab rules', async () => {
  const globalDomain: Domain = {
    ...domain,
    rules: [{
      on: true,
      type: 'urlRedirect',
      from: 'global.example/app.js',
      to: 'http://localhost:8090/global.js'
    }]
  };
  const privateDomain: Domain = {
    ...domain,
    rules: [{
      on: true,
      type: 'urlRedirect',
      from: 'private.example/app.js',
      to: 'http://localhost:8090/private.js'
    }]
  };
  const manager = new RuleManager() as any;
  let capturedDynamic: any[] = [];
  let capturedSession: any[] = [];
  manager.getGlobalDomains = async () => [globalDomain];
  manager.getTabRuleSessions = async () => ({
    '12': {
      enabled: true,
      domains: [privateDomain],
      createdAt: 1,
      updatedAt: 1
    },
    '34': {
      enabled: false,
      domains: [privateDomain],
      createdAt: 1,
      updatedAt: 1
    }
  });
  manager.replaceBrowserRules = async (dynamicRules: any[], sessionRules: any[]) => {
    capturedDynamic = dynamicRules;
    capturedSession = sessionRules;
  };

  await manager.rebuildRulesNow();

  assert.equal(capturedDynamic.length, 0);
  assert.equal(capturedSession.length, 2);
  assert.deepEqual(capturedSession[0].condition.excludedTabIds, [12]);
  assert.deepEqual(capturedSession[1].condition.tabIds, [12]);
});
