// Test storage functionality
console.log('Testing storage functionality...');

// Test saving data
const testDomain = {
    id: 'd1',
    matchUrl: 'https://example.com',
    rules: [{
        type: 'normalOverride',
        match: 'https://example.com/test',
        replace: 'https://example.com/new',
        on: true
    }],
    on: true
};

// Test saving
chrome.storage.local.set({storedDomains: [testDomain]}, function() {
    console.log('✓ Test data saved to storage');
    
    // Test loading
    chrome.storage.local.get(['storedDomains'], function(result) {
        if (result.storedDomains && result.storedDomains.length > 0) {
            console.log('✓ Test data loaded from storage:', result.storedDomains.length, 'domains');
            console.log('✓ First domain ID:', result.storedDomains[0].id);
        } else {
            console.error('✗ Failed to load test data from storage');
        }
    });
});

console.log('Storage test completed'); 
