/* ============================================================
   Step N Rock — Cart logic (vanilla JS, localStorage)
   ============================================================ */

(function () {
  "use strict";

  var KEY = "snr_cart";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
    document.dispatchEvent(new CustomEvent("cart:changed", { detail: items }));
  }

  function get() { return read(); }

  function add(product) {
    var items = read();
    var existing = items.find(function (i) { return i.id === product.id; });
    if (existing) { existing.qty += 1; }
    else { items.push({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category, qty: 1 }); }
    write(items);
    toast("Added to cart");
  }

  function remove(id) {
    var items = read().filter(function (i) { return i.id !== id; });
    write(items);
  }

  function setQty(id, qty) {
    var items = read();
    var it = items.find(function (i) { return i.id === id; });
    if (!it) return;
    it.qty = Math.max(1, qty);
    write(items);
  }

  function count() {
    return read().reduce(function (n, i) { return n + i.qty; }, 0);
  }

  function subtotal() {
    return read().reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function updateBadge() {
    var n = count();
    document.querySelectorAll(".cart-badge").forEach(function (b) {
      b.textContent = n;
      b.classList.toggle("is-visible", n > 0);
    });
  }

  function toast(msg) {
    var t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.innerHTML = '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span class="msg"></span>';
      document.body.appendChild(t);
    }
    t.querySelector(".msg").textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* expose */
  window.SNRCart = { add: add, remove: remove, setQty: setQty, get: get, count: count, subtotal: subtotal, toast: toast };

  /* init badge on load */
  if (document.readyState !== "loading") updateBadge();
  else document.addEventListener("DOMContentLoaded", updateBadge);

  /* ============================================================
     PWA — Service Worker, Install Prompt, Bottom Nav, Pull-to-Refresh
     ============================================================ */

  /* ---- Service Worker registration ---- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---- PWA install prompt ---- */
  var deferredPrompt = null;
  var installBanner = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBanner) installBanner.classList.add("show");
  });

  function setupInstallBanner() {
    installBanner = document.querySelector(".install-banner");
    if (!installBanner) return;
    var yes = installBanner.querySelector(".install-banner__btn--yes");
    var no = installBanner.querySelector(".install-banner__btn--no");
    if (yes) yes.addEventListener("click", function () {
      if (!deferredPrompt) { installBanner.classList.remove("show"); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBanner.classList.remove("show");
      });
    });
    if (no) no.addEventListener("click", function () {
      installBanner.classList.remove("show");
      localStorage.setItem("snr_install_dismissed", "1");
    });
    if (localStorage.getItem("snr_install_dismissed") !== "1" && deferredPrompt) {
      installBanner.classList.add("show");
    }
  }

  /* ---- Bottom tab bar: sync active state + cart badge ---- */
  function syncTabBar() {
    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".tabbar__item").forEach(function (item) {
      var href = item.getAttribute("href");
      var isActive = (href === path) || (path === "" && href === "index.html");
      item.classList.toggle("is-active", isActive);
    });
    var n = count();
    document.querySelectorAll(".tabbar__badge").forEach(function (b) {
      b.textContent = n;
      b.classList.toggle("is-visible", n > 0);
    });
  }

  /* ---- Pull-to-refresh (mobile only) ---- */
  var ptrHint = null;
  var ptrStartY = 0;
  var ptrPulling = false;

  function setupPTR() {
    if (!("ontouchstart" in window) || window.matchMedia("(min-width: 821px)").matches) return;
    ptrHint = document.querySelector(".ptr-hint");
    if (!ptrHint) return;
    document.addEventListener("touchstart", function (e) {
      if (window.scrollY <= 0 && e.touches.length === 1) {
        ptrStartY = e.touches[0].clientY;
        ptrPulling = true;
      }
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!ptrPulling) return;
      var diff = e.touches[0].clientY - ptrStartY;
      if (diff > 70) ptrHint.classList.add("show");
    }, { passive: true });
    document.addEventListener("touchend", function () {
      if (!ptrPulling) return;
      ptrPulling = false;
      if (ptrHint.classList.contains("show")) {
        ptrHint.classList.remove("show");
        setTimeout(function () { location.reload(); }, 300);
      }
    });
  }

  /* ---- DOMContentLoaded: nav, reveal, PWA setup ---- */
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".nav__toggle");
    var links = document.querySelector(".nav__links");
    if (toggle && links) {
      toggle.addEventListener("click", function () { links.classList.toggle("open"); });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { links.classList.remove("open"); });
      });
    }

    /* reveal-on-scroll */
    var els = document.querySelectorAll(".reveal");
    if (els.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add("in"); });
    }

    /* PWA: bottom tab bar, install banner, pull-to-refresh */
    var tabbar = document.querySelector(".tabbar");
    if (tabbar) tabbar.classList.add("is-ready");
    syncTabBar();
    setupInstallBanner();
    setupPTR();
  });

  /* re-sync tab bar badge when cart changes */
  document.addEventListener("cart:changed", syncTabBar);
})();
