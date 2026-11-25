/* ═══════════════════════════════════════════════════════════════
   GENGVOLUNTEERS 2.0 · PLUS LAYER
   1. Motion: scroll progress, back to top, word reveals, card tilt
      and spotlight, magnetic buttons, ripples, hero constellation.
   2. GV AI: "Ask GV" on highlighted text, AI follow up on the squad
      quiz, the homepage demo, and the AI Story Studio.
   Runs after gv.js. Every block checks for its own elements, so one
   file serves every page.
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
var $  = function(s, r){ return (r || document).querySelector(s) };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)) };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
  return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] }) };
var lang = function(){ try{ return localStorage.getItem('gv.lang') === 'bm' ? 'bm' : 'en' }catch(e){ return 'en' } };
var CF = (typeof CFG !== 'undefined') ? CFG : {};
var aiEndpoint = function(){
  if(window.GVAI && window.GVAI.endpoint) return window.GVAI.endpoint;
  return (CF.ai && CF.ai.enabled) ? (CF.ai.endpoint || CF.appsScriptUrl || '') : '';
};
var session = function(){
  if(window.GVAI && window.GVAI.session) return window.GVAI.session;
  try{ return sessionStorage.getItem('gv.sid') || 'anon' }catch(e){ return 'anon' }
};

/* ═══ 1 · MOTION ══════════════════════════════════════════════ */

/* scroll progress bar (the site already has its own back to top) */
(function(){
  var bar = document.createElement('div'); bar.className = 'gvp-prog'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function paint(){
    ticking = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    var p = h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
    bar.style.setProperty('--p', p.toFixed(4));
  }
  addEventListener('scroll', function(){ if(!ticking){ ticking = true; requestAnimationFrame(paint) } }, { passive:true });
  addEventListener('resize', paint);
  paint();
})();

/* section titles rise in word by word */
(function(){
  if(RM || !('IntersectionObserver' in window)) return;
  var heads = $$('h2.dh, .hvsays h2, .gvp-card h3');
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('gvp-in'); io.unobserve(e.target) } });
  }, { threshold:.25 });
  heads.forEach(function(h){
    if(h.dataset.gvpSplit || h.children.length > 3) return;
    h.dataset.gvpSplit = '1';
    var i = 0;
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType === 3){
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function(part){
            if(!part) return;
            if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return }
            var w = document.createElement('span'); w.className = 'gvp-w';
            var inner = document.createElement('span'); inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        }else if(n.nodeType === 1 && n.tagName !== 'BR'){ walk(n) }
      });
    })(h);
    h.classList.add('gvp-split');
    io.observe(h);
  });
})();

/* cards: 3D tilt with a light that follows the pointer */
var TILT = '.rec,.sqc,.pc,.sc,.tier,.trc,.xic,.hcc,.ivtile,.ivq,.hvq,.hvscore,.ccard,.dial,.gvp-card,[data-tilt]';
function wireTilt(el){
  if(el.dataset.gvpTilt) return; el.dataset.gvpTilt = '1';
  if(getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.classList.add('gvp-tilt');
  var max = el.classList.contains('dial') ? 4 : 7, raf = 0;
  el.addEventListener('pointermove', function(e){
    var r = el.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function(){
      el.classList.add('gvp-hot');
      el.style.setProperty('--mx', (x * 100) + '%');
      el.style.setProperty('--my', (y * 100) + '%');
      el.style.transform = 'perspective(900px) rotateX(' + ((.5 - y) * max).toFixed(2) + 'deg) rotateY(' +
        ((x - .5) * max).toFixed(2) + 'deg) translateY(-4px)';
    });
  });
  el.addEventListener('pointerleave', function(){
    cancelAnimationFrame(raf);
    el.classList.remove('gvp-hot'); el.style.transform = '';
  });
}
(function(){
  if(RM || !FINE) return;
  $$(TILT).forEach(wireTilt);
  /* gv.js renders many cards after load; catch them as they arrive */
  var mo = new MutationObserver(function(ms){
    ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes, function(n){
      if(n.nodeType !== 1) return;
      if(n.matches && n.matches(TILT)) wireTilt(n);
      if(n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll(TILT), wireTilt);
    }) });
  });
  mo.observe(document.body, { childList:true, subtree:true });
})();

