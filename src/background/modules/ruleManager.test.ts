import test from 'node:test';
import assert from 'node:assert/strict';

import { RuleManager } from './ruleManager.ts';
import type { Domain, Rule } from './storage.ts';

(globalThis as any).chrome = {
  declarativeNetRequest: {
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
