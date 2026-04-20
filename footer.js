/* MOOVIED Footer — vanilla JS, loads on every page */
(function(){
  var GAS_URL = "https://script.google.com/macros/s/AKfycbw5QsOM-yMbD-3p9Eci_9j3sSnFIvw6TeCXsdapWvFntFzcaVJ3BpQmnoAMc0uAmL0i/exec";
  var ADMIN_EMAIL = "rawindunethsara93@gmail.com";
  var SESSION_KEY = "moovied_session";
  var CACHE_KEY = "moovied_footer_cfg";
  var CACHE_TTL = 5 * 60 * 1000;

  var DEFAULTS = {
    brand_name:"MOOVIED",
    brand_tagline:"Your premium movie streaming destination.",
    brand_description:"Watch the latest movies and shows in stunning HD. Stream and download your favorites anytime, anywhere.",
    brand_logo_url:"",
    newsletter_title:"Stay in the loop",
    newsletter_subtitle:"Get weekly picks & new releases straight to your inbox.",
    newsletter_button:"Subscribe",
    contact_email:"support@moovied.com",
    contact_phone:"",
    contact_address:"",
    social_facebook:"",social_twitter:"",social_instagram:"",
    social_youtube:"",social_telegram:"",social_discord:"",social_tiktok:"",
    links_explore:'[{"label":"Home","url":"#/"},{"label":"Movies","url":"#/movies"},{"label":"Series","url":"#/series"},{"label":"Search","url":"#/search"}]',
    links_categories:'[{"label":"Action","url":"#/category/Action"},{"label":"Drama","url":"#/category/Drama"},{"label":"Comedy","url":"#/category/Comedy"},{"label":"Thriller","url":"#/category/Thriller"}]',
    links_legal:'[{"label":"About","url":"#/about"},{"label":"Privacy","url":"#/privacy"},{"label":"Terms","url":"#/terms"},{"label":"DMCA","url":"#/dmca"},{"label":"Contact","url":"#/contact"}]',
    copyright_text:"© 2026 MOOVIED. All rights reserved.",
    bottom_note:"MOOVIED does not host any files. All movies are linked to third-party services.",
    accent_color:"#FFD700",
    bg_color:"#0a0a18"
  };

  var SOCIAL_ICONS = {
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.19 8.688H6.75v3.21h2.44v9.69h4.014v-9.69h2.926l.288-3.21h-3.214V7.34c0-.764.154-1.066.892-1.066h2.322V2.412h-2.984c-2.872 0-4.244 1.264-4.244 3.682v2.594z"/></svg>',
    twitter:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38a3.7 3.7 0 0 1-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9a3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38a3.7 3.7 0 0 1 1.38-.9c.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.86 5.86 0 0 0-2.13 1.39A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.86 5.86 0 0 0 1.39 2.13 5.86 5.86 0 0 0 2.13 1.39c.76.3 1.64.5 2.91.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.13-1.39 5.86 5.86 0 0 0 1.39-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.39-2.13A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88"/></svg>',
    youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.53A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.12c1.88.53 9.38.53 9.38.53s7.5 0 9.38-.53a3 3 0 0 0 2.12-2.12C24 15.93 24 12 24 12s0-3.93-.5-5.8M9.6 15.6V8.4l6.24 3.6z"/></svg>',
    telegram:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
    discord:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298 0 .59.044.87.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52V6.73c-.628.001-1.252-.075-1.86-.225z"/></svg>'
  };

  function safeJSON(v, fb){ try { return JSON.parse(v); } catch(e){ return fb; } }
  function escHTML(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
  function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch(e){ return null; } }
  function isAdmin(){ var u=getSession(); return !!(u && (u.email===ADMIN_EMAIL || u.isAdmin===true || String(u.isAdmin).toLowerCase()==="true")); }

  function getCachedConfig(){
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.t > CACHE_TTL) return null;
      return obj.cfg;
    } catch(e){ return null; }
  }
  function setCachedConfig(cfg){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({t:Date.now(), cfg:cfg})); } catch(e){}
  }

  function fetchConfig(){
    return fetch(GAS_URL + "?action=getFooterConfig").then(function(r){return r.json();})
      .then(function(j){ if (j && j.success) return j.config; throw new Error("bad"); });
  }

  function postAction(action, body){
    return fetch(GAS_URL, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify(Object.assign({action:action}, body||{}))
    }).then(function(r){return r.json();});
  }

  function buildSocials(cfg){
    var keys = ["facebook","twitter","instagram","youtube","telegram","discord","tiktok"];
    var html = "";
    keys.forEach(function(k){
      var url = cfg["social_"+k];
      if (url) html += '<a href="'+escHTML(url)+'" target="_blank" rel="noopener" aria-label="'+k+'">'+ (SOCIAL_ICONS[k]||"") +'</a>';
    });
    return html;
  }

  function buildLinkList(jsonStr){
    var arr = safeJSON(jsonStr, []);
    if (!Array.isArray(arr)) arr = [];
    return arr.map(function(it){
      return '<li><a href="'+escHTML(it.url||"#")+'">'+escHTML(it.label||"")+'</a></li>';
    }).join("");
  }

  function render(cfg){
    // remove old
    var old = document.getElementById("mv-footer"); if (old) old.remove();

    var f = document.createElement("footer");
    f.id = "mv-footer";
    f.className = "mv-footer";
    f.style.setProperty("--mv-accent", cfg.accent_color || "#FFD700");

    var brandLogo = cfg.brand_logo_url ? '<img src="'+escHTML(cfg.brand_logo_url)+'" alt="logo">' : "";
    var contact = "";
    if (cfg.contact_email)   contact += '<span>📧 <a href="mailto:'+escHTML(cfg.contact_email)+'">'+escHTML(cfg.contact_email)+'</a></span>';
    if (cfg.contact_phone)   contact += '<span>📞 '+escHTML(cfg.contact_phone)+'</span>';
    if (cfg.contact_address) contact += '<span>📍 '+escHTML(cfg.contact_address)+'</span>';

    f.innerHTML =
      '<div class="mv-footer-grid">'+
        '<div class="mv-foot-brand">'+
          '<div class="mv-foot-logo">'+brandLogo+'<span>'+escHTML(cfg.brand_name||"MOOVIED")+'</span></div>'+
          (cfg.brand_tagline?'<p class="mv-foot-tagline">'+escHTML(cfg.brand_tagline)+'</p>':'')+
          (cfg.brand_description?'<p class="mv-foot-desc">'+escHTML(cfg.brand_description)+'</p>':'')+
          (contact?'<div class="mv-foot-contact">'+contact+'</div>':'')+
          '<div class="mv-foot-socials">'+buildSocials(cfg)+'</div>'+
        '</div>'+
        '<div class="mv-foot-col">'+
          '<h4>Explore</h4>'+
          '<ul>'+buildLinkList(cfg.links_explore)+'</ul>'+
        '</div>'+
        '<div class="mv-foot-col">'+
          '<h4>Categories</h4>'+
          '<ul>'+buildLinkList(cfg.links_categories)+'</ul>'+
        '</div>'+
        '<div class="mv-foot-col mv-foot-newsletter">'+
          '<h4>'+escHTML(cfg.newsletter_title||"Stay in the loop")+'</h4>'+
          '<p>'+escHTML(cfg.newsletter_subtitle||"")+'</p>'+
          '<form class="mv-foot-form" id="mv-foot-sub-form">'+
            '<input type="email" required placeholder="your@email.com" id="mv-foot-sub-email">'+
            '<button type="submit">'+escHTML(cfg.newsletter_button||"Subscribe")+'</button>'+
          '</form>'+
          '<div class="mv-foot-msg" id="mv-foot-sub-msg"></div>'+
          '<ul style="margin-top:14px">'+buildLinkList(cfg.links_legal)+'</ul>'+
        '</div>'+
      '</div>'+
      '<div class="mv-foot-bottom">'+
        '<div class="mv-foot-note">'+escHTML(cfg.bottom_note||"")+'</div>'+
        '<div class="mv-foot-copyright">'+escHTML(cfg.copyright_text||"")+'</div>'+
      '</div>';

    document.body.appendChild(f);

    // Wire subscribe
    var form = document.getElementById("mv-foot-sub-form");
    if (form) form.addEventListener("submit", function(e){
      e.preventDefault();
      var emailEl = document.getElementById("mv-foot-sub-email");
      var msgEl = document.getElementById("mv-foot-sub-msg");
      var btn = form.querySelector("button");
      var email = (emailEl.value||"").trim();
      if (!email || email.indexOf("@")<0) { msgEl.className="mv-foot-msg err"; msgEl.textContent="Please enter a valid email."; return; }
      btn.disabled = true; msgEl.className="mv-foot-msg"; msgEl.textContent="Subscribing…";
      postAction("subscribeNewsletter", {email:email}).then(function(r){
        if (r && r.success) {
          msgEl.textContent = r.alreadySubscribed ? "You're already subscribed ✓" : "Subscribed! Welcome aboard ✓";
          emailEl.value = "";
        } else {
          msgEl.className="mv-foot-msg err"; msgEl.textContent = (r && r.error) || "Subscription failed.";
        }
      }).catch(function(){
        msgEl.className="mv-foot-msg err"; msgEl.textContent="Network error, please retry.";
      }).finally(function(){ btn.disabled=false; });
    });

  }

  // ===== Admin sidebar injector =====
  // Adds a "Footer" nav button into the React-rendered admin panel sidebar.
  // Clicking it opens the same edit modal used previously.
  function injectAdminButton(){
    if (!isAdmin()) return;
    if (currentRoute().toLowerCase().indexOf("/admin") !== 0) return;
    if (document.getElementById("mv-admin-footer-btn")) return;

    // Find the admin sidebar nav (matches the bundle's classes: "flex-1 p-4 space-y-1")
    var navs = document.querySelectorAll("nav.flex-1.p-4.space-y-1, nav[class*='flex-1'][class*='space-y-1']");
    if (!navs || !navs.length) return;
    var nav = navs[navs.length - 1];

    // Mimic the existing button styles
    var btn = document.createElement("button");
    btn.id = "mv-admin-footer-btn";
    btn.type = "button";
    btn.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-white/60 hover:bg-white/5 hover:text-white";
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="15" x2="9" y2="21"/></svg> Footer Settings';
    btn.addEventListener("click", function(e){
      e.preventDefault(); e.stopPropagation();
      var cfg = getCachedConfig() || DEFAULTS;
      // Fetch fresh first so admin sees latest values
      fetchConfig().then(function(c){ openEditor(c || cfg); }).catch(function(){ openEditor(cfg); });
    });
    nav.appendChild(btn);
  }
  function watchAdminSidebar(){
    var run = function(){ try { injectAdminButton(); } catch(e){} };
    run();
    var mo = new MutationObserver(run);
    mo.observe(document.body, {childList:true, subtree:true});
  }

  function openEditor(cfg){
    var existing = document.getElementById("mv-foot-modal"); if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "mv-foot-modal";
    modal.className = "mv-foot-modal";
    var fields = [
      {k:"brand_name",label:"Brand Name"},
      {k:"brand_logo_url",label:"Brand Logo URL (optional)"},
      {k:"brand_tagline",label:"Brand Tagline"},
      {k:"brand_description",label:"Brand Description",ta:true},
      {k:"contact_email",label:"Contact Email"},
      {k:"contact_phone",label:"Contact Phone"},
      {k:"contact_address",label:"Contact Address"}
    ];
    var socials = ["facebook","twitter","instagram","youtube","telegram","discord","tiktok"];
    var newsletter = [
      {k:"newsletter_title",label:"Newsletter Title"},
      {k:"newsletter_subtitle",label:"Newsletter Subtitle"},
      {k:"newsletter_button",label:"Newsletter Button Text"}
    ];
    var bottom = [
      {k:"copyright_text",label:"Copyright Text"},
      {k:"bottom_note",label:"Bottom Note (Disclaimer)",ta:true},
      {k:"accent_color",label:"Accent Color (hex)"}
    ];
    function renderField(f){
      var v = cfg[f.k]==null?"":cfg[f.k];
      var input = f.ta
        ? '<textarea data-k="'+f.k+'">'+escHTML(v)+'</textarea>'
        : '<input data-k="'+f.k+'" value="'+escHTML(v)+'">';
      return '<label>'+escHTML(f.label)+'</label>'+input;
    }
    function renderRow(arr){
      return '<div class="mv-mod-row">'+arr.map(function(p){return '<div>'+p+'</div>';}).join('')+'</div>';
    }

    modal.innerHTML =
      '<div class="mv-foot-modal-box">'+
        '<div class="mv-foot-modal-head"><h3>Edit Footer</h3><button type="button" id="mv-mod-close">×</button></div>'+
        '<div class="mv-foot-modal-body">'+
          '<div class="mv-mod-section"><h5>Brand</h5>'+
            fields.map(renderField).join('')+
          '</div>'+
          '<div class="mv-mod-section"><h5>Social Links</h5>'+
            renderRow([renderField({k:"social_facebook",label:"Facebook URL"}), renderField({k:"social_twitter",label:"Twitter / X URL"})])+
            renderRow([renderField({k:"social_instagram",label:"Instagram URL"}), renderField({k:"social_youtube",label:"YouTube URL"})])+
            renderRow([renderField({k:"social_telegram",label:"Telegram URL"}), renderField({k:"social_discord",label:"Discord URL"})])+
            renderField({k:"social_tiktok",label:"TikTok URL"})+
          '</div>'+
          '<div class="mv-mod-section"><h5>Link Lists (JSON: [{"label":"…","url":"…"}])</h5>'+
            renderField({k:"links_explore",label:"Explore Links",ta:true})+
            renderField({k:"links_categories",label:"Category Links",ta:true})+
            renderField({k:"links_legal",label:"Legal / Other Links",ta:true})+
          '</div>'+
          '<div class="mv-mod-section"><h5>Newsletter</h5>'+
            newsletter.map(renderField).join('')+
          '</div>'+
          '<div class="mv-mod-section"><h5>Bottom Bar & Theme</h5>'+
            bottom.map(renderField).join('')+
          '</div>'+
        '</div>'+
        '<div class="mv-foot-modal-foot">'+
          '<button type="button" class="mv-btn-cancel" id="mv-mod-cancel">Cancel</button>'+
          '<button type="button" class="mv-btn-save" id="mv-mod-save">Save Changes</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(modal);
    function close(){ modal.remove(); }
    modal.addEventListener("click", function(e){ if (e.target===modal) close(); });
    document.getElementById("mv-mod-close").addEventListener("click", close);
    document.getElementById("mv-mod-cancel").addEventListener("click", close);
    document.getElementById("mv-mod-save").addEventListener("click", function(){
      var saveBtn = this;
      var inputs = modal.querySelectorAll("[data-k]");
      var newCfg = {};
      for (var i=0;i<inputs.length;i++){ newCfg[inputs[i].getAttribute("data-k")] = inputs[i].value; }
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      postAction("saveFooterConfig", {config:newCfg}).then(function(r){
        if (r && r.success){
          // merge & re-render
          var merged = Object.assign({}, cfg, newCfg);
          setCachedConfig(merged);
          render(merged);
          close();
        } else {
          saveBtn.disabled = false; saveBtn.textContent = "Save Changes";
          alert("Save failed: " + (r && r.error || "unknown"));
        }
      }).catch(function(e){
        saveBtn.disabled = false; saveBtn.textContent = "Save Changes";
        alert("Network error: " + e.message);
      });
    });
  }

  // Footer is shown ONLY on these app routes (after stripping the GitHub Pages basename)
  var ALLOWED = ["/", "/movies", "/movie", "/search", "/profile"];
  function currentRoute(){
    try {
      var p = location.pathname || "/";
      // Strip basename like "/Admin-Log-Sync"
      p = p.replace(/^\/Admin-Log-Sync(\/|$)/i, "/");
      // Also support hash routing (#/path)
      var h = (location.hash || "").replace(/^#/, "");
      if (h && h.charAt(0) === "/") p = h;
      // Normalize: remove trailing slash (except root) and query
      p = p.split("?")[0].split("#")[0];
      if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
      return p || "/";
    } catch(e){ return "/"; }
  }
  function isAllowedRoute(){
    var p = (currentRoute() || "/").toLowerCase();
    for (var i = 0; i < ALLOWED.length; i++) {
      var a = ALLOWED[i].toLowerCase();
      if (p === a) return true;
      if (a !== "/" && (p === a || p.indexOf(a + "/") === 0)) return true;
    }
    return false;
  }
  function applyRouteVisibility(){
    var el = document.getElementById("mv-footer");
    if (el) el.style.display = isAllowedRoute() ? "" : "none";
  }
  function watchRoute(){
    window.addEventListener("popstate", applyRouteVisibility);
    window.addEventListener("hashchange", applyRouteVisibility);
    try {
      var ps = history.pushState, rs = history.replaceState;
      history.pushState = function(){ var r = ps.apply(this, arguments); setTimeout(applyRouteVisibility, 0); return r; };
      history.replaceState = function(){ var r = rs.apply(this, arguments); setTimeout(applyRouteVisibility, 0); return r; };
    } catch(e){}
  }

  function init(){
    watchRoute();
    watchAdminSidebar();
    // Always render so SPA navigation can simply toggle visibility
    var cached = getCachedConfig();
    render(cached || DEFAULTS);
    applyRouteVisibility();
    // Then fetch fresh in background
    fetchConfig().then(function(cfg){
      if (cfg) { setCachedConfig(cfg); render(cfg); applyRouteVisibility(); }
    }).catch(function(){});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
