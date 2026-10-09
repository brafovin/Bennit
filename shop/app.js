(function () {
  "use strict";
  var GAMES = window.GAMES;
  var CART_KEY = "pixelcrate-cart", WALLET_KEY = "pixelcrate-wallet", ORDERS_KEY = "pixelcrate-orders";
  var PROMOS = { WELCOME10: 0.10, GAMER20: 0.20 };
  var state = { genre: "All", query: "", sort: "featured", cart: loadCart(), promo: null, wallet: loadNum(WALLET_KEY, 150), orders: loadOrders() };

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
      '<div class="tags"><span class="tag">' + esc(g.genre) + '</span><span class="tag">' + g.year + "</span>" + (g.age ? '<span class="tag">' + esc(g.age) + "</span>" : "") +
      g.platforms.map(function (p) { return '<span class="tag">' + esc(p) + "</span>"; }).join("") + "</div>" +
      "<p>" + esc(g.desc) + "</p>" +
      '<p class="meta">' + etaSummary() + "</p>" +
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
    $("eta-hint").textContent = etaSummary();
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

  /* ---------- wallet (fake money) ---------- */
  function loadNum(key, def) { try { var v = parseFloat(localStorage.getItem(key)); return isFinite(v) ? v : def; } catch (e) { return def; } }
  function saveWallet() { try { localStorage.setItem(WALLET_KEY, String(state.wallet)); } catch (e) {} }
  function renderWallet() { $("wallet").textContent = money(state.wallet); }
  function topUp() { state.wallet = round2(state.wallet + 50); saveWallet(); renderWallet(); toast("+ $50.00 fake money"); var h = $("balance-hint"); if (h) updateCheckout(); }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------- delivery ---------- */
  // Demo speed: delivery takes seconds instead of minutes so you can watch the whole thing.
  var DELIVERY = [
    { id: "standard", label: "Standard", icon: "🚚", fee: 0,    min: 90, max: 150 },
    { id: "express",  label: "Express",  icon: "🛵", fee: 4.99, min: 40, max: 70 },
    { id: "instant",  label: "Instant",  icon: "⚡", fee: 9.99, min: 15, max: 30 }
  ];
  var DRIVERS = ["Max", "Lena", "Tariq", "Sofia", "Noah", "Mia", "Jonas", "Aylin"];
  var VEHICLES = ["Scooter", "E-Bike", "Van", "Motorbike"];
  var GRID = { cols: 6, rows: 5, ox: 30, oy: 30, dx: 60, dy: 45 };
  function deliveryOf(id) { return DELIVERY.filter(function (d) { return d.id === id; })[0]; }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2); }
  function range(d) { return mmss(d.min) + "–" + mmss(d.max) + " min"; }
  function etaSummary() { return "🚚 Delivery: " + DELIVERY.map(function (d) { return d.label + " ~" + range(d); }).join(" · ") + " (demo speed)"; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }

  function makeRoute() {
    var shop, home;
    do {
      shop = [rint(0, GRID.cols - 1), rint(0, GRID.rows - 1)];
      home = [rint(0, GRID.cols - 1), rint(0, GRID.rows - 1)];
    } while (Math.abs(shop[0] - home[0]) + Math.abs(shop[1] - home[1]) < 4);
    var cur = shop.slice(), pts = [cur.slice()], steps = 0;
    while (cur[0] !== home[0] || cur[1] !== home[1]) {
      var canX = cur[0] !== home[0], canY = cur[1] !== home[1];
      var moveX = canX && (!canY || Math.random() < 0.5);
      if (moveX) cur[0] += home[0] > cur[0] ? 1 : -1; else cur[1] += home[1] > cur[1] ? 1 : -1;
      steps++;
      var n = pts.length;
      // merge collinear steps so the polyline only keeps the turns
      if (n >= 2 && ((pts[n - 1][0] === pts[n - 2][0] && cur[0] === pts[n - 1][0]) || (pts[n - 1][1] === pts[n - 2][1] && cur[1] === pts[n - 1][1]))) pts[n - 1] = cur.slice();
      else pts.push(cur.slice());
    }
    return { shop: shop, home: home, route: pts, km: round2(steps * 0.4) };
  }

  /* ---------- checkout (fake money) ---------- */
  function openCheckout() {
    if (!state.cart.length) return;
    closeAll(); showOverlay();
    $("modal").innerHTML =
      '<button class="x" data-close aria-label="Close">×</button>' +
      '<div class="body"><h2>Checkout</h2><p class="meta">Test mode — you pay with fake PixelCoins. No real money involved.</p></div>' +
      '<form class="checkout" id="checkout-form">' +
      '<label>Full name<input name="name" required autocomplete="name"></label>' +
      '<div class="two"><label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label>Delivery address<input name="address" required autocomplete="street-address" placeholder="Fake Street 1"></label></div>' +
      '<div class="delivery">' + DELIVERY.map(function (d, i) {
        return '<label class="opt"><input type="radio" name="delivery" value="' + d.id + '"' + (i === 0 ? " checked" : "") + '><span>' + d.icon + " <b>" + d.label + "</b><small>Arrives in ~" + range(d) + '</small></span><span>' + (d.fee ? money(d.fee) : "Free") + "</span></label>";
      }).join("") + "</div>" +
      '<div class="sum" id="sum"></div><div class="row"><div class="warn" id="balance-hint"></div><button type="button" class="btn ghost" data-topup>+ $50 🪙</button></div>' +
      '<button class="btn green" type="submit" id="pay-btn"></button></form>';
    $("modal").classList.add("open");
    var f = $("checkout-form");
    f.addEventListener("change", updateCheckout);
    f.addEventListener("submit", function (e) { e.preventDefault(); completeOrder(new FormData(e.target)); });
    updateCheckout();
  }
  function checkoutTotals() {
    var d = deliveryOf(($("checkout-form").elements.delivery || {}).value || "standard"), t = totals();
    return { d: d, t: t, fee: d.fee, total: round2(t.total + d.fee) };
  }
  function updateCheckout() {
    if (!$("checkout-form")) return;
    var c = checkoutTotals(), short = c.total > state.wallet;
    $("sum").innerHTML =
      '<div class="row"><span>Subtotal</span><span>' + money(c.t.sub) + "</span></div>" +
      (state.promo ? '<div class="row"><span>Discount</span><span>−' + money(c.t.disc) + "</span></div>" : "") +
      '<div class="row"><span>' + c.d.label + " delivery</span><span>" + (c.fee ? money(c.fee) : "Free") + "</span></div>" +
      '<div class="row total"><span>Total</span><span>' + money(c.total) + "</span></div>";
    $("balance-hint").textContent = short ? "Not enough PixelCoins (🪙 " + money(state.wallet) + "). Add fake money with the button on the right." : "Pays from your wallet: 🪙 " + money(state.wallet);
    $("balance-hint").style.color = short ? "" : "var(--muted)";
    $("pay-btn").textContent = "Pay " + money(c.total) + " with 🪙 PixelCoins";
    $("pay-btn").disabled = short;
  }
  function fakeKey() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = [];
    for (var i = 0; i < 3; i++) { var p = ""; for (var j = 0; j < 5; j++) p += c[Math.floor(Math.random() * c.length)]; out.push(p); }
    return out.join("-");
  }
  function completeOrder(fd) {
    var c = checkoutTotals();
    if (c.total > state.wallet) { updateCheckout(); return; }
    var keys = [];
    state.cart.forEach(function (l) { for (var i = 0; i < l.qty; i++) keys.push(byId(l.id).title + ": " + fakeKey()); });
    var map = makeRoute();
    var order = {
      id: "PC-" + Date.now().toString(36).toUpperCase(),
      createdAt: Date.now(),
      etaMs: Math.round(rnd(c.d.min, c.d.max) * 1000),   // random arrival time
      delivery: c.d.id, total: c.total, fee: c.fee, name: String(fd.get("name")), email: String(fd.get("email")), address: String(fd.get("address")),
      items: state.cart.map(function (l) { return { id: l.id, qty: l.qty }; }),
      keys: keys, shop: map.shop, home: map.home, route: map.route, km: map.km,
      driver: { name: DRIVERS[rint(0, DRIVERS.length - 1)], vehicle: VEHICLES[rint(0, VEHICLES.length - 1)], plate: "PC-" + rint(100, 999) }
    };
    state.wallet = round2(state.wallet - c.total); saveWallet(); renderWallet();
    state.orders.unshift(order); saveOrders();
    state.cart = []; state.promo = null; $("promo").value = ""; $("promo-msg").textContent = "";
    saveCart(); renderCart(); renderOrdersCount();
    openTracker(order.id);
  }

  /* ---------- orders + live tracking ---------- */
  function loadOrders() { try { var o = JSON.parse(localStorage.getItem(ORDERS_KEY)); return Array.isArray(o) ? o : []; } catch (e) { return []; } }
  function saveOrders() { try { localStorage.setItem(ORDERS_KEY, JSON.stringify(state.orders.slice(0, 20))); } catch (e) {} }
  function renderOrdersCount() { $("orders-count").textContent = state.orders.length; }
  function orderById(id) { return state.orders.filter(function (o) { return o.id === id; })[0]; }
  function progress(o) { return Math.min(1, (Date.now() - o.createdAt) / o.etaMs); }
  function px(p) { return [GRID.ox + p[0] * GRID.dx, GRID.oy + p[1] * GRID.dy]; }

  function pointAlong(pts, frac) {
    var segs = [], total = 0, i;
    for (i = 1; i < pts.length; i++) { var l = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    var d = frac * total;
    for (i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        var k = segs[i] ? Math.min(1, d / segs[i]) : 1;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
      }
      d -= segs[i];
    }
    return pts[0];
  }

  function mapSvg(o) {
    var W = GRID.ox * 2 + (GRID.cols - 1) * GRID.dx, H = GRID.oy * 2 + (GRID.rows - 1) * GRID.dy, i, s = "";
    for (i = 0; i < GRID.cols - 1; i++) for (var j = 0; j < GRID.rows - 1; j++)
      s += '<rect x="' + (GRID.ox + i * GRID.dx + 8) + '" y="' + (GRID.oy + j * GRID.dy + 8) + '" width="' + (GRID.dx - 16) + '" height="' + (GRID.dy - 16) + '" rx="6" fill="' + ((i * 7 + j * 3) % 5 === 0 ? "#173a2e" : "#1b2040") + '"/>';
    for (i = 0; i < GRID.cols; i++) s += '<line x1="' + (GRID.ox + i * GRID.dx) + '" y1="0" x2="' + (GRID.ox + i * GRID.dx) + '" y2="' + H + '" stroke="#2a3050" stroke-width="7"/>';
    for (i = 0; i < GRID.rows; i++) s += '<line x1="0" y1="' + (GRID.oy + i * GRID.dy) + '" x2="' + W + '" y2="' + (GRID.oy + i * GRID.dy) + '" stroke="#2a3050" stroke-width="7"/>';
    var d = o.route.map(function (p, k) { var q = px(p); return (k ? "L" : "M") + q[0] + " " + q[1]; }).join(" "), sp = px(o.shop), hp = px(o.home);
    s += '<path d="' + d + '" fill="none" stroke="#7c5cff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    s += '<path id="m-done" d="' + d + '" pathLength="100" fill="none" stroke="#00d1b2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0 100"/>';
    s += '<text x="' + sp[0] + '" y="' + (sp[1] + 7) + '" font-size="20" text-anchor="middle">🏪</text><text x="' + hp[0] + '" y="' + (hp[1] + 7) + '" font-size="20" text-anchor="middle">🏠</text>';
    s += '<g id="m-driver"><circle r="13" fill="#7c5cff" stroke="#fff" stroke-width="2"/><text y="6" font-size="16" text-anchor="middle">🛵</text></g>';
    return '<svg class="minimap" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Delivery minimap">' + s + "</svg>";
  }

  var tracker = { timer: null, id: null };
  function stopTracking() { clearInterval(tracker.timer); tracker.timer = null; tracker.id = null; }
  var STEPS = ["Order confirmed", "Packing your order", "Driver picked up your order", "Out for delivery", "Delivered"];

  function openTracker(id) {
    var o = orderById(id); if (!o) return;
    closeAll(); showOverlay(); stopTracking();
    var dl = deliveryOf(o.delivery);
    $("modal").innerHTML =
      '<button class="x" data-close aria-label="Close">×</button>' +
      '<div class="body"><div class="track-head"><div><h2>Order ' + esc(o.id) + '</h2><div class="meta">' + dl.icon + " " + dl.label + " · " + o.km.toFixed(1) + " km · to " + esc(o.address) + '</div></div>' +
      '<div class="eta"><span class="meta" id="t-label"></span><b id="t-count">–</b><span class="meta" id="t-clock"></span></div></div>' +
      mapSvg(o) + '<div class="bar-bg"><div class="bar-fill" id="t-bar"></div></div>' +
      '<div class="driver"><span class="av">🧑‍✈️</span><span><b>' + esc(o.driver.name) + '</b> · ' + esc(o.driver.vehicle) + " · " + esc(o.driver.plate) + '<br><span class="meta" id="t-status"></span></span></div>' +
      '<ul class="steps" id="t-steps">' + STEPS.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ul>" +
      '<div id="t-keys"></div></div>';
    $("modal").classList.add("open");
    tracker.id = id; updateTracker(); tracker.timer = setInterval(updateTracker, 250);
  }

  function stageOf(t) { return t >= 1 ? 4 : t >= 0.2 ? 3 : t >= 0.12 ? 2 : t >= 0.04 ? 1 : 0; }
  function updateTracker() {
    var o = orderById(tracker.id); if (!o || !$("t-steps")) { stopTracking(); return; }
    var t = progress(o), stage = stageOf(t), move = Math.max(0, Math.min(1, (t - 0.2) / 0.8));
    var pos = px(pointAlong(o.route, move)), start = px(o.shop);
    $("m-driver").setAttribute("transform", "translate(" + (t < 0.12 ? start[0] + 14 : pos[0]) + " " + (t < 0.12 ? start[1] - 12 : pos[1]) + ")");
    $("m-done").setAttribute("stroke-dasharray", (move * 100) + " 100");
    $("t-bar").style.width = (t * 100) + "%";
    var left = (o.createdAt + o.etaMs - Date.now()) / 1000, arrive = new Date(o.createdAt + o.etaMs);
    $("t-label").textContent = t >= 1 ? "Delivered at" : "Arrives in";
    $("t-count").textContent = t >= 1 ? arrive.toLocaleTimeString() : mmss(Math.ceil(left));
    $("t-clock").textContent = t >= 1 ? "" : "ETA " + arrive.toLocaleTimeString();
    $("t-status").textContent = t >= 1 ? "Delivered — enjoy your games!" : STEPS[stage] + (stage === 3 ? " · " + Math.max(0.1, o.km * (1 - move)).toFixed(1) + " km away" : "");
    Array.prototype.forEach.call($("t-steps").children, function (li, i) { li.className = i < stage || stage === 4 ? "done" : i === stage ? "now" : ""; });
    if (t >= 1) {
      if (!$("t-keys").innerHTML) $("t-keys").innerHTML = '<div class="tags" style="margin-bottom:6px"><span class="tag">Your license keys</span></div><div class="keys">' + o.keys.map(function (k) { return "<span>" + esc(k) + "</span>"; }).join("") + "</div>";
      stopTracking();
    }
  }

  function openOrders() {
    closeAll(); showOverlay();
    $("modal").innerHTML = '<button class="x" data-close aria-label="Close">×</button><div class="body orders"><h2>Your orders</h2>' +
      (state.orders.length ? state.orders.map(function (o) {
        var done = progress(o) >= 1, n = o.items.reduce(function (s, l) { return s + l.qty; }, 0);
        return '<div class="o"><div><b>' + esc(o.id) + '</b> <span class="st ' + (done ? "ok" : "go") + '">' + (done ? "Delivered" : "On the way") + '</span><div class="meta">' + n + " game" + (n > 1 ? "s" : "") + " · " + money(o.total) + " · " + new Date(o.createdAt).toLocaleTimeString() + '</div></div><button class="btn ghost" data-track="' + esc(o.id) + '">' + (done ? "View" : "Track") + "</button></div>";
      }).join("") : '<p class="empty">No orders yet.</p>') + "</div>";
    $("modal").classList.add("open");
  }

  /* ---------- ui plumbing ---------- */
  function showOverlay() { $("overlay").classList.add("open"); }
  function closeAll() {
    stopTracking();
    ["overlay", "drawer", "modal"].forEach(function (id) { $(id).classList.remove("open"); });
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-topup],[data-track],[data-genre],[data-add],[data-open],[data-inc],[data-dec],[data-rm],[data-close]");
    if (el) {
      var d = el.dataset;
      if ("topup" in d) topUp();
      else if (d.track) openTracker(d.track);
      else if (d.genre) { state.genre = d.genre; renderChips(); renderGrid(); }
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
  $("topup").addEventListener("click", topUp);
  $("open-orders").addEventListener("click", openOrders);

  // drop cart lines for games that no longer exist
  state.cart = state.cart.filter(function (l) { return byId(l.id); });
  renderChips(); renderGrid(); renderCart(); renderWallet(); renderOrdersCount();
})();
