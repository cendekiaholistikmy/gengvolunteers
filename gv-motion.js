/* ═══════════════════════════════════════════════════════════════
   GENGVOLUNTEERS 2.0 · MOTION LAYER
   0. Story tour: a swipeable preview of every page, shown once per
      visit before the consent gate (index only). ?tour=1 replays it.
   1. Cinematic intro: streaks, flash, shockwave, confetti, logo
      reveal with shine, letter cascade, "2.0" stamp, fly-through exit.
   2. Flashcard decks: HighCom feedback (home + voices) stacks into
      draggable, swipeable cards that deal themselves.
   3. Filing drawer: the project archive becomes tabbed folders.
   4. Hero scroll choreography, eyebrow decode, marquee momentum.
   Runs after gv.js and gv-plus.js. Reduced motion is respected.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var $  = function(s, r){ return (r || document).querySelector(s) };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)) };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
  return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] }) };
var clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)) };
var logoSrc = function(){
  var ids = ['gateLogo', 'introLogo', 'navLogo', 'heroLogo'];
  for(var i = 0; i < ids.length; i++){ var el = document.getElementById(ids[i]); if(el && el.src) return el.src }
  return '';
};

/* ═══ 0 · STORY TOUR ══════════════════════════════════════════ */
var SLIDES = [
  { tag:'Home', c:'var(--o)', art:'logo', link:'index.html',
    h:'100 days. <em>One movement.</em>',
    p:'GengVolunteers 2.0 is Malaysia’s youth volunteering programme. Young people plan, fund and run real community projects in their own state.' },
  { tag:'About', c:'var(--zn)', img:'assets/SQUADGV-KUALALUMPUR-PROJECTREPORT-004-1.0-P05.webp', link:'about.html',
    h:'Run by young <em>Malaysians.</em>',
    p:'A volunteering line of Persatuan Belia Cendekia Holistik. A National XI, thirteen state High Committees, and every ringgit accounted for.' },
  { tag:'Projects', c:'var(--zc)', img:'assets/SQUADGV-TERENGGANU-PROJECTREPORT-008-1.0-P02.webp', link:'projects.html',
    h:'Cycle one, <em>delivered.</em>',
    stats:[[14,'', 'projects'], [13,'', 'states'], [1500,'+', 'volunteers'], [550,'+', 'beneficiaries']] },
  { tag:'Voices', c:'var(--zs)', img:'assets/SQUADGV-JOHOR-PROJECTREPORT-013-1.0-P04.webp', link:'voices.html',
    h:'Rated <em>9.01 / 10</em>',
    p:'By all 161 High Committee members, anonymously.',
    q:['“Everything was fully done by us.”', 'Nur Syamirah · Melaka'] },
  { tag:'Volunteer', c:'var(--pink)', img:'assets/SQUADGV-KEDAH-PROJECTREPORT-009-1.0-P04.webp', link:'volunteer.html',
    h:'Four squads. <em>Find yours.</em>',
    chips:[['Khidmat','var(--zn)'], ['Komuniti','var(--zc)'], ['Logistik','var(--zs)'], ['Kreativiti','var(--ze)']],
    p:'Open to everyone and free to join. GV Familia is open now.' },
  { tag:'HighCom', c:'var(--vio)', img:'assets/hc-melaka.webp', link:'highcom.html', kx:'0', ky:'-4%',
    h:'Lead <em>a state.</em>',
    p:'Every state is run by a twelve person High Committee: eight Architects and four Anchors.' },
  { tag:'GV AI', c:'var(--pink)', art:'orb', link:'volunteer.html#ai',
    h:'Ask GV <em>anything.</em>',
    p:'Our AI buddy answers in BM or English, and the AI Story Studio turns your project day into a scholarship ready story.' },
  { tag:'Contact', c:'var(--o)', art:'logo', link:'contact.html', last:true,
    h:'Nobody is coming. <em>We are the ones.</em>',
    p:'Follow @gengvolunteers everywhere. One last thing before you enter: please read our terms.' }
];
var DUR = 5500;

