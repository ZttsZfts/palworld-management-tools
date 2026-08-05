'use strict';

/**
 * 汇总官方 REST 实时数据与存档扩展数据。
 * 两类数据各自保留边界，避免同名字段相互覆盖。
 */
class RemoteDataModule {
  constructor(restClient, snapshotRepository, supplementalData, movementPaths) {
    this.restClient = restClient;
    this.snapshots = snapshotRepository;
    this.supplementalData = supplementalData;
    this.movementPaths = movementPaths;
    this.gameDataBackoff = new Map();
  }

  async sync(connection) {
    const started = Date.now();
    const [infoResult, playersResult, metricsResult, supplemental, gameDataResult] = await Promise.all([
      this.restClient.request(connection, { endpoint: '/info' }),
      this.restClient.request(connection, { endpoint: '/players' }),
      this.restClient.request(connection, { endpoint: '/metrics' }),
      this.supplementalData.read(connection),
      // 未启用 Game Data 时仍要继续同步其他 REST 接口。
      this.getGameData(connection)
    ]);
    const previous = await this.snapshots.get(connection.id);
    const actorData = this.list(gameDataResult.data?.ActorData);
    const gamePlayers = actorData.filter((actor) => actor.Type === 'Character' && actor.UnitType === 'Player');
    const officialPlayers = this.list(playersResult.data?.players)
      .map((item) => this.officialPlayer(item, previous))
      .map((player) => this.mergeGamePlayer(player, this.findGamePlayer(player, gamePlayers)));
    const supplementalPlayers = new Map(this.list(supplemental.players).map((item) => [this.playerUid(item), item]));
    const liveIds = new Set(officialPlayers.map((player) => player.uid));

    const livePlayers = officialPlayers.map((player) => this.mergeSupplementalPlayer(player, supplementalPlayers.get(player.uid)));
    const cachedOffline = this.list(previous.players)
      .filter((player) => !liveIds.has(player.uid))
      .map((player) => ({ ...player, uid: this.normalizeId(player.uid), guildId: this.normalizeId(player.guildId) }))
      .filter((player) => !liveIds.has(player.uid))
      .map((player) => this.mergeSupplementalPlayer({ ...player, online: false }, supplementalPlayers.get(player.uid)));
    const newOffline = this.list(supplemental.players)
      .filter((item) => !liveIds.has(this.playerUid(item)) && !cachedOffline.some((player) => player.uid === this.playerUid(item)))
      .map((item) => this.supplementalPlayer(item));
    const players = this.deduplicatePlayers([...livePlayers, ...cachedOffline, ...newOffline].map((player) => {
      const actor = this.findGamePlayer(player, gamePlayers);
      return this.mergeGamePals(this.mergeGamePlayer(player, actor), actor, actorData);
    }));
    const guilds = (supplemental.available
      ? this.list(supplemental.guilds).map((item) => this.guild(item, players))
      : this.list(previous.guilds)).map((guild) => this.mergeGameGuild(guild, actorData));

    await this.movementPaths.record(connection.id, players);

    return this.snapshots.save(connection.id, {
      online: true,
      server: this.server(infoResult.data || {}, metricsResult.data || {}, Date.now() - started, gameDataResult.data || {}),
      players,
      guilds,
      capabilities: {
        officialRest: true,
        gameDataAvailable: Boolean(gameDataResult.data),
        gameDataError: gameDataResult.error?.message || '',
        gameDataActors: actorData.length,
        gameDataCounts: actorData.reduce((counts, actor) => {
          const key = actor.Type === 'PalBox' ? 'PalBox' : actor.UnitType || 'Unknown';
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {}),
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

  server(info, metrics, latency, gameData = {}) {
    const fps = this.number(gameData.FPS ?? metrics.serverfps ?? metrics.serverFps ?? metrics.fps);
    const frameTime = this.number(metrics.serverframetime ?? metrics.frameTime ?? metrics.frametime);
    return {
      name: info.servername || info.serverName || info.name || 'Palworld Server',
      version: info.version || info.serverversion || info.serverVersion || '\u672a\u77e5',
      onlinePlayers: this.number(metrics.currentplayernum ?? metrics.currentPlayerNum ?? info.currentplayernum),
      maxPlayers: this.number(metrics.maxplayernum ?? metrics.maxPlayerNum ?? info.maxplayernum),
      uptimeSeconds: this.number(metrics.uptime ?? info.uptime),
      day: this.number(metrics.days ?? info.days),
      fps,
      averageFps: this.number(gameData.AverageFPS),
      frameTime: frameTime || (fps > 0 ? 1000 / fps : 0),
      latency,
      description: info.description || ''
    };
  }

  async getGameData(connection) {
    const retryAt = this.gameDataBackoff.get(connection.id) || 0;
    if (retryAt > Date.now()) return { data: null, error: new Error('Game Data API 未启用，稍后自动重试') };
    try {
      const result = await this.restClient.request(connection, { endpoint: '/game-data' });
      this.gameDataBackoff.delete(connection.id);
      return result;
    } catch (error) {
      // 接口不可用时暂停探测一分钟，避免每轮同步都等待超时。
      this.gameDataBackoff.set(connection.id, Date.now() + 60000);
      return { data: null, error };
    }
  }

  officialPlayer(item, previous) {
    const uid = this.playerUid(item);
    const cached = this.list(previous.players).find((player) => this.normalizeId(player.uid) === uid) || {};
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
      guildId: this.normalizeId(cached.guildId), guildName: cached.guildName || '',
      pals: this.list(cached.pals), items: this.list(cached.items)
    };
  }

  mergeSupplementalPlayer(player, extra) {
    if (!extra) return player;
    return {
      ...player,
      guildId: this.normalizeId(extra.guildId || extra.guild?.id || player.guildId),
      guildName: extra.guildName || extra.guild?.name || player.guildName || '',
      pals: this.list(extra.pals || extra.palList || player.pals),
      items: this.list(extra.items || extra.inventory || player.items),
      steam64: String(extra.steam64 || player.steam64 || ''),
      platform: extra.platform || player.platform,
      lastOnlineAt: player.online ? player.lastOnlineAt : extra.lastOnlineAt || player.lastOnlineAt
    };
  }

  mergeGamePlayer(player, actor) {
    if (!actor) return player;
    const hasLocation = Number.isFinite(Number(actor.LocationX)) && Number.isFinite(Number(actor.LocationY));
    return {
      ...player,
      name: actor.NickName || player.name,
      level: this.number(actor.level ?? player.level),
      ip: actor.ip || player.ip,
      guildId: this.normalizeId(actor.GuildID || player.guildId),
      guildName: actor.GuildName || player.guildName || '',
      instanceId: actor.InstanceID || player.instanceId || '',
      x: hasLocation ? this.number(actor.LocationX) : player.x,
      y: hasLocation ? this.number(actor.LocationY) : player.y,
      z: Number.isFinite(Number(actor.LocationZ)) ? this.number(actor.LocationZ) : player.z,
      hasLocation: hasLocation || player.hasLocation,
      gameDataActive: String(actor.IsActive).toLowerCase() === 'true',
      hp: this.number(actor.HP),
      maxHp: this.number(actor.MaxHP),
      rotation: this.number(actor.RotationZ),
      action: actor.Action || '',
      stage: actor.Stage || ''
    };
  }

  findGamePlayer(player, actors) {
    const userId = String(player.userId || '').toLowerCase();
    const instanceId = String(player.instanceId || '').toLowerCase();
    return actors.find((actor) => {
      if (userId && String(actor.userid || '').toLowerCase() === userId) return true;
      if (instanceId && String(actor.InstanceID || '').toLowerCase() === instanceId) return true;
      return player.name && actor.NickName === player.name;
    });
  }

  mergeGamePals(player, playerActor, actors) {
    if (!playerActor) return player;
    const live = actors.filter((actor) => actor.UnitType === 'OtomoPal' && actor.TrainerInstanceID === playerActor.InstanceID);
    const pals = this.list(player.pals).map((pal) => ({ ...pal }));
    for (const actor of live) {
      const id = this.actorGuid(actor.InstanceID);
      const existing = pals.find((pal) => this.normalizeId(pal.id) === id);
      const value = {
        id,
        name: actor.NickName || existing?.name || '未知帕鲁', level: this.number(actor.level), active: true,
        hp: this.number(actor.HP), maxHp: this.number(actor.MaxHP),
        x: this.number(actor.LocationX), y: this.number(actor.LocationY), z: this.number(actor.LocationZ),
        action: actor.Action || '', className: actor.Class || ''
      };
      if (existing) Object.assign(existing, value);
      else pals.push(value);
    }
    return { ...player, pals, activePalCount: live.length };
  }

  mergeGameGuild(guild, actors) {
    const id = this.normalizeId(guild.id);
    const basePals = actors.filter((actor) => actor.UnitType === 'BaseCampPal' && this.normalizeId(actor.GuildID) === id);
    const palBoxes = actors.filter((actor) => actor.Type === 'PalBox' && this.normalizeId(actor.GuildID) === id);
    return {
      ...guild, id, memberIds: this.list(guild.memberIds).map((uid) => this.normalizeId(uid)),
      basePalCount: basePals.length,
      activeBasePalCount: basePals.filter((actor) => String(actor.IsActive).toLowerCase() === 'true').length,
      palBoxes: palBoxes.map((actor) => ({ name: actor.Name || '据点终端', x: this.number(actor.LocationX), y: this.number(actor.LocationY), z: this.number(actor.LocationZ) }))
    };
  }

  deduplicatePlayers(source) {
    const result = [];
    const identities = new Map();
    for (const player of source) {
      const aliases = this.playerAliases(player);
      const index = aliases.map((alias) => identities.get(alias)).find((value) => value !== undefined);
      if (index === undefined) {
        const nextIndex = result.push(player) - 1;
        for (const alias of aliases) identities.set(alias, nextIndex);
        continue;
      }
      result[index] = this.mergePlayerRecords(result[index], player);
      for (const alias of this.playerAliases(result[index])) identities.set(alias, index);
    }
    return result;
  }

  playerAliases(player) {
    const aliases = [];
    const steam64 = String(player.steam64 || this.steam64Of(player.userId) || '');
    const userId = String(player.userId || '').trim().toLowerCase();
    const uid = this.normalizeId(player.uid);
    const instanceId = this.actorGuid(player.instanceId);
    if (steam64) aliases.push(`steam:${steam64}`);
    if (userId && userId !== 'none') aliases.push(`user:${userId}`);
    if (uid && uid !== 'none' && uid !== this.normalizeId('00000000-0000-0000-0000-000000000000')) aliases.push(`uid:${uid}`);
    if (instanceId && instanceId !== 'none') aliases.push(`instance:${instanceId}`);
    // 只有在记录缺少稳定标识时才按名称匹配，尽量避免合并同名玩家。
    if (!aliases.length && player.name) aliases.push(`name:${String(player.name).trim().toLowerCase()}`);
    return aliases;
  }

  mergePlayerRecords(left, right) {
    const primary = right.online && !left.online ? right : left;
    const secondary = primary === left ? right : left;
    const value = { ...secondary, ...primary, online: Boolean(left.online || right.online) };
    const fields = ['uid', 'userId', 'steam64', 'name', 'steamName', 'platform', 'ip', 'guildId', 'guildName', 'instanceId', 'lastOnlineAt'];
    for (const field of fields) {
      const current = value[field];
      if (!current || current === 'none' || current === '未知玩家') value[field] = secondary[field] || primary[field] || '';
    }
    if (!value.uid || value.uid === 'none') value.uid = this.normalizeId(left.uid !== 'none' ? left.uid : right.uid);
    value.pals = this.mergeCollections(left.pals, right.pals, ['id', 'characterId', 'name']);
    value.items = this.mergeCollections(left.items, right.items, ['id', 'itemId', 'name', 'itemName']);
    value.level = Math.max(this.number(left.level), this.number(right.level));
    return value;
  }

  mergeCollections(left, right, keys) {
    const values = [];
    const seen = new Map();
    for (const item of [...this.list(left), ...this.list(right)]) {
      const key = keys.map((name) => item?.[name]).find(Boolean) || JSON.stringify(item);
      if (seen.has(key)) Object.assign(values[seen.get(key)], item);
      else { seen.set(key, values.length); values.push({ ...item }); }
    }
    return values;
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
    const id = this.normalizeId(item.id || item.guildId || item.groupId);
    const explicitMembers = this.list(item.memberIds || item.members).map((member) => this.normalizeId(member.uid || member.playerUid || member));
    return { id, name: item.name || item.guildName || '\u672a\u547d\u540d\u516c\u4f1a', level: this.number(item.level ?? item.guildLevel), memberIds: explicitMembers.length ? explicitMembers : players.filter((player) => player.guildId === id).map((player) => player.uid) };
  }

  playerUid(item) { return this.normalizeId(item?.playerId || item?.playeruid || item?.uid); }
  normalizeId(value) { return String(value || '').replace(/-/g, '').toLowerCase(); }
  actorGuid(value) { return this.normalizeId(String(value || '').split(':').at(-1).trim()); }
  steam64Of(userId) { const match = String(userId || '').match(/(?:steam_)?(\d{15,20})/i); return match ? match[1] : ''; }
  platformOf(userId, fallback = '') { const value = String(userId || '').toLowerCase(); return value.startsWith('steam_') ? 'Steam' : value.startsWith('xbox_') || value.startsWith('xuid_') ? 'Xbox' : fallback || '\u672a\u77e5'; }
  number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
  list(value) { return Array.isArray(value) ? value : []; }
}

module.exports = { RemoteDataModule };
