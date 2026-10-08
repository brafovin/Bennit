(function () {
  "use strict";
  var GAMES = window.GAMES;
  var CART_KEY = "pixelcrate-cart";
  var PROMOS = { WELCOME10: 0.10, GAMER20: 0.20 };
  var state = { genre: "All", query: "", sort: "featured", cart: loadCart(), promo: null };

  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return "$" + n.toFixed(2); };
  var priceOf = function (g) { return g.sale != null ? g.sale : g.price; };
  var byId = function (id) { return GAMES.filter(function (g) { return g.id === id; })[0]; };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function grad(g) { return "linear-gradient(135deg," + g.colors[0] + "," + g.colors[1] + ")"; }

  function loadCart() {
    try { var c = JSON.parse(localStorage.getItem(CART_KEY)); return Array.isArray(c) ? c : []; } catch (e) { return []; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) {} }

  /* ---------- catalog ---------- */
  function visibleGames() {
    var q = state.query.trim().toLowerCase();
    var list = GAMES.filter(function (g) {
      return (state.genre === "All" || g.genre === state.genre) &&
        (!q || (g.title + " " + g.genre + " " + g.desc).toLowerCase().indexOf(q) !== -1);
    });
    var sorts = {
      "price-asc": function (a, b) { return priceOf(a) - priceOf(b); },
      "price-desc": function (a, b) { return priceOf(b) - priceOf(a); },
      rating: function (a, b) { return b.rating - a.rating; },
      name: function (a, b) { return a.title.localeCompare(b.title); }
    };
    if (sorts[state.sort]) list.sort(sorts[state.sort]);
    return list;
  }

  function renderChips() {
    var genres = ["All"].concat(GAMES.map(function (g) { return g.genre; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort());
    $("chips").innerHTML = genres.map(function (g) {
      return '<button class="chip' + (g === state.genre ? " active" : "") + '" data-genre="' + esc(g) + '">' + esc(g) + "</button>";
    }).join("");
  }

  function priceHtml(g) {
    if (g.sale == null) return '<span class="price"><span class="now">' + money(g.price) + "</span></span>";
    return '<span class="price"><s>' + money(g.price) + '</s><span class="now on-sale">' + money(g.sale) + "</span></span>";
  }
  function badge(g) {
    return g.sale == null ? "" : '<span class="badge">-' + Math.round((1 - g.sale / g.price) * 100) + "%</span>";
  }

  function renderGrid() {
    var list = visibleGames();
    $("empty").hidden = list.length > 0;
    $("grid").innerHTML = list.map(function (g) {
      return '<article class="card">' +
        '<div class="cover" data-open="' + g.id + '" style="background:' + grad(g) + '">' + badge(g) + '<span class="icon">' + g.icon + "</span></div>" +
        '<div class="info"><h3 data-open="' + g.id + '">' + esc(g.title) + "</h3>" +
        '<div class="meta">' + esc(g.genre) + " · " + g.year + "</div>" +
        '<div class="rating">' + stars(g.rating) + " " + g.rating.toFixed(1) + "</div>" +
        '<div class="buy">' + priceHtml(g) + '<button class="btn" data-add="' + g.id + '">Add</button></div></div></article>';
    }).join("");
  }
  function stars(r) { var n = Math.round(r); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }

  /* ---------- product modal ---------- */
  function openModal(id) {
    var g = byId(id);
    $("modal").innerHTML =
      '<div class="cover" style="background:' + grad(g) + '">' + badge(g) + '<span class="icon">' + g.icon + '</span></div>' +
      '<button class="x" data-close aria-label="Close">×</button>' +
      '<div class="body"><h2>' + esc(g.title) + "</h2>" +
      '<div class="rating">' + stars(g.rating) + " " + g.rating.toFixed(1) + " / 5</div>" +
      '<div class="tags"><span class="tag">' + esc(g.genre) + '</span><span class="tag">' + g.year + "</span>" +
      g.platforms.map(function (p) { return '<span class="tag">' + esc(p) + "</span>"; }).join("") + "</div>" +
      "<p>" + esc(g.desc) + "</p>" +
      '<div class="buy">' + priceHtml(g) + '<button class="btn" data-add="' + g.id + '">Add to cart</button></div></div>';
    showOverlay(); $("modal").classList.add("open");
  }

  /* ---------- cart ---------- */
  function addToCart(id) {
    var line = state.cart.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(line.qty + 1, 9); else state.cart.push({ id: id, qty: 1 });
    saveCart(); renderCart(); toast("Added " + byId(id).title);
  }
  function totals() {
    var sub = state.cart.reduce(function (s, l) { return s + priceOf(byId(l.id)) * l.qty; }, 0);
    var disc = state.promo ? sub * PROMOS[state.promo] : 0;
    return { sub: sub, disc: disc, total: sub - disc };
  }
  function renderCart() {
    var count = state.cart.reduce(function (s, l) { return s + l.qty; }, 0);
    $("cart-count").textContent = count;
    $("lines").innerHTML = state.cart.length ? state.cart.map(function (l) {
      var g = byId(l.id);
      return '<div class="line"><div class="thumb" style="background:' + grad(g) + '">' + g.icon + "</div>" +
        '<div><div class="t">' + esc(g.title) + '</div><div class="meta">' + money(priceOf(g)) + "</div>" +
        '<div class="qty"><button data-dec="' + g.id + '" aria-label="Decrease">−</button><span>' + l.qty + '</span><button data-inc="' + g.id + '" aria-label="Increase">+</button></div></div>' +
        '<div><b>' + money(priceOf(g) * l.qty) + '</b><button class="rm" data-rm="' + g.id + '">Remove</button></div></div>';
    }).join("") : '<p class="empty">Your cart is empty.</p>';
    var t = totals();
    $("subtotal").textContent = money(t.sub);
    $("discount-row").hidden = !state.promo;
    $("discount").textContent = "−" + money(t.disc);
    $("total").textContent = money(t.total);
    $("checkout-btn").disabled = !state.cart.length;
  }
  function changeQty(id, d) {
    var l = state.cart.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    l.qty += d;
    if (l.qty <= 0) state.cart = state.cart.filter(function (x) { return x !== l; });
    l.qty = Math.min(l.qty, 9);
    saveCart(); renderCart();
  }
  function applyPromo() {
    var code = $("promo").value.trim().toUpperCase(), msg = $("promo-msg");
    if (PROMOS[code]) { state.promo = code; msg.className = "msg ok"; msg.textContent = "Code " + code + " applied (" + PROMOS[code] * 100 + "% off)."; }
    else { state.promo = null; msg.className = "msg err"; msg.textContent = code ? "Invalid promo code." : ""; }
    renderCart();
  }
  function openCart() { showOverlay(); $("drawer").classList.add("open"); }

  /* ---------- checkout (fake) ---------- */
  function openCheckout() {
    if (!state.cart.length) return;
    closeAll(); showOverlay();
    $("modal").innerHTML =
      '<button class="x" data-close aria-label="Close">×</button>' +
      '<div class="body"><h2>Checkout</h2><p class="meta">Test mode — enter anything. No card is charged. Total: <b>' + money(totals().total) + "</b></p></div>" +
      '<form class="checkout" id="checkout-form">' +
      '<label>Full name<input name="name" required autocomplete="name"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<div class="two"><label>Card number<input name="card" required inputmode="numeric" placeholder="4242 4242 4242 4242" pattern="[0-9 ]{12,23}"></label>' +
      '<label>Expiry<input name="exp" required placeholder="MM/YY" pattern="[0-9]{2}/[0-9]{2}"></label></div>' +
      '<button class="btn green" type="submit">Pay ' + money(totals().total) + "</button></form>";
    $("modal").classList.add("open");
    $("checkout-form").addEventListener("submit", function (e) { e.preventDefault(); completeOrder(new FormData(e.target)); });
  }
  function fakeKey() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = [];
    for (var i = 0; i < 3; i++) { var p = ""; for (var j = 0; j < 5; j++) p += c[Math.floor(Math.random() * c.length)]; out.push(p); }
    return out.join("-");
  }
  function completeOrder(fd) {
    var t = totals(), orderNo = "PC-" + Date.now().toString(36).toUpperCase();
    var keys = [];
    state.cart.forEach(function (l) { for (var i = 0; i < l.qty; i++) keys.push(esc(byId(l.id).title) + ": " + fakeKey()); });
    $("modal").innerHTML =
      '<button class="x" data-close aria-label="Close">×</button>' +
      '<div class="body"><h2>🎉 Thanks, ' + esc(fd.get("name")) + "!</h2>" +
      "<p>Order <b>" + orderNo + "</b> confirmed. A (pretend) receipt was sent to " + esc(fd.get("email")) + ".</p>" +
      '<p class="meta">Total paid: ' + money(t.total) + "</p>" +
      '<div class="keys">' + keys.map(function (k) { return "<span>" + k + "</span>"; }).join("") + "</div>" +
      '<button class="btn" data-close>Keep shopping</button></div>';
    state.cart = []; state.promo = null; $("promo").value = ""; $("promo-msg").textContent = "";
    saveCart(); renderCart();
  }

  /* ---------- ui plumbing ---------- */
  function showOverlay() { $("overlay").classList.add("open"); }
  function closeAll() {
    ["overlay", "drawer", "modal"].forEach(function (id) { $(id).classList.remove("open"); });
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-genre],[data-add],[data-open],[data-inc],[data-dec],[data-rm],[data-close]");
    if (el) {
      var d = el.dataset;
      if (d.genre) { state.genre = d.genre; renderChips(); renderGrid(); }
      else if (d.add) addToCart(+d.add);
      else if (d.open) openModal(+d.open);
      else if (d.inc) changeQty(+d.inc, 1);
      else if (d.dec) changeQty(+d.dec, -1);
      else if (d.rm) { state.cart = state.cart.filter(function (l) { return l.id !== +d.rm; }); saveCart(); renderCart(); }
      else if ("close" in d) closeAll();
    } else if (e.target === $("overlay")) closeAll();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
  $("search").addEventListener("input", function (e) { state.query = e.target.value; renderGrid(); });
  $("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
  $("open-cart").addEventListener("click", openCart);
  $("apply-promo").addEventListener("click", applyPromo);
  $("promo").addEventListener("keydown", function (e) { if (e.key === "Enter") applyPromo(); });
  $("checkout-btn").addEventListener("click", openCheckout);

  // drop cart lines for games that no longer exist
  state.cart = state.cart.filter(function (l) { return byId(l.id); });
  renderChips(); renderGrid(); renderCart();
})();
