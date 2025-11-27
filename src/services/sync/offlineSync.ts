import * as SQLite from 'expo-sqlite'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { supabase } from '../api/supabaseClient'

// Types for sync operations
export type SyncOperation = 'create' | 'update' | 'delete'
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'
export type EntityType = 'documents' | 'bookings' | 'accounts' | 'transactions'

export interface SyncQueueItem {
  id: string
  entityType: EntityType
  entityId: string
  operation: SyncOperation
  data: Record<string, any>
  status: SyncStatus
  retryCount: number
  createdAt: string
  lastAttempt?: string
  error?: string
}

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime?: string
  pendingCount: number
}

// Database name
const DB_NAME = 'wif_finance_offline.db'

/**
 * OfflineSyncService
 * Handles offline data storage and synchronization with Supabase
 */
export class OfflineSyncService {
  private static db: SQLite.SQLiteDatabase | null = null
  private static syncInProgress = false
  private static listeners: ((state: SyncState) => void)[] = []

  /**
   * Initialize the offline database
   */
  static async initialize(): Promise<void> {
    if (this.db) return

    this.db = await SQLite.openDatabaseAsync(DB_NAME)

    // Create sync queue table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_attempt TEXT,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    `)

    // Create local cache tables for each entity type
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS documents_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        synced_at TEXT,
        local_changes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bookings_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        synced_at TEXT,
        local_changes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS accounts_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        synced_at TEXT,
        local_changes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS transactions_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        synced_at TEXT,
        local_changes INTEGER DEFAULT 0
      );
    `)

    // Start network monitoring
    this.startNetworkMonitoring()
  }

  /**
   * Start monitoring network state
   */
  private static startNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        // Network is back, trigger sync
        this.syncAll()
      }
      this.notifyListeners()
    })
  }

  /**
   * Subscribe to sync state changes
   */
  static subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private static async notifyListeners(): Promise<void> {
    const state = await this.getSyncState()
    this.listeners.forEach((listener) => listener(state))
  }

  /**
   * Get current sync state
   */
  static async getSyncState(): Promise<SyncState> {
    const netInfo = await NetInfo.fetch()
    const pendingCount = await this.getPendingCount()

    return {
      isOnline: netInfo.isConnected === true && netInfo.isInternetReachable === true,
      isSyncing: this.syncInProgress,
      pendingCount,
    }
  }

  /**
   * Get count of pending sync items
   */
  static async getPendingCount(): Promise<number> {
    if (!this.db) return 0

    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending' OR status = 'failed'`
    )

    return result?.count || 0
  }

  /**
   * Add item to sync queue
   */
  static async queueSync(
    entityType: EntityType,
    entityId: string,
    operation: SyncOperation,
    data: Record<string, any>
  ): Promise<void> {
    if (!this.db) await this.initialize()

    const id = `${entityType}-${entityId}-${Date.now()}`
    const createdAt = new Date().toISOString()

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO sync_queue (id, entity_type, entity_id, operation, data, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, entityType, entityId, operation, JSON.stringify(data), createdAt]
    )

    // Also update local cache
    await this.updateLocalCache(entityType, entityId, data)

    // Try to sync immediately if online
    const state = await this.getSyncState()
    if (state.isOnline) {
      this.syncAll()
    }

    this.notifyListeners()
  }

  /**
   * Update local cache
   */
  private static async updateLocalCache(
    entityType: EntityType,
    entityId: string,
    data: Record<string, any>
  ): Promise<void> {
    if (!this.db) return

    const tableName = `${entityType}_cache`

    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${tableName} (id, data, local_changes) VALUES (?, ?, 1)`,
      [entityId, JSON.stringify(data)]
    )
  }

  /**
   * Get cached data
   */
  static async getCached<T>(entityType: EntityType, entityId: string): Promise<T | null> {
    if (!this.db) await this.initialize()

    const tableName = `${entityType}_cache`
    const result = await this.db!.getFirstAsync<{ data: string }>(
      `SELECT data FROM ${tableName} WHERE id = ?`,
      [entityId]
    )

    if (!result) return null
    return JSON.parse(result.data) as T
  }

  /**
   * Get all cached items of a type
   */
  static async getAllCached<T>(entityType: EntityType): Promise<T[]> {
    if (!this.db) await this.initialize()

    const tableName = `${entityType}_cache`
    const results = await this.db!.getAllAsync<{ data: string }>(
      `SELECT data FROM ${tableName}`
    )

    return results.map((r) => JSON.parse(r.data) as T)
  }

  /**
   * Sync all pending items
   */
  static async syncAll(): Promise<void> {
    if (this.syncInProgress) return

    const state = await this.getSyncState()
    if (!state.isOnline) return

    this.syncInProgress = true
    this.notifyListeners()

    try {
      // Get pending items
      const pendingItems = await this.db!.getAllAsync<{
        id: string
        entity_type: string
        entity_id: string
        operation: string
        data: string
        retry_count: number
      }>(
        `SELECT * FROM sync_queue
         WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)
         ORDER BY created_at ASC`
      )

      for (const item of pendingItems) {
        await this.syncItem({
          id: item.id,
          entityType: item.entity_type as EntityType,
          entityId: item.entity_id,
          operation: item.operation as SyncOperation,
          data: JSON.parse(item.data),
          status: 'pending',
          retryCount: item.retry_count,
          createdAt: '',
        })
      }
    } finally {
      this.syncInProgress = false
      this.notifyListeners()
    }
  }

  /**
   * Sync a single item
   */
  private static async syncItem(item: SyncQueueItem): Promise<void> {
    if (!this.db) return

    // Mark as syncing
    await this.db.runAsync(
      `UPDATE sync_queue SET status = 'syncing', last_attempt = ? WHERE id = ?`,
      [new Date().toISOString(), item.id]
    )

    try {
      switch (item.operation) {
        case 'create':
          await this.syncCreate(item)
          break
        case 'update':
          await this.syncUpdate(item)
          break
        case 'delete':
          await this.syncDelete(item)
          break
      }

      // Mark as synced and remove from queue
      await this.db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id])

      // Update cache synced timestamp
      const tableName = `${item.entityType}_cache`
      await this.db.runAsync(
        `UPDATE ${tableName} SET synced_at = ?, local_changes = 0 WHERE id = ?`,
        [new Date().toISOString(), item.entityId]
      )
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.db.runAsync(
        `UPDATE sync_queue SET status = 'failed', error = ?, retry_count = retry_count + 1 WHERE id = ?`,
        [errorMessage, item.id]
      )
    }
  }

  /**
   * Sync create operation
   */
  private static async syncCreate(item: SyncQueueItem): Promise<void> {
    const { error } = await supabase.from(item.entityType).insert(item.data)

    if (error) throw error
  }

  /**
   * Sync update operation
   */
  private static async syncUpdate(item: SyncQueueItem): Promise<void> {
    const { error } = await supabase
      .from(item.entityType)
      .update(item.data)
      .eq('id', item.entityId)

    if (error) throw error
  }

  /**
   * Sync delete operation
   */
  private static async syncDelete(item: SyncQueueItem): Promise<void> {
    const { error } = await supabase.from(item.entityType).delete().eq('id', item.entityId)

    if (error) throw error
  }

  /**
   * Pull latest data from server
   */
  static async pullFromServer(entityType: EntityType, companyId: string): Promise<void> {
    if (!this.db) await this.initialize()

    const state = await this.getSyncState()
    if (!state.isOnline) return

    const { data, error } = await supabase
      .from(entityType)
      .select('*')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    if (!data) return

    const tableName = `${entityType}_cache`

    for (const item of data) {
      // Only update if no local changes
      const existing = await this.db!.getFirstAsync<{ local_changes: number }>(
        `SELECT local_changes FROM ${tableName} WHERE id = ?`,
        [item.id]
      )

      if (!existing || existing.local_changes === 0) {
        await this.db!.runAsync(
          `INSERT OR REPLACE INTO ${tableName} (id, data, synced_at, local_changes) VALUES (?, ?, ?, 0)`,
          [item.id, JSON.stringify(item), new Date().toISOString()]
        )
      }
    }
  }

  /**
   * Clear all cached data
   */
  static async clearCache(): Promise<void> {
    if (!this.db) return

    await this.db.execAsync(`
      DELETE FROM documents_cache;
      DELETE FROM bookings_cache;
      DELETE FROM accounts_cache;
      DELETE FROM transactions_cache;
      DELETE FROM sync_queue;
    `)

    this.notifyListeners()
  }

  /**
   * Close database connection
   */
  static async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync()
      this.db = null
    }
  }
}

export default OfflineSyncService
