// Resource Override Service Worker for Manifest V3

console.log('Service worker starting...');

// 初始化bgapp对象 - 这是其他模块依赖的全局对象
self.bgapp = {};
// 在service worker环境中，使用self代替window
self.browser = self.chrome;

// 导入所需的背景脚本模块
try {
  importScripts(
    'util.js',
    'requestHandling.js',
    'keyvalDB.js',
    'mainStorage.js',
    'requestIdTracker.js',
    'tabUrlTracker.js',
    'headerHandling.js',
    'init.js',
    'match.js',
    'extractMime.js'
  );
  console.log('Successfully imported background modules');
} catch (error) {
  console.error('Error importing background modules:', error.message);
}

// Track rule IDs for proper cleanup
let currentRuleIds = [];
let nextRuleId = 1000; // Start with a high ID to avoid conflicts

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle extension action click
chrome.action.onClicked.addListener(function() {
  console.log('Extension action clicked');
  const optionsUrl = chrome.runtime.getURL("src/ui/devtoolstab.html");
  chrome.tabs.create({url: optionsUrl});
});

// Handle runtime messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request.action);
  
  try {
    if (request.action === "setSetting") {
      chrome.storage.local.set({[request.setting]: request.value}, () => {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
        } else {
          sendResponse({success: true});
        }
      });
      return true;
    } else if (request.action === "getSetting") {
      chrome.storage.local.get([request.setting], (result) => {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
        } else {
          sendResponse(result[request.setting]);
        }
      });
      return true;
    } else if (request.action === "syncMe") {
      sendResponse({synced: true});
      return true;
    } else if (request.action === "getDomains") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
        } else {
          const domains = result.storedDomains || [];
          console.log('Returning domains from storage:', domains.length);
          sendResponse(domains);
        }
      });
      return true;
    } else if (request.action === "match") {
      // Handle URL matching for content scripts
      const isMatch = isUrlMatch(request.domainUrl, request.windowUrl);
      sendResponse(isMatch);
      return true; // 添加缺失的return语句
    } else if (request.action === "saveDomain") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
          return;
        }
        
        let domains = result.storedDomains || [];
        const existingIndex = domains.findIndex(d => d.id === request.data.id);
        if (existingIndex >= 0) {
          domains[existingIndex] = request.data;
        } else {
          domains.push(request.data);
        }
        
        chrome.storage.local.set({storedDomains: domains}, function() {
          if (chrome.runtime.lastError) {
            sendResponse({error: chrome.runtime.lastError.message});
            return;
          }
          
          console.log('Domain saved to storage');
          updateDeclarativeRules(domains, function(success, error) {
            if (error) {
              sendResponse({error: error});
            } else {
              sendResponse({saved: true});
            }
          });
        });
      });
      return true;
    } else if (request.action === "import") {
      chrome.storage.local.set({storedDomains: request.data}, function() {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
          return;
        }
        
        console.log('Imported domains saved to storage');
        updateDeclarativeRules(request.data, function(success, error) {
          if (error) {
            sendResponse({error: error});
          } else {
            sendResponse({imported: true});
          }
        });
      });
      return true;
    } else if (request.action === "deleteDomain") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        if (chrome.runtime.lastError) {
          sendResponse({error: chrome.runtime.lastError.message});
          return;
        }
        
        let domains = result.storedDomains || [];
        const index = domains.findIndex(d => d.id === request.id);
        if (index >= 0) {
          domains.splice(index, 1);
          chrome.storage.local.set({storedDomains: domains}, function() {
            if (chrome.runtime.lastError) {
              sendResponse({error: chrome.runtime.lastError.message});
              return;
            }
            
            console.log('Updated domains saved to storage after deletion');
            updateDeclarativeRules(domains, function(success, error) {
              if (error) {
                sendResponse({error: error});
              } else {
                sendResponse({deleted: true});
              }
            });
          });
        } else {
          sendResponse({deleted: false});
        }
      });
      return true;
    } else {
      sendResponse({error: 'Action not implemented yet'});
      return true;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({error: error.message || 'Unknown error occurred'});
    return true;
  }
});

// Helper function to check if URL matches pattern
function isUrlMatch(pattern, url) {
  if (!pattern || !url) return false;
  
  try {
    let regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '\\?');
    
    const regex = new RegExp(regexPattern);
    return regex.test(url);
  } catch (error) {
    console.error('Error in isUrlMatch:', error);
    return false;
  }
}

