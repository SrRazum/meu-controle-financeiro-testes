// Configuração do Supabase para o Meu Controle Financeiro.
// V1.15 desenvolvimento — projeto Supabase isolado de TESTES.
window.SUPABASE_URL = "https://lxsvcmsdxcwiwyzexyyc.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_veiVnXHTgGGl7QJDQhmoMA_4s7J3He0";

(function () {

  function getData() {
    try { return typeof activeData === "function" ? (activeData() || []) : []; }
    catch (e) { return []; }
  }

  function monthLabel(v) {
    const [y, mo] = v.split("-");
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
      .format(new Date(Number(y), Number(mo) - 1, 1));
  }

  function refreshReportPeriods(keepValue) {
    const select = document.getElementById("reportMonth");
    if (!select || select.tagName !== "SELECT") return;
    const old = keepValue || select.value || "__ALL__";
    const months = [...new Set(getData()
      .map(x => x && x.data ? String(x.data).slice(0, 7) : "")
      .filter(v => /^\d{4}-\d{2}$/.test(v)))]
      .sort().reverse();
    select.innerHTML = "";
    const all = document.createElement("option");
    all.value = "__ALL__";
    all.textContent = "Todos os períodos";
    select.appendChild(all);
    months.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = monthLabel(v);
      select.appendChild(opt);
    });
    select.value = months.includes(old) || old === "__ALL__" ? old : "__ALL__";
  }

  function calculateAllPeriods() {
    const arr = getData();
    const ent = arr.filter(x => x.tipo === "entrada").reduce((s, x) => s + Number(x.valor || 0), 0);
    const sai = arr.filter(x => x.tipo === "saida").reduce((s, x) => s + Number(x.valor || 0), 0);
    const pend = arr.filter(x => x.status === "pendente").reduce((s, x) => s + Number(x.valor || 0), 0);
    const money = typeof brl === "function" ? brl : (v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    const cards = document.getElementById("reportCards");
    if (cards) cards.innerHTML = [["Entradas", ent, "green"], ["Saídas", sai, "red"], ["Resultado", ent - sai, ent - sai >= 0 ? "green" : "red"], ["Contas pendentes", pend, "orange"]]
      .map(x => `<div class="card"><div class="label">${x[0]}</div><div class="value ${x[2]}">${money(x[1])}</div></div>`).join("");
    const map = {};
    arr.forEach(x => {
      const k = x.categoria || "Sem categoria";
      map[k] ??= { e: 0, s: 0 };
      map[k][x.tipo === "entrada" ? "e" : "s"] += Number(x.valor || 0);
    });
    const body = document.getElementById("catBody");
    if (body) body.innerHTML = Object.entries(map)
      .map(([k, v]) => `<tr><td>${escapeHTML(k)}</td><td class="green">${money(v.e)}</td><td class="red">${money(v.s)}</td></tr>`).join("")
      || '<tr><td colspan="3" class="empty">Sem dados registrados.</td></tr>';
  }

  function installReportFilter() {
    let el = document.getElementById("reportMonth");
    if (!el) return;
    if (el.tagName !== "SELECT") {
      const select = document.createElement("select");
      select.id = "reportMonth";
      el.replaceWith(select);
      el = select;
    }
    refreshReportPeriods();
    const originalRender = window.render;
    if (typeof originalRender !== "function") return;
    if (!originalRender.__reportAllWrapped) {
      function renderWithAllPeriods() {
        const current = document.getElementById("reportMonth");
        const period = current ? current.value : "__ALL__";
        if (period !== "__ALL__") return originalRender();
        const saved = current ? current.value : "__ALL__";
        const month = new Date().toISOString().slice(0, 7);
        if (current) current.value = month;
        originalRender();
        if (current) current.value = saved;
        calculateAllPeriods();
      }
      renderWithAllPeriods.__reportAllWrapped = true;
      window.render = renderWithAllPeriods;
    }
    el.onchange = () => window.render();
    el.value = "__ALL__";
    window.render();
  }

  window.addEventListener("DOMContentLoaded", function () {
    installReportFilter();

    let lastSignature = "";
    let attempts = 0;
    const timer = setInterval(function () {
      const select = document.getElementById("reportMonth");
      const signature = getData().map(x => `${x.id || ""}|${x.data || ""}`).join(";");
      if (select && select.tagName === "SELECT" && signature !== lastSignature) {
        const current = select.value || "__ALL__";
        refreshReportPeriods(current);
        lastSignature = signature;
      }
      if (++attempts >= 300) clearInterval(timer);
    }, 200);
  });
})();