function tourSeen(){ try{ return sessionStorage.getItem('gv.tour') === '1' }catch(e){ return false } }
function markTour(){ try{ sessionStorage.setItem('gv.tour', '1') }catch(e){} }

function openTour(){
  if($('.gvt')) return;
  var logo = logoSrc();
  var root = document.createElement('div');
  root.className = 'gvt'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'A quick tour of GengVolunteers');
  root.style.setProperty('--dur', DUR + 'ms');

  var html = '<div class="gvt-bgblur"></div><div class="gvt-frame">';
  SLIDES.forEach(function(s, k){
    var words = 0;
    var h = s.h.replace(/(<em>|<\/em>)|([^\s<]+)/g, function(m, tag, w){
      if(tag) return tag;
      return '<span class="w"><span style="--i:' + (words++) + '">' + w + '</span></span>';
    });
    html += '<section class="gvt-slide" data-k="' + k + '" aria-hidden="true">';
    if(s.img) html += '<div class="gvt-img" style="background-image:url(\'' + s.img + '\');--kx:' + (s.kx || (k % 2 ? '-2%' : '2%')) + ';--ky:' + (s.ky || '1%') + '"></div>';
    else html += '<div class="gvt-art">' + (s.art === 'orb' ? '<div class="gvt-orb"></div>' : (logo ? '<img alt="" src="' + logo + '">' : '')) + '</div>';
    html += '<div class="gvt-copy"><span class="gvt-tag" style="--c:' + s.c + '"><i></i>' + (k + 1) + ' / ' + SLIDES.length + ' · ' + esc(s.tag) + '</span>' +
      '<h2 class="gvt-h">' + h + '</h2>';
    if(s.stats) html += '<div class="gvt-stats">' + s.stats.map(function(x, i){
      return '<div style="--i:' + i + '"><b data-n="' + x[0] + '" data-s="' + x[1] + '">0</b><span>' + esc(x[2]) + '</span></div>' }).join('') + '</div>';
    if(s.chips) html += '<div class="gvt-chips">' + s.chips.map(function(x, i){
      return '<b style="--c:' + x[1] + ';--i:' + i + '">' + esc(x[0]) + '</b>' }).join('') + '</div>';
    if(s.p) html += '<p class="gvt-p">' + esc(s.p) + '</p>';
    if(s.q) html += '<p class="gvt-q">' + esc(s.q[0]) + '<small>' + esc(s.q[1]) + '</small></p>';
    if(s.last) html += '<button type="button" class="gvt-go" data-act="done">Continue to the site →</button>';
    html += '</div></section>';
  });
  html += '<div class="gvt-tap" aria-hidden="true"><b data-act="prev"></b><b data-act="next"></b></div>' +
    '<div class="gvt-top"><div class="gvt-bars">' + SLIDES.map(function(){ return '<span><i></i></span>' }).join('') + '</div>' +
    '<div class="gvt-head"><span class="gvt-brand">' + (logo ? '<img alt="" src="' + logo + '">' : '') +
    '<span>GengVolunteers 2.0<small>A 40 second tour</small></span></span>' +
    '<button type="button" class="gvt-skip" data-act="done">Skip tour</button></div></div>' +
    '<div class="gvt-hint">Tap to continue <i>→</i></div></div>' +
    '<button type="button" class="gvt-side pv" data-act="prev" aria-label="Previous slide">‹</button>' +
    '<button type="button" class="gvt-side nx" data-act="next" aria-label="Next slide">›</button>';
  root.innerHTML = html;
  document.body.appendChild(root);

  var slides = $$('.gvt-slide', root), bars = $$('.gvt-bars span', root), blur = $('.gvt-bgblur', root);
  var cur = -1, timer = 0, startAt = 0, left = DUR, holdT = 0, held = false;

  function count(el){
    var n = +el.dataset.n, s = el.dataset.s || '', t0 = performance.now(), d = 1200;
    (function f(t){
      var p = clamp((t - t0) / d, 0, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(n * e).toLocaleString('en-MY') + (p === 1 ? s : '');
      if(p < 1 && root.isConnected) requestAnimationFrame(f);
    })(t0);
  }
  function show(k){
    if(k < 0) k = 0;
    if(k >= SLIDES.length){ close(); return }
    cur = k;
    slides.forEach(function(s, i){
      var on = i === k;
      if(on){ s.classList.remove('on'); void s.offsetWidth }
      s.classList.toggle('on', on); s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    bars.forEach(function(b, i){
      b.classList.remove('now'); b.classList.toggle('done', i < k);
      if(i === k){ void b.offsetWidth; b.classList.add('now') }
    });
    var img = SLIDES[k].img;
    blur.style.backgroundImage = img ? 'url("' + img + '")' : 'none';
    $$('.gvt-stats b', slides[k]).forEach(function(b){ setTimeout(function(){ count(b) }, 450) });
    $('.gvt-hint', root).style.display = SLIDES[k].last ? 'none' : '';
    left = DUR; arm();
  }
  function arm(){
    clearTimeout(timer);
    if(SLIDES[cur].last) return;                /* the last slide waits for the button */
    startAt = performance.now();
    timer = setTimeout(function(){ show(cur + 1) }, left);
  }
  function pause(){ held = true; root.classList.add('hold'); clearTimeout(timer); left -= performance.now() - startAt }
  function resume(){ if(!held) return; held = false; root.classList.remove('hold'); arm() }
  function close(){
    clearTimeout(timer); markTour();
    root.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(function(){ root.remove(); var g = $('#gateChk'); if(g) g.focus() }, 700);
  }
  function onKey(e){
    if(e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); show(cur + 1) }
    else if(e.key === 'ArrowLeft'){ show(cur - 1) }
    else if(e.key === 'Escape'){ close() }
  }
  document.addEventListener('keydown', onKey);

  /* tap left/right, hold to pause, swipe to move */
  var downX = 0, downY = 0, downT = 0, moved = false;
  root.addEventListener('pointerdown', function(e){
    if(e.target.closest('button')) return;
    downX = e.clientX; downY = e.clientY; downT = Date.now(); moved = false;
    holdT = setTimeout(pause, 220);
  });
  root.addEventListener('pointermove', function(e){
    if(downT && Math.abs(e.clientX - downX) > 12) moved = true;
  });
  root.addEventListener('pointerup', function(e){
    clearTimeout(holdT);
    if(!downT) return;
    var dx = e.clientX - downX, wasHeld = held; downT = 0;
    resume();
    if(e.target.closest('button')) return;
    if(moved && Math.abs(dx) > 40){ show(cur + (dx < 0 ? 1 : -1)); return }
    if(wasHeld) return;
    var act = e.target.closest('[data-act]');
    if(act) show(cur + (act.dataset.act === 'prev' ? -1 : 1));
  });
  root.addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var a = b.dataset.act;
    if(a === 'done') close(); else show(cur + (a === 'prev' ? -1 : 1));
  });
  document.addEventListener('visibilitychange', function(){ if(!root.isConnected) return; if(document.hidden) pause(); else resume() });

  /* warm the images */
  SLIDES.forEach(function(s){ if(s.img){ var i = new Image(); i.src = s.img } });
  show(0);
  setTimeout(function(){ var s = $('.gvt-skip', root); if(s) s.focus({ preventScroll:true }) }, 50);
}

