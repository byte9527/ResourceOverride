// Resource Override Service Worker for Manifest V3

console.log('Service worker starting...');

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
        sendResponse({success: true});
      });
      return true;
    } else if (request.action === "getSetting") {
      chrome.storage.local.get([request.setting], (result) => {
        sendResponse(result[request.setting]);
      });
      return true;
    } else if (request.action === "syncMe") {
      sendResponse({synced: true});
    } else if (request.action === "getDomains") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        const domains = result.storedDomains || [];
        console.log('Returning domains from storage:', domains.length);
        sendResponse(domains);
      });
      return true;
    } else if (request.action === "match") {
      // Handle URL matching for content scripts
      const isMatch = isUrlMatch(request.domainUrl, request.windowUrl);
      sendResponse(isMatch);
    } else if (request.action === "saveDomain") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        let domains = result.storedDomains || [];
        const existingIndex = domains.findIndex(d => d.id === request.data.id);
        if (existingIndex >= 0) {
          domains[existingIndex] = request.data;
        } else {
          domains.push(request.data);
        }
        chrome.storage.local.set({storedDomains: domains}, function() {
          console.log('Domain saved to storage');
          updateDeclarativeRules(domains);
          sendResponse({saved: true});
        });
      });
      return true;
    } else if (request.action === "import") {
      chrome.storage.local.set({storedDomains: request.data}, function() {
        console.log('Imported domains saved to storage');
        updateDeclarativeRules(request.data);
        sendResponse({imported: true});
      });
      return true;
    } else if (request.action === "deleteDomain") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        let domains = result.storedDomains || [];
        const index = domains.findIndex(d => d.id === request.id);
        if (index >= 0) {
          domains.splice(index, 1);
          chrome.storage.local.set({storedDomains: domains}, function() {
            console.log('Updated domains saved to storage after deletion');
            updateDeclarativeRules(domains);
            sendResponse({deleted: true});
          });
        } else {
          sendResponse({deleted: false});
        }
      });
      return true;
    } else {
      sendResponse({error: 'Action not implemented yet'});
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({error: error.message});
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
      callback([]);
    } else {
      const ruleIds = rules.map(rule => rule.id);
      console.log('Existing rule IDs:', ruleIds);
      callback(ruleIds);
    }
  });
}

// Function to update declarativeNetRequest rules
function updateDeclarativeRules(domains) {
  try {
    // First get existing rule IDs
    getExistingRuleIds(function(existingRuleIds) {
      const rules = [];
      let ruleId = nextRuleId;
      
      for (const domain of domains) {
        if (domain.on && domain.rules) {
          for (const rule of domain.rules) {
            if (rule.on && rule.type === "normalOverride") {
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
      
      console.log('Updating declarativeNetRequest rules:', rules.length);
      
      // Remove all existing rules first
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: []
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error removing old rules:', chrome.runtime.lastError);
        } else {
          console.log('Old rules removed');
          
          // Then add new rules
          if (rules.length > 0) {
            chrome.declarativeNetRequest.updateDynamicRules({
              removeRuleIds: [],
              addRules: rules
            }, function() {
              if (chrome.runtime.lastError) {
                console.error('Error adding new rules:', chrome.runtime.lastError);
              } else {
                console.log('New rules added successfully');
                // Update current rule IDs and next rule ID
                currentRuleIds = rules.map(rule => rule.id);
                nextRuleId = ruleId;
              }
            });
          } else {
            console.log('No rules to add');
            currentRuleIds = [];
          }
        }
      });
    });
  } catch (error) {
    console.error('Error in updateDeclarativeRules:', error);
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
      updateDeclarativeRules(result.storedDomains);
    }
    
    console.log('Settings initialized');
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
});

console.log('Service worker loaded successfully'); 
