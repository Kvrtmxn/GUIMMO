// Espace hôte : gérer ses annonces et les demandes de réservation reçues.
(() => {
  const D = window.GUIMMO;
  const G = window.GuimmoApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const PAY = { om: "🟠 Orange Money", momo: "🟡 MTN MoMo", card: "💳 Carte", cash: "💵 Acompte + espèces" };
  const STATUS = { attente: ["En attente", "wait"], acceptee: ["Acceptée", "ok"], refusee: ["Refusée", "no"], annulee: ["Annulée par le voyageur", "no"] };
  const fmtDate = (s) => new Date(s + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const dlg = document.createElement("dialog");
  dlg.id = "host-space";
  dlg.setAttribute("aria-labelledby", "hs-title");
  document.body.appendChild(dlg);

  let confirmDel = null; // id de l'annonce dont on demande la suppression

  const mine = () => G.store.get("myListings", []);
  const saveMine = (list) => G.store.set("myListings", list);
  const trips = () => G.store.get("trips", []);

  function requests() {
    const ids = new Set(mine().map((l) => l.id));
    return trips()
      .map((t, i) => ({ ...t, tid: t.tid ?? `t${t.at}-${i}`, status: t.status || "attente" }))
      .filter((t) => ids.has(t.id))
      .sort((a, b) => b.at - a.at);
  }

  function statusOf(l) {
    if (l.paused) return ["⏸ En pause", "pause"];
    if (l.verified) return ["✅ Vérifié, en ligne", "ok"];
    return ["⏳ Vérification en attente", "wait"];
  }

  function listingRow(l, reqs) {
    const [label, cls] = statusOf(l);
    const n = reqs.filter((r) => r.id === l.id && r.status === "attente").length;
    const prices = [l.night && `${G.money(l.night)} / nuit`, l.month && `${G.money(l.month)} / mois`].filter(Boolean).join(" · ");
    const confirm = confirmDel === l.id;
    return `
      <article class="hs-item ${l.paused ? "is-paused" : ""}">
        <div class="hs-thumb" style="background:linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})" aria-hidden="true">${l.emoji}</div>
        <div class="hs-main">
          <div class="hs-title">${esc(l.title)}</div>
          <div class="muted">${esc(l.area)}, ${esc(l.city)} · ${l.rooms} ch. · ${l.guests} pers.</div>
          <div class="hs-meta"><span class="st ${cls}">${label}</span><span>${prices}</span>${n ? `<span class="st wait">${n} demande${n > 1 ? "s" : ""}</span>` : ""}</div>
        </div>
        <div class="hs-actions">
          ${confirm ? `
            <span class="hs-ask">Supprimer définitivement ?</span>
            <button class="btn-sm danger" data-act="del-yes" data-id="${l.id}">Oui, supprimer</button>
            <button class="btn-sm" data-act="del-no">Annuler</button>` : `
            <button class="btn-sm" data-act="view" data-id="${l.id}">Voir</button>
            <button class="btn-sm" data-act="edit" data-id="${l.id}">Modifier</button>
            <button class="btn-sm" data-act="pause" data-id="${l.id}">${l.paused ? "Réactiver" : "Mettre en pause"}</button>
            <button class="btn-sm danger-ghost" data-act="del" data-id="${l.id}" aria-label="Supprimer ${esc(l.title)}">Supprimer</button>`}
        </div>
      </article>`;
  }

  function requestRow(r, byId) {
    const l = byId[r.id];
    const [label, cls] = STATUS[r.status];
    const when = r.mode === "mois"
      ? `${r.months || "?"} mois${r.in ? ` à partir du ${fmtDate(r.in)}` : ""}`
      : r.in && r.out ? `${fmtDate(r.in)} → ${fmtDate(r.out)} (${r.nights} nuit${r.nights > 1 ? "s" : ""})` : "Séjour court";
    return `
      <article class="hs-item req">
        <div class="hs-main">
          <div class="hs-title">${esc(l.title)}</div>
          <div class="muted">${when}${r.guests ? ` · ${r.guests} pers.` : ""}</div>
          <div class="hs-meta">
            <span class="st ${cls}">${label}</span>
            ${r.total ? `<span><b>${G.money(r.total)}</b></span>` : ""}
            ${r.pay ? `<span>${PAY[r.pay]}</span>` : ""}
            ${r.phone ? `<span>📞 ${esc(r.phone)}</span>` : ""}
          </div>
        </div>
        <div class="hs-actions">
          ${(() => { const n = window.unreadFor?.(r.tid, "host") || 0; return `<button class="btn-sm ${n ? "ok" : ""}" data-act="chat" data-tid="${r.tid}">Message${n ? ` (${n})` : ""}</button>`; })()}
          ${r.status === "attente" ? `
            <button class="btn-sm ok" data-act="accept" data-tid="${r.tid}">Accepter</button>
            <button class="btn-sm" data-act="refuse" data-tid="${r.tid}">Refuser</button>` : ""}
        </div>
      </article>`;
  }

  function render() {
    const list = mine().slice().reverse();
    const reqs = requests();
    const byId = Object.fromEntries(list.map((l) => [l.id, l]));
    const active = list.filter((l) => !l.paused).length;
    const pending = reqs.filter((r) => r.status === "attente").length;
    // Revenu hôte : montant payé moins commission (8 % court séjour, 5 % d'un mois en long séjour, déjà inclus côté voyageur).
    const earned = reqs.filter((r) => r.status === "acceptee" && r.total).reduce((s, r) => s + (r.hostShare ?? r.total * 0.92), 0);

    dlg.innerHTML = `
      <div class="hs">
        <header class="hf-head">
          <h2 id="hs-title">Espace hôte</h2>
          <button type="button" class="d-close" data-act="close" aria-label="Fermer">✕</button>
        </header>
        <div class="hs-body">
          <div class="hs-stats">
            <div><b>${active}</b><span>annonce${active > 1 ? "s" : ""} en ligne</span></div>
            <div><b>${pending}</b><span>demande${pending > 1 ? "s" : ""} à traiter</span></div>
            <div><b>${G.money(earned)}</b><span>revenus confirmés</span></div>
          </div>

          <div class="hs-head"><h3>Mes annonces</h3><button class="btn-sm ok" data-act="new">+ Ajouter un logement</button></div>
          ${list.length ? list.map((l) => listingRow(l, reqs)).join("") : `<p class="empty">Vous n'avez pas encore publié de logement.</p>`}

          <div class="hs-head"><h3>Demandes reçues</h3></div>
          ${reqs.length ? reqs.map((r) => requestRow(r, byId)).join("") : `<p class="empty">Aucune demande pour l'instant. Elles arriveront ici, et par WhatsApp.</p>`}
          <p class="note">Prototype : tout est enregistré sur cet appareil. Les réservations que vous faites vous-même sur vos annonces apparaissent ici pour tester.</p>
        </div>
      </div>`;
  }

  function updateListing(id, fn) {
    const list = mine().map((l) => (l.id === id ? fn({ ...l }) : l));
    saveMine(list);
    const fresh = list.find((l) => l.id === id);
    const i = D.listings.findIndex((l) => l.id === id);
    if (i >= 0) D.listings[i] = fresh;
  }

  function setTripStatus(tid, status) {
    const all = trips().map((t, i) => ((t.tid ?? `t${t.at}-${i}`) === tid ? { ...t, tid, status } : t));
    G.store.set("trips", all);
  }

  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = +b.dataset.id;
    switch (b.dataset.act) {
      case "close": dlg.close(); return;
      case "new": dlg.close(); window.openHostForm(); return;
      case "edit": dlg.close(); window.openHostForm(id); return;
      case "view": G.openDetail(id); return;
      case "chat": window.openChat(b.dataset.tid, "host"); return;
      case "pause": updateListing(id, (l) => ({ ...l, paused: !l.paused })); break;
      case "del": confirmDel = id; break;
      case "del-no": confirmDel = null; break;
      case "del-yes": {
        saveMine(mine().filter((l) => l.id !== id));
        const i = D.listings.findIndex((l) => l.id === id);
        if (i >= 0) D.listings.splice(i, 1);
        confirmDel = null;
        break;
      }
      case "accept": setTripStatus(b.dataset.tid, "acceptee"); break;
      case "refuse": setTripStatus(b.dataset.tid, "refusee"); break;
    }
    G.refresh();
    render();
  });
  dlg.addEventListener("close", () => { confirmDel = null; });

  window.openHostSpace = () => { confirmDel = null; render(); if (!dlg.open) dlg.showModal(); };
  window.refreshHostSpace = () => { if (dlg.open) render(); };
})();
