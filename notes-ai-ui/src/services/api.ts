const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface ProcessRequest {
  url: string;
  client_id?: string;
}

export interface Note {
  id: number;
  url: string;
  title: string;
  content_type: string;
  output: string;
  language: string;
  created_at: string;
  updated_at?: string;
}

export interface ProcessResponse {
  status: 'success' | 'error';
  id?: number;
  title?: string;
  content_type?: string;
  notes?: string;
  language?: string;
  error?: string;
}

export interface HistoryResponse {
  notes: Note[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  status: 'success' | 'error';
  reply?: string;
  error?: string;
}

export interface ImportStatus {
  video_index: number;
  video_total: number;
  url: string;
  status: 'processing' | 'done' | 'error';
  title?: string;
  error?: string;
  message?: string;
}

export interface MemoryStats {
  count: number;
  total_words: number;
  types: Record<string, number>;
}

class ApiService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substr(2, 9);
  }

  private authHeaders(json = false): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/${this.clientId}`);
    
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.emit(msg.type, msg);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 1000);
    };
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  async process(url: string): Promise<ProcessResponse> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        const offResult = this.on('result', (data) => {
          offResult();
          offError();
          resolve(data.data);
        });
        const offError = this.on('error', (data) => {
          offResult();
          offError();
          resolve({ status: 'error', error: data.error });
        });
        this.ws!.send(JSON.stringify({ type: 'process', url }));
      });
    }

    const res = await fetch(`${API_BASE}/api/process`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ url, client_id: this.clientId })
    });
    return res.json();
  }

  async getHistory(limit = 50, q = ''): Promise<Note[]> {
    const qs = q ? `&q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`${API_BASE}/api/history?limit=${limit}${qs}`, { headers: this.authHeaders() });
    const data: HistoryResponse = await res.json();
    return data.notes || [];
  }

  async deleteNote(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE', headers: this.authHeaders() });
    return res.ok;
  }

  async downloadNote(id: number): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/history/${id}/download`, { headers: this.authHeaders() });
    return res.blob();
  }

  importVideos(urls: string[], onStatus: (s: ImportStatus) => void): Promise<ImportStatus[]> {
    const results: ImportStatus[] = [];
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to server'));
        return;
      }
      const offStatus = this.on('import_status', (data) => {
        const s = data as ImportStatus;
        results.push(s);
        onStatus(s);
      });
      const offDone = this.on('import_done', () => {
        offStatus();
        offDone();
        offError();
        resolve(results);
      });
      const offError = this.on('error', (data) => {
        offStatus();
        offDone();
        offError();
        reject(new Error(data.error || 'Import failed'));
      });
      this.ws!.send(JSON.stringify({ type: 'import', urls }));
    });
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const res = await fetch(`${API_BASE}/api/memory`, { headers: this.authHeaders() });
    const data = await res.json();
    return { count: data.count || 0, total_words: data.total_words || 0, types: data.types || {} };
  }

  async chatWithMemory(messages: ChatMessage[]): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/api/memory/chat`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ messages })
    });
    if (!res.ok) {
      try {
        const data = await res.json();
        return { status: 'error', error: data.error || `Request failed (${res.status})` };
      } catch {
        return { status: 'error', error: `Request failed (${res.status})` };
      }
    }
    return res.json();
  }

  async chatWithNotes(noteId: number, messages: ChatMessage[]): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ note_id: noteId, messages })
    });
    if (res.status === 404) return { status: 'error', error: 'Note not found' };
    if (!res.ok) {
      try {
        const data = await res.json();
        return { status: 'error', error: data.error || `Request failed (${res.status})` };
      } catch {
        return { status: 'error', error: `Request failed (${res.status})` };
      }
    }
    return res.json();
  }

  disconnect() {
    this.ws?.close();
  }
}

export const api = new ApiService();