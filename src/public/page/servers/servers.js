'use strict';

window.ConnectionsModule = class ConnectionsModule {
  constructor(api, state, modal) {
    this.api = api;
    this.state = state;
    this.modal = modal;
  }

  register() {
    $('[data-action="new-connection"]').on('click', () => this.modal.showConnection());
    $('#connection-form').on('submit', (event) => this.save(event));
    $('#active-connection').on('change', (event) => this.select(event.target.value));
    $('#server-list').on('click', '[data-server-action]', (event) => this.handleCardAction(event));
  }

  async load() {
    const connections = await this.api.connections.list();
    this.state.set('connections', connections);
    const current = this.state.get('activeConnectionId');
    if (!connections.some((item) => item.id === current)) this.state.set('activeConnectionId', connections[0]?.id || '');
    this.render();
  }

  select(id) {
    this.state.set('activeConnectionId', id);
    this.renderActive();
    $(document).trigger('connection:changed', [id]);
  }

  async save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const connection = Object.fromEntries(new FormData(form).entries());
    connection.useHttps = form.elements.useHttps.checked;
    try {
      const saved = await this.api.connections.save(connection);
      this.modal.hideConnection();
      this.state.set('activeConnectionId', saved.id);
      await this.load();
      $(document).trigger('connection:changed', [saved.id]);
      this.modal.toast('服务器连接已保存');
    } catch (error) { this.modal.message('无法保存', this.error(error), 'x-lg'); }
  }

  async handleCardAction(event) {
    const id = $(event.currentTarget).closest('[data-server-id]').data('server-id');
    const action = $(event.currentTarget).data('server-action');
    const connection = this.state.get('connections').find((item) => item.id === id);
    if (action === 'edit') this.modal.showConnection(connection);
    if (action === 'select') this.select(id);
    if (action === 'remove') this.modal.confirm('移除服务器？', `“${connection.name}”的本地连接配置将被删除。`, async () => {
      await this.api.connections.remove(id);
      if (this.state.get('activeConnectionId') === id) this.state.set('activeConnectionId', '');
      await this.load();
      this.modal.toast('连接配置已移除');
    });
  }

  render() {
    const connections = this.state.get('connections');
    $('#active-connection').html('<option value="">选择服务器</option>' + connections.map((item) => `<option value="${this.escape(item.id)}">${this.escape(item.name)}</option>`).join('')).val(this.state.get('activeConnectionId'));
    $('#server-list').html(connections.length ? connections.map((item) => this.card(item)).join('') : '<div class="surface empty-state tall" style="grid-column:1/-1"><span class="empty-illustration"><i class="bi bi-hdd-rack"></i></span><strong>还没有服务器连接</strong><span>添加 REST 和 RCON 连接后即可开始管理。</span><button class="btn btn-primary mt-3" data-action="new-connection">添加第一台服务器</button></div>');
    $('#server-list [data-action="new-connection"]').on('click', () => this.modal.showConnection());
    this.renderActive();
  }

  renderActive() {
    const connection = this.state.getActiveConnection();
    $('#active-connection').val(connection?.id || '');
    $('#sidebar-server').text(connection?.name || '未选择服务器');
    $('#sidebar-status').text(connection ? `${connection.host}:${connection.restPort}` : '等待连接');
    $('.connection-dot').removeClass('online');
  }

  card(item) {
    const active = item.id === this.state.get('activeConnectionId');
    return `<article class="server-card-item" data-server-id="${this.escape(item.id)}"><div class="server-card-head"><span class="server-avatar"><i class="bi bi-hdd-rack"></i></span><span class="soft-badge ${active ? 'success' : ''}">${active ? '当前' : '已保存'}</span></div><h3>${this.escape(item.name)}</h3><div class="server-address">${this.escape(item.host)}</div><div class="server-meta"><span>REST ${item.restPort}</span><span>同步 ${Math.max(1, Number(item.syncIntervalSeconds) || 3)}秒</span><span>${item.supplementalDataPath ? '扩展数据已配置' : '仅官方 REST'}</span></div><div class="server-actions"><button class="btn btn-surface" data-server-action="select">选择</button><button class="icon-button" data-server-action="edit"><i class="bi bi-pencil"></i></button><button class="icon-button" data-server-action="remove"><i class="bi bi-trash3"></i></button></div></article>`;
  }

  escape(value) { return $('<div>').text(String(value ?? '')).html(); }
  error(error) { return error instanceof Error ? error.message : String(error); }
};
