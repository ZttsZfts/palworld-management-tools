'use strict';

window.AppState = class AppState {
  constructor() {
    this.data = { connections: [], activeConnectionId: '', activePage: 'dashboard', snapshot: null };
    this.listeners = new Map();
  }

  get(key) { return this.data[key]; }
  set(key, value) {
    this.data[key] = value;
    (this.listeners.get(key) || []).forEach((listener) => listener(value));
  }
  on(key, listener) {
    const items = this.listeners.get(key) || [];
    items.push(listener);
    this.listeners.set(key, items);
    return () => this.listeners.set(key, items.filter((item) => item !== listener));
  }
  getActiveConnection() {
    return this.data.connections.find((item) => item.id === this.data.activeConnectionId) || null;
  }
};
