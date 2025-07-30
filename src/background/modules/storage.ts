/// <reference types="chrome"/>
import { Utils } from './utils';

// Type definitions
export interface Rule {
  id?: string;
  on: boolean;
  type: 'fileOverride' | 'fileInject' | 'urlRedirect' | 'headerModification' | 'contentModification';
  from: string;
  to?: string;
  file?: string;
  fileType?: 'js' | 'css' | 'html' | 'json' | 'xml';
  injectLocation?: 'head' | 'body';
  headers?: Array<{
    name: string;
    value: string;
    operation: 'add' | 'modify' | 'remove';
  }>;
  content?: string;
  matchType?: 'exact' | 'contains' | 'regex';
  description?: string;
}

export interface Domain {
  id: string;
  url: string;
  on: boolean;
  rules: Rule[];
  description?: string;
}

export interface ExtensionStorage {
  domains: Domain[];
  showLogs?: string;
  version?: string;
  installDate?: string;
  updateDate?: string;
  [key: string]: any;
}

/**
 * Storage manager for extension data
 */
export class StorageManager {
  private cache: ExtensionStorage | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  async init(): Promise<void> {
    console.log('💾 Initializing Storage Manager...');
    await this.get(); // Initialize cache
  }

  /**
   * Get extension storage data
   */
  async get(): Promise<ExtensionStorage> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const data = await Utils.getStorage<ExtensionStorage>();
      
      // Initialize with default structure if empty
      if (!data.domains) {
        data.domains = [];
      }
      
      this.cache = data;
      this.cacheExpiry = now + this.CACHE_DURATION;
      
      return data;
    } catch (error) {
      Utils.simpleError(error);
      return { domains: [] };
    }
  }

  /**
   * Set extension storage data
   */
  async set(data: Partial<ExtensionStorage>): Promise<void> {
    try {
      await Utils.setStorage(data);
      
      // Update cache
      if (this.cache) {
        Object.assign(this.cache, data);
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      }
    } catch (error) {
      Utils.simpleError(error);
      throw error;
    }
  }

  /**
   * Add a new domain to storage
   */
  async addDomain(domain: Omit<Domain, 'id'> & { id?: string }): Promise<Domain> {
    const storage = await this.get();
    if (!domain.id) {
      domain.id = Utils.generateId();
    }
    const newDomain = domain as Domain;
    storage.domains.push(newDomain);
    await this.set({ domains: storage.domains });
    return newDomain;
  }

  /**
   * Update an existing domain
   */
  async updateDomain(domainId: string, updates: Partial<Domain>): Promise<Domain | null> {
    const storage = await this.get();
    const domainIndex = storage.domains.findIndex(d => d.id === domainId);
    
    if (domainIndex !== -1) {
      Object.assign(storage.domains[domainIndex], updates);
      await this.set({ domains: storage.domains });
      return storage.domains[domainIndex];
    }
    return null;
  }

  /**
   * Remove a domain from storage
   */
  async removeDomain(domainId: string): Promise<boolean> {
    const storage = await this.get();
    const originalLength = storage.domains.length;
    storage.domains = storage.domains.filter(d => d.id !== domainId);
    
    if (storage.domains.length < originalLength) {
      await this.set({ domains: storage.domains });
      return true;
    }
    return false;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Force refresh - clear cache and immediately fetch fresh data
   */
  async forceRefresh(): Promise<ExtensionStorage> {
    console.log('🔄 Force refreshing storage data...');
    this.clearCache();
    const freshData = await this.get();
    console.log(`✅ Fresh data loaded: ${freshData.domains?.length || 0} domains`);
    return freshData;
  }

  /**
   * Legacy compatibility method
   */
  legacyGet(callback: (data: ExtensionStorage) => void): void {
    this.get().then(callback).catch(error => {
      Utils.simpleError(error);
      callback({ domains: [] });
    });
  }

  /**
   * Legacy compatibility method
   */
  legacySet(data: Partial<ExtensionStorage>, callback?: () => void): void {
    this.set(data).then(() => {
      callback?.();
    }).catch(error => {
      Utils.simpleError(error);
      callback?.();
    });
  }
} 
 