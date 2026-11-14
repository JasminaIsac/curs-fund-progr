(() => {
    "use strict";
    const list = document.getElementById("theme-list");
    function escapeHtml(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function render(data) {
        const themes = data.themes || [];
        list.innerHTML = themes.map((t) => {
            const open = t.status === "ready";
            const href = `teme/${t.slug}/index.html`;
            return `<li class="theme-card ${open ? "ready" : "soon"}">
  <span class="theme-num">${t.id}</span>
  <div class="theme-body"><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.blurb)}</p></div>
  <div class="theme-actions">
    <span class="badge ${open ? "ready" : "soon"}">${open ? "Доступна" : "Скоро"}</span>
    ${open ? `<a class="btn" href="${href}">Открыть тему</a>` : `<span class="btn ghost">Ещё не опубликована</span>`}
  </div>
</li>`;
        }).join("");
    }
    if (window.ATELIER_COURSE) render(window.ATELIER_COURSE);
    else fetch("assets/course.json").then((r) => r.json()).then(render).catch((err) => {
        list.innerHTML = `<li class="theme-card soon"><div class="theme-body"><h3>Не удалось загрузить программу</h3><p>${escapeHtml(String(err))}</p></div></li>`;
    });
})();
