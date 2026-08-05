'use strict';

const movementModuleUrl = document.currentScript.src;

/** 在校准后的世界地图上绘制玩家移动轨迹。 */
window.MovementModule = class MovementModule {
  constructor(api, state, modal) {
    this.api = api;
    this.state = state;
    this.modal = modal;
    this.result = null;
    this.loading = false;
    this.resizeObserver = null;
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.drag = null;
    this.mapImage = new Image();
    this.mapReady = false;
    this.mapUrl = new URL('../assets/images/maps/palworld-world-map-display-8192.webp', movementModuleUrl).href;
    this.world = { minX: -1099400, maxX: 349400, minY: -724400, maxY: 724400 };
  }

  register() {
    $('[data-page="movement"]').on('click', () => setTimeout(() => this.load(), 0));
    $('[data-action="refresh-movement"]').on('click', () => this.load(true));
    $('#movement-range, #jump-distance').on('change', () => this.load());
    $('#movement-player-list').on('change', 'input', () => this.load());
    $('#movement-player-search').on('input', (event) => this.filterPlayerList(event.target.value));
    $('[data-movement-zoom]').on('click', (event) => this.zoomBy(Number($(event.currentTarget).data('movement-zoom'))));
    $('[data-action="reset-movement-view"]').on('click', () => this.resetView());

    const canvas = $('#movement-canvas')[0];
    this.mapImage.onload = () => { this.mapReady = true; this.drawCurrent(); };
    this.mapImage.onerror = () => $('#movement-meta').text('地图底图加载失败');
    this.mapImage.src = this.mapUrl;
    canvas.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    canvas.addEventListener('pointerdown', (event) => this.startPan(event));
    canvas.addEventListener('pointermove', (event) => this.movePan(event));
    canvas.addEventListener('pointerup', (event) => this.endPan(event));
    canvas.addEventListener('pointercancel', (event) => this.endPan(event));
    canvas.addEventListener('dblclick', () => this.resetView());
    $(document).on('connection:changed', () => {
      this.result = null;
      this.renderPlayerList();
      if (this.state.get('activePage') === 'movement') this.load();
    });
    $(document).on('snapshot:updated', () => {
      this.renderPlayerList();
      if (this.state.get('activePage') === 'movement') this.load();
    });
    this.resizeObserver = new ResizeObserver(() => this.drawCurrent());
    this.resizeObserver.observe(canvas);
  }

  async load(showFeedback = false) {
    const connection = this.state.getActiveConnection();
    if (!connection || this.loading) { this.drawCurrent(); return; }
    this.loading = true;
    $('[data-action="refresh-movement"] i').addClass('spin');
    try {
      this.renderPlayerList();
      const range = Number($('#movement-range').val()) || 86400000;
      const playerIds = $('#movement-player-list input:checked').map((_index, element) => element.value).get();
      const players = (this.state.get('snapshot')?.players || []).map((player) => ({
        uid: player.uid,
        userId: player.userId,
        steam64: player.steam64,
        name: player.name
      }));
      this.result = await this.api.movement.get({
        connectionId: connection.id,
        since: Date.now() - range,
        playerIds,
        players,
        jumpDistance: Math.max(100, Number($('#jump-distance').val()) || 1000),
        maxJumpSeconds: Math.max(15, (Number(connection.syncIntervalSeconds) || 3) * 2.5)
      });
      this.drawCurrent();
      if (showFeedback) this.modal.toast('移动轨迹已刷新');
    } catch (error) {
      this.modal.message('轨迹读取失败', error.message || String(error), 'map');
    } finally {
      this.loading = false;
      $('[data-action="refresh-movement"] i').removeClass('spin');
    }
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

  drawCurrent() {
    this.draw(this.result || { paths: [], totalPoints: 0, truncatedToFiveMinutes: false });
  }

  draw(result) {
    const canvas = $('#movement-canvas')[0];
    const wrapper = canvas.parentElement;
    const width = Math.max(300, wrapper.clientWidth);
    const height = Math.max(420, wrapper.clientHeight);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const mapSize = Math.max(1, Math.min(width, height) - 24);
    const mapLeft = (width - mapSize) / 2;
    const mapTop = (height - mapSize) / 2;
    const applyView = (x, y) => ({
      x: (x - width / 2) * this.view.zoom + width / 2 + this.view.panX,
      y: (y - height / 2) * this.view.zoom + height / 2 + this.view.panY
    });
    const project = (point) => {
      const horizontal = (Number(point.y) - this.world.minY) / (this.world.maxY - this.world.minY);
      const vertical = (this.world.maxX - Number(point.x)) / (this.world.maxX - this.world.minX);
      return applyView(mapLeft + horizontal * mapSize, mapTop + vertical * mapSize);
    };

    this.drawMap(context, applyView, mapLeft, mapTop, mapSize);
    const paths = Array.isArray(result.paths) ? result.paths : [];
    const valid = (point) => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
    const allPoints = paths.flatMap((pathItem) => pathItem.points || []).filter(valid);
    $('#movement-empty').toggleClass('d-none', allPoints.length > 0);
    if (!allPoints.length) {
      $('#movement-legend').empty();
      if (this.mapReady) $('#movement-meta').text('地图已就绪，当前时间范围内没有坐标记录');
      return;
    }

    for (const pathItem of paths) {
      const points = (pathItem.points || []).filter(valid);
      if (!points.length) continue;
      const hue = this.hue(pathItem.uid);
      for (let index = 1; index < points.length; index += 1) {
        const from = project(points[index - 1]);
        const to = project(points[index]);
        const progress = index / Math.max(1, points.length - 1);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.strokeStyle = `hsla(${hue},90%,${78 - progress * 25}%,${0.45 + progress * 0.5})`;
        context.lineWidth = 1.8 + progress * 1.8;
        context.lineCap = 'round';
        context.stroke();
      }
      for (const anomaly of pathItem.anomalies || []) this.drawAnomaly(context, project(anomaly.from), project(anomaly.to));
      this.drawPlayer(context, project(points.at(-1)), pathItem.name, hue);
    }

    const anomalyCount = paths.reduce((sum, item) => sum + (item.anomalies?.length || 0), 0);
    $('#movement-meta').text(`${paths.length} 名玩家 · ${allPoints.length.toLocaleString()} 个绘制点 · ${anomalyCount} 个异常片段`);
    $('#movement-performance-note').toggleClass('warning', result.truncatedToFiveMinutes).find('span').text(result.truncatedToFiveMinutes ? '数据量过大，已自动显示全部玩家最近5分钟；选择玩家可读取更长范围' : `主进程已抽样，原始范围共 ${Number(result.totalPoints || 0).toLocaleString()} 点`);
    $('#movement-legend').html(paths.map((item) => `<span><i style="--path-color:hsl(${this.hue(item.uid)} 72% 60%)"></i>${this.escape(item.name)}</span>`).join(''));
    $('#movement-zoom-value').text(`${Math.round(this.view.zoom * 100)}%`);
  }

  drawMap(context, applyView, mapLeft, mapTop, mapSize) {
    const topLeft = applyView(mapLeft, mapTop);
    const size = mapSize * this.view.zoom;
    context.fillStyle = '#071019';
    context.fillRect(topLeft.x, topLeft.y, size, size);
    if (this.mapReady) context.drawImage(this.mapImage, topLeft.x, topLeft.y, size, size);
  }

  drawPlayer(context, point, name, hue) {
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fillStyle = `hsl(${hue} 82% 55%)`;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = '#fff';
    context.stroke();
    context.font = '600 11px system-ui, sans-serif';
    const label = String(name || '玩家');
    const textWidth = context.measureText(label).width;
    context.fillStyle = 'rgba(5,10,16,.86)';
    context.fillRect(point.x + 10, point.y - 12, textWidth + 10, 20);
    context.fillStyle = '#fff';
    context.fillText(label, point.x + 15, point.y + 3);
  }

  handleWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const oldZoom = this.view.zoom;
    const newZoom = Math.min(20, Math.max(0.5, oldZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const ratio = newZoom / oldZoom;
    this.view.panX = anchorX - rect.width / 2 - (anchorX - rect.width / 2 - this.view.panX) * ratio;
    this.view.panY = anchorY - rect.height / 2 - (anchorY - rect.height / 2 - this.view.panY) * ratio;
    this.view.zoom = newZoom;
    this.drawCurrent();
  }

  zoomBy(factor) {
    if (!Number.isFinite(factor)) return;
    this.view.zoom = Math.min(20, Math.max(0.5, this.view.zoom * factor));
    this.drawCurrent();
  }

  resetView() {
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.drawCurrent();
  }

  startPan(event) {
    if (event.button !== 0) return;
    this.drag = { x: event.clientX, y: event.clientY, panX: this.view.panX, panY: this.view.panY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-panning');
  }

  movePan(event) {
    if (!this.drag) return;
    this.view.panX = this.drag.panX + event.clientX - this.drag.x;
    this.view.panY = this.drag.panY + event.clientY - this.drag.y;
    this.drawCurrent();
  }

  endPan(event) {
    if (!this.drag) return;
    this.drag = null;
    event.currentTarget.classList.remove('is-panning');
  }

  drawAnomaly(context, from, to) {
    context.strokeStyle = '#ff5d73';
    context.lineWidth = 2;
    for (const point of [from, to]) {
      context.beginPath(); context.arc(point.x, point.y, 9, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255,93,115,.14)'; context.fill(); context.stroke();
      context.beginPath(); context.arc(point.x, point.y, 3, 0, Math.PI * 2);
      context.fillStyle = '#ff5d73'; context.fill();
    }
    context.setLineDash([4, 5]);
    context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
    context.setLineDash([]);
  }

  hue(value) {
    let hash = 0;
    for (const character of String(value)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return hash % 360;
  }

  escape(value) { return $('<div>').text(String(value ?? '')).html(); }
};
