'use strict';

/** Canvas-based movement path viewer with server-side filtering/downsampling. */
window.MovementModule = class MovementModule {
  constructor(api, state, modal) {
    this.api = api;
    this.state = state;
    this.modal = modal;
    this.result = null;
    this.loading = false;
    this.resizeObserver = null;
  }

  register() {
    $('[data-page="movement"]').on('click', () => setTimeout(() => this.load(), 0));
    $('[data-action="refresh-movement"]').on('click', () => this.load(true));
    $('#movement-range, #jump-distance').on('change', () => this.load());
    $('#movement-player-list').on('change', 'input', () => this.load());
    $('#movement-player-search').on('input', (event) => this.filterPlayerList(event.target.value));
    $(document).on('connection:changed', () => { this.result = null; this.renderPlayerList(); if (this.state.get('activePage') === 'movement') this.load(); });
    $(document).on('snapshot:updated', () => { this.renderPlayerList(); if (this.state.get('activePage') === 'movement') this.load(); });
    this.resizeObserver = new ResizeObserver(() => { if (this.result) this.draw(this.result); });
    this.resizeObserver.observe($('#movement-canvas')[0]);
  }

  async load(showFeedback = false) {
    const connection = this.state.getActiveConnection();
    if (!connection || this.loading) return;
    this.loading = true;
    $('[data-action="refresh-movement"] i').addClass('spin');
    try {
      this.renderPlayerList();
      const range = Number($('#movement-range').val()) || 86400000;
      const playerIds = $('#movement-player-list input:checked').map((_index, element) => element.value).get();
      this.result = await this.api.movement.get({
        connectionId: connection.id,
        since: Date.now() - range,
        playerIds,
        jumpDistance: Math.max(100, Number($('#jump-distance').val()) || 1000),
        maxJumpSeconds: Math.max(15, (Number(connection.syncIntervalSeconds) || 3) * 2.5)
      });
      this.draw(this.result);
      if (showFeedback) this.modal.toast('移动轨迹已刷新');
    } catch (error) { this.modal.message('轨迹读取失败', error.message || String(error), 'map'); }
    finally { this.loading = false; $('[data-action="refresh-movement"] i').removeClass('spin'); }
  }

  renderPlayerList() {
    const players = this.state.get('snapshot')?.players || [];
    const checked = new Set($('#movement-player-list input:checked').map((_index, element) => element.value).get());
    $('#movement-player-list').html(players.map((player) => `<label data-search="${this.escape(`${player.name} ${player.uid}`).toLowerCase()}"><input class="form-check-input" type="checkbox" value="${this.escape(player.uid)}" ${checked.has(player.uid) ? 'checked' : ''}><span class="path-color" style="--path-color:hsl(${this.hue(player.uid)} 72% 60%)"></span><span>${this.escape(player.name)}</span><small>${player.online ? '在线' : '离线'}</small></label>`).join('') || '<div class="empty-state py-4"><small>暂无玩家</small></div>');
  }

  filterPlayerList(query) {
    const value = String(query || '').trim().toLowerCase();
    $('#movement-player-list label').each((_index, element) => $(element).toggle(!value || $(element).data('search').includes(value)));
  }

  draw(result) {
    const canvas = $('#movement-canvas')[0];
    const wrapper = canvas.parentElement;
    const width = Math.max(300, wrapper.clientWidth);
    const height = Math.max(420, wrapper.clientHeight);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const allPoints = result.paths.flatMap((pathItem) => pathItem.points);
    $('#movement-empty').toggleClass('d-none', allPoints.length > 0);
    if (!allPoints.length) { $('#movement-legend').empty(); $('#movement-meta').text('当前时间范围内没有坐标记录'); return; }

    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const point of allPoints) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
    if (maxX === minX) { minX -= 1; maxX += 1; } if (maxY === minY) { minY -= 1; maxY += 1; }
    const padding = 42; const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2; const offsetY = (height - (maxY - minY) * scale) / 2;
    const project = (point) => ({ x: offsetX + (point.x - minX) * scale, y: height - offsetY - (point.y - minY) * scale });
    this.drawGrid(context, width, height);

    for (const pathItem of result.paths) {
      const hue = this.hue(pathItem.uid);
      for (let index = 1; index < pathItem.points.length; index += 1) {
        const from = project(pathItem.points[index - 1]); const to = project(pathItem.points[index]); const progress = index / Math.max(1, pathItem.points.length - 1);
        context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y);
        context.strokeStyle = `hsla(${hue},72%,${78 - progress * 26}%,${0.28 + progress * 0.72})`;
        context.lineWidth = 1.2 + progress * 1.4; context.lineCap = 'round'; context.stroke();
      }
      for (const anomaly of pathItem.anomalies) this.drawAnomaly(context, project(anomaly.from), project(anomaly.to));
      const latest = project(pathItem.points.at(-1)); context.beginPath(); context.arc(latest.x, latest.y, 4, 0, Math.PI * 2); context.fillStyle = `hsl(${hue} 78% 58%)`; context.fill();
    }

    const anomalyCount = result.paths.reduce((sum, item) => sum + item.anomalies.length, 0);
    $('#movement-meta').text(`${result.paths.length} 名玩家 · ${allPoints.length.toLocaleString()} 个绘制点 · ${anomalyCount} 个异常片段`);
    $('#movement-performance-note').toggleClass('warning', result.truncatedToFiveMinutes).find('span').text(result.truncatedToFiveMinutes ? '数据量过大，已自动显示全部玩家最近5分钟；选择玩家可读取更长范围' : `主进程已抽样，原始范围共 ${result.totalPoints.toLocaleString()} 点`);
    $('#movement-legend').html(result.paths.map((item) => `<span><i style="--path-color:hsl(${this.hue(item.uid)} 72% 60%)"></i>${this.escape(item.name)}</span>`).join(''));
  }

  drawGrid(context, width, height) {
    context.strokeStyle = 'rgba(104,122,148,.10)'; context.lineWidth = 1;
    for (let x = 30; x < width; x += 60) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 30; y < height; y += 60) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  }

  drawAnomaly(context, from, to) {
    context.strokeStyle = '#ff5d73'; context.lineWidth = 2;
    for (const point of [from, to]) { context.beginPath(); context.arc(point.x, point.y, 9, 0, Math.PI * 2); context.fillStyle = 'rgba(255,93,115,.14)'; context.fill(); context.stroke(); context.beginPath(); context.arc(point.x, point.y, 3, 0, Math.PI * 2); context.fillStyle = '#ff5d73'; context.fill(); }
    context.setLineDash([4, 5]); context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke(); context.setLineDash([]);
  }

  hue(value) { let hash = 0; for (const character of String(value)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; return hash % 360; }
  escape(value) { return $('<div>').text(String(value ?? '')).html(); }
};