// Helper function to replace URL
function replaceUrl(matchPattern, replacePattern, originalUrl) {
  if (!matchPattern || !replacePattern) return originalUrl;
  
  try {
    let regexPattern = matchPattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '\\?');
    
    const regex = new RegExp(regexPattern);
    return originalUrl.replace(regex, replacePattern);
  } catch (error) {
    console.error('Error in replaceUrl:', error);
    return originalUrl;
  }
}

// Function to get existing rule IDs
function getExistingRuleIds(callback) {
  chrome.declarativeNetRequest.getDynamicRules(function(rules) {
    if (chrome.runtime.lastError) {
      console.error('Error getting existing rules:', chrome.runtime.lastError);
      callback([], chrome.runtime.lastError.message);
    } else {
      const ruleIds = rules.map(rule => rule.id);
      console.log('Existing rule IDs:', ruleIds);
      callback(ruleIds);
    }
  });
}

// Function to update declarativeNetRequest rules
function updateDeclarativeRules(domains, callback) {
  try {
    callback = callback || function() {};
    
    // First get existing rule IDs
    getExistingRuleIds(function(existingRuleIds, error) {
      if (error) {
        console.error('Error getting existing rule IDs:', error);
        callback(false, 'Error getting existing rule IDs: ' + error);
        return;
      }
      
      const rules = [];
      let ruleId = nextRuleId;
      
      try {
        for (const domain of domains) {
          if (domain && domain.on && domain.rules) {
            for (const rule of domain.rules) {
              if (rule && rule.on && rule.type === "normalOverride" && rule.match && rule.replace) {
                rules.push({
                  id: ruleId++,
                  priority: 1,
                  action: {
                    type: "redirect",
                    redirect: {
                      url: rule.replace
                    }
                  },
                  condition: {
                    urlFilter: rule.match,
                    resourceTypes: ["script", "stylesheet", "image", "xmlhttprequest", "sub_frame", "main_frame"]
                  }
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Error building rules:', e);
        callback(false, 'Error building rules: ' + e.message);
        return;
      }
      
      console.log('Updating declarativeNetRequest rules:', rules.length);
      
      // Remove all existing rules first
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: []
      }, function() {
        if (chrome.runtime.lastError) {
          const error = 'Error removing old rules: ' + chrome.runtime.lastError.message;
          console.error(error);
          callback(false, error);
        } else {
          console.log('Old rules removed');
          
          // Then add new rules
          if (rules.length > 0) {
            chrome.declarativeNetRequest.updateDynamicRules({
              removeRuleIds: [],
              addRules: rules
            }, function() {
              if (chrome.runtime.lastError) {
                const error = 'Error adding new rules: ' + chrome.runtime.lastError.message;
                console.error(error);
                callback(false, error);
              } else {
                console.log('New rules added successfully');
                // Update current rule IDs and next rule ID
                currentRuleIds = rules.map(rule => rule.id);
                nextRuleId = ruleId;
                callback(true);
              }
            });
          } else {
            console.log('No rules to add');
            currentRuleIds = [];
            callback(true);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error in updateDeclarativeRules:', error);
    callback(false, 'Error in updateDeclarativeRules: ' + error.message);
  }
}

// Initialize settings and load existing rules
chrome.storage.local.get(['devTools', 'showSuggestions', 'showLogs', 'storedDomains'], (result) => {
  try {
    if (!result.devTools) {
      chrome.storage.local.set({devTools: 'true'});
    }
    if (!result.showSuggestions) {
      chrome.storage.local.set({showSuggestions: 'true'});
    }
    if (!result.showLogs) {
      chrome.storage.local.set({showLogs: 'false'});
    }
    
    // Initialize declarative rules with existing domains
    if (result.storedDomains && result.storedDomains.length > 0) {
      console.log('Initializing rules with existing domains');
      updateDeclarativeRules(result.storedDomains, function(success, error) {
        if (error) {
          console.error('Error initializing rules:', error);
        } else {
          console.log('Rules initialized successfully');
        }
      });
    }
    
    console.log('Settings initialized');
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
});

console.log('Service worker loaded successfully'); 
