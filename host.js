// Formulaire « Publier mon logement » : assistant en 5 étapes.
(() => {
  const D = window.GUIMMO;
  const G = window.GuimmoApp;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const CITIES = ["Conakry", "Coyah", "Dubréka", "Kindia", "Mamou", "Dalaba", "Pita", "Labé", "Boké", "Kamsar",
    "Kankan", "Siguiri", "Faranah", "N'Zérékoré", "Macenta", "Kissidougou", "Îles de Loos"];
  const TYPES = [
    ["meuble", "Appartement meublé", "🛋️"], ["villa", "Villa / maison", "🏡"], ["chambre", "Chambre chez l'habitant", "🛏️"],
    ["ecolodge", "Case / écolodge", "🌿"], ["mer", "Bungalow bord de mer", "🏝️"],
  ];
  const STEPS = ["Logement", "Réalités", "Capacité", "Prix", "Vérification"];
  const DRAFT_KEY = "hostDraft";

  let step = 0;
  let editId = null; // id de l'annonce en cours de modification, sinon null
  const blank = () => ({
    type: "", city: "Conakry", area: "", landmark: "", title: "", desc: "",
    power: "", powerNote: "", water: "", waterNote: "", road: "goudron", wifi: "4G",
    guard: false, clim: false, guests: 2, rooms: 1, photos: 0,
    modes: ["nuit"], night: "", month: "", advance: 3, deposit: 1,
    payout: "om", payoutPhone: "", hostName: "", langs: ["Français"],
    idType: "cni", proof: "", visitDay: "", visitSlot: "matin", accept: false,
  });
  let data = { ...blank(), ...(G.store.get(DRAFT_KEY, null) || {}) };

  // Annonces publiées avant l'espace hôte : on reconstitue le formulaire depuis l'annonce.
  function formFrom(l) {
    if (l.form) return { ...blank(), ...l.form, accept: false };
    const powerNotes = ["Courant 24h/24", "EDG + groupe", "Solaire", "EDG seulement, coupures possibles"];
    return {
      ...blank(), type: l.cats[0], city: l.city, area: l.area, title: l.title, desc: l.desc,
      power: l.power, powerNote: powerNotes.includes(l.powerNote) ? "" : l.powerNote,
      water: l.water, road: l.road, wifi: l.wifi, guard: l.guard, clim: l.clim,
      guests: l.guests, rooms: l.rooms, modes: [l.night && "nuit", l.month && "mois"].filter(Boolean),
      night: l.night || "", month: l.month || "", advance: l.advance, deposit: l.deposit,
      hostName: l.host, langs: l.hostLangs,
    };
  }

  const radio = (name, value, label, extra = "") =>
    `<label class="opt"><input type="radio" name="${name}" value="${esc(value)}" ${data[name] === value ? "checked" : ""}> ${label}${extra ? `<small>${extra}</small>` : ""}</label>`;
  const check = (name, label) =>
    `<label class="opt"><input type="checkbox" name="${name}" ${data[name] ? "checked" : ""}> ${label}</label>`;
  const multi = (name, value, label) =>
    `<label class="opt"><input type="checkbox" data-multi="${name}" value="${esc(value)}" ${data[name].includes(value) ? "checked" : ""}> ${label}</label>`;

  function view() {
    switch (step) {
      case 0: return `
        <h3>Quel type de logement proposez-vous ?</h3>
        <div class="opts cols">${TYPES.map(([v, l, i]) => radio("type", v, `${i} ${l}`)).join("")}</div>
        <div class="row2">
          <label class="fld">Ville
            <select name="city">${CITIES.map((c) => `<option ${c === data.city ? "selected" : ""}>${c}</option>`).join("")}</select>
          </label>
          <label class="fld">Quartier
            <input name="area" value="${esc(data.area)}" placeholder="ex. Kipé, Lambanyi, Tata…" required>
          </label>
        </div>
        <label class="fld">Point de repère
          <input name="landmark" value="${esc(data.landmark)}" placeholder="ex. Derrière la pharmacie Kipé, 2e rue après le carrefour">
          <small>En Guinée, on se repère aux lieux connus : c'est ce que l'agent et les voyageurs utiliseront.</small>
        </label>
        <label class="fld">Titre de l'annonce
          <input name="title" value="${esc(data.title)}" maxlength="60" placeholder="ex. Appartement calme proche de la corniche" required>
        </label>
        <label class="fld">Description
          <textarea name="desc" rows="3" maxlength="500" placeholder="Ce qui rend votre logement agréable, ce qu'il y a autour…">${esc(data.desc)}</textarea>
        </label>`;

      case 1: return `
        <h3>Les réalités du logement</h3>
        <p class="muted">Soyez honnête : les voyageurs comparent sur ces critères, et l'agent les vérifie sur place.</p>
        <fieldset><legend>⚡ Électricité</legend>
          <div class="opts">
            ${radio("power", "24h", "24h/24", "EDG + groupe automatique ou onduleur")}
            ${radio("power", "EDG+groupe", "EDG + groupe à certaines heures")}
            ${radio("power", "solaire", "Solaire")}
            ${radio("power", "EDG", "EDG seulement", "coupures possibles")}
          </div>
          <input name="powerNote" value="${esc(data.powerNote)}" placeholder="Précision, ex. groupe de 18 h à 6 h">
        </fieldset>
        <fieldset><legend>💧 Eau</legend>
          <div class="opts">
            ${radio("water", "permanent", "Eau permanente", "forage ou SEG + réservoir")}
            ${radio("water", "citerne", "Citerne / bidons")}
          </div>
          <input name="waterNote" value="${esc(data.waterNote)}" placeholder="Précision, ex. forage + surpresseur">
        </fieldset>
        <fieldset><legend>🛣️ Accès</legend>
          <div class="opts">
            ${radio("road", "goudron", "Route goudronnée")}
            ${radio("road", "piste", "Piste")}
            ${radio("road", "bateau", "Bateau / pirogue")}
          </div>
        </fieldset>
        <fieldset><legend>Équipements</legend>
          <div class="opts">
            ${check("guard", "🛡️ Gardien")}
            ${check("clim", "❄️ Climatisation")}
          </div>
          <label class="fld">📶 Internet
            <select name="wifi">${["Fibre", "4G Box", "Starlink", "Réseau Orange", "Réseau MTN", "Non"].map((w) => `<option ${w === data.wifi ? "selected" : ""}>${w}</option>`).join("")}</select>
          </label>
        </fieldset>`;

      case 2: return `
        <h3>Capacité et photos</h3>
        <div class="row2">
          <label class="fld">Personnes max.<input type="number" name="guests" min="1" max="30" value="${data.guests}"></label>
          <label class="fld">Chambres<input type="number" name="rooms" min="1" max="20" value="${data.rooms}"></label>
        </div>
        <label class="fld">Photos (facultatif)
          <input type="file" id="photos" accept="image/*" multiple>
          <small>${data.photos ? `${data.photos} photo(s) sélectionnée(s). ` : ""}Pas de bonnes photos ? L'agent Guimmo les prend lors de sa visite, gratuitement.</small>
        </label>
        <div class="thumbs" id="thumbs"></div>`;

      case 3: return `
        <h3>Prix et paiements</h3>
        <fieldset><legend>Type de location</legend>
          <div class="opts">
            ${multi("modes", "nuit", "Séjours courts (à la nuit)")}
            ${multi("modes", "mois", "Location au mois")}
          </div>
        </fieldset>
        <div class="row2">
          <label class="fld ${data.modes.includes("nuit") ? "" : "hidden"}" data-mode-f="nuit">Prix par nuit (GNF)
            <input type="number" name="night" min="50000" step="10000" value="${data.night}" placeholder="ex. 600000">
            <small id="night-hint"></small>
          </label>
          <label class="fld ${data.modes.includes("mois") ? "" : "hidden"}" data-mode-f="mois">Loyer mensuel (GNF)
            <input type="number" name="month" min="500000" step="50000" value="${data.month}" placeholder="ex. 6000000">
            <small id="month-hint"></small>
          </label>
        </div>
        <div class="row2 ${data.modes.includes("mois") ? "" : "hidden"}" data-mode-f="mois">
          <label class="fld">Avance demandée
            <select name="advance">${[1, 2, 3, 6].map((m) => `<option value="${m}" ${+data.advance === m ? "selected" : ""}>${m} mois</option>`).join("")}</select>
            <small>Guimmo recommande 3 mois maximum.</small>
          </label>
          <label class="fld">Caution
            <select name="deposit">${[0, 1, 2].map((m) => `<option value="${m}" ${+data.deposit === m ? "selected" : ""}>${m} mois</option>`).join("")}</select>
          </label>
        </div>
        <fieldset><legend>Où recevoir vos paiements ?</legend>
          <div class="opts">
            ${radio("payout", "om", "🟠 Orange Money")}
            ${radio("payout", "momo", "🟡 MTN MoMo")}
          </div>
          <input type="tel" name="payoutPhone" inputmode="tel" value="${esc(data.payoutPhone)}" placeholder="Numéro, ex. 62X XX XX XX">
        </fieldset>
        <p class="note">Commission Guimmo : 8 % sur les séjours, 5 % d'un mois sur les locations mensuelles. Aucun autre frais.</p>`;

      case 4: return `
        <h3>Vous et la visite de vérification</h3>
        <div class="row2">
          <label class="fld">Votre prénom<input name="hostName" value="${esc(data.hostName)}" required></label>
          <label class="fld">Pièce d'identité à présenter
            <select name="idType">
              <option value="cni" ${data.idType === "cni" ? "selected" : ""}>Carte d'identité</option>
              <option value="passeport" ${data.idType === "passeport" ? "selected" : ""}>Passeport</option>
              <option value="permis" ${data.idType === "permis" ? "selected" : ""}>Permis de conduire</option>
            </select>
          </label>
        </div>
        <fieldset><legend>Langues parlées</legend>
          <div class="opts">${["Français", "Pular", "Maninka", "Sosoxui", "Anglais", "Arabe"].map((l) => multi("langs", l, l)).join("")}</div>
        </fieldset>
        <fieldset><legend>Vous êtes…</legend>
          <div class="opts">
            ${radio("proof", "proprietaire", "Propriétaire", "titre foncier, acte de vente ou attestation de la mairie")}
            ${radio("proof", "mandataire", "Mandataire de la famille", "procuration signée du propriétaire")}
            ${radio("proof", "locataire", "Locataire", "contrat de bail autorisant la sous-location")}
          </div>
          <small class="muted">Montrez le document à l'agent lors de la visite. Rien à téléverser maintenant.</small>
        </fieldset>
        <div class="row2">
          <label class="fld">Jour de visite de l'agent<input type="date" name="visitDay" value="${esc(data.visitDay)}" min="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" required></label>
          <label class="fld">Créneau
            <select name="visitSlot">
              <option value="matin" ${data.visitSlot === "matin" ? "selected" : ""}>Matin (8 h-12 h)</option>
              <option value="apres-midi" ${data.visitSlot === "apres-midi" ? "selected" : ""}>Après-midi (14 h-18 h)</option>
            </select>
          </label>
        </div>
        ${check("accept", "Je confirme que les informations sont exactes et j'accepte les conditions hôte Guimmo.")}`;
    }
  }

  // ---------- Validation ----------
  const phoneOk = (p) => /^(\+?224)?6\d{8}$/.test(String(p).replace(/\s/g, ""));
  function validate() {
    const e = [];
    if (step === 0) {
      if (!data.type) e.push("Choisissez un type de logement.");
      if (!data.area.trim()) e.push("Indiquez le quartier.");
      if (data.title.trim().length < 8) e.push("Le titre doit faire au moins 8 caractères.");
    }
    if (step === 1) {
      if (!data.power) e.push("Précisez l'électricité.");
      if (!data.water) e.push("Précisez l'eau.");
    }
    if (step === 2 && (+data.guests < 1 || +data.rooms < 1)) e.push("Capacité invalide.");
    if (step === 3) {
      if (!data.modes.length) e.push("Choisissez au moins un type de location.");
      if (data.modes.includes("nuit") && !(+data.night >= 50000)) e.push("Prix par nuit : 50 000 GNF minimum.");
      if (data.modes.includes("mois") && !(+data.month >= 500000)) e.push("Loyer mensuel : 500 000 GNF minimum.");
      if (!phoneOk(data.payoutPhone)) e.push("Numéro Mobile Money guinéen à 9 chiffres commençant par 6.");
    }
    if (step === 4) {
      if (!data.hostName.trim()) e.push("Indiquez votre prénom.");
      if (!data.langs.length) e.push("Choisissez au moins une langue.");
      if (!data.proof) e.push("Indiquez votre lien avec le logement.");
      if (!editId && !data.visitDay) e.push("Choisissez un jour de visite.");
      if (!data.accept) e.push("Cochez la confirmation.");
    }
    return e;
  }

  // ---------- Conseils de prix (moyenne des annonces de la même ville) ----------
  function priceHints() {
    const same = D.listings.filter((l) => l.city === data.city && !l.mine);
    const avg = (k) => {
      const v = same.map((l) => l[k]).filter(Boolean);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const n = avg("night"), m = avg("month");
    const nh = $("#night-hint"), mh = $("#month-hint");
    if (nh) nh.textContent = n ? `Moyenne à ${data.city} : ${G.money(n)} / nuit` : "";
    if (mh) mh.textContent = m ? `Moyenne à ${data.city} : ${G.money(m)} / mois` : "";
  }

  // ---------- Rendu ----------
  const dlg = document.createElement("dialog");
  dlg.id = "host-form";
  dlg.setAttribute("aria-labelledby", "hf-title");
  document.body.appendChild(dlg);

  function render() {
    dlg.innerHTML = `
      <form class="hf" novalidate>
        <header class="hf-head">
          <h2 id="hf-title">${editId ? "Modifier mon annonce" : "Publier mon logement"}</h2>
          <button type="button" class="d-close" data-act="close" aria-label="Fermer">✕</button>
        </header>
        <ol class="hf-steps">${STEPS.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${s}</li>`).join("")}</ol>
        <div class="hf-body">${view()}<div class="hf-err" role="alert"></div></div>
        <footer class="hf-foot">
          <button type="button" class="btn-ghost" data-act="back" ${step === 0 ? "disabled" : ""}>Retour</button>
          <span class="muted">${editId ? "" : "Brouillon enregistré"}</span>
          <button type="submit" class="btn-primary">${step === STEPS.length - 1 ? (editId ? "Enregistrer les modifications" : "Publier et réserver la visite") : "Continuer"}</button>
        </footer>
      </form>`;
    priceHints();
  }

  function sync(e) {
    const t = e.target;
    if (t.dataset.multi) {
      const k = t.dataset.multi;
      data[k] = t.checked ? [...new Set([...data[k], t.value])] : data[k].filter((x) => x !== t.value);
      if (k === "modes") $$("[data-mode-f]", dlg).forEach((el) => el.classList.toggle("hidden", !data.modes.includes(el.dataset.modeF)));
    } else if (t.id === "photos") {
      data.photos = t.files.length;
      $("#thumbs", dlg).innerHTML = [...t.files].slice(0, 8).map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join("");
    } else if (t.name) {
      data[t.name] = t.type === "checkbox" ? t.checked : t.value;
      if (t.name === "city") priceHints();
    }
    if (!editId) G.store.set(DRAFT_KEY, data);
  }

  function publish() {
    const type = TYPES.find(([v]) => v === data.type);
    const tints = { meuble: ["#0b6b45", "#7fc8a9"], villa: ["#1f6f8b", "#99d5e5"], chambre: ["#9a3412", "#fed7aa"], ecolodge: ["#3f6212", "#d9f99d"], mer: ["#0e7490", "#fcd34d"] };
    const powerNotes = { "24h": "Courant 24h/24", "EDG+groupe": "EDG + groupe", solaire: "Solaire", EDG: "EDG seulement, coupures possibles" };
    const prev = editId ? G.store.get("myListings", []).find((l) => l.id === editId) : null;
    const listing = {
      id: prev ? prev.id : Date.now(), mine: true, title: data.title.trim(), city: data.city, area: data.area.trim(),
      cats: [data.type, ...(+data.guests >= 6 ? ["famille"] : [])],
      night: data.modes.includes("nuit") ? +data.night : null,
      month: data.modes.includes("mois") ? +data.month : null,
      rating: null, reviews: 0, guests: +data.guests, rooms: +data.rooms,
      emoji: type[2], tint: tints[data.type],
      power: data.power, powerNote: data.powerNote || powerNotes[data.power],
      water: data.water, waterNote: data.waterNote || (data.water === "permanent" ? "Eau permanente" : "Citerne / bidons"),
      guard: data.guard, clim: data.clim, road: data.road, wifi: data.wifi, verified: false,
      host: data.hostName.trim(), hostLangs: data.langs, superhost: false,
      advance: +data.advance, deposit: +data.deposit,
      desc: [data.desc.trim(), data.landmark.trim() && `Repère : ${data.landmark.trim()}.`].filter(Boolean).join(" "),
      form: { ...data, accept: false },
    };
    if (prev) {
      // On garde l'historique : avis, statut de vérification, pause.
      Object.assign(listing, { rating: prev.rating, reviews: prev.reviews, verified: prev.verified, paused: prev.paused, superhost: prev.superhost });
    }
    const mine = G.store.get("myListings", []);
    if (prev) mine[mine.findIndex((l) => l.id === prev.id)] = listing;
    else mine.push(listing);
    G.store.set("myListings", mine);
    if (prev) {
      D.listings[D.listings.findIndex((l) => l.id === prev.id)] = listing;
      G.refresh();
      editId = null;
      data = { ...blank(), ...(G.store.get(DRAFT_KEY, null) || {}) };
      step = 0;
      dlg.close();
      window.openHostSpace();
      return;
    }
    G.store.set(DRAFT_KEY, null);
    D.listings.unshift(listing);
    G.refresh();

    const day = new Date(data.visitDay + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    dlg.innerHTML = `
      <div class="hf-done">
        <div class="big">Annonce enregistrée ✓</div>
        <p><b>${esc(listing.title)}</b>, ${esc(listing.area)}, ${esc(listing.city)}</p>
        <p>Un agent Guimmo passera le <b>${day}</b> (${data.visitSlot === "matin" ? "8 h-12 h" : "14 h-18 h"}). Il vous appellera la veille sur WhatsApp.</p>
        <p class="muted">Préparez votre ${{ cni: "carte d'identité", passeport: "passeport", permis: "permis de conduire" }[data.idType]} et le justificatif de ${data.proof === "proprietaire" ? "propriété" : data.proof === "mandataire" ? "procuration" : "bail"}.
        En attendant, votre annonce est visible avec la mention « Vérification en attente ».</p>
        <div class="host-btns center">
          <button class="btn-primary" data-act="close">Voir mon annonce</button>
          <button class="btn-ghost" data-act="space">Gérer mes annonces</button>
        </div>
      </div>`;
    data = blank();
    step = 0;
  }

  dlg.addEventListener("input", sync);
  dlg.addEventListener("change", sync);
  dlg.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close") {
      dlg.close();
      if (e.target.closest(".hf-done")) document.querySelector("#explore").scrollIntoView();
    }
    if (act === "space") { dlg.close(); window.openHostSpace(); }
    if (act === "back" && step > 0) { step--; render(); }
  });
  dlg.addEventListener("submit", (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) {
      const box = $(".hf-err", dlg);
      box.innerHTML = errs.map((x) => `<div>• ${esc(x)}</div>`).join("");
      box.scrollIntoView({ block: "nearest" });
      return;
    }
    if (step < STEPS.length - 1) { step++; render(); $(".hf-body", dlg).scrollTop = 0; }
    else publish();
  });

  // Fermer sans enregistrer une modification : on retrouve le brouillon de nouvelle annonce.
  dlg.addEventListener("close", () => {
    if (editId) { editId = null; step = 0; data = { ...blank(), ...(G.store.get(DRAFT_KEY, null) || {}) }; }
  });

  window.openHostForm = (id) => {
    const l = id && G.store.get("myListings", []).find((x) => x.id === id);
    if (l) { editId = l.id; data = formFrom(l); step = 0; }
    render();
    dlg.showModal();
  };
})();
