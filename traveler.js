// Espace voyageur : mes séjours (suivi, annulation) et messagerie avec l'hôte.
// La messagerie est partagée avec l'espace hôte : window.openChat(tid, "guest" | "host").
(() => {
  const D = window.GUIMMO;
  const G = window.GuimmoApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const PAY = { om: "🟠 Orange Money", momo: "🟡 MTN MoMo", card: "💳 Carte", cash: "💵 Acompte + espèces" };
  const STATUS = {
    attente: ["En attente de l'hôte", "wait"], acceptee: ["Confirmée", "ok"],
    refusee: ["Refusée par l'hôte", "no"], annulee: ["Annulée", "no"],
  };
  const CANCEL_LIMIT = 48 * 3600e3;
  const day = (s) => new Date(s + "T12:00");
  const fmtDate = (s) => day(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const fmtTime = (t) => new Date(t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const trips = () => G.store.get("trips", []);
  const listing = (id) => D.listings.find((l) => l.id === id);
  const msgs = () => G.store.get("msgs", {});

  // ---------- Règles ----------
  function arrival(t) { return t.mode === "nuit" && t.in ? day(t.in).getTime() : null; }
  function isPast(t) {
    if (t.mode !== "nuit" || !t.out) return false;
    return day(t.out).getTime() < Date.now() - 864e5;
  }
  // Annulation gratuite jusqu'à 48 h avant l'arrivée (séjours courts) ; au mois, tant que l'entrée n'a pas eu lieu.
  function cancelState(t) {
    if (!["attente", "acceptee"].includes(t.status)) return null;
    const a = arrival(t);
    if (a && a - Date.now() < CANCEL_LIMIT) return "late";
    return "free";
  }

  // ---------- Espace voyageur ----------
  const dlg = document.createElement("dialog");
  dlg.id = "traveler-space";
  dlg.setAttribute("aria-labelledby", "ts-title");
  document.body.appendChild(dlg);
  let confirmCancel = null;

  function tripRow(t) {
    const l = listing(t.id);
    const [label, cls] = STATUS[t.status] || STATUS.attente;
    const when = t.mode === "mois"
      ? `Location ${t.months || "?"} mois · date d'entrée à convenir avec l'hôte`
      : t.in && t.out ? `${fmtDate(t.in)} → ${fmtDate(t.out)} · ${t.nights} nuit${t.nights > 1 ? "s" : ""}` : "Séjour court";
    const unread = (msgs()[t.tid] || []).filter((m) => m.from === "host" && !m.readGuest).length;
    const cs = cancelState(t);
    let info = "";
    if (t.status === "attente") info = "L'hôte répond en général sous 2 h. Votre paiement est bloqué par Guimmo et remboursé s'il refuse.";
    if (t.status === "acceptee") info = l ? `Adresse et repère : ${esc(l.area)}, ${esc(l.city)}. L'hôte vous appelle sur WhatsApp la veille.` : "";
    if (t.status === "refusee") info = "Remboursement intégral sous 24 h. Vous pouvez réserver un autre logement.";
    if (t.status === "annulee") info = "Remboursement intégral sous 24 h sur le moyen de paiement utilisé.";

    return `
      <article class="hs-item trip ${t.status === "annulee" || t.status === "refusee" ? "is-paused" : ""}">
        ${l ? `<div class="hs-thumb" style="background:linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})" aria-hidden="true">${l.emoji}</div>` : ""}
        <div class="hs-main">
          <div class="hs-title">${l ? esc(l.title) : "Logement retiré par l'hôte"}</div>
          <div class="muted">${when}${t.guests ? ` · ${t.guests} pers.` : ""}</div>
          <div class="hs-meta">
            <span class="st ${cls}">${label}</span>
            ${t.total ? `<span><b>${G.money(t.total)}</b></span>` : ""}
            ${t.pay ? `<span>${PAY[t.pay]}</span>` : ""}
          </div>
          ${info ? `<p class="trip-info">${info}</p>` : ""}
        </div>
        <div class="hs-actions">
          ${confirmCancel === t.tid ? `
            <span class="hs-ask">Annuler cette réservation ?</span>
            <button class="btn-sm danger" data-act="cancel-yes" data-tid="${t.tid}">Oui, annuler</button>
            <button class="btn-sm" data-act="cancel-no">Garder</button>` : `
            ${l ? `<button class="btn-sm" data-act="view" data-id="${l.id}">Voir le logement</button>` : ""}
            ${l ? `<button class="btn-sm ${unread ? "ok" : ""}" data-act="chat" data-tid="${t.tid}">Message${unread ? ` (${unread})` : " à l'hôte"}</button>` : ""}
            ${cs === "free" ? `<button class="btn-sm danger-ghost" data-act="cancel" data-tid="${t.tid}">Annuler</button>` : ""}
            ${cs === "late" ? `<span class="trip-late">Moins de 48 h avant l'arrivée : contactez le support pour annuler.</span>` : ""}`}
        </div>
      </article>`;
  }

  function render() {
    const all = trips().slice().sort((a, b) => b.at - a.at);
    const upcoming = all.filter((t) => !isPast(t) && ["attente", "acceptee"].includes(t.status));
    const other = all.filter((t) => !upcoming.includes(t));
    dlg.innerHTML = `
      <div class="hs">
        <header class="hf-head">
          <h2 id="ts-title">Mes séjours</h2>
          <button type="button" class="d-close" data-act="close" aria-label="Fermer">✕</button>
        </header>
        <div class="hs-body">
          <div class="hs-head"><h3>À venir</h3></div>
          ${upcoming.length ? upcoming.map(tripRow).join("") : `<p class="empty">Aucun séjour prévu. <button class="btn-sm ok" data-act="explore">Trouver un logement</button></p>`}
          ${other.length ? `<div class="hs-head"><h3>Historique</h3></div>${other.map(tripRow).join("")}` : ""}
          <p class="note">Besoin d'aide ? Le support Guimmo répond 7j/7 sur WhatsApp, en français, pular, maninka ou sosoxui.</p>
        </div>
      </div>`;
  }

  function setStatus(tid, status) {
    G.store.set("trips", trips().map((t) => (t.tid === tid ? { ...t, status } : t)));
  }

  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    switch (b.dataset.act) {
      case "close": dlg.close(); return;
      case "explore": dlg.close(); $("#explore").scrollIntoView(); return;
      case "view": G.openDetail(+b.dataset.id); return;
      case "chat": window.openChat(b.dataset.tid, "guest"); return;
      case "cancel": confirmCancel = b.dataset.tid; break;
      case "cancel-no": confirmCancel = null; break;
      case "cancel-yes": {
        setStatus(b.dataset.tid, "annulee");
        addMsg(b.dataset.tid, "system", "Réservation annulée par le voyageur. Remboursement intégral sous 24 h.");
        confirmCancel = null;
        window.refreshHostSpace?.();
        break;
      }
    }
    render();
  });
  dlg.addEventListener("close", () => { confirmCancel = null; });

  // ---------- Messagerie ----------
  const QUICK = {
    guest: ["Bonjour, je confirme mon arrivée.", "Comment trouver le logement ?", "Y a-t-il du courant en ce moment ?", "Je suis en route, j'arrive bientôt."],
    host: ["Bienvenue ! Je vous attends.", "Je vous envoie la localisation sur WhatsApp.", "Le groupe est en marche, pas de souci.", "Le gardien vous ouvrira."],
  };
  const chat = document.createElement("dialog");
  chat.id = "chat";
  chat.setAttribute("aria-labelledby", "chat-title");
  document.body.appendChild(chat);
  let cur = { tid: null, as: "guest" };

  function addMsg(tid, from, text) {
    const all = msgs();
    all[tid] = [...(all[tid] || []), { from, text, at: Date.now() }];
    G.store.set("msgs", all);
  }

  function markRead() {
    const all = msgs();
    const key = cur.as === "guest" ? "readGuest" : "readHost";
    const other = cur.as === "guest" ? "host" : "guest";
    (all[cur.tid] || []).forEach((m) => { if (m.from === other) m[key] = true; });
    G.store.set("msgs", all);
  }

  function renderChat() {
    const t = trips().find((x) => x.tid === cur.tid);
    const l = t && listing(t.id);
    const list = msgs()[cur.tid] || [];
    const who = cur.as === "guest" ? (l ? l.host : "l'hôte") : "le voyageur";
    chat.innerHTML = `
      <div class="hs chat">
        <header class="hf-head">
          <div>
            <h2 id="chat-title">${cur.as === "guest" ? `Discussion avec ${esc(who)}` : "Discussion avec le voyageur"}</h2>
            <div class="muted chat-sub">${l ? esc(l.title) : ""}</div>
          </div>
          <button type="button" class="d-close" data-act="close" aria-label="Fermer">✕</button>
        </header>
        <div class="chat-log" aria-live="polite">
          ${list.length ? list.map((m) => m.from === "system"
            ? `<div class="msg sys">${esc(m.text)}</div>`
            : `<div class="msg ${m.from === cur.as ? "me" : "them"}">${esc(m.text)}<time>${fmtTime(m.at)}</time></div>`).join("")
            : `<p class="empty">Écrivez à ${esc(who)}. Pour votre sécurité, gardez les paiements sur Guimmo : ne versez jamais d'argent en dehors de l'application.</p>`}
        </div>
        <div class="chat-quick">${QUICK[cur.as].map((q) => `<button class="chip-btn" data-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <form class="chat-form">
          <input name="text" autocomplete="off" maxlength="500" placeholder="Votre message…" aria-label="Votre message">
          <button class="btn-primary" type="submit">Envoyer</button>
        </form>
        ${cur.as === "guest" ? `<p class="note chat-demo">Prototype : pour répondre en tant qu'hôte, ouvrez « Espace hôte » sur ce même appareil.</p>` : ""}
      </div>`;
    const log = $(".chat-log", chat);
    log.scrollTop = log.scrollHeight;
  }

  function send(text) {
    text = text.trim();
    if (!text) return;
    addMsg(cur.tid, cur.as, text);
    renderChat();
    $("input[name=text]", chat).focus();
    if (dlg.open) render();
    window.refreshHostSpace?.();
  }

  chat.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=close]")) chat.close();
    const q = e.target.closest("[data-quick]");
    if (q) send(q.dataset.quick);
  });
  chat.addEventListener("submit", (e) => {
    e.preventDefault();
    send(e.target.text.value);
  });
  chat.addEventListener("close", () => {
    if (dlg.open) render();
    window.refreshHostSpace?.();
  });

  window.openChat = (tid, as = "guest") => {
    cur = { tid, as };
    markRead();
    renderChat();
    chat.showModal();
    $("input[name=text]", chat).focus();
  };
  window.unreadFor = (tid, as) => {
    const other = as === "guest" ? "host" : "guest";
    const key = as === "guest" ? "readGuest" : "readHost";
    return (msgs()[tid] || []).filter((m) => m.from === other && !m[key]).length;
  };
  window.openTraveler = () => { confirmCancel = null; render(); if (!dlg.open) dlg.showModal(); };
})();