(function(){
  var gate = $('#gate');
  if(!gate) return;
  /* a replay link inside the gate, for anyone who skipped */
  var ft = $('.gft', gate);
  if(ft){
    var r = document.createElement('button');
    r.type = 'button'; r.className = 'gvt-replay'; r.innerHTML = '▶ Watch the 40 second tour';
    r.addEventListener('click', openTour);
    ft.insertBefore(r, ft.firstChild);
  }
  var force = /[?&]tour=1/.test(location.search);
  if(force || (!tourSeen() && !location.hash)) openTour();
})();

/* ═══ 1 · CINEMATIC INTRO ═════════════════════════════════════ */
(function(){
  var intro = $('#intro');
  if(!intro || RM) return;
  intro.classList.add('gvp-cine');
  var stage = $('.stage', intro), img = $('#introLogo', intro);

  var deco = '<div class="gvc-grid"></div>' +
    [['225deg','var(--zn)'], ['315deg','var(--zc)'], ['45deg','var(--zs)'], ['135deg','var(--ze)'],
     ['180deg','var(--o)'], ['0deg','var(--pink)']].map(function(x, i){
      return '<i class="gvc-streak" style="--r:' + x[0] + ';color:' + x[1] + ';animation-delay:' + (i * 40) + 'ms"></i>' }).join('') +
    '<i class="gvc-flash"></i><i class="gvc-shock"></i><i class="gvc-shock b"></i><canvas class="gvc-fx"></canvas>';
  intro.insertAdjacentHTML('afterbegin', deco);

  if(img){
    var wrapL = document.createElement('span'); wrapL.className = 'gvc-logo';
    img.parentNode.insertBefore(wrapL, img); wrapL.appendChild(img);
    var setMask = function(){ if(img.src) wrapL.style.setProperty('--logo', 'url("' + img.src + '")') };
    setMask(); img.addEventListener('load', setMask);
  }
  var wm = $('.wm', intro);
  if(wm){
    var word = document.createElement('div'); word.className = 'gvc-word'; word.setAttribute('aria-label', 'GengVolunteers 2.0');
    word.innerHTML = 'GENGVOLUNTEERS'.split('').map(function(ch, i){ return '<span style="--i:' + i + '">' + ch + '</span>' }).join('') +
      '<b class="gvc-ver">2.0</b>';
    wm.parentNode.insertBefore(word, wm);
  }
  var tl = $('.tl', intro);
  if(tl){
    var tag = document.createElement('div'); tag.className = 'gvc-tag';
    tag.innerHTML = '<b>100 days</b><b>100 places</b><b>One movement</b>';
    tl.parentNode.insertBefore(tag, tl);
    var bar = document.createElement('div'); bar.className = 'gvc-bar'; bar.innerHTML = '<i></i>';
    tag.parentNode.insertBefore(bar, tag.nextSibling);
  }

  /* confetti burst at the moment of the flash */
  function burst(){
    var cv = $('.gvc-fx', intro); if(!cv) return;
    var dpr = Math.min(2, devicePixelRatio || 1), W = intro.clientWidth, H = intro.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    var cx = cv.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var COLS = ['#22D3EE', '#34D399', '#FBBF24', '#A855F7', '#FF6B1A', '#FF4D8D', '#ffffff'];
    var P = [], ox = W / 2, oy = H / 2 - Math.min(80, H * .08);
    for(var i = 0; i < 170; i++){
      var a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 13;
      P.push({ x:ox, y:oy, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 2, r:1.5 + Math.random() * 3.5,
        c:COLS[i % COLS.length], rot:Math.random() * 6, vr:(Math.random() - .5) * .4, sq:Math.random() < .45, life:1 });
    }
    (function f(){
      cx.clearRect(0, 0, W, H);
      var alive = 0;
      P.forEach(function(p){
        if(p.life <= 0) return;
        alive++;
        p.vx *= .975; p.vy = p.vy * .975 + .16; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= .0085;
        cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
        if(p.sq) cx.fillRect(-p.r, -p.r * .5, p.r * 2.2, p.r); else { cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.283); cx.fill() }
        cx.restore();
      });
      cx.globalAlpha = 1;
      if(alive && intro.isConnected) requestAnimationFrame(f);
    })();
  }

  var played = false;
  function go(){
    if(played || !intro.isConnected) return; played = true;
    intro.classList.add('gvp-go');
    setTimeout(burst, 620);
    /* hand over to the site a little sooner than gv.js would */
    setTimeout(function(){ var sk = $('#skip'); if(sk && intro.isConnected) sk.click() }, 4700);
  }
  if(window.__gateDone || !$('#gate')) setTimeout(go, 30);
  else document.addEventListener('gv:entered', function(){ setTimeout(go, 30) }, { once:true });
})();

