'use strict';

/**
 * 管理服务器快照的加载、自动同步、排序、筛选与详情跳转。
 * UI 始终先显示本地缓存，再尝试联网同步，保证离线可浏览。
 */
window.DataModule = class DataModule {
  constructor(api, state, modal, navigation) {
    this.api = api;
    this.state = state;
    this.modal = modal;
    this.navigation = navigation;
    this.syncing = false;
    this.timer = null;
  }

  register() {
    $('[data-action="sync"]').on('click', () => this.sync(true));
    $('#player-filter, #player-status-filter, #player-sort').on('input change', () => this.renderPlayers());
    $('#guild-filter, #guild-sort').on('input change', () => this.renderGuilds());
    $('#players-grid').on('click', '[data-player-id]', (event) => this.openPlayer($(event.currentTarget).data('player-id')));
    $('#players-grid').on('click', '[data-guild-id]', (event) => { event.stopPropagation(); this.openGuild($(event.currentTarget).data('guild-id')); });
    $('#guild-list').on('click', '[data-guild-id]', (event) => this.openGuild($(event.currentTarget).data('guild-id')));
    $('#guild-members').on('click', '[data-player-id]', (event) => this.openPlayer($(event.currentTarget).data('player-id')));
    $('#player-summary').on('click', '[data-guild-id]', (event) => this.openGuild($(event.currentTarget).data('guild-id')));
    $(document).on('connection:changed', (_event, id) => this.load(id));
  }

  async load(connectionId = this.state.get('activeConnectionId')) {
    clearTimeout(this.timer);
    if (!connectionId) { this.state.set('snapshot', null); this.renderAll(); return; }
    try {
      this.state.set('snapshot', await this.api.snapshots.get(connectionId));
      this.renderAll();
      await this.sync(false);
    } catch (error) { this.modal.message('缓存读取失败', this.error(error), 'database-x'); }
    finally { this.scheduleAutoSync(); }
  }

  async sync(showFeedback) {
    const connectionId = this.state.get('activeConnectionId');
    if (!connectionId || this.syncing) return;
    this.syncing = true;
    $('[data-action="sync"] i, [data-action="refresh"] i').addClass('spin');
    try {
      const snapshot = await this.api.snapshots.sync(connectionId);
      // 切换服务器期间丢弃旧请求结果，避免串台。
      if (connectionId !== this.state.get('activeConnectionId')) return;
      this.state.set('snapshot', snapshot);
      this.renderAll();
      $(document).trigger('snapshot:updated');
      if (showFeedback) this.modal.toast('服务器数据与本地 JSON 缓存已更新');
    } catch (error) {
      this.markCached();
      if (showFeedback) this.modal.message('服务器暂时离线', `正在显示最后一次缓存。${this.error(error)}`, 'cloud-slash');
    } finally {
      this.syncing = false;
      $('[data-action="sync"] i, [data-action="refresh"] i').removeClass('spin');
      this.scheduleAutoSync();
    }
  }

  scheduleAutoSync() {
    clearTimeout(this.timer);
    const connection = this.state.getActiveConnection();
    if (!connection) return;
    const milliseconds = Math.max(1000, (Number(connection.syncIntervalSeconds) || 3) * 1000);
    this.timer = setTimeout(() => {
      if (document.hidden) this.scheduleAutoSync();
      else this.sync(false);
    }, milliseconds);
  }

  renderAll() {
    this.renderServer();
    this.renderPlayers();
    this.renderGuilds();
  }

  renderServer() {
    const snapshot = this.state.get('snapshot');
    const server = snapshot?.server || {};
    $('#server-name').text(server.name || '选择一台 Palworld 服务器');
    $('#server-description').text(server.description || '在线时自动刷新，离线时继续浏览本地缓存。');
    // 即使服务端未返回人数上限，也保留可用的在线人数，不整项隐藏。
    const onlinePlayers = Number.isFinite(Number(server.onlinePlayers)) ? Number(server.onlinePlayers) : '—';
    const maxPlayers = Number(server.maxPlayers) > 0 ? Number(server.maxPlayers) : '—';
    $('#metric-players').text(`${onlinePlayers} / ${maxPlayers}`);
    $('#metric-version').text(server.version || '—');
    $('#metric-uptime').text(this.duration(server.uptimeSeconds));
    $('#metric-day').text(server.day ? `第 ${server.day} 天` : '—');
    $('#metric-fps').text(server.fps ? server.fps.toFixed(1) : '—');
    $('#metric-fps').attr('title', server.averageFps ? `平均 FPS ${server.averageFps.toFixed(1)}` : '');
    $('#metric-frame-time').text(server.frameTime ? `${server.frameTime.toFixed(2)} ms` : '—');
    if (snapshot?.online) {
      $('#hero-status').text('服务器在线').parent().addClass('online');
      $('#cache-badge').text(`刚刚同步 · ${server.latency || 0} ms`).addClass('success');
      const gameData = snapshot.capabilities?.gameDataAvailable
        ? ` · Game Data ${snapshot.capabilities.gameDataActors || 0} Actor`
        : ' · Game Data 未启用/不可用';
      $('#health-content').html(`<i class="bi bi-check-circle text-success"></i><strong>远程数据已写入本地缓存</strong><span>${this.time(snapshot.cachedAt)}${gameData}</span>`);
      $('.connection-dot').addClass('online');
    } else this.markCached();
  }

  markCached() {
    const snapshot = this.state.get('snapshot');
    $('#hero-status').text(snapshot?.cachedAt ? '离线缓存' : '尚未同步').parent().removeClass('online');
    $('#cache-badge').text(snapshot?.cachedAt ? `缓存于 ${this.time(snapshot.cachedAt)}` : '暂无缓存').removeClass('success');
    $('.connection-dot').removeClass('online');
  }

  renderPlayers() {
    let players = [...(this.state.get('snapshot')?.players || [])];
    const query = $('#player-filter').val()?.trim().toLowerCase() || '';
    const status = $('#player-status-filter').val() || 'all';
    const sort = $('#player-sort').val() || 'online';
    players = players.filter((player) => {
      const haystack = [player.name, player.steamName, player.uid, player.steam64, player.guildName, player.ip].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || (status === 'online') === Boolean(player.online));
    });
    players.sort(this.playerComparator(sort));
    $('#players-grid').html(players.length ? players.map((player) => this.playerCard(player)).join('') : '<div class="surface empty-state tall player-empty"><i class="bi bi-person-x"></i><strong>没有符合条件的玩家</strong><span>调整关键词或状态筛选后重试</span></div>');
  }

  renderGuilds() {
    let guilds = [...(this.state.get('snapshot')?.guilds || [])];
    const capabilities = this.state.get('snapshot')?.capabilities || {};
    const players = this.state.get('snapshot')?.players || [];
    const query = $('#guild-filter').val()?.trim().toLowerCase() || '';
    const sort = $('#guild-sort').val() || 'name';
    guilds = guilds.filter((guild) => `${guild.name} ${guild.memberIds.map((id) => players.find((p) => p.uid === id)?.name || '').join(' ')}`.toLowerCase().includes(query));
    guilds.sort(sort === 'level-desc' ? (a, b) => b.level - a.level : sort === 'members-desc' ? (a, b) => b.memberIds.length - a.memberIds.length : (a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    let emptyMessage = '<div class="surface empty-state tall" style="grid-column:1/-1"><i class="bi bi-shield"></i><strong>没有符合条件的公会缓存</strong></div>';
    if (!capabilities.supplementalConfigured) emptyMessage = '<div class="surface empty-state tall" style="grid-column:1/-1"><i class="bi bi-database-add"></i><strong>公会数据源未配置</strong><span>在服务器连接设置中填写扩展数据 JSON 路径</span></div>';
    else if (!capabilities.supplementalAvailable) emptyMessage = `<div class="surface empty-state tall" style="grid-column:1/-1"><i class="bi bi-database-x"></i><strong>扩展数据源当前不可用</strong><span>${this.escape(capabilities.supplementalError || '请检查文件路径和 JSON 格式')}</span></div>`;
    $('#guild-list').html(guilds.length ? guilds.map((guild) => `<article class="guild-card" data-guild-id="${this.escape(guild.id)}"><span class="guild-emblem"><i class="bi bi-shield-shaded"></i></span><div><h3>${this.escape(guild.name)}</h3><p>等级 ${guild.level || '未知'} · ${guild.memberIds.length} 名成员${guild.palBoxes?.length ? ` · ${guild.palBoxes.length} 个据点` : ''}</p></div><i class="bi bi-chevron-right"></i></article>`).join('') : emptyMessage);
  }

  openPlayer(uid) {
    const snapshot = this.state.get('snapshot');
    const player = snapshot?.players.find((item) => item.uid === String(uid));
    if (!player) return;
    $('#player-modal-title').text(player.name);
    const values = [
      ['Steam 名称', player.steamName], ['等级', `${player.level || 0}${player.levelGainToday ? ` ↑${player.levelGainToday}` : ''}`],
      ['状态', player.online ? '在线' : '离线'], ['最后在线', this.time(player.lastOnlineAt)], ['登录平台', player.platform],
      ['玩家 UID', player.uid], ['Steam64', player.steam64], ['IP', player.ip], ['Ping', player.ping ? `${player.ping} ms` : '未知'],
      ['生命值', player.maxHp ? `${player.hp} / ${player.maxHp}` : '未知'],
      ['坐标', player.x || player.y ? `X ${player.x}, Y ${player.y}, Z ${player.z ?? '—'}` : '未知'],
      ['朝向', Number.isFinite(player.rotation) ? `${player.rotation.toFixed(1)}°` : '未知'],
      ['当前跟随帕鲁', player.activePalCount || 0], ['所在公会', player.guildName || '无', true]
    ];
    $('#player-summary').html(values.map(([label, value, guildLink]) => `<div class="detail-item"><small>${label}</small>${guildLink && player.guildId ? `<button data-guild-id="${this.escape(player.guildId)}">${this.escape(value || '未知')}</button>` : `<strong>${this.escape(value ?? '未知')}</strong>`}</div>`).join(''));
    const supplementalAvailable = Boolean(snapshot.capabilities?.supplementalAvailable);
    this.renderCollection('#player-pals', player.pals, '帕鲁', supplementalAvailable);
    this.renderCollection('#player-items', player.items, '物品', supplementalAvailable);
    this.modal.showPlayer();
  }

  openGuild(id) {
    const snapshot = this.state.get('snapshot');
    const guild = snapshot?.guilds.find((item) => item.id === String(id));
    if (!guild) return;
    $('#guild-modal-title').text(guild.name);
    const baseLocations = (guild.palBoxes || []).map((base) => `${base.name}: ${Math.round(base.x)}, ${Math.round(base.y)}`).join(' · ');
    $('#guild-summary').html(`<div class="detail-item"><small>公会等级</small><strong>${guild.level || '未知'}</strong></div><div class="detail-item"><small>成员数量</small><strong>${guild.memberIds.length}</strong></div><div class="detail-item"><small>据点数量</small><strong>${guild.palBoxes?.length || 0}</strong></div><div class="detail-item"><small>据点帕鲁</small><strong>${guild.activeBasePalCount || 0} / ${guild.basePalCount || 0} 活跃</strong></div>${baseLocations ? `<div class="detail-item span-2"><small>据点坐标</small><strong>${this.escape(baseLocations)}</strong></div>` : ''}`);
    $('#guild-members').html(guild.memberIds.map((uid) => {
      const player = snapshot.players.find((item) => item.uid === uid);
      return `<button data-player-id="${this.escape(uid)}"><span class="player-avatar">${this.escape((player?.name || '?')[0])}</span><span><strong>${this.escape(player?.name || uid)}</strong><small>${player?.online ? '在线' : `最后在线 ${this.time(player?.lastOnlineAt)}`}</small></span><i class="bi bi-chevron-right"></i></button>`;
    }).join('') || '<div class="empty-state"><strong>暂无成员缓存</strong></div>');
    this.modal.showGuild();
  }

  renderCollection(selector, source, label, dataSourceAvailable) {
    const values = Array.isArray(source) ? source : [];
    const render = (query = '', sort = 'name') => {
      let items = values.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
      items.sort(sort === 'count-desc' ? (a, b) => Number(b.count || b.quantity || 0) - Number(a.count || a.quantity || 0) : (a, b) => String(a.name || a.palName || a.itemName || '').localeCompare(String(b.name || b.palName || b.itemName || ''), 'zh-CN'));
      const emptyText = dataSourceAvailable ? `暂无${label}缓存` : `${label}数据源未配置`;
      $(`${selector} .collection-items`).html(items.length ? items.map((item) => `<article><i class="bi bi-${label === '帕鲁' ? 'stars' : 'box'}"></i><div><strong>${this.escape(item.name || item.palName || item.itemName || '未知')}${item.active ? ' · 跟随中' : ''}</strong><small>${this.escape(item.level ? `Lv.${item.level}${item.maxHp ? ` · HP ${item.hp}/${item.maxHp}` : ''}` : `数量 ${item.count || item.quantity || 1}`)}</small></div></article>`).join('') : `<div class="empty-state"><strong>${emptyText}</strong><span>${dataSourceAvailable ? '' : '请在服务器连接中设置扩展 JSON 路径'}</span></div>`);
    };
    $(selector).html(`<div class="collection-toolbar"><input class="form-control" placeholder="筛选${label}"><select class="form-select"><option value="name">按名称</option><option value="count-desc">按数量/等级</option></select></div><div class="collection-items"></div>`);
    $(`${selector} input, ${selector} select`).on('input change', () => render($(`${selector} input`).val(), $(`${selector} select`).val()));
    render();
  }

  playerComparator(sort) {
    if (sort === 'name') return (a, b) => a.name.localeCompare(b.name, 'zh-CN');
    if (sort === 'level-desc') return (a, b) => b.level - a.level;
    if (sort === 'ping') return (a, b) => (a.ping || Infinity) - (b.ping || Infinity);
    if (sort === 'lastOnline') return (a, b) => new Date(b.lastOnlineAt || 0) - new Date(a.lastOnlineAt || 0);
    return (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'zh-CN');
  }

  playerCard(player) {
    const initial = (player.name || '?').slice(0, 1).toUpperCase();
    return `<article class="player-card" data-player-id="${this.escape(player.uid)}">
      <div class="player-card-top">
        <span class="player-card-avatar">${this.escape(initial)}<i class="${player.online ? 'online' : ''}"></i></span>
        <div class="player-card-identity"><h3>${this.escape(player.name)}</h3><p><i class="bi bi-steam"></i>${this.escape(player.steamName || player.steam64 || '未绑定 Steam')}</p></div>
        <span class="status-badge ${player.online ? 'online' : ''}">${player.online ? '在线' : '离线'}</span>
      </div>
      <div class="player-level-row"><div><small>玩家等级</small><strong>Lv.${player.level || 0}</strong>${player.levelGainToday ? `<span class="level-gain">↑${player.levelGainToday}</span>` : ''}</div><span class="platform-pill"><i class="bi bi-${String(player.platform).toLowerCase().includes('steam') ? 'steam' : 'controller'}"></i>${this.escape(player.platform || '未知平台')}</span></div>
      <div class="player-card-stats"><div><small>Ping</small><strong>${player.ping ? `${player.ping} ms` : '—'}</strong></div><div><small>坐标</small><strong>${player.x || player.y ? `${player.x}, ${player.y}` : '—'}</strong></div><div><small>帕鲁</small><strong>${player.pals?.length || 0}</strong></div><div><small>物品</small><strong>${player.items?.length || 0}</strong></div></div>
      <div class="player-card-footer"><div><small>最后在线</small><strong>${this.time(player.lastOnlineAt)}</strong></div>${player.guildId ? `<button data-guild-id="${this.escape(player.guildId)}"><i class="bi bi-shield-shaded"></i>${this.escape(player.guildName || '查看公会')}</button>` : '<span class="no-guild">未加入公会</span>'}<i class="bi bi-arrow-up-right card-open-icon"></i></div>
    </article>`;
  }

  duration(seconds) { if (!seconds) return '—'; const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); return days ? `${days}天 ${hours}小时` : `${hours}小时 ${Math.floor(seconds % 3600 / 60)}分`; }
  time(value) { if (!value) return '未知'; return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
  emptyRow(columns, text) { return `<tr><td colspan="${columns}"><div class="empty-state"><i class="bi bi-search"></i><strong>${text}</strong></div></td></tr>`; }
  escape(value) { return $('<div>').text(String(value ?? '')).html(); }
  error(error) { return error instanceof Error ? error.message : String(error); }
};
