'use strict';

window.NavigationModule = class NavigationModule {
  constructor(state) {
    this.state = state;
    this.titles = { dashboard: '服务器概览', servers: '服务器', players: '玩家档案', guilds: '公会', movement: '玩家移动轨迹', console: 'RCON 控制台', backups: '备份', settings: '设置' };
  }

  register() {
    $('[data-page], [data-navigate]').on('click', (event) => {
      this.navigate($(event.currentTarget).data('page') || $(event.currentTarget).data('navigate'));
    });
  }

  navigate(page) {
    $('.nav-item').toggleClass('active', false).filter(`[data-page="${page}"]`).addClass('active');
    $('.app-page').removeClass('active').filter(`[data-page-panel="${page}"]`).addClass('active');
    $('#page-title').text(this.titles[page] || '幻兽帕鲁管理工具');
    this.state.set('activePage', page);
    $('.workspace').scrollTop(0);
  }
};