/* ═══ 2 · FLASHCARD DECKS ═════════════════════════════════════ */
function Deck(box, cards, opt){
  opt = opt || {};
  var self = this;
  box.classList.add('gvp-deck');
  if(opt.width) box.style.setProperty('--deckw', opt.width + 'px');
  box.setAttribute('tabindex', '0');
  box.setAttribute('aria-roledescription', 'card deck');

  var stage = document.createElement('div'); stage.className = 'gvp-stage';
  cards[0].parentNode.insertBefore(stage, cards[0]);
  var order = [];
  function adopt(list){
    list.forEach(function(c){
      c.classList.add('gvp-dcard'); c.removeAttribute('data-rev'); c.classList.add('in');
      c.style.animationDelay = '';
      stage.appendChild(c); order.push(c);
    });
  }
  adopt(cards);

  var ctl = document.createElement('div'); ctl.className = 'gvp-dctl';
  ctl.innerHTML = '<button type="button" data-act="prev" aria-label="Previous card">‹</button>' +
    '<span class="ctr" aria-live="polite"><b>01</b> / 01</span>' +
    '<span class="gvp-dtimer" aria-hidden="true"><i></i></span>' +
    '<button type="button" data-act="next" aria-label="Next card">›</button>' +
    '<button type="button" data-act="list">See all</button>';
  stage.parentNode.insertBefore(ctl, stage.nextSibling);
  var hint = document.createElement('p'); hint.className = 'gvp-dhint';
  hint.textContent = 'Drag, swipe or tap the card';
  ctl.parentNode.insertBefore(hint, ctl.nextSibling);
  var ctr = $('.ctr', ctl), tbar = $('.gvp-dtimer i', ctl);
  var shown = 0, total = cards.length, dur = opt.dur || 5500, tm = 0, inView = false, hover = false, off = false;
  box.style.setProperty('--dur', dur + 'ms');

  var POS = [
    'translate3d(0,0,0) rotate(0deg) scale(1)',
    'translate3d(12px,18px,0) rotate(2.4deg) scale(.95)',
    'translate3d(-12px,34px,0) rotate(-2.8deg) scale(.9)'
  ];
  function layout(){
    order.forEach(function(c, i){
      c.dataset.pos = i < 3 ? String(i) : 'hide';
      c.style.transform = i < 3 ? POS[i] : 'translate3d(0,46px,0) scale(.86)';
      c.style.opacity = i < 3 ? '1' : '0';
      c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });
    var n = (shown % total) + 1;
    ctr.innerHTML = '<b>' + String(n).padStart(2, '0') + '</b> / ' + String(total).padStart(2, '0');
  }
  function measure(){
    if(off) return;
    var h = 0;
    order.forEach(function(c){ h = Math.max(h, c.offsetHeight) });
    stage.style.height = (h + 46) + 'px';
  }
  function runTimer(){
    clearTimeout(tm);
    tbar.classList.remove('run'); void tbar.offsetWidth;
    if(off || !inView || hover || document.hidden){ box.classList.add('paused'); return }
    box.classList.remove('paused'); tbar.classList.add('run');
    tm = setTimeout(function(){ throwTop(1) }, dur);
  }
  var busy = false;
  function throwTop(dir, dy){
    if(busy || order.length < 2) return; busy = true;
    var c = order[0];
    c.classList.remove('drag');
    c.style.transform = 'translate3d(' + (dir * 125) + '%,' + ((dy || 0) - 30) + 'px,0) rotate(' + (dir * 24) + 'deg)';
    c.style.opacity = '0';
    order.push(order.shift()); shown++;
    layoutExcept(c);
    setTimeout(function(){
      c.classList.add('nofx');
      c.style.transform = 'translate3d(0,46px,0) scale(.86)';
      void c.offsetWidth; c.classList.remove('nofx');
      layout(); busy = false; runTimer();
    }, 430);
  }
  function layoutExcept(skip){
    order.forEach(function(c, i){
      if(c === skip) return;
      c.dataset.pos = i < 3 ? String(i) : 'hide';
      c.style.transform = i < 3 ? POS[i] : 'translate3d(0,46px,0) scale(.86)';
      c.style.opacity = i < 3 ? '1' : '0';
    });
  }
  function back(){
    if(busy || order.length < 2) return; busy = true;
    var c = order.pop(); order.unshift(c); shown = (shown - 1 + total * 100) % total;
    c.classList.add('nofx');
    c.style.transform = 'translate3d(-125%,-30px,0) rotate(-24deg)'; c.style.opacity = '0'; c.dataset.pos = '0';
    void c.offsetWidth; c.classList.remove('nofx');
    layout();
    setTimeout(function(){ busy = false; runTimer() }, 450);
  }
  self.next = function(){ throwTop(1) };
  self.add = function(list){ if(!list.length) return; adopt(list); total = order.length; layout(); measure() };

  /* drag / swipe / tap */
  var sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, dragging = false, card = null;
  stage.addEventListener('pointerdown', function(e){
    var c = e.target.closest('.gvp-dcard');
    if(off || !c || c !== order[0] || e.target.closest('a,button')) return;
    card = c; dragging = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = Date.now();
    c.classList.add('drag'); c.setPointerCapture && c.setPointerCapture(e.pointerId);
    clearTimeout(tm); box.classList.add('paused');
  });
  stage.addEventListener('pointermove', function(e){
    if(!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    card.style.transform = 'translate3d(' + dx + 'px,' + (dy * .25) + 'px,0) rotate(' + (dx * .06) + 'deg)';
  });
  function end(){
    if(!dragging) return; dragging = false;
    var dt = Math.max(1, Date.now() - t0), v = Math.abs(dx) / dt;
    card.classList.remove('drag');
    if(Math.abs(dx) > 90 || (v > .5 && Math.abs(dx) > 30)) throwTop(dx > 0 ? 1 : -1, dy * .25);
    else if(Math.abs(dx) < 6 && Math.abs(dy) < 6) throwTop(1);
    else { layout(); runTimer() }
  }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  ctl.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var a = b.dataset.act;
    if(a === 'next') throwTop(1);
    else if(a === 'prev') back();
    else if(a === 'list'){
      off = !off; box.classList.toggle('off', off);
      b.textContent = off ? 'Stack them' : 'See all';
      if(off){ order.forEach(function(c){ c.style.transform = ''; c.style.opacity = '' }); clearTimeout(tm) }
      else { layout(); measure(); runTimer() }
    }
  });
  box.addEventListener('keydown', function(e){
    if(off) return;
    if(e.key === 'ArrowRight'){ e.preventDefault(); throwTop(1) }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); back() }
  });
  box.addEventListener('mouseenter', function(){ hover = true; runTimer() });
  box.addEventListener('mouseleave', function(){ hover = false; runTimer() });
  document.addEventListener('visibilitychange', runTimer);
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ inView = es[0].isIntersecting; runTimer() }, { threshold:.35 }).observe(box);
  }
  addEventListener('resize', function(){ clearTimeout(measure.t); measure.t = setTimeout(measure, 120) });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  layout(); measure(); setTimeout(measure, 600);
}

