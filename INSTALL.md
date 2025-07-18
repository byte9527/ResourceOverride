# Resource Override Chrome Extension - Installation Guide

## Installation Steps

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `ResourceOverride` folder
   - The extension should appear in your extensions list

3. **Verify Installation**
   - Check that the extension shows as "Enabled"
   - Look for any error messages in the extension card
   - Click on the extension icon to open the options page

## Troubleshooting Service Worker Issues

If the service worker shows as "invalid" or doesn't work:

1. **Check Console for Errors**
   - Right-click the extension icon
   - Select "Inspect popup" or "Inspect service worker"
   - Look for any JavaScript errors in the console

2. **Common Issues Fixed**
   - ✅ Removed `webRequestBlocking` permission (not supported in MV3)
   - ✅ Added proper service worker lifecycle events
   - ✅ Added error handling for all async operations
   - ✅ Fixed message handling for content scripts

3. **Test the Extension**
   - Open the test page: `test-service-worker.html`
   - Click "Test Service Worker" button
   - Should show "Service worker is working"

4. **Manual Testing**
   - Open any website
   - Check browser console for "[Resource Override]" messages
   - Verify extension icon is visible in toolbar

## Files Modified

- `src/background/service-worker.js` - Fixed service worker implementation
- `manifest.json` - Removed unsupported permissions
- `test-service-worker.html` - Added test page

## Manifest V3 Compatibility

This extension has been updated for Manifest V3:
- Uses `declarativeNetRequest` instead of `webRequestBlocking`
- Proper service worker lifecycle management
- Error handling for all Chrome API calls 
