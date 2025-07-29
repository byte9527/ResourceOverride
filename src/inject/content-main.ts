/// <reference types="chrome"/>

console.log('📝 Content script loading...');

// Content script main entry point
class ContentMain {
    private isInitialized = false;

    constructor() {
        this.init();
    }

    private init(): void {
        if (this.isInitialized) return;
        
        console.log('📝 Initializing Content Script...');
        
        // Setup message listener
        this.setupMessageListener();
        
        // Setup DOM ready handler
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
        
        this.isInitialized = true;
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Content script received message:', message);
            
            switch (message.action) {
                case 'log':
                    this.handleLogMessage(message);
                    break;
                
                case 'ping':
                    sendResponse({ success: true, timestamp: Date.now() });
                    break;
                
                default:
                    console.log('❓ Unknown message action:', message.action);
            }
        });
    }

    private onDOMReady(): void {
        console.log('🌐 DOM ready in content script');
        
        // Check if we need to inject any rules
        this.checkForInjectionRules();
    }

    private handleLogMessage(message: { message: string; important?: boolean }): void {
        const { message: logMessage, important } = message;
        
        if (important) {
            console.warn(`[Resource Override] ${logMessage}`);
        } else {
            console.log(`[Resource Override] ${logMessage}`);
        }
    }

    private async checkForInjectionRules(): Promise<void> {
        try {
            // Get current page rules from storage
            const result = await chrome.storage.local.get(['domains']);
            const domains = result.domains || [];
            
            // Find matching domains
            const currentUrl = window.location.href;
            const matchingDomains = domains.filter((domain: any) => {
                return domain.on && this.urlMatches(currentUrl, domain.url);
            });
            
            // Process injection rules
            matchingDomains.forEach((domain: any) => {
                domain.rules?.forEach((rule: any) => {
                    if (rule.on && rule.type === 'fileInject') {
                        this.processInjectionRule(rule);
                    }
                });
            });
            
        } catch (error) {
            console.error('Failed to check injection rules:', error);
        }
    }

    private urlMatches(url: string, pattern: string): boolean {
        try {
            if (pattern.includes('*')) {
                const regexPattern = pattern
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\\\*/g, '.*');
                return new RegExp(`^${regexPattern}$`).test(url);
            } else if (pattern.startsWith('/') && pattern.endsWith('/')) {
                const regex = new RegExp(pattern.slice(1, -1));
                return regex.test(url);
            } else {
                return url.includes(pattern);
            }
        } catch (error) {
            console.error('URL pattern matching error:', error);
            return false;
        }
    }

    private processInjectionRule(rule: any): void {
        console.log('💉 Processing injection rule:', rule);
        
        if (rule.fileType === 'js') {
            this.injectJavaScript(rule);
        } else if (rule.fileType === 'css') {
            this.injectCSS(rule);
        }
    }

    private injectJavaScript(rule: any): void {
        const script = document.createElement('script');
        script.textContent = rule.file;
        
        const target = rule.injectLocation === 'head' ? document.head : document.body;
        if (target) {
            target.appendChild(script);
            console.log('✅ JavaScript injected');
        }
    }

    private injectCSS(rule: any): void {
        const style = document.createElement('style');
        style.textContent = rule.file;
        
        const target = rule.injectLocation === 'head' ? document.head : document.body;
        if (target) {
            target.appendChild(style);
            console.log('✅ CSS injected');
        }
    }
}

// Initialize content script
new ContentMain(); 