(function(){
  if(RM) return;
  /* home: the three HighCom quotes, then more pulled from the voices page */
  var hv = $('.hvqs');
  if(hv && $$('.hvq', hv).length){
    var d = new Deck(hv, $$('.hvq', hv), { width:560 });
    if(window.fetch && window.DOMParser){
      fetch('voices.html').then(function(r){ return r.ok ? r.text() : '' }).then(function(t){
        if(!t) return;
        var doc = new DOMParser().parseFromString(t, 'text/html'), seen = {};
        $$('.hvq blockquote', hv).forEach(function(b){ seen[b.textContent.trim().slice(0, 40)] = 1 });
        var extra = $$('.thread .msg', doc).map(function(m){
          var q = (($('.bub p', m) || {}).textContent || '').trim();
          var who = (($('.who', m) || {}).textContent || '').trim();
          var whr = (($('.whr', m) || {}).textContent || '').trim();
          if(!q || q.length > 230 || seen[q.slice(0, 40)]) return null;
          seen[q.slice(0, 40)] = 1;
          var f = document.createElement('figure'); f.className = 'hvq';
          f.innerHTML = '<blockquote>' + esc(q) + '</blockquote><figcaption>' + esc(who) + (whr ? ' &middot; ' + esc(whr) : '') + '</figcaption>';
          return f;
        }).filter(Boolean).slice(0, 12);
        d.add(extra);
      }).catch(function(){});
    }
  }
  /* voices: every thread becomes its own deck */
  $$('.thread').forEach(function(t){
    var msgs = $$('.msg', t);
    if(msgs.length > 2) new Deck(t, msgs, { width:640, dur:6500 });
  });
})();

