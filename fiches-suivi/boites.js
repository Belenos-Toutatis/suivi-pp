// Répond automatiquement aux fenêtres internes de l'appli (comme page.on("dialog") le faisait pour confirm/alert/prompt).
// o.messages : tableau où noter les messages ; o.decide(type, message) → true (bouton principal) ou false (Annuler) ;
// o.reponse() → texte à saisir (sinon la valeur proposée est gardée) ; o.compter() appelé à chaque fenêtre.
module.exports = async (page, o = {}) => {
  await page.exposeFunction("__boiteNotifier", (message, type, titre) => {
    if (o.messages) o.messages.push((titre ? titre + "\n" : "") + message);
    if (o.compter) o.compter();
    const accept = o.decide ? o.decide(type, message) : true;
    const r = type === "saisie" && o.reponse ? o.reponse() : undefined;
    return { accept, valeur: r === undefined || r === null ? null : String(r) };
  });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("boite-ouverte", async e => {
      const d = e.target, r = await window.__boiteNotifier(e.detail.message, e.detail.type, e.detail.titre);
      const champ = d.querySelector("#boite-champ");
      if (r.valeur !== null && /^\{/.test(r.valeur)) {          // fenêtre à plusieurs champs : { id: valeur, nomRadio: valeur }
        for (const [k, v] of Object.entries(JSON.parse(r.valeur))) { const el = d.querySelector("#" + k); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = v; } else { const rb = d.querySelector(`input[name="${k}"][value="${v}"]`); if (rb) rb.checked = true; } }
      } else if (champ && r.valeur !== null) champ.value = r.valeur;
      const b = d.querySelector(r.accept ? '[data-r="oui"]' : '[data-r="non"]') || d.querySelector('[data-r="oui"]');
      if (b) b.click();
    });
  });
  page.on("dialog", d => { if (o.messages) o.messages.push(d.message()); d.accept(); });   // beforeunload, vieux navigateur
};
