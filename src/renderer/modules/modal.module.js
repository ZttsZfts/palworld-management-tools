'use strict';

window.ModalModule = class ModalModule {
  constructor() {
    this.messageModal = new bootstrap.Modal('#message-modal');
    this.connectionModal = new bootstrap.Modal('#connection-modal');
    this.broadcastModal = new bootstrap.Modal('#broadcast-modal');
    this.playerModal = new bootstrap.Modal('#player-modal');
    this.guildModal = new bootstrap.Modal('#guild-modal');
  }

  message(title, body, icon = 'info-lg') {
    $('#message-title').text(title);
    $('#message-body').text(body);
    $('.message-icon i').attr('class', `bi bi-${icon}`);
    $('#message-confirm').addClass('d-none').off('click');
    this.messageModal.show();
  }

  confirm(title, body, onConfirm) {
    $('#message-title').text(title);
    $('#message-body').text(body);
    $('.message-icon i').attr('class', 'bi bi-exclamation-lg');
    $('#message-confirm').removeClass('d-none').off('click').one('click', async () => {
      this.messageModal.hide();
      await onConfirm();
    });
    this.messageModal.show();
  }

  toast(message) {
    $('#app-toast .toast-body').text(message);
    bootstrap.Toast.getOrCreateInstance('#app-toast', { delay: 2600 }).show();
  }

  showConnection(connection = null) {
    const form = $('#connection-form')[0];
    form.reset();
    form.elements.id.value = connection?.id || '';
    form.elements.name.value = connection?.name || '';
    form.elements.host.value = connection?.host || '';
    form.elements.restPort.value = connection?.restPort || 8212;
    form.elements.rconPort.value = connection?.rconPort || 25575;
    form.elements.username.value = connection?.username || 'admin';
    form.elements.password.value = connection?.password || '';
    form.elements.supplementalDataPath.value = connection?.supplementalDataPath || '';
    form.elements.useHttps.checked = Boolean(connection?.useHttps);
    $('#connection-modal .modal-title').text(connection ? '编辑服务器' : '添加服务器');
    this.connectionModal.show();
  }

  hideConnection() { this.connectionModal.hide(); }
  showBroadcast() { $('#broadcast-form')[0].reset(); this.broadcastModal.show(); }
  hideBroadcast() { this.broadcastModal.hide(); }
  showPlayer() { this.guildModal.hide(); this.playerModal.show(); }
  showGuild() { this.playerModal.hide(); this.guildModal.show(); }
};