/* buttons lean toward the cursor */
(function(){
  if(RM || !FINE) return;
  document.addEventListener('pointermove', function(e){
    var b = e.target.closest && e.target.closest('.btn,.nav-cta');
    if(!b) return;
    var r = b.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    b.style.transform = 'translate(' + (dx * 10).toFixed(1) + 'px,' + (dy * 8 - 3).toFixed(1) + 'px) scale(1.03)';
    if(!b.dataset.gvpMag){
      b.dataset.gvpMag = '1';
      b.addEventListener('pointerleave', function(){ b.style.transform = '' });
    }
  }, { passive:true });
})();

/* tap ripple */
document.addEventListener('pointerdown', function(e){
  if(RM) return;
  var b = e.target.closest && e.target.closest('.btn,.opt,.gvchip,.nav-cta,.gvp-seg button,.gvp-suggest button');
  if(!b) return;
  var cs = getComputedStyle(b);
  if(cs.position === 'static') b.style.position = 'relative';
  if(cs.overflow !== 'hidden') b.style.overflow = 'hidden';
  var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
  var d = document.createElement('span'); d.className = 'gvp-rip';
  d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
  b.appendChild(d); setTimeout(function(){ d.remove() }, 700);
});

/* hero: a slow constellation that reaches for the cursor */
(function(){
  var hero = $('.hero');
  if(!hero || RM) return;
  var cv = document.createElement('canvas'); cv.className = 'gvp-canvas'; cv.setAttribute('aria-hidden', 'true');
  hero.insertBefore(cv, hero.firstChild);
  var cx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, devicePixelRatio || 1), pts = [], mouse = { x:-9999, y:-9999 };
  var COLS = ['#FF6B1A', '#FF4D8D', '#A855F7', '#22D3EE', '#34D399', '#FBBF24'];
  function size(){
    var r = hero.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(70, Math.max(24, W * H / 18000)));
    pts = [];
    for(var i = 0; i < n; i++) pts.push({ x:Math.random() * W, y:Math.random() * H,
      vx:(Math.random() - .5) * .35, vy:(Math.random() - .5) * .35, r:1 + Math.random() * 2.2, c:COLS[i % COLS.length] });
  }
  hero.addEventListener('pointermove', function(e){ var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top });
  hero.addEventListener('pointerleave', function(){ mouse.x = mouse.y = -9999 });
  var visible = true, raf = 0;
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ visible = es[0].isIntersecting; if(visible && !raf) loop() }).observe(hero);
  }
  function loop(){
    raf = 0;
    if(!visible || document.hidden) return;
    cx.clearRect(0, 0, W, H);
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    for(var i = 0; i < pts.length; i++){
      var p = pts[i];
      var mdx = mouse.x - p.x, mdy = mouse.y - p.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
      if(md < 160){ p.vx += mdx / md * .012; p.vy += mdy / md * .012 }
      p.vx *= .992; p.vy *= .992;
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > W) p.vx *= -1;
      if(p.y < 0 || p.y > H) p.vy *= -1;
      for(var j = i + 1; j < pts.length; j++){
        var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
        if(d2 < 13000){
          cx.strokeStyle = (dark ? 'rgba(255,255,255,' : 'rgba(20,23,43,') + ((1 - d2 / 13000) * (dark ? .13 : .09)).toFixed(3) + ')';
          cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke();
        }
      }
      if(md < 160){
        cx.strokeStyle = p.c; cx.globalAlpha = (1 - md / 160) * .5;
        cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(mouse.x, mouse.y); cx.stroke(); cx.globalAlpha = 1;
      }
      cx.fillStyle = p.c; cx.globalAlpha = .75;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); cx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && !raf) loop() });
  addEventListener('resize', function(){ clearTimeout(size.t); size.t = setTimeout(size, 150) });
  size(); loop();
})();

/* ═══ 2 · GV AI ═══════════════════════════════════════════════ */

function aiPost(body){
  var url = aiEndpoint();
  if(!url) return Promise.resolve({ status:'off' });
  body.form = 'ai'; body.session = session();
  return fetch(url, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify(body) })
    .then(function(r){ return r.json() });
}

