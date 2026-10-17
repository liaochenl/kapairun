/* 启动入口。 */
(function () {
  'use strict';
  if (window.TA_UI_INTERNAL && typeof window.TA_UI_INTERNAL.init === 'function') {
    window.TA_UI_INTERNAL.init();
  } else {
    document.getElementById('app').innerHTML =
      '<div class="empty-state">学院没有响应。请确认 js/ 下的脚本都已加载。</div>';
  }
})();
