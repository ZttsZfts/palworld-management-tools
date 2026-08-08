'use strict';

$(() => {
  const application = new window.ApplicationModule();
  application.initialize().catch((error) => application.modal.message('初始化失败', error.message || String(error), 'x-lg'));
});