/* ═══ 3 · FILING DRAWER (project archive) ═════════════════════ */
(function(){
  var pg = $('#pg');
  if(!pg) return;
  var mode = 'drawer';
  var sw = document.createElement('div'); sw.className = 'gvp-viewsw'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Archive view');
  sw.innerHTML = '<button type="button" data-v="drawer" aria-pressed="true">▤ Drawer</button><button type="button" data-v="grid" aria-pressed="false">▦ Grid</button>';
  pg.parentNode.insertBefore(sw, pg);

  var shaping = false;
  function shape(){
    shaping = true;
    $$('.pc', pg).forEach(function(c, i){
      c.style.setProperty('--i', i);
      if(c.dataset.gvpFile){ return }
      c.dataset.gvpFile = '1';
      var dot = $('.zdot', c), st = $('.top span', c);
      if(dot) c.style.setProperty('--zc2', dot.style.background);
      var tab = document.createElement('span'); tab.className = 'gvp-tab';
      tab.textContent = st ? st.textContent.trim() : 'FILE';
      c.style.setProperty('--tabx', (4 + (i % 5) * 17) + '%');
      var hint = document.createElement('span'); hint.className = 'gvp-fhint'; hint.textContent = '+'; hint.setAttribute('aria-hidden', 'true');
      var body = document.createElement('div'); body.className = 'gvp-fbody';
      var inner = document.createElement('div'); body.appendChild(inner);
      Array.prototype.slice.call(c.children).forEach(function(k){
        if(k.classList.contains('top') || k.tagName === 'H3') return;
        inner.appendChild(k);
      });
      c.appendChild(body); c.insertBefore(tab, c.firstChild); c.appendChild(hint);
      c.setAttribute('tabindex', '0');
    });
    var first = $('.pc', pg);
    if(first && !$('.pc.open', pg)) first.classList.add('open');
    shaping = false;
  }
  function drop(){
    if(RM || mode !== 'drawer') return;
    pg.classList.remove('gvp-in'); pg.classList.add('gvp-pre'); void pg.offsetWidth;
    pg.classList.remove('gvp-pre'); pg.classList.add('gvp-in');
  }
  function apply(){
    pg.classList.toggle('gvp-files', mode === 'drawer');
    $$('button', sw).forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.v === mode ? 'true' : 'false') });
  }
  function open(c){
    $$('.pc.open', pg).forEach(function(x){ if(x !== c) x.classList.remove('open') });
    c.classList.toggle('open');
  }
  pg.addEventListener('click', function(e){
    if(mode !== 'drawer') return;
    var c = e.target.closest('.pc'); if(!c || e.target.closest('a,button')) return;
    if(c.classList.contains('open') && e.target.closest('.gvp-fbody')) return;
    open(c);
  });
  pg.addEventListener('keydown', function(e){
    var c = e.target.closest && e.target.closest('.pc');
    if(c && (e.key === 'Enter' || e.key === ' ') && e.target === c){ e.preventDefault(); open(c) }
  });
  sw.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    mode = b.dataset.v; apply(); drop();
  });
  /* gv.js redraws the cards whenever a zone chip is clicked */
  new MutationObserver(function(){ if(shaping) return; shape(); drop() }).observe(pg, { childList:true });
  shape(); apply();
  if(!RM){
    pg.classList.add('gvp-pre');
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(es){ if(es[0].isIntersecting){ drop(); io.disconnect() } }, { threshold:.12 });
      io.observe(pg);
    }else drop();
  }
})();

