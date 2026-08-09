'use strict';

window.SettingsModule = class SettingsModule {
  constructor(api, modal, onStorageChanged) {
    this.api = api;
    this.modal = modal;
    this.onStorageChanged = onStorageChanged;
    this.value = null;
  }

  register() {
    $('input[name="theme"]').on('change', (event) => this.saveTheme(event.target.value));
    $('#select-storage-root').on('click', () => this.selectStorageRoot());
    $('#reset-storage-root').on('click', () => $('#storage-root').val(''));
    $('#storage-settings-form').on('submit', (event) => { event.preventDefault(); this.saveStorageRoot(); });
  }

  async load() { this.value = await this.api.settings.get(); this.applyTheme(this.value.theme); this.render(); }

  applyTheme(theme) {
    const selected = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = selected;
    document.documentElement.dataset.bsTheme = selected;
    $('meta[name="theme-color"]').attr('content', selected === 'light' ? '#f3f6fb' : '#0a0e16');
  }

  async saveTheme(theme) {
    this.applyTheme(theme);
    try {
      this.value = await this.api.settings.save({ theme, storageRoot: this.value?.storageRoot || '' });
      this.render();
      this.modal.toast(theme === 'light' ? '已切换为亮色模式' : '已切换为暗色模式');
    } catch (error) { this.modal.message('主题保存失败', error.message || String(error), 'x-lg'); }
  }

  async selectStorageRoot() {
    try { const directory = await this.api.settings.selectStorageDirectory(); if (directory) $('#storage-root').val(directory); }
    catch (error) { this.modal.message('目录选择失败', error.message || String(error), 'x-lg'); }
  }

  async saveStorageRoot() {
    const storageRoot = String($('#storage-root').val() || '').trim();
    const previousRoot = this.value?.storageRoot || '';
    this.setBusy(true);
    try {
      this.value = await this.api.settings.save({ theme: this.value?.theme || 'dark', storageRoot });
      this.render();
      if (previousRoot !== this.value.storageRoot && this.onStorageChanged) await this.onStorageChanged();
      this.modal.toast('数据存储目录已保存，连接与缓存状态已重新载入');
    } catch (error) { this.modal.message('目录保存失败', error.message || String(error), 'x-lg'); }
    finally { this.setBusy(false); }
  }

  render() {
    if (!this.value) return;
    $(`input[name="theme"][value="${this.value.theme}"]`).prop('checked', true);
    $('#storage-root').val(this.value.storageRoot || '');
    const paths = [
      ['启动设置文件', this.value.settingsFile, '固定入口，用于启动时定位主题与数据根目录'],
      ['服务器连接配置', this.value.connectionsFile, '包含服务器地址和管理员凭据'],
      ['服务器快照缓存', this.value.snapshotDirectory, '玩家、公会和服务器状态快照'],
      ['玩家移动轨迹', this.value.movementDirectory, '按服务器、玩家和日期保存'],
      ['Level.json 解析缓存', this.value.levelJsonCacheDirectory, '大型存档解析后的结构化缓存'],
      ['界面渲染缓存', this.value.rendererCacheDirectory, 'EJS 生成的本地 HTML']
    ];
    $('#storage-path-list').html(paths.map(([label, value, note]) => `<div class="storage-path-item"><i class="bi bi-${label.includes('文件') || label.includes('配置') ? 'file-earmark-text' : 'folder'}"></i><div><strong>${this.escape(label)}</strong><code>${this.escape(value)}</code><small>${this.escape(note)}</small></div></div>`).join(''));
  }

  setBusy(busy) {
    $('#storage-settings-form button, #storage-settings-form input').prop('disabled', busy);
    $('#settings-save-state').text(busy ? '正在保存…' : '设置已同步').toggleClass('success', !busy);
  }

  escape(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
};
