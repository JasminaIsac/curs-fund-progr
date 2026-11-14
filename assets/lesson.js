/* FP.curs — markdown + интерактивные демо C (симулированный вывод) */
(() => {
    "use strict";
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } },
    };

    function dedent(text) {
        const lines = text.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
        const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
        const min = indents.length ? Math.min(...indents) : 0;
        return lines.map((l) => l.slice(min)).join("\n");
    }

    function inline(s) {
        return esc(s)
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    function splitRow(line) {
        let s = line.replace(/^\|/, "").replace(/\|$/, "");
        const cells = [];
        let cur = "";
        let inCode = false;
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === "`") {
                inCode = !inCode;
                cur += ch;
                continue;
            }
            if (ch === "|" && !inCode) {
                cells.push(cur.trim());
                cur = "";
                continue;
            }
            cur += ch;
        }
        cells.push(cur.trim());
        return cells;
    }

    function hlCpp(src) {
        const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(#\s*\w+)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])')|\b(int|double|float|char|bool|void|long|short|unsigned|auto|const|string|vector|if|else|for|while|do|switch|case|break|continue|return|true|false|nullptr|new|delete|class|struct|public|private|using|namespace|include|std)\b|(-?\d+\.?\d*|0x[0-9a-fA-F]+)|([{}();,<>=!&|+\-*/%\[\]])|(\s+)|([^\s]+)/g;
        let out = "", m;
        while ((m = re.exec(src))) {
            if (m[1]) out += `<span class="t-com">${esc(m[1])}</span>`;
            else if (m[2]) out += `<span class="t-pp">${esc(m[2])}</span>`;
            else if (m[3]) out += `<span class="t-str">${esc(m[3])}</span>`;
            else if (m[4]) {
                const kw = /^(int|double|float|char|bool|void|long|short|unsigned|string|vector|auto)$/;
                out += `<span class="${kw.test(m[4]) ? "t-type" : "t-kw"}">${esc(m[4])}</span>`;
            }
            else if (m[5]) out += `<span class="t-num">${esc(m[5])}</span>`;
            else if (m[6]) out += esc(m[6]);
            else if (m[7]) out += m[7];
            else out += esc(m[8] || "");
        }
        return out;
    }

    function renderMarkdown(src) {
        const root = document.createElement("div");
        root.className = "prose";
        const lines = dedent(src).split("\n");
        let i = 0, html = "";
        const flush = () => { if (html) { root.insertAdjacentHTML("beforeend", html); html = ""; } };

        while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) { i++; continue; }

            const fence = line.match(/^```\s*([\w+#]*)/);
            if (fence) {
                const buf = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
                i++;
                flush();
                const code = buf.join("\n");
                const lang = (fence[1] || "").toLowerCase();
                const pre = document.createElement("pre");
                pre.className = "code-block";
                pre.innerHTML = lang.includes("c") || lang === "cpp" || lang === "c++"
                    ? hlCpp(code) : esc(code);
                root.append(pre);
                continue;
            }

            const h = line.match(/^(#{3,4})\s+(.*)$/);
            if (h) {
                html += h[1].length === 3 ? `<h3>${inline(h[2])}</h3>` : `<h4>${inline(h[2])}</h4>`;
                i++; continue;
            }

            if (/^\|/.test(line) && lines[i + 1] && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
                const head = splitRow(line);
                i += 2;
                const rows = [];
                while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
                html += `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
                    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
                continue;
            }

            if (/^>/.test(line)) {
                const buf = [];
                while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
                let text = buf.join(" ");
                let kind = "info";
                const k = text.match(/^\[!(TIP|WARN|INFO|NOTE)\]\s*/i);
                if (k) {
                    kind = { tip: "tip", warn: "warn" }[k[1].toLowerCase()] || "info";
                    text = text.slice(k[0].length);
                }
                html += `<div class="callout ${kind}"><div><p>${inline(text)}</p></div></div>`;
                continue;
            }

            if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
                const ordered = /^\s*\d/.test(line);
                const items = [];
                while (i < lines.length) {
                    const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
                    if (m) { items.push(m[3]); i++; continue; }
                    if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
                        items[items.length - 1] += " " + lines[i].trim();
                        i++; continue;
                    }
                    break;
                }
                const tag = ordered ? "ol" : "ul";
                html += `<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`;
                continue;
            }

            const buf = [];
            while (
                i < lines.length && lines[i].trim() &&
                !/^(#{3,4}\s|```|>|\||\s*([-*]|\d+\.)\s)/.test(lines[i])
            ) buf.push(lines[i++].trim());
            html += `<p>${inline(buf.join(" "))}</p>`;
        }
        flush();
        return root;
    }

    async function copyText(text, btn) {
        try { await navigator.clipboard.writeText(text); }
        catch {
            const ta = document.createElement("textarea");
            ta.value = text; document.body.append(ta); ta.select();
            document.execCommand("copy"); ta.remove();
        }
        const old = btn.textContent;
        btn.textContent = "Скопировано";
        setTimeout(() => { btn.textContent = old; }, 1100);
    }

    function mountCpp(el) {
        const title = el.dataset.title || "Пример C";
        const desc = el.dataset.desc || "";
        const codeEl = $("script[type='text/cpp']", el) || $("script[type='text/plain']", el);
        const metaEl = $("script[type='application/json']", el);
        let meta = { stdout: "", variants: null };
        try { if (metaEl) meta = JSON.parse(metaEl.textContent); } catch { /* */ }
        const baseCode = codeEl ? dedent(codeEl.textContent) : "";
        codeEl?.remove();
        metaEl?.remove();

        el.innerHTML = `
            <div class="cpp-head"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ""}</div>
            <div class="cpp-knobs" hidden></div>
            <div class="cpp-grid">
                <pre class="cpp-code"></pre>
                <pre class="cpp-out"></pre>
            </div>
            <div class="cpp-actions">
                <button type="button" class="primary" data-act="run">▶ Запустить</button>
                <button type="button" data-act="copy">Копировать код</button>
                <button type="button" data-act="clear">Очистить вывод</button>
            </div>`;

        const codeView = $(".cpp-code", el);
        const outView = $(".cpp-out", el);
        const knobsBox = $(".cpp-knobs", el);
        let currentCode = baseCode;
        let currentOut = meta.stdout || "";

        function paintCode() {
            codeView.innerHTML = hlCpp(currentCode);
        }

        function run() {
            outView.textContent = currentOut || "(нет вывода)";
        }

        if (meta.variants && Array.isArray(meta.variants) && meta.variants.length) {
            knobsBox.hidden = false;
            const label = document.createElement("label");
            label.textContent = "Вариант";
            const sel = document.createElement("select");
            meta.variants.forEach((v, i) => {
                const o = document.createElement("option");
                o.value = String(i);
                o.textContent = v.label || `Вариант ${i + 1}`;
                sel.append(o);
            });
            sel.addEventListener("change", () => {
                const v = meta.variants[Number(sel.value)];
                currentCode = v.code ? dedent(v.code) : baseCode;
                currentOut = v.stdout ?? "";
                paintCode();
                outView.textContent = "";
            });
            label.append(sel);
            knobsBox.append(label);
            const first = meta.variants[0];
            currentCode = first.code ? dedent(first.code) : baseCode;
            currentOut = first.stdout ?? currentOut;
        }

        paintCode();
        $("[data-act=run]", el).addEventListener("click", run);
        $("[data-act=copy]", el).addEventListener("click", (e) => copyText(currentCode, e.currentTarget));
        $("[data-act=clear]", el).addEventListener("click", () => { outView.textContent = ""; });
    }

    function buildLesson(sec) {
        const num = sec.dataset.num || "";
        const title = sec.dataset.title || "";
        const h2 = document.createElement("h2");
        h2.innerHTML = `<span class="num">${esc(num)}</span>${esc(title)}`;
        sec.prepend(h2);
        for (const md of $$(':scope > script[type="text/markdown"]', sec)) {
            md.replaceWith(renderMarkdown(md.textContent));
        }
        $$(":scope > .cpp", sec).forEach(mountCpp);
    }

    function currentSlug() {
        const path = location.pathname.replace(/\\/g, "/");
        const m = path.match(/teme\/([^/]+)\//) || location.href.replace(/\\/g, "/").match(/teme\/([^/]+)\//);
        return m ? m[1] : null;
    }

    function fillStats() {
        const lessons = $$("section.lesson");
        if ($("#stat-sections")) $("#stat-sections").textContent = String(lessons.length);
        if ($("#stat-demos")) $("#stat-demos").textContent = String($$(".cpp").length);
        if ($("#stat-qa")) $("#stat-qa").textContent = String($$("details.qa").length);
    }

    function fillThemeNav(data) {
        const toc = $("#toc");
        if (!toc) return;
        const slug = currentSlug();
        const themes = data.themes || [];
        toc.innerHTML = themes.map((t) => {
            const num = `<span style="font-family:var(--mono);color:var(--accent)">${esc(t.id)}</span>`;
            if (t.status && t.status !== "ready") {
                return `<li><span class="toc-muted">${num} ${esc(t.title)}</span></li>`;
            }
            const cls = t.slug === slug ? ' class="active"' : "";
            return `<li><a${cls} href="../${esc(t.slug)}/index.html" data-slug="${esc(t.slug)}">${num} ${esc(t.title)}</a></li>`;
        }).join("");
        $$(".toc-hub").forEach((el) => el.remove());
        const hub = document.createElement("p");
        hub.className = "toc-hub";
        hub.innerHTML = `<a href="../../index.html">← Все темы курса</a>`;
        toc.after(hub);
    }

    function loadThemeNav() {
        fillStats();
        if (window.ATELIER_COURSE) {
            fillThemeNav(window.ATELIER_COURSE);
            return;
        }
        const s = document.createElement("script");
        s.src = "../../assets/course-data.js";
        s.onload = () => fillThemeNav(window.ATELIER_COURSE || { themes: [] });
        s.onerror = () => {
            fetch("../../assets/course.json")
                .then((r) => r.json())
                .then(fillThemeNav)
                .catch(() => fillThemeNav({ themes: [] }));
        };
        document.head.append(s);
    }

    function wireChrome() {
        const sidebar = $("#sidebar");
        const menuBtn = $("#menu");
        function setNav(open) {
            sidebar?.classList.toggle("open", open);
            menuBtn?.setAttribute("aria-expanded", open ? "true" : "false");
            if (menuBtn) menuBtn.textContent = open ? "✕" : "☰";
        }
        menuBtn?.addEventListener("click", () => setNav(!sidebar.classList.contains("open")));
        sidebar?.addEventListener("click", (e) => {
            if (e.target.closest("a[href]")) setNav(false);
        });

        const themeBtn = $("#theme");
        if (themeBtn) {
            const apply = (m) => {
                if (m === "auto") document.documentElement.removeAttribute("data-theme");
                else document.documentElement.dataset.theme = m;
                themeBtn.textContent = `Тема: ${m}`;
            };
            apply(store.get("fp-lab-theme") || "auto");
            themeBtn.addEventListener("click", () => {
                const cur = store.get("fp-lab-theme") || "auto";
                const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
                store.set("fp-lab-theme", next);
                apply(next);
            });
        }

        const search = $("#search");
        if (search) {
            search.placeholder = "Поиск темы…";
            search.setAttribute("aria-label", "Поиск темы");
        }
        search?.addEventListener("input", () => {
            const q = fold(search.value.trim());
            let n = 0;
            $$("#toc li").forEach((li) => {
                const show = !q || fold(li.textContent).includes(q);
                li.hidden = !show;
                if (show) n++;
            });
            if ($("#toc-empty")) $("#toc-empty").hidden = n > 0;
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") setNav(false);
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                e.preventDefault();
                setNav(true);
                search?.focus();
            }
        });

        const toTop = $(".to-top");
        const progress = $(".progress");
        window.addEventListener("scroll", () => {
            const max = document.documentElement.scrollHeight - innerHeight;
            if (progress) progress.style.width = max > 0 ? `${(scrollY / max) * 100}%` : "0";
            toTop?.classList.toggle("show", scrollY > 500);
        }, { passive: true });
        toTop?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    }

    function boot() {
        $$("section.lesson").forEach(buildLesson);
        loadThemeNav();
        wireChrome();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
