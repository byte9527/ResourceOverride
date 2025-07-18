// Minimal test service worker
console.log('Test service worker starting...');

// Basic message handler
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Test message received:', request.action);
  sendResponse({status: 'ok', action: request.action});
});

console.log('Test service worker loaded'); 
