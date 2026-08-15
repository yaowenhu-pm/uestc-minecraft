/* 电子科大 Minecraft 地图 · 第三人称小人 + 虚拟摇杆
 * 左下摇杆移动/转向，右下按钮升降（飞行），贴地自动跟随地形。
 * 依赖 BlueMap webapp 暴露的 window.bluemap。
 */
(function () {
  'use strict';

  var WALK_DISTANCE = 42;    // 第三人称镜头距离
  var WALK_ANGLE = 1.18;     // 镜头俯仰（接近平视）
  var SPEED = 26;            // 移动速度 方块/秒
  var TURN = 2.4;            // 转向速度 弧度/秒
  var FLY_SPEED = 18;        // 垂直速度 方块/秒
  var EYE = 2;               // 目标点离地高度

  function ready(fn) {
    if (window.bluemap && window.bluemap.mapViewer &&
        window.bluemap.mapViewer.controlsManager) { fn(); }
    else { setTimeout(function () { ready(fn); }, 400); }
  }

  ready(function () {
    var bm = window.bluemap;
    var cm = bm.mapViewer.controlsManager;

    /* ---------- 像素小人（背影） ---------- */
    var av = document.createElement('canvas');
    av.width = 16; av.height = 32;
    var g = av.getContext('2d');
    function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    // 头发+头（背面全是头发）
    px(4, 0, 8, 8, '#5a3a22');
    px(4, 6, 8, 2, '#4a2f1b');
    // 身体（蓝绿上衣）
    px(4, 8, 8, 12, '#009393');
    px(4, 8, 8, 2, '#007a7a');
    // 手臂（袖子+皮肤）
    px(1, 8, 3, 8, '#009393');
    px(12, 8, 3, 8, '#009393');
    px(1, 16, 3, 4, '#c98e6d');
    px(12, 16, 3, 4, '#c98e6d');
    // 裤子
    px(4, 20, 8, 9, '#3c4a9c');
    px(4, 20, 1, 9, '#333f85');
    // 鞋
    px(4, 29, 3, 3, '#6b6b6b');
    px(9, 29, 3, 3, '#6b6b6b');

    var avatar = document.createElement('div');
    avatar.style.cssText = 'position:fixed;left:50%;top:50%;pointer-events:none;' +
      'z-index:900;display:none;transform:translate(-50%,-58%);';
    var shadow = document.createElement('div');
    shadow.style.cssText = 'width:52px;height:14px;border-radius:50%;' +
      'background:rgba(0,0,0,0.3);margin:-6px auto 0;';
    av.style.cssText = 'width:64px;height:128px;image-rendering:pixelated;display:block;margin:0 auto;';
    avatar.appendChild(av); avatar.appendChild(shadow);
    document.body.appendChild(avatar);

    /* ---------- 左下摇杆 ---------- */
    var base = document.createElement('div');
    base.style.cssText = 'position:fixed;left:22px;bottom:26px;width:118px;height:118px;' +
      'border-radius:50%;background:rgba(0,0,0,0.28);border:2px solid rgba(255,255,255,0.35);' +
      'z-index:1000;touch-action:none;display:none;';
    var knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;' +
      'border-radius:50%;background:rgba(255,255,255,0.75);transform:translate(-50%,-50%);' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    base.appendChild(knob);
    document.body.appendChild(base);

    var joy = { x: 0, y: 0, active: false };
    function setKnob(dx, dy) {
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    }
    function joyHandler(e) {
      var r = base.getBoundingClientRect();
      var t = (e.touches && e.touches[0]) || e;
      var dx = t.clientX - (r.left + r.width / 2);
      var dy = t.clientY - (r.top + r.height / 2);
      var max = r.width / 2 - 10;
      var len = Math.hypot(dx, dy);
      if (len > max) { dx *= max / len; dy *= max / len; }
      joy.x = dx / max; joy.y = dy / max;
      setKnob(dx, dy);
    }
    base.addEventListener('pointerdown', function (e) {
      joy.active = true; base.setPointerCapture(e.pointerId); joyHandler(e); e.preventDefault();
    });
    base.addEventListener('pointermove', function (e) { if (joy.active) { joyHandler(e); e.preventDefault(); } });
    function joyEnd() { joy.active = false; joy.x = 0; joy.y = 0; setKnob(0, 0); }
    base.addEventListener('pointerup', joyEnd);
    base.addEventListener('pointercancel', joyEnd);

    /* ---------- 右下升降钮 ---------- */
    function makeBtn(bottom, label) {
      var b = document.createElement('div');
      b.style.cssText = 'position:fixed;right:26px;bottom:' + bottom + 'px;width:58px;height:58px;' +
        'border-radius:50%;background:rgba(0,0,0,0.28);border:2px solid rgba(255,255,255,0.35);' +
        'color:#fff;font:700 22px/54px sans-serif;text-align:center;z-index:1000;' +
        'touch-action:none;user-select:none;-webkit-user-select:none;display:none;';
      b.textContent = label;
      document.body.appendChild(b);
      return b;
    }
    var btnUp = makeBtn(96, '上');
    var btnDown = makeBtn(26, '下');
    var vert = 0;
    function bindHold(btn, v) {
      btn.addEventListener('pointerdown', function (e) {
        vert = v; btn.setPointerCapture(e.pointerId);
        btn.style.background = 'rgba(255,255,255,0.45)'; e.preventDefault();
      });
      function end() { if (vert === v) vert = 0; btn.style.background = 'rgba(0,0,0,0.28)'; }
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
    }
    bindHold(btnUp, 1); bindHold(btnDown, -1);

    /* ---------- 走/飞模式开关 ---------- */
    var toggle = document.createElement('div');
    toggle.style.cssText = 'position:fixed;left:22px;bottom:158px;padding:7px 14px;' +
      'border-radius:16px;background:rgba(0,0,0,0.45);color:#fff;font:600 13px sans-serif;' +
      'z-index:1000;cursor:pointer;user-select:none;-webkit-user-select:none;';
    toggle.textContent = '小人模式';
    document.body.appendChild(toggle);

    var on = false, flying = false, playerY = 0;
    toggle.addEventListener('click', function () {
      on = !on;
      toggle.textContent = on ? '退出小人' : '小人模式';
      toggle.style.background = on ? 'rgba(0,147,147,0.8)' : 'rgba(0,0,0,0.45)';
      var d = on ? 'block' : 'none';
      base.style.display = d; btnUp.style.display = d; btnDown.style.display = d;
      avatar.style.display = d;
      if (on) {
        flying = false;
        cm.distance = WALK_DISTANCE;
        cm.angle = WALK_ANGLE;
        var gy = groundY();
        playerY = (gy !== null ? gy : cm.position.y - EYE) + EYE;
        cm.position.y = playerY;
      }
    });

    function groundY() {
      try {
        var h = bm.mapViewer.map.terrainHeightAt(cm.position.x, cm.position.z);
        if (typeof h === 'number' && isFinite(h)) return h;
      } catch (e) {}
      return null;
    }

    /* ---------- 主循环 ---------- */
    var last = performance.now(), bob = 0;
    function loop(t) {
      var dt = Math.min((t - last) / 1000, 0.1); last = t;
      if (on) {
        // 左右推 = 转向
        if (Math.abs(joy.x) > 0.15) cm.rotation -= joy.x * TURN * dt;
        // 前后推 = 沿朝向移动
        var fwd = -joy.y;
        if (Math.abs(fwd) > 0.12) {
          var r = cm.rotation;
          cm.position.x += -Math.sin(r) * fwd * SPEED * dt;
          cm.position.z += -Math.cos(r) * fwd * SPEED * dt;
          bob += dt * 10;
        }
        // 升降与贴地。BlueMap 默认控件每帧会把 y 拉向地形，
        // 所以我们自己维护 playerY，并在每帧末尾强制写入，后写者生效。
        var gy = groundY();
        if (vert !== 0) {
          playerY += vert * FLY_SPEED * dt;
          flying = true;
          if (gy !== null && playerY <= gy + EYE) {
            playerY = gy + EYE; flying = false;   // 降到地面即落地
          }
        } else if (!flying && gy !== null) {
          playerY = gy + EYE;                      // 走路时贴地
        }
        cm.position.y = playerY;
        // 镜头参数维持第三人称
        cm.distance = WALK_DISTANCE;
        cm.angle = WALK_ANGLE;
        // 走路小幅上下浮动
        var bobPx = (Math.abs(fwd) > 0.12 && !flying) ? Math.sin(bob) * 3 : 0;
        avatar.style.transform = 'translate(-50%, calc(-58% + ' + bobPx.toFixed(1) + 'px))';
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // 供调试
    window.uestcWalk = {
      toggle: function () { toggle.click(); },
      set: function (x, y) { joy.x = x; joy.y = y; },
      vert: function (v) { vert = v; },
      state: function () {
        return { on: on, flying: flying, x: cm.position.x, y: cm.position.y, z: cm.position.z, rot: cm.rotation };
      }
    };
  });
})();
