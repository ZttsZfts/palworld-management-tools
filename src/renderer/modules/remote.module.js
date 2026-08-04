'use strict';

/** 负责 RCON 控制台与游戏内广播；数据同步由 DataModule 独立管理。 */
window.RemoteModule = class RemoteModule {
  constructor(api, state, modal, navigation) {
    this.api = api;
    this.state = state;
    this.modal = modal;
    this.navigation = navigation;
  }

  register() {
    $('[data-action="broadcast"]').on('click', () => this.openBroadcast());
    $('#broadcast-form').on('submit', (event) => this.broadcast(event));
    $('[data-action="clear-console"]').on('click', () => $('#console-output').empty());
    $('#console-form').on('submit', (event) => { event.preventDefault(); this.execute($('#console-command').val()); });
    $('[data-command]').on('click', (event) => this.execute($(event.currentTarget).data('command')));
    $('[data-fill-command]').on('click', (event) => {
      this.navigation.navigate('console');
      $('#console-command').val($(event.currentTarget).data('fill-command')).trigger('focus');
    });
  }

  openBroadcast() {
    if (!this.requireConnection()) return;
    this.modal.showBroadcast();
  }

  async broadcast(event) {
    event.preventDefault();
    const connection = this.requireConnection();
    if (!connection) return;
    const message = event.currentTarget.elements.message.value.trim();
    try {
      await this.api.remote.broadcast({ connectionId: connection.id, message });
      this.modal.hideBroadcast();
      this.modal.toast('游戏内广播已发送');
      this.writeConsole(`› Broadcast ${message}`, 'console-command-line');
    } catch (error) { this.modal.message('广播发送失败', this.error(error), 'megaphone'); }
  }

  async execute(command) {
    const connection = this.requireConnection();
    const value = String(command || '').trim();
    if (!connection || !value) return;
    this.navigation.navigate('console');
    this.writeConsole(`› ${value}`, 'console-command-line');
    $('#console-command').val('').prop('disabled', true);
    try {
      const restCommands = {
        Save: { endpoint: '/save', method: 'POST', success: '世界存档已保存' },
        Info: { endpoint: '/info', method: 'GET' },
        ShowPlayers: { endpoint: '/players', method: 'GET' }
      };
      const restCommand = restCommands[value];
      if (restCommand) {
        const response = await this.api.remote.rest({ connectionId: connection.id, endpoint: restCommand.endpoint, method: restCommand.method });
        this.writeConsole(restCommand.success || JSON.stringify(response.data, null, 2));
      } else {
        this.writeConsole(await this.api.remote.rcon({ connectionId: connection.id, command: value }) || '命令已执行');
      }
    } catch (error) { this.writeConsole(`错误: ${this.error(error)}`, 'console-error'); }
    finally { $('#console-command').prop('disabled', false).trigger('focus'); }
  }

  requireConnection() {
    const connection = this.state.getActiveConnection();
    if (!connection) this.modal.message('请选择服务器', '请先添加并选择一台服务器。', 'hdd-rack');
    return connection;
  }

  writeConsole(text, className = '') {
    $('<p>').addClass(className).text(text).appendTo('#console-output');
    const output = $('#console-output')[0];
    output.scrollTop = output.scrollHeight;
  }
  error(error) { return error instanceof Error ? error.message : String(error); }
};
