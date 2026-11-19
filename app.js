(() => {
  const D = window.GUIMMO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("guimmo:" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("guimmo:" + k, JSON.stringify(v)); } catch {} },
  };

  // Anciennes réservations : identifiant et statut manquants.
  store.set("trips", store.get("trips", []).map((t, i) => ({ ...t, tid: t.tid ?? `t${t.at}-${i}`, status: t.status || "attente" })));

  // Annonces publiées depuis cet appareil via le formulaire hôte
  D.listings.unshift(...store.get("myListings", []).reverse());
  const stars = (l) => (l.reviews ? `★ ${l.rating.toFixed(2)}` : "Nouveau");

  const state = {
    mode: "nuit",          // nuit | mois
    cat: "all",
    q: "",
    guests: 2,
    months: 3,
    currency: store.get("currency", "GNF"),
    lowdata: store.get("lowdata", false),
    favs: new Set(store.get("favs", [])),
    filters: new Set(),
    onlyFavs: false,
  };

  // ---------- Formatage ----------
  function money(gnf) {
    const c = state.currency;
    const v = gnf * D.rates[c];
    if (c === "GNF") {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v / 1000) * 1000) + " GNF";
    }
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Badges réalité terrain ----------
  function amenities(l) {
    const a = [];
    if (l.power === "24h") a.push(["⚡ 24h/24", ""]);
    else if (l.power === "solaire") a.push(["☀️ Solaire", ""]);
    else if (l.power === "EDG+groupe") a.push(["⚡ EDG + groupe", ""]);
    else a.push(["⚠️ Coupures EDG", "warn"]);
    a.push(l.water === "permanent" ? ["💧 Eau", ""] : ["💧 Citerne", "warn"]);
    if (l.guard) a.push(["🛡️ Gardien", ""]);
    if (l.road === "piste") a.push(["🚙 Piste", "warn"]);
    if (l.road === "bateau") a.push(["⛵ Accès bateau", "warn"]);
    return a;
  }

  // ---------- Filtrage ----------
  function matches(l) {
    if (l.paused) return false;
    if (state.onlyFavs && !state.favs.has(l.id)) return false;
    if (state.mode === "mois" && !l.month) return false;
    if (state.mode === "nuit" && !l.night) return false;
    if (state.cat !== "all" && !l.cats.includes(state.cat)) return false;
    if (l.guests < state.guests) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      if (!(l.city + " " + l.area + " " + l.title).toLowerCase().includes(q)) return false;
    }
    for (const f of state.filters) {
      if (f === "power24" && l.power !== "24h") return false;
      if (f === "water" && l.water !== "permanent") return false;
      if (f === "guard" && !l.guard) return false;
      if (f === "clim" && !l.clim) return false;
      if (f === "paved" && l.road !== "goudron") return false;
      if (f === "verified" && !l.verified) return false;
    }
    return true;
  }

  // ---------- Rendu ----------
  function renderCats() {
    $("#cats").innerHTML = D.categories.map((c) => `
      <button class="cat ${c.id === state.cat ? "active" : ""}" role="tab" aria-selected="${c.id === state.cat}" data-cat="${c.id}">
        <span class="ico" aria-hidden="true">${c.ico}</span>${esc(c.label)}
      </button>`).join("");
  }

  function renderGrid() {
    const list = D.listings.filter(matches);
    const unit = state.mode === "mois" ? "mois" : "nuit";
    $("#results-title").textContent = state.onlyFavs ? "Vos favoris"
      : state.mode === "mois" ? "Locations au mois" : "Séjours courts";
    $("#count").textContent = `${list.length} logement${list.length > 1 ? "s" : ""}`;

    if (!list.length) {
      $("#grid").innerHTML = `<p class="empty">Aucun logement ne correspond. Essayez de retirer un filtre ou d'élargir la ville.</p>`;
      return;
    }
    $("#grid").innerHTML = list.map((l) => {
      const price = state.mode === "mois" ? l.month : l.night;
      const badge = l.mine ? (l.verified ? "✅ Votre annonce" : "⏳ Votre annonce · en vérification") : l.superhost ? "Hôte de confiance" : l.verified ? "✅ Vérifié" : "";
      return `
      <article class="card" tabindex="0" data-id="${l.id}" aria-label="${esc(l.title)}">
        <div class="photo" style="background:linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})">
          ${state.lowdata ? "" : `<span aria-hidden="true">${l.emoji}</span>`}
          ${badge ? `<span class="badge">${badge}</span>` : ""}
          <button class="fav ${state.favs.has(l.id) ? "on" : ""}" data-fav="${l.id}" aria-label="Ajouter aux favoris">${state.favs.has(l.id) ? "♥" : "♡"}</button>
        </div>
        <div class="card-body">
          <div class="card-row"><span>${esc(l.area)}, ${esc(l.city)}</span><span>${stars(l)}</span></div>
          <div class="card-sub">${esc(l.title)} · ${l.rooms} ch. · ${l.guests} pers.</div>
          <div class="amen">${amenities(l).map(([t, c]) => `<span class="${c}">${t}</span>`).join("")}</div>
          <div class="price"><b>${money(price)}</b> / ${unit}</div>
        </div>
      </article>`;
    }).join("");
  }

  function setMode(mode) {
    if (mode === "hote") { hostEntry(); return; }
    state.mode = mode;
    $$(".mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $$("[data-for]").forEach((el) => el.classList.toggle("hidden", el.dataset.for !== mode));
    $("#hero-title").textContent = mode === "mois"
      ? "Louez au mois, sans démarcheur ni surprise."
      : "Trouvez un logement vérifié, partout en Guinée.";
    $("#hero-sub").textContent = mode === "mois"
      ? "Avance, caution et charges affichées dès le départ. Visite virtuelle ou avec un agent avant de payer."
      : "Chaque annonce est visitée par un agent Guimmo. Courant, eau et accès route indiqués honnêtement.";
    renderGrid();
  }

  // ---------- Fiche détaillée + réservation ----------
  function nights() {
    const a = new Date($("#in").value), b = new Date($("#out").value);
    const n = Math.round((b - a) / 86400000);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  function quote(l) {
    if (state.mode === "mois") {
      const m = state.months;
      const advanceMonths = Math.max(l.advance, 1);
      const advance = l.month * Math.min(advanceMonths, m);
      const deposit = l.month * l.deposit;
      const fee = Math.round(l.month * 0.05);
      return {
        lines: [
          [`Loyer ${money(l.month)} × ${Math.min(advanceMonths, m)} mois d'avance`, advance],
          [`Caution (remboursable) ${l.deposit} mois`, deposit],
          ["Frais Guimmo (5 % d'un mois, pas de démarcheur)", fee],
        ],
        total: advance + deposit + fee,
        hostShare: advance,
        months: m,
        note: `Durée choisie : ${m} mois. Les mois suivants sont payés directement chaque mois via Mobile Money.`,
      };
    }
    const n = nights();
    const base = l.night * n;
    const fee = Math.round(base * 0.06);
    return {
      lines: [[`${money(l.night)} × ${n} nuit${n > 1 ? "s" : ""}`, base], ["Frais de service Guimmo", fee]],
      total: base + fee,
      hostShare: Math.round(base * 0.92),
      nights: n,
      note: "Annulation gratuite jusqu'à 48 h avant l'arrivée. L'argent est versé à l'hôte après votre entrée.",
    };
  }

  function openDetail(id) {
    const l = D.listings.find((x) => x.id === id);
    // Annonce sans prix dans le mode courant (ex. ouverte depuis l'espace hôte) : on bascule de mode.
    if (!(state.mode === "mois" ? l.month : l.night)) setMode(l.month ? "mois" : "nuit");
    const q = quote(l);
    const fact = (ok, label) => `<div class="${ok ? "" : "no"}">${label}</div>`;
    const dlg = $("#detail");
    dlg.innerHTML = `
      <div class="d-photo" style="background:linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})">
        ${state.lowdata ? "" : `<span aria-hidden="true">${l.emoji}</span>`}
        <button class="d-close" aria-label="Fermer">✕</button>
      </div>
      <div class="d-body">
        <div>
          <h2 id="d-title">${esc(l.title)}</h2>
          <div class="muted">${esc(l.area)}, ${esc(l.city)} · ${stars(l)}${l.reviews ? ` (${l.reviews} avis)` : ""} ${l.verified ? "· ✅ Vérifié par un agent" : "· ⏳ Vérification en attente"}</div>
          <div class="d-section"><p style="margin:0">${esc(l.desc)}</p></div>
          <div class="d-section">
            <h4>Réalités du logement</h4>
            <div class="facts">
              <div>⚡ <b>Électricité :</b> ${esc(l.powerNote)}</div>
              <div>💧 <b>Eau :</b> ${esc(l.waterNote)}</div>
              <div>🛣️ <b>Accès :</b> ${l.road === "goudron" ? "Route goudronnée" : l.road === "piste" ? "Piste (4x4 conseillé en saison des pluies)" : "Par bateau"}</div>
              <div>📶 <b>Internet :</b> ${esc(l.wifi)}</div>
              ${fact(l.guard, "🛡️ Gardien de nuit")}
              ${fact(l.clim, "❄️ Climatisation")}
            </div>
          </div>
          <div class="d-section">
            <h4>Votre hôte</h4>
            <div class="host-line">
              <div class="avatar">${esc(l.host[0])}</div>
              <div><b>${esc(l.host)}</b>${l.superhost ? " · Hôte de confiance" : ""}<br>
              <span class="muted">Parle ${l.hostLangs.map(esc).join(", ")}</span></div>
            </div>
          </div>
        </div>
        <aside class="book" id="book">
          <div><span class="big">${money(state.mode === "mois" ? l.month : l.night)}</span> / ${state.mode === "mois" ? "mois" : "nuit"}</div>
          <div class="lines">
            ${q.lines.map(([t, v]) => `<div><span>${t}</span><span>${money(v)}</span></div>`).join("")}
            <div class="total"><span>À payer maintenant</span><span>${money(q.total)}</span></div>
          </div>
          <div class="pay" role="radiogroup" aria-label="Moyen de paiement">
            <label><input type="radio" name="pay" value="om" checked> 🟠 Orange Money</label>
            <label><input type="radio" name="pay" value="momo"> 🟡 MTN MoMo</label>
            <label><input type="radio" name="pay" value="card"> 💳 Carte (diaspora)</label>
            <label><input type="radio" name="pay" value="cash"> 💵 Acompte 30 % mobile + espèces à l'arrivée</label>
            <input type="tel" id="phone" placeholder="Numéro, ex. 62X XX XX XX" inputmode="tel" aria-label="Numéro Mobile Money">
          </div>
          <button class="btn-primary" id="confirm">Réserver</button>
          <p class="note">${q.note}</p>
        </aside>
      </div>`;
    dlg.showModal();
    $(".d-close", dlg).onclick = () => dlg.close();
    $$('input[name="pay"]', dlg).forEach((r) => r.onchange = () => {
      $("#phone", dlg).classList.toggle("hidden", r.value === "card" && r.checked);
    });
    $("#confirm", dlg).onclick = () => {
      const pay = $('input[name="pay"]:checked', dlg).value;
      const phone = $("#phone", dlg).value.replace(/\s/g, "");
      if (pay !== "card" && !/^(\+?224)?6\d{8}$/.test(phone)) {
        $("#phone", dlg).focus();
        $("#phone", dlg).setCustomValidity("Numéro guinéen à 9 chiffres commençant par 6");
        $("#phone", dlg).reportValidity();
        return;
      }
      const trips = store.get("trips", []);
      trips.push({
        tid: "t" + Date.now(), id: l.id, at: Date.now(), mode: state.mode, status: "attente",
        in: state.mode === "nuit" ? $("#in").value : "", out: state.mode === "nuit" ? $("#out").value : "", nights: q.nights, months: q.months, guests: state.guests,
        total: q.total, hostShare: q.hostShare, pay, phone: pay === "card" ? "" : phone.replace(/^(\+?224)?(\d{3})(\d{2})(\d{2})(\d{2})$/, "$2 $3 $4 $5"),
      });
      store.set("trips", trips);
      window.refreshHostSpace?.();
      const method = { om: "Orange Money", momo: "MTN MoMo", card: "carte bancaire", cash: "Mobile Money (acompte)" }[pay];
      $("#book", dlg).innerHTML = `
        <div class="ok">
          <div class="big">Demande envoyée ✓</div>
          <p>Validez le paiement de <b>${money(pay === "cash" ? q.total * 0.3 : q.total)}</b> sur votre téléphone (${method}).</p>
          <p class="muted">${esc(l.host)} vous contactera sur WhatsApp sous 2 h. Le support Guimmo reste joignable 7j/7.</p>
          <div class="host-btns">
            <button class="btn-primary" id="follow">Suivre ma demande</button>
            <button class="btn-ghost" onclick="this.closest('dialog').close()">Fermer</button>
          </div>
        </div>`;
      $("#follow", dlg).onclick = () => { dlg.close(); window.openTraveler(); };
    };
  }

  // ---------- Calculateur hôte ----------
  function renderCalc() {
    const n = +$("#calc-n").value;
    $("#calc-n-out").textContent = n;
    $("#calc-out").textContent = money(+$("#calc-city").value * n * 0.92);
  }

  // ---------- Événements ----------
  $("#places").innerHTML = D.places.map((p) => `<option value="${esc(p)}">`).join("");
  $("#currency").value = state.currency;
  $("#lowdata").checked = state.lowdata;
  document.body.classList.toggle("lowdata", state.lowdata);

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  $("#in").value = iso(new Date(today.getTime() + 7 * 864e5));
  $("#out").value = iso(new Date(today.getTime() + 10 * 864e5));
  $("#in").min = iso(today);

  $$(".mode").forEach((b) => b.onclick = () => setMode(b.dataset.mode));
  $("#cats").onclick = (e) => {
    const b = e.target.closest(".cat"); if (!b) return;
    state.cat = b.dataset.cat; renderCats(); renderGrid();
  };
  $$(".filters input").forEach((i) => i.onchange = () => {
    i.checked ? state.filters.add(i.dataset.f) : state.filters.delete(i.dataset.f); renderGrid();
  });
  $("#search").onsubmit = (e) => {
    e.preventDefault();
    state.q = $("#q").value.trim();
    state.guests = Math.max(1, +$("#guests").value || 1);
    state.months = +$("#months").value;
    state.onlyFavs = false;
    renderGrid();
    $("#explore").scrollIntoView();
  };
  $("#grid").onclick = (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.stopPropagation();
      const id = +fav.dataset.fav;
      state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
      store.set("favs", [...state.favs]);
      renderGrid();
      return;
    }
    const card = e.target.closest(".card"); if (card) openDetail(+card.dataset.id);
  };
  $("#grid").onkeydown = (e) => {
    const card = e.target.closest(".card");
    if (card && e.key === "Enter") openDetail(+card.dataset.id);
  };
  $("#currency").onchange = (e) => { state.currency = e.target.value; store.set("currency", state.currency); renderGrid(); renderCalc(); };
  $("#lowdata").onchange = (e) => {
    state.lowdata = e.target.checked; store.set("lowdata", state.lowdata);
    document.body.classList.toggle("lowdata", state.lowdata); renderGrid();
  };
  $("#calc-n").oninput = renderCalc;
  $("#calc-city").onchange = renderCalc;
  $("#host-cta").onclick = () => window.openHostForm();
  $("#host-space-cta").onclick = () => window.openHostSpace();
  $("#trips-btn").onclick = () => window.openTraveler();
  // « Devenir hôte » : ouvre l'espace hôte si on a déjà publié, sinon le formulaire.
  function hostEntry() {
    store.get("myListings", []).length ? window.openHostSpace() : window.openHostForm();
  }
  function refresh() {
    renderGrid();
    const n = store.get("myListings", []).length;
    $("#host-space-cta").classList.toggle("hidden", !n);
    $("#host-space-cta").textContent = `Gérer mes annonces (${n})`;
  }
  window.GuimmoApp = { store, money, refresh, openDetail };
  $$(".tabbar a").forEach((a) => a.onclick = (e) => {
    $$(".tabbar a").forEach((x) => x.classList.toggle("active", x === a));
    if (a.dataset.nav === "favs") { e.preventDefault(); state.onlyFavs = true; renderGrid(); $("#explore").scrollIntoView(); }
    else if (a.dataset.nav === "trips") { e.preventDefault(); window.openTraveler(); }
    else if (a.dataset.nav === "host") { e.preventDefault(); hostEntry(); }
    else state.onlyFavs = false, renderGrid();
  });

  renderCats();
  refresh();
  renderCalc();
})();