/* highlight any text on the page → "Ask GV about this" */
(function(){
  var pill = document.createElement('button');
  pill.type = 'button'; pill.className = 'gvp-selask';
  pill.textContent = 'Ask GV about this';
  document.body.appendChild(pill);
  var picked = '';
  function hide(){ pill.classList.remove('on'); picked = '' }
  document.addEventListener('mouseup', function(e){
    if(pill.contains(e.target)) return;
    setTimeout(function(){
      if(typeof window.GVAsk !== 'function') return;
      var s = window.getSelection(), t = s ? String(s).trim() : '';
      if(!t || t.length < 12 || t.length > 700){ hide(); return }
      var node = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      if(!node || node.closest('input,textarea,select,.gvwrap,#gate,.gvp-form,nav,footer,.gvp-out')){ hide(); return }
      var r = s.getRangeAt(0).getBoundingClientRect();
      picked = t;
      pill.textContent = lang() === 'bm' ? 'Tanya GV pasal ni' : 'Ask GV about this';
      pill.style.left = Math.max(10, Math.min(innerWidth - 190, r.left + r.width / 2 - 80 + scrollX)) + 'px';
      pill.style.top = (r.top + scrollY - 46) + 'px';
      pill.classList.add('on');
    }, 10);
  });
  document.addEventListener('scroll', hide, { passive:true });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hide() });
  pill.addEventListener('click', function(){
    var t = picked; hide();
    if(window.getSelection) window.getSelection().removeAllRanges();
    window.GVAsk(lang() === 'bm' ? 'Terangkan bahagian yang saya highlight ni dengan mudah.' :
      'Explain the part I highlighted in simple terms.', t);
  });
})();

/* squad quiz: once there is a result, offer a personal AI read */
(function(){
  var box = $('#quizBox');
  if(!box) return;
  new MutationObserver(function(){
    var res = $('.result', box);
    if(!res || $('.gvp-quizai', res) || typeof window.GVAsk !== 'function') return;
    if(!(window.GVAI && window.GVAI.on())) return;
    var squad = ($('.badge', res) || {}).textContent || '';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-g gvp-quizai';
    b.innerHTML = '<span class="gvp-aitag" style="padding:4px 8px">AI</span> Why does ' + esc(squad) + ' fit me?';
    b.addEventListener('click', function(){
      window.GVAsk('The squad quiz matched me to Squad ' + squad + '. Why might that suit me, what will I actually do on a project day, and how should I prepare?');
    });
    res.appendChild(document.createElement('br'));
    res.appendChild(b);
  }).observe(box, { childList:true, subtree:true });
})();

/* homepage: a live typed demo of GV answering */
(function(){
  var demo = $('#gvpDemo');
  if(!demo) return;
  var SCRIPT = [
    ['Is it free to join?', 'Yes, joining as a volunteer is **free**. No registration fee. You usually cover your own transport, and everything on the project day is covered by the project budget.'],
    ['Skuad mana sesuai untuk saya?', 'Ada empat skuad: **Khidmat** (aktiviti), **Komuniti** (penerima manfaat), **Logistik** (operasi) dan **Kreativiti** (media). Buat kuiz 30 saat, nanti saya terangkan kenapa ia sesuai dengan korang.'],
    ['Will this help my scholarship application?', 'It can. You get a certificate, and the **AI Story Studio** turns what you actually did into an essay paragraph, LinkedIn post or resume bullets.']
  ];
  var k = 0, timer = 0, running = false;
  function bold(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') }
  function type(el, text, html, done){
    if(RM){ el.innerHTML = html ? bold(text) : esc(text); done(); return }
    var i = 0; el.classList.add('cur');
    (function step(){
      i += html ? 3 : 1;
      var part = text.slice(0, i);
      el.innerHTML = html ? bold(part) : esc(part);
      if(i < text.length) timer = setTimeout(step, html ? 22 : 45);
      else { el.classList.remove('cur'); done() }
    })();
  }
  function play(){
    var pair = SCRIPT[k++ % SCRIPT.length];
    demo.innerHTML = '<div class="q"></div>';
    type($('.q', demo), pair[0], false, function(){
      timer = setTimeout(function(){
        var a = document.createElement('div'); a.className = 'a'; demo.appendChild(a);
        type(a, pair[1], true, function(){ timer = setTimeout(play, 3200) });
      }, 500);
    });
  }
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      if(es[0].isIntersecting && !running){ running = true; play() }
    }, { threshold:.4 }).observe(demo);
  }else play();
  $$('[data-gvp-ask]').forEach(function(b){
    b.addEventListener('click', function(){ if(window.GVAsk) window.GVAsk(b.getAttribute('data-gvp-ask')) });
  });
})();