/* ═══ 4 · HERO, EYEBROWS, MARQUEE ═════════════════════════════ */
(function(){
  var hero = $('.hero'); if(!hero || RM) return;
  var h1 = $('h1', hero);
  if(h1 && !h1.dataset.gvh){
    h1.dataset.gvh = '1';
    h1.innerHTML = h1.innerHTML.split(/<br\s*\/?>/i).map(function(s){ return '<span class="gvh-l">' + s + '</span>' }).join('');
  }
  var lines = $$('.gvh-l', hero), mark = $('.mark', hero), dial = $('.dial', hero), sub = $('.sub', hero);
  var tick = false;
  function paint(){
    tick = false;
    var p = clamp(scrollY / Math.max(1, hero.offsetHeight), 0, 1);
    lines.forEach(function(l, i){
      l.style.transform = 'translate3d(' + ((i % 2 ? 1 : -1) * p * 140) + 'px,0,0)';
      l.style.opacity = String(1 - p * .7);
    });
    if(mark) mark.style.transform = 'translate3d(0,' + (p * 90) + 'px,0) rotate(' + (-p * 14) + 'deg) scale(' + (1 - p * .25) + ')';
    if(dial) dial.style.transform = 'translate3d(0,' + (-p * 70) + 'px,0) rotate(' + (p * 2.5) + 'deg)';
    if(sub) sub.style.opacity = String(1 - p * .8);
  }
  addEventListener('scroll', function(){ if(!tick){ tick = true; requestAnimationFrame(paint) } }, { passive:true });
  paint();
})();

