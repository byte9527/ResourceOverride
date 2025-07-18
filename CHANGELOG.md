# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2024-01-XX - Manifest V3 Upgrade

### Added
- Support for Chrome Extension Manifest V3
- New service worker architecture replacing background page
- Chrome storage API integration
- Declarative network request rules support
- Enhanced security with new permission model
- Package.json for better project management
- Installation guide (INSTALL.md)
- Manifest V3 compatibility tests

### Changed
- **Breaking Change**: Upgraded from Manifest V2 to Manifest V3
- Replaced `browser_action` with `action` API
- Updated permissions structure:
  - Added `declarativeNetRequest` and `declarativeNetRequestFeedback`
  - Added `storage` permission
  - Added `activeTab` permission
  - Moved URL permissions to `host_permissions`
- Replaced background page with service worker (`src/background/service-worker.js`)
- Updated storage system to use Chrome storage API instead of localStorage
- Modified request handling to work with MV3 webRequest limitations
- Updated devtools integration for MV3 compatibility

### Removed
- Background page (`src/background/background.html`)
- Old background script (`src/background/background.js`)
- `webRequestBlocking` permission (no longer supported in MV3)
- Direct localStorage usage in service worker context

### Fixed
- Service worker initialization and lifecycle management
- Storage API compatibility issues
- WebRequest blocking limitations in MV3
- DevTools panel path resolution

### Technical Details
- **Service Worker**: All background functionality now runs in a service worker
- **Storage**: Settings and data now use `chrome.storage.local` API
- **Network Requests**: Uses combination of `declarativeNetRequest` and non-blocking `webRequest`
- **Permissions**: Stricter permission model with separate host permissions
- **Compatibility**: Requires Chrome 88+ for Manifest V3 support

### Migration Notes
- Existing users will need to reinstall the extension
- Settings will need to be reconfigured (stored in new storage system)
- Some advanced features may work differently due to MV3 limitations
- DevTools integration requires re-enabling after installation

## [1.3.1] - Previous Version
- Last stable Manifest V2 version
- Original functionality before MV3 upgrade

## [1.3.0] - Previous Version
- Initial release with Manifest V2
- Core resource override functionality 
