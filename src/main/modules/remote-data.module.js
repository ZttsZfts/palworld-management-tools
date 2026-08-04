'use strict';

/**
 * Aggregates two explicit data sources:
 * 1. Pocketpair's official REST API for live server/player information.
 * 2. Optional supplemental JSON for save-derived guild, Pal and inventory data.
 */
class RemoteDataModule {
  constructor(restClient, snapshotRepository, supplementalData, movementPaths) {
    this.restClient = restClient;
    this.snapshots = snapshotRepository;
    this.supplementalData = supplementalData;
    this.movementPaths = movementPaths;
  }

  async sync(connection) {
    const started = Date.now();
    const [infoResult, playersResult, metricsResult, supplemental] = await Promise.all([
      this.restClient.request(connection, { endpoint: '/info' }),
      this.restClient.request(connection, { endpoint: '/players' }),
      this.restClient.request(connection, { endpoint: '/metrics' }),
      this.supplementalData.read(connection)
    ]);
    const previous = await this.snapshots.get(connection.id);
    const officialPlayers = this.list(playersResult.data?.players).map((item) => this.officialPlayer(item, previous));
    const supplementalPlayers = new Map(this.list(supplemental.players).map((item) => [this.playerUid(item), item]));
    const liveIds = new Set(officialPlayers.map((player) => player.uid));

    const livePlayers = officialPlayers.map((player) => this.mergeSupplementalPlayer(player, supplementalPlayers.get(player.uid)));
    const cachedOffline = this.list(previous.players)
      .filter((player) => !liveIds.has(player.uid))
      .map((player) => this.mergeSupplementalPlayer({ ...player, online: false }, supplementalPlayers.get(player.uid)));
    const newOffline = this.list(supplemental.players)
      .filter((item) => !liveIds.has(this.playerUid(item)) && !cachedOffline.some((player) => player.uid === this.playerUid(item)))
      .map((item) => this.supplementalPlayer(item));
    const players = [...livePlayers, ...cachedOffline, ...newOffline];
    const guilds = supplemental.available
      ? this.list(supplemental.guilds).map((item) => this.guild(item, players))
      : this.list(previous.guilds);

    await this.movementPaths.record(connection.id, players);

    return this.snapshots.save(connection.id, {
      online: true,
      server: this.server(infoResult.data || {}, metricsResult.data || {}, Date.now() - started),
      players,
      guilds,
      capabilities: {
        officialRest: true,
        supplementalConfigured: supplemental.configured,
        supplementalAvailable: supplemental.available,
        supplementalSource: supplemental.source || '',
        supplementalError: supplemental.error || '',
        guilds: supplemental.available,
        pals: supplemental.available,
        items: supplemental.available
      }
    });
  }

  server(info, metrics, latency) {
    const fps = this.number(metrics.serverfps ?? metrics.serverFps ?? metrics.fps);
    const frameTime = this.number(metrics.serverframetime ?? metrics.frameTime ?? metrics.frametime);
    return {
      name: info.servername || info.serverName || info.name || 'Palworld Server',
      version: info.version || info.serverversion || info.serverVersion || '\u672a\u77e5',
      onlinePlayers: this.number(metrics.currentplayernum ?? metrics.currentPlayerNum ?? info.currentplayernum),
      maxPlayers: this.number(metrics.maxplayernum ?? metrics.maxPlayerNum ?? info.maxplayernum),
      uptimeSeconds: this.number(metrics.uptime ?? info.uptime),
      day: this.number(metrics.days ?? info.days),
      fps,
      frameTime: frameTime || (fps > 0 ? 1000 / fps : 0),
      latency,
      description: info.description || ''
    };
  }

  officialPlayer(item, previous) {
    const uid = this.playerUid(item);
    const cached = this.list(previous.players).find((player) => player.uid === uid) || {};
    const userId = String(item.userId || cached.userId || '');
    return {
      ...cached,
      uid,
      userId,
      name: item.name || cached.name || '\u672a\u77e5\u73a9\u5bb6',
      steamName: item.accountName || cached.steamName || '',
      level: this.number(item.level ?? cached.level),
      online: true,
      lastOnlineAt: new Date().toISOString(),
      platform: this.platformOf(userId, cached.platform),
      steam64: this.steam64Of(userId) || cached.steam64 || '',
      ip: item.ip || cached.ip || '',
      ping: this.number(item.ping ?? cached.ping),
      x: this.number(item.location_x ?? item.locationX ?? cached.x),
      y: this.number(item.location_y ?? item.locationY ?? cached.y),
      hasLocation: Number.isFinite(Number(item.location_x ?? item.locationX)) && Number.isFinite(Number(item.location_y ?? item.locationY)),
      buildingCount: this.number(item.building_count ?? cached.buildingCount),
      guildId: cached.guildId || '', guildName: cached.guildName || '',
      pals: this.list(cached.pals), items: this.list(cached.items)
    };
  }

  mergeSupplementalPlayer(player, extra) {
    if (!extra) return player;
    return {
      ...player,
      guildId: String(extra.guildId || extra.guild?.id || player.guildId || ''),
      guildName: extra.guildName || extra.guild?.name || player.guildName || '',
      pals: this.list(extra.pals || extra.palList || player.pals),
      items: this.list(extra.items || extra.inventory || player.items),
      steam64: String(extra.steam64 || player.steam64 || ''),
      platform: extra.platform || player.platform,
      lastOnlineAt: player.online ? player.lastOnlineAt : extra.lastOnlineAt || player.lastOnlineAt
    };
  }

  supplementalPlayer(item) {
    return this.mergeSupplementalPlayer({
      uid: this.playerUid(item), userId: String(item.userId || ''), name: item.name || '\u672a\u77e5\u73a9\u5bb6',
      steamName: item.accountName || item.steamName || '', level: this.number(item.level), online: false,
      lastOnlineAt: item.lastOnlineAt || null, platform: item.platform || this.platformOf(item.userId),
      steam64: String(item.steam64 || this.steam64Of(item.userId)), ip: item.ip || '', ping: 0,
      x: this.number(item.location_x ?? item.x), y: this.number(item.location_y ?? item.y),
      hasLocation: Number.isFinite(Number(item.location_x ?? item.x)) && Number.isFinite(Number(item.location_y ?? item.y)),
      pals: [], items: []
    }, item);
  }

  guild(item, players) {
    const id = String(item.id || item.guildId || item.groupId || '');
    const explicitMembers = this.list(item.memberIds || item.members).map((member) => String(member.uid || member.playerUid || member));
    return { id, name: item.name || item.guildName || '\u672a\u547d\u540d\u516c\u4f1a', level: this.number(item.level ?? item.guildLevel), memberIds: explicitMembers.length ? explicitMembers : players.filter((player) => player.guildId === id).map((player) => player.uid) };
  }

  playerUid(item) { return String(item?.playerId || item?.playeruid || item?.uid || ''); }
  steam64Of(userId) { const match = String(userId || '').match(/(?:steam_)?(\d{15,20})/i); return match ? match[1] : ''; }
  platformOf(userId, fallback = '') { const value = String(userId || '').toLowerCase(); return value.startsWith('steam_') ? 'Steam' : value.startsWith('xbox_') || value.startsWith('xuid_') ? 'Xbox' : fallback || '\u672a\u77e5'; }
  number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
  list(value) { return Array.isArray(value) ? value : []; }
}

module.exports = { RemoteDataModule };