/* eyebrow labels decode like a terminal when they arrive */
(function(){
  if(RM || !('IntersectionObserver' in window)) return;
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*+';
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return; io.unobserve(e.target);
      var el = e.target, full = el.textContent, t0 = performance.now(), d = 750;
      el.classList.add('gvp-decode');
      (function f(t){
        var p = clamp((t - t0) / d, 0, 1), n = Math.floor(full.length * p), out = full.slice(0, n);
        for(var i = n; i < full.length; i++) out += full[i] === ' ' || full[i] === '·' ? full[i] : CH[(Math.random() * CH.length) | 0];
        el.textContent = out;
        if(p < 1) requestAnimationFrame(f); else el.textContent = full;
      })(t0);
    });
  }, { threshold:.6 });
  $$('.eye, .eyebrow').forEach(function(el){ if(!el.children.length && el.textContent.length < 48) io.observe(el) });
})();

/* the quote marquee picks up speed with the scroll */
(function(){
  var mq = $('.mq-in'); if(!mq || RM || !mq.getAnimations) return;
  var last = scrollY, boost = 0, raf = 0;
  function loop(){
    raf = 0;
    var a = mq.getAnimations()[0]; if(!a) return;
    boost *= .92;
    a.playbackRate = 1 + boost;
    if(boost > .02) raf = requestAnimationFrame(loop); else a.playbackRate = 1;
  }
  addEventListener('scroll', function(){
    var v = Math.abs(scrollY - last); last = scrollY;
    boost = Math.min(7, boost + v * .05);
    if(!raf) raf = requestAnimationFrame(loop);
  }, { passive:true });
})();

})();