/* ═══ AI STORY STUDIO (volunteer.html#ai) ═════════════════════ */
(function(){
  var root = $('#gvpStudio');
  if(!root) return;
  var f = {
    name:$('#gsName'), state:$('#gsState'), squad:$('#gsSquad'),
    did:$('#gsDid'), challenge:$('#gsChal'), learned:$('#gsLearn')
  };
  var out = $('#gsOut'), text = $('#gsText'), go = $('#gsGo'), meter = $('#gsMeter'), hint = $('#gsHint');
  var tools = $('#gsTools'), note = $('#gsNote'), status = $('#gsStatus');
  var state = { format:'essay', lang:'en', last:'' };

  /* segmented controls */
  $$('.gvp-seg', root).forEach(function(seg){
    seg.addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return;
      $$('button', seg).forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false') });
      state[seg.dataset.key] = b.dataset.v;
    });
  });

  /* richness meter: nudges people to give the AI real detail */
  function score(){
    var s = 0;
    s += Math.min(50, f.did.value.trim().length / 4);
    s += Math.min(25, f.challenge.value.trim().length / 3);
    s += Math.min(25, f.learned.value.trim().length / 3);
    if(/\d/.test(f.did.value)) s += 5;
    s = Math.min(100, Math.round(s));
    meter.style.setProperty('--w', s + '%');
    hint.textContent = s < 25 ? 'Add a few concrete details: where, who for, what you did with your hands.'
      : s < 60 ? 'Good. A real challenge and what you learned will make it stand out.'
      : s < 90 ? 'Strong material. Numbers (people, hours, items) make it even better.'
      : 'Excellent detail. Generate away.';
    return s;
  }
  [f.did, f.challenge, f.learned].forEach(function(x){ x.addEventListener('input', score) });
  score();

  /* draft without AI: a careful template that only uses what they wrote */
  function sentence(s){ s = String(s || '').trim().replace(/\s+/g, ' '); if(!s) return ''; s = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?]$/.test(s) ? s : s + '.' }
  function lower(s){ s = String(s || '').trim(); return s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/[.!?]+$/, '') : '' }
  function template(d){
    var st = d.state ? ' in ' + d.state : '', sq = d.squad ? ' as part of ' + d.squad : '';
    var did = sentence(d.did), ch = sentence(d.challenge), le = sentence(d.learned);
    if(d.lang === 'bm'){
      st = d.state ? ' di ' + d.state : ''; sq = d.squad ? ' sebagai ahli ' + d.squad : '';
      if(d.format === 'resume') return '- Menyertai GengVolunteers 2.0' + sq + st + ', menjalankan projek komuniti dari perancangan hingga pelaporan\n- ' + did + (ch ? '\n- Menangani cabaran: ' + lower(d.challenge) : '') + (le ? '\n- ' + le : '');
      return 'Melalui GengVolunteers 2.0' + st + ', saya turun padang' + sq + '. ' + did + (ch ? ' Cabaran terbesar ialah ' + lower(d.challenge) + '.' : '') + (le ? ' ' + le : '') + (d.format === 'linkedin' ? '\n\n#GengVolunteers #Sukarelawan #BeliaMalaysia' : '');
    }
    if(d.format === 'resume') return '- Volunteered with GengVolunteers 2.0' + sq + st + ', delivering a community project from planning to report\n- ' + did + (ch ? '\n- Worked through ' + lower(d.challenge) : '') + (le ? '\n- ' + le : '');
    var verb = /^(ran|led|built|made|taught|helped|organi[sz]ed|planned|ma?naged|cooked|cleaned|painted|designed|shot|filmed|wrote|drove|set|took|gave|\w+ed)\b/i.test(String(d.did).trim());
    if(verb) did = 'I ' + lower(d.did) + '.';
    var body = 'Through GengVolunteers 2.0' + st + ', I volunteered' + sq + '. ' + did + (ch ? ' The hardest part was ' + lower(d.challenge) + '.' : '') + (le ? ' ' + le : '');
    if(d.format === 'linkedin') return 'I did not expect one project day to change how I see my own community.\n\n' + body + '\n\nGrateful to my squad and to Persatuan Belia Cendekia Holistik.\n\n#GengVolunteers #YouthVolunteering #Malaysia';
    if(d.format === 'interview') return 'One experience I am proud of is volunteering with GengVolunteers 2.0' + st + '. ' + did + (ch ? ' It was not easy, because ' + lower(d.challenge) + '.' : '') + (le ? ' ' + le : '') + ' It taught me that showing up and doing the work matters more than titles.';
    return body;
  }

  function reveal(full, done){
    text.textContent = '';
    if(RM){ text.textContent = full; done(); return }
    text.classList.add('typing');
    var i = 0;
    (function step(){
      i += 2 + Math.floor(Math.random() * 3);
      text.textContent = full.slice(0, i);
      if(i < full.length) setTimeout(step, 14);
      else { text.classList.remove('typing'); done() }
    })();
  }

  function setBusy(on){
    go.classList.toggle('busy', on); go.disabled = on;
    go.querySelector('span').textContent = on ? 'GV AI is writing…' : 'GENERATE WITH GV AI';
    $$('button', tools).forEach(function(b){ b.disabled = on || !state.last });
  }

  function show(full, viaAI){
    $('.gvp-empty', out) && ($('.gvp-empty', out).style.display = 'none');
    $('.gvp-skel', out) && $('.gvp-skel', out).remove();
    text.hidden = false;
    state.last = full;
    status.innerHTML = viaAI ? '<span class="gvp-aitag">Written by GV AI</span>'
      : '<span class="gvp-badge-off">TEMPLATE DRAFT · AI OFFLINE</span>';
    note.textContent = viaAI
      ? 'Check every fact before you submit. Make it yours: change words until it sounds like you.'
      : 'GV AI is not reachable right now, so this is a simple template built only from your words. Try again later for a full AI draft.';
    reveal(full, function(){ setBusy(false) });
  }

  function collect(){
    return { name:f.name.value, state:f.state.value, squad:f.squad.value, did:f.did.value,
      challenge:f.challenge.value, learned:f.learned.value, format:state.format, lang:state.lang };
  }

  function generate(){
    var d = collect();
    if(d.did.trim().length < 15){
      f.did.focus(); hint.textContent = 'Tell GV what you actually did first (at least a sentence).';
      f.did.animate && !RM && f.did.animate([{ transform:'translateX(0)' }, { transform:'translateX(-6px)' },
        { transform:'translateX(6px)' }, { transform:'translateX(0)' }], { duration:300 });
      return;
    }
    setBusy(true);
    $('.gvp-empty', out) && ($('.gvp-empty', out).style.display = 'none');
    text.hidden = true;
    if(!$('.gvp-skel', out)){
      var sk = document.createElement('div'); sk.className = 'gvp-skel';
      sk.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
      text.parentNode.insertBefore(sk, text);
    }
    var finished = false;
    var t = setTimeout(function(){ if(!finished){ finished = true; show(template(d), false) } }, 40000);
    aiPost({ mode:'story', story:d }).then(function(res){
      if(finished) return; finished = true; clearTimeout(t);
      if(res && res.status === 'ok' && res.answer) show(res.answer.trim(), true);
      else if(res && res.status === 'limited'){ setBusy(false); $('.gvp-skel', out) && $('.gvp-skel', out).remove(); text.hidden = false; text.textContent = res.message; }
      else show(template(d), false);
    }).catch(function(){
      if(finished) return; finished = true; clearTimeout(t); show(template(d), false);
    });
  }

  go.addEventListener('click', generate);
  tools.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b || !state.last) return;
    var act = b.dataset.act;
    if(act === 'copy'){
      (navigator.clipboard ? navigator.clipboard.writeText(state.last) : Promise.reject())
        .then(function(){ b.textContent = 'Copied ✓'; setTimeout(function(){ b.textContent = 'Copy' }, 1600) })
        .catch(function(){ var r = document.createRange(); r.selectNodeContents(text); var s = getSelection(); s.removeAllRanges(); s.addRange(r) });
    }else if(act === 'again'){ generate() }
    else if(act === 'save'){
      var blob = new Blob([state.last + '\n'], { type:'text/plain;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'my-gv-story-' + state.format + '.txt'; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove() }, 500);
    }else if(act === 'ask'){
      if(window.GVAsk) window.GVAsk('Give me two specific ways to make the draft I selected stronger for a scholarship panel, without inventing anything.', state.last);
    }
  });
})();

})();
