// IndexedDB utility for storing video recordings
export interface StoredRecording {
  id: string
  blob: Blob
  url: string
  type: 'video' | 'audio'
  duration: number
  timestamp: Date
  analysis?: string
  title?: string
}

class VideoStorage {
  private dbName = 'eloquence-recordings'
  private dbVersion = 1
  private storeName = 'recordings'
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  async saveRecording(recording: Omit<StoredRecording, 'id'>): Promise<string> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    const id = `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const recordingWithId: StoredRecording = { ...recording, id }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.add(recordingWithId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(id)
    })
  }

  async getRecording(id: string): Promise<StoredRecording | null> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Recreate the blob URL since it doesn't persist
          result.url = URL.createObjectURL(result.blob)
        }
        resolve(result || null)
      }
    })
  }

  async getAllRecordings(): Promise<StoredRecording[]> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      const request = index.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const recordings = request.result.map((recording: StoredRecording) => ({
          ...recording,
          url: URL.createObjectURL(recording.blob) // Recreate blob URL
        }))
        
        // Sort by timestamp descending (newest first)
        recordings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        resolve(recordings)
      }
    })
  }

  async updateRecording(id: string, updates: Partial<StoredRecording>): Promise<void> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      // First get the existing recording
      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const existingRecording = getRequest.result
        if (!existingRecording) {
          reject(new Error('Recording not found'))
          return
        }

        // Merge updates
        const updatedRecording = { ...existingRecording, ...updates }
        
        // Put the updated recording back
        const putRequest = store.put(updatedRecording)
        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async deleteRecording(id: string): Promise<void> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearAllRecordings(): Promise<void> {
    await this.init()
    
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// Export singleton instance
export const videoStorage = new VideoStorage()