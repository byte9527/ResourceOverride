// Simple test to verify Manifest V3 configuration
console.log('Testing Manifest V3 configuration...');

// Test if service worker is accessible
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✓ Chrome runtime API available');
    
    // Test if service worker is loaded
    chrome.runtime.getManifest((manifest) => {
        console.log('✓ Manifest loaded:', manifest.manifest_version);
        
        if (manifest.manifest_version === 3) {
            console.log('✓ Manifest V3 configuration is correct');
        } else {
            console.error('✗ Expected Manifest V3, got:', manifest.manifest_version);
        }
        
        // Test permissions
        if (manifest.permissions && manifest.permissions.includes('storage')) {
            console.log('✓ Storage permission configured');
        } else {
            console.error('✗ Storage permission missing');
        }
        
        if (manifest.host_permissions && manifest.host_permissions.includes('<all_urls>')) {
            console.log('✓ Host permissions configured');
        } else {
            console.error('✗ Host permissions missing');
        }
    });
} else {
    console.error('✗ Chrome runtime API not available');
}

// Test storage API
if (typeof chrome !== 'undefined' && chrome.storage) {
    console.log('✓ Chrome storage API available');
    
    // Test storage functionality
    chrome.storage.local.set({test: 'value'}, () => {
        chrome.storage.local.get(['test'], (result) => {
            if (result.test === 'value') {
                console.log('✓ Storage API working correctly');
            } else {
                console.error('✗ Storage API test failed');
            }
        });
    });
} else {
    console.error('✗ Chrome storage API not available');
}

console.log('Manifest V3 test completed'); 
