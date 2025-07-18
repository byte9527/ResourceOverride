// Simple Service Worker for testing
console.log('Simple service worker starting...');

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Simple service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Simple service worker activating...');
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
    if (request.action === "getDomains") {
      chrome.storage.local.get(['storedDomains'], function(result) {
        const domains = result.storedDomains || [];
        console.log('Returning domains:', domains.length);
        sendResponse(domains);
      });
      return true;
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
          sendResponse({saved: true});
        });
      });
      return true;
    } else if (request.action === "import") {
      chrome.storage.local.set({storedDomains: request.data}, function() {
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
            sendResponse({deleted: true});
          });
        } else {
          sendResponse({deleted: false});
        }
      });
      return true;
    } else if (request.action === "syncMe") {
      sendResponse({synced: true});
    } else if (request.action === "match") {
      // Simple URL matching
      const isMatch = request.domainUrl && request.windowUrl && 
                     request.windowUrl.includes(request.domainUrl.replace('*', ''));
      sendResponse(isMatch);
    } else {
      sendResponse({error: 'Action not implemented'});
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({error: error.message});
  }
});

console.log('Simple service worker loaded successfully'); 
