/* ─────────────────────────────────────────────────────────────
   SignDoc — script.js
   Renders full letter + signature into ONE canvas → single-page PDF
───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const canvas        = document.getElementById("signature-canvas");
  const canvasWrapper = document.getElementById("canvas-wrapper");
  const canvasHint    = document.getElementById("canvas-hint");
  const btnClear      = document.getElementById("btn-clear");
  const btnValidate   = document.getElementById("btn-validate");
  const btnGenerate   = document.getElementById("btn-generate");
  const btnDownload   = document.getElementById("btn-download");
  const btnWhatsApp   = document.getElementById("btn-whatsapp");
  const statusValidated = document.getElementById("status-validated");
  const statusEmpty     = document.getElementById("status-empty");
  const sigPreviewArea  = document.getElementById("sig-preview-area");
  const sigPreviewImg   = document.getElementById("sig-preview-img");
  const downloadSection = document.getElementById("download-section");

  let signatureDataURL = null;
  let pdfBlob          = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const pad = new SignaturePad(canvas, {
    minWidth: 1.2, maxWidth: 3.2,
    penColor: "#1a3a6b",
    backgroundColor: "rgba(0,0,0,0)",
  });

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect  = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    canvas.getContext("2d").scale(ratio, ratio);
    pad.clear();
    canvasHint.classList.remove("hidden");
    canvasWrapper.classList.remove("has-sig");
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  pad.addEventListener("beginStroke", () => {
    canvasHint.classList.add("hidden");
    canvasWrapper.classList.add("active");
    hide(statusValidated); hide(statusEmpty);
    btnGenerate.disabled = true;
    signatureDataURL = null;
    sigPreviewArea.classList.remove("visible");
    sigPreviewImg.src = "";
    hide(downloadSection);
    pdfBlob = null;
  });

  pad.addEventListener("endStroke", () => {
    if (!pad.isEmpty()) { canvasWrapper.classList.add("has-sig"); canvasWrapper.classList.remove("active"); }
  });

  btnClear.addEventListener("click", () => {
    pad.clear();
    canvasWrapper.classList.remove("has-sig", "active");
    canvasHint.classList.remove("hidden");
    hide(statusValidated); hide(statusEmpty);
    btnGenerate.disabled = true;
    signatureDataURL = null;
    sigPreviewArea.classList.remove("visible");
    sigPreviewImg.src = "";
    hide(downloadSection);
    pdfBlob = null;
  });

  btnValidate.addEventListener("click", () => {
    hide(statusEmpty); hide(statusValidated);
    if (pad.isEmpty()) { show(statusEmpty); return; }
    signatureDataURL = pad.toDataURL("image/png");
    sigPreviewImg.src = signatureDataURL;
    sigPreviewArea.classList.add("visible");
    btnGenerate.disabled = false;
    show(statusValidated);
    statusValidated.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  btnGenerate.addEventListener("click", async () => {
    if (!signatureDataURL) return;
    btnGenerate.disabled = true;
    const origHTML = btnGenerate.innerHTML;
    btnGenerate.textContent = "Génération en cours…";
    try {
      if (typeof window.jspdf === "undefined") {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      }
      pdfBlob = await buildPDF(signatureDataURL);
      show(downloadSection);
      downloadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error("PDF error:", err);
      alert("Erreur PDF : " + err.message);
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.innerHTML = origHTML;
    }
  });

  async function buildPDF(sigDataURL) {
    const A4_W = 210, A4_H = 297;
    const MARGIN = 18;
    const DPI    = 150;
    const MM     = DPI / 25.4;

    const cW = Math.round(A4_W * MM);
    const cH = Math.round(A4_H * MM);
    const m  = Math.round(MARGIN * MM);

    const c   = document.createElement("canvas");
    c.width   = cW; c.height = cH;
    const ctx = c.getContext("2d");

    // White bg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cW, cH);

    // Gold top bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, 0, cW, Math.round(4 * MM));

    // Navy left accent
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, Math.round(3 * MM), cH);

    let y = m + Math.round(6 * MM);
    const iW = cW - m * 2;

    // Logo
    const logoEl = document.querySelector("#letter-logo");
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const lH = Math.round(14 * MM);
      const lW = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * lH);
      ctx.drawImage(logoEl, m, y, lW, lH);

      ctx.fillStyle = "#1a1a2e";
      ctx.font = `bold ${Math.round(6.5 * MM)}px Georgia, serif`;
      ctx.textBaseline = "middle";
      ctx.fillText("SpidR", m + lW + Math.round(3 * MM), y + lH / 2 - Math.round(2 * MM));
      ctx.fillStyle = "#8a8a8a";
      ctx.font = `${Math.round(3.3 * MM)}px Arial, sans-serif`;
      ctx.fillText("TECHNOLOGY", m + lW + Math.round(3 * MM), y + lH / 2 + Math.round(3 * MM));

      ctx.fillStyle = "#555555";
      ctx.font = `italic ${Math.round(4 * MM)}px Georgia, serif`;
      ctx.textAlign = "right";
      ctx.fillText("Paris, le 19 février 2026", cW - m, y + lH / 2);
      ctx.textAlign = "left";
      y += lH + Math.round(8 * MM);
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = `bold ${Math.round(8 * MM)}px Georgia, serif`;
      ctx.textBaseline = "top";
      ctx.fillText("SpidR", m, y);
      ctx.fillStyle = "#555";
      ctx.font = `italic ${Math.round(4 * MM)}px Georgia, serif`;
      ctx.textAlign = "right";
      ctx.fillText("Paris, le 19 février 2026", cW - m, y + Math.round(2 * MM));
      ctx.textAlign = "left";
      y += Math.round(18 * MM);
    }

    // Divider
    ctx.strokeStyle = "#e2ddd5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(cW - m, y); ctx.stroke();
    y += Math.round(5 * MM);

    // Objet box
    const objH = Math.round(9 * MM);
    ctx.fillStyle = "#f7f5f1";
    ctx.fillRect(m, y, iW, objH);
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(m, y, Math.round(3 * MM), objH);
    ctx.fillStyle = "#1c1c1c";
    ctx.font = `${Math.round(4.1 * MM)}px Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText("Objet : Lettre de recommandation – M. Ilyesse El Adaoui", m + Math.round(6 * MM), y + objH / 2);
    y += objH + Math.round(7 * MM);

    // Body
    const bFS  = Math.round(4.4 * MM);
    const lnH  = bFS * 1.85;
    ctx.fillStyle = "#1c1c1c";
    ctx.textBaseline = "top";

    // Salutation
    ctx.font = `${bFS}px Georgia, serif`;
    ctx.fillText("Madame, Monsieur,", m, y);
    y += lnH + Math.round(3 * MM);

    const paragraphs = [
      "J'ai l'honneur de vous adresser la présente lettre afin de recommander chaleureusement M. Ilyesse El Adaoui, qui effectue actuellement un stage de 5 mois au sein de notre entreprise SpidR en tant que stagiaire Data Engineer, sous ma supervision directe en qualité de CTO.",
      "Depuis son arrivée, M. El Adaoui a fait preuve d'une rigueur, d'une curiosité intellectuelle et d'une capacité d'adaptation remarquables. Il a été impliqué dans des projets concrets liés à la gestion et au traitement de la donnée, et a su s'intégrer pleinement à notre équipe technique.",
      "Sur le plan technique, M. El Adaoui maîtrise un ensemble de compétences solides et adaptées aux exigences du métier : Python, SQL, NoSQL, MongoDB, Google Cloud Platform (GCP), ainsi que les technologies d'intelligence artificielle telles que LLaMA. Il a su mobiliser ces outils de manière professionnelle dans le cadre de ses missions, contribuant ainsi directement à la valeur ajoutée de nos projets data.",
      "Au-delà de ses compétences techniques, nous avons particulièrement apprécié ses qualités humaines : sens des responsabilités, esprit d'équipe, proactivité et capacité à proposer des solutions innovantes face aux problématiques rencontrées.",
      "C'est sans réserve que je recommande M. Ilyesse El Adaoui pour l'intégration d'un Master 1 dans le domaine de la Data. Son profil, alliant compétences techniques pointues et qualités personnelles avouées, est un atout certain pour toute formation d'excellence.",
      "Je reste à votre disposition pour tout renseignement complémentaire.",
      "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    ];

    ctx.font = `${bFS}px Georgia, serif`;
    for (const para of paragraphs) {
      for (const line of wrapText(ctx, para, iW)) {
        ctx.fillText(line, m, y); y += lnH;
      }
      y += Math.round(2.5 * MM);
    }

    y += Math.round(7 * MM);

    // Divider
    ctx.strokeStyle = "#e2ddd5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(cW - m, y); ctx.stroke();
    y += Math.round(5 * MM);

    // Signature label
    ctx.fillStyle = "#8a8a8a";
    ctx.font = `${Math.round(3.1 * MM)}px Arial, sans-serif`;
    ctx.fillText("SIGNATURE DU CTO :", m, y);
    y += Math.round(5 * MM);

    // Signature image
    const sigImg = new Image();
    sigImg.src = sigDataURL;
    await new Promise(r => { sigImg.onload = r; sigImg.onerror = r; });
    const sigH = Math.round(22 * MM);
    const sigW = sigImg.width > 0 ? Math.round((sigImg.width / sigImg.height) * sigH) : Math.round(60 * MM);
    ctx.drawImage(sigImg, m, y, sigW, sigH);
    y += sigH + Math.round(3 * MM);

    // Signer name
    ctx.fillStyle = "#1a1a2e";
    ctx.font = `bold ${Math.round(5 * MM)}px Georgia, serif`;
    ctx.fillText("Geoffroy Detrousselle", m, y);
    y += Math.round(7 * MM);
    ctx.fillStyle = "#666666";
    ctx.font = `${Math.round(3.7 * MM)}px Arial, sans-serif`;
    ctx.fillText("Chief Technology Officer (CTO)  —  SpidR", m, y);

    // Stamp
    drawStamp(ctx, cW - m - Math.round(26 * MM), cH - m - Math.round(28 * MM), Math.round(20 * MM));

    // Footer bar
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, cH - Math.round(8 * MM), cW, Math.round(8 * MM));
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${Math.round(2.7 * MM)}px Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("© 2026 SpidR — Document confidentiel — Signé électroniquement via SignDoc", cW / 2, cH - Math.round(4 * MM));
    ctx.textAlign = "left";

    // Build PDF
    const imgData = c.toDataURL("image/jpeg", 0.97);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(imgData, "JPEG", 0, 0, A4_W, A4_H);
    return doc.output("blob");
  }

  function drawStamp(ctx, cx, cy, r) {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = r * 0.11; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy);
    ctx.lineTo(cx - r * 0.05, cy + r * 0.28);
    ctx.lineTo(cx + r * 0.38, cy - r * 0.28);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#1a1a2e";
    ctx.font = `bold ${Math.round(r * 0.22)}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SIGNÉ", cx, cy + r * 0.55);
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = []; let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  btnDownload.addEventListener("click", () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url; a.download = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  });

  btnWhatsApp.addEventListener("click", () => {
    const text = encodeURIComponent("Bonjour, veuillez trouver ci-joint la lettre de recommandation signée de M. Ilyesse El Adaoui.\n\nFichier : Recommendation_Letter_Ilyesse_ElAdaoui.pdf");
    window.open("https://wa.me/?text=" + text, "_blank", "noopener,noreferrer");
  });

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
})();
