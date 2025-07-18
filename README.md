# Resource Override - Manifest V3

Resource Override is a Chrome extension that helps you gain full control of any website by redirecting traffic, replacing, editing, or inserting new content.

## Features

- **URL Redirection**: Redirect any URL to another URL
- **File Replacement**: Replace remote resources with local files
- **Content Injection**: Inject JavaScript or CSS into pages
- **Header Modification**: Modify request and response headers
- **DevTools Integration**: Full integration with Chrome DevTools

## Manifest V3 Changes

This extension has been upgraded from Manifest V2 to Manifest V3 to comply with Chrome's new extension requirements:

### Key Changes Made:

1. **Service Worker**: Replaced background page with service worker
2. **Storage API**: Updated to use Chrome's storage API for persistent data storage
3. **Permissions**: Updated permissions to use `declarativeNetRequest` and `host_permissions`
4. **Action API**: Updated from `browser_action` to `action`
5. **WebRequest**: Removed blocking webRequest in favor of declarative rules

### New Permissions:

- `declarativeNetRequest`: For network request modification
- `declarativeNetRequestFeedback`: For debugging network rules
- `storage`: For storing extension data
- `activeTab`: For accessing current tab
- `host_permissions`: For accessing all URLs

### Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension will appear in your extensions list

### Usage

1. Click the extension icon to open the main interface
2. Add a new tab group for the website you want to override
3. Configure rules for URL redirection, file replacement, or content injection
4. Enable the rules and refresh the target website

### Development

This extension is built for Chrome Extension Manifest V3 and may not be compatible with older browsers or extension frameworks.

## License

MIT License - see LICENSE file for details.
