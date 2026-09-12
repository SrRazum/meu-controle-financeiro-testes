/* Tela Sobre — somente apresentação, sem alterar as funcionalidades do aplicativo. */
window.addEventListener("DOMContentLoaded", function () {
  const style = document.createElement("style");
  style.textContent = `
    .about-btn{background:transparent;color:#fff;border:1px solid #ffffff44;padding:7px 10px;font-size:12px}
    #aboutModal{position:fixed;inset:0;background:#0008;z-index:120;display:none;align-items:center;justify-content:center;padding:18px}
    #aboutModal.show{display:flex}
    .about-box{width:min(500px,100%);background:#fff;border-radius:16px;padding:24px;box-shadow:0 18px 60px #0004;text-align:center}
    .about-logo{width:76px;height:76px;object-fit:contain;border-radius:50%;margin-bottom:10px}
    .about-box h2{margin:4px 0 2px;color:#6d2b22}
    .about-version{font-weight:700;color:#d85a2b;margin-bottom:18px}
    .about-box p{font-size:13px;color:#76685f;line-height:1.5;margin:7px 0}
    .about-credits{margin:16px 0;padding:12px;border:1px solid #ead9ca;border-radius:10px;background:#fffaf5;text-align:left}
    .about-credits strong{color:#4a211d}
  `;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.id = "aboutModal";
  modal.innerHTML = `
    <div class="about-box">
      <img class="about-logo" src="logo.png" alt="Logo Meu Controle Financeiro">
      <h2>Meu Controle Financeiro</h2>
      <div class="about-version">V1.15 — desenvolvimento</div>
      <p><strong>Proprietário / Desenvolvedor</strong><br>SrRazum</p>
      <p>© 2026 SrRazum. Todos os direitos reservados.</p>
      <div class="about-credits">
        <strong>Tecnologias e serviços</strong>
        <p>HTML5, CSS3 e JavaScript — estrutura, apresentação e lógica da aplicação.</p>
        <p>IndexedDB — dados e fila offline separados por conta.</p>
        <p>Web Crypto API — leitura dos cofres antigos durante importação.</p>
        <p>Supabase — autenticação, armazenamento e sincronização dos dados.</p>
        <p>Progressive Web App (PWA) / Service Worker — instalação e funcionamento como aplicativo web.</p>
        <p>GitHub Pages — hospedagem da aplicação.</p>
        <p>Supabase JavaScript Client — comunicação com o serviço Supabase.</p>
      </div>
      <button class="primary" type="button" id="aboutClose">Fechar</button>
    </div>`;
  document.body.appendChild(modal);

  function openAbout(){ modal.classList.add("show"); }
  function closeAbout(){ modal.classList.remove("show"); }
  window.openAbout = openAbout;
  window.closeAbout = closeAbout;
  modal.querySelector("#aboutClose").addEventListener("click", closeAbout);
  modal.addEventListener("click", function(e){ if(e.target === modal) closeAbout(); });

  const headerControls = document.querySelector("header .topbar > div:last-child");
  if (headerControls) {
    const btn = document.createElement("button");
    btn.className = "about-btn";
    btn.type = "button";
    btn.textContent = "ℹ️ Sobre";
    btn.addEventListener("click", openAbout);
    headerControls.insertBefore(btn, headerControls.firstChild);
  }

});
