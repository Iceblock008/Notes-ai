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

class ApiService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substr(2, 9);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, client_id: this.clientId })
    });
    return res.json();
  }

  async getHistory(limit = 50): Promise<Note[]> {
    const res = await fetch(`${API_BASE}/api/history?limit=${limit}`);
    const data: HistoryResponse = await res.json();
    return data.notes || [];
  }

  async deleteNote(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' });
    return res.ok;
  }

  async downloadNote(id: number): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/history/${id}/download`);
    return res.blob();
  }

  disconnect() {
    this.ws?.close();
  }
}

export const api = new ApiService();