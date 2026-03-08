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
    btnGenerate.textContent = "Generation en cours...";
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

  /* ================================================================
     buildPDF — draws everything on a single A4 canvas then wraps
     it in a one-page PDF via jsPDF.
     Sizing is carefully calculated so the full letter + signature
     always fits inside the A4 frame.
  ================================================================ */
  async function buildPDF(sigDataURL) {
    const A4_W = 210;   // mm
    const A4_H = 297;   // mm
    const DPI  = 180;
    const MM   = DPI / 25.4;   // px per mm

    const cW = Math.round(A4_W * MM);
    const cH = Math.round(A4_H * MM);

    // Margins (px)
    const mL = Math.round(20 * MM);
    const mR = Math.round(14 * MM);
    const mT = Math.round(10 * MM);
    const iW = cW - mL - mR;   // usable text width

    const c   = document.createElement("canvas");
    c.width   = cW;
    c.height  = cH;
    const ctx = c.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cW, cH);

    // Gold top bar
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(0, 0, cW, Math.round(3.5 * MM));

    // Navy left accent
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, Math.round(2.5 * MM), cH);

    let y = mT + Math.round(4 * MM);

    // ── HEADER: Logo + SpidR + date ──
    const lH   = Math.round(12 * MM);
    const logoEl = document.querySelector("#letter-logo");
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const lW = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * lH);
      ctx.drawImage(logoEl, mL, y, lW, lH);
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold " + Math.round(5.8 * MM) + "px Georgia, serif";
      ctx.textBaseline = "middle";
      ctx.fillText("SpidR", mL + lW + Math.round(2.5 * MM), y + lH / 2);
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold " + Math.round(7 * MM) + "px Georgia, serif";
      ctx.textBaseline = "middle";
      ctx.fillText("SpidR", mL, y + lH / 2);
    }
    // Date right-aligned
    ctx.fillStyle = "#555555";
    ctx.font = "italic " + Math.round(3.6 * MM) + "px Georgia, serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Paris, le 19 fevrier 2026", cW - mR, y + lH / 2);
    ctx.textAlign = "left";
    y += lH + Math.round(4 * MM);

    // Divider
    ctx.strokeStyle = "#e2ddd5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(cW - mR, y); ctx.stroke();
    y += Math.round(4 * MM);

    // ── OBJET box ──
    const objFS = Math.round(3.7 * MM);
    const objH  = Math.round(7.5 * MM);
    ctx.fillStyle = "#f7f5f1";
    ctx.fillRect(mL, y, iW, objH);
    ctx.fillStyle = "#c9a84c";
    ctx.fillRect(mL, y, Math.round(2.5 * MM), objH);
    ctx.fillStyle = "#1c1c1c";
    ctx.font = objFS + "px Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("Objet : Lettre de recommandation - M. Ilyesse El Adaoui", mL + Math.round(5 * MM), y + objH / 2);
    y += objH + Math.round(5 * MM);

    // ── BODY ──
    // Font sized so the entire letter fits: 3.45 mm ≈ 11pt at 180dpi
    const bFS = Math.round(3.45 * MM);
    const lnH = bFS * 1.70;
    const pGap = Math.round(1.8 * MM);

    ctx.fillStyle = "#1c1c1c";
    ctx.textBaseline = "top";
    ctx.font = bFS + "px Georgia, serif";

    // Salutation
    ctx.fillText("Madame, Monsieur,", mL, y);
    y += lnH + pGap;

    const paragraphs = [
      "J'ai l'honneur de vous adresser la presente lettre afin de recommander chaleureusement M. Ilyesse El Adaoui, qui effectue actuellement un stage de 5 mois au sein de notre entreprise SpidR en tant que stagiaire Data Engineer, sous ma supervision directe en qualite de CTO.",
      "Depuis son arrivee, M. El Adaoui a fait preuve d'une rigueur, d'une curiosite intellectuelle et d'une capacite d'adaptation remarquables. Il a ete implique dans des projets concrets lies a la gestion et au traitement de la donnee, et a su s'integrer pleinement a notre equipe technique.",
      "Sur le plan technique, M. El Adaoui maitrise un ensemble de competences solides et adaptees aux exigences du metier : Python, SQL, NoSQL, MongoDB, Google Cloud Platform (GCP), ainsi que les technologies d'intelligence artificielle telles que LLaMA. Il a su mobiliser ces outils de maniere professionnelle dans le cadre de ses missions, contribuant ainsi directement a la valeur ajoutee de nos projets data.",
      "Au-dela de ses competences techniques, nous avons particulierement apprécie ses qualites humaines : sens des responsabilites, esprit d'equipe, proactivite et capacite a proposer des solutions innovantes face aux problematiques rencontrees.",
      "C'est sans reserve que je recommande M. Ilyesse El Adaoui pour l'integration d'un Master 1 dans le domaine de la Data. Son profil, alliant competences techniques pointues et qualites personnelles avouees, est un atout certain pour toute formation d'excellence.",
      "Je reste a votre disposition pour tout renseignement complementaire.",
      "Veuillez agreer, Madame, Monsieur, l'expression de mes salutations distinguees.",
    ];

    for (const para of paragraphs) {
      const lines = wrapText(ctx, para, iW);
      for (const line of lines) {
        ctx.fillText(line, mL, y);
        y += lnH;
      }
      y += pGap;
    }

    y += Math.round(5 * MM);

    // ── SIGNATURE divider ──
    ctx.strokeStyle = "#e2ddd5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(cW - mR, y); ctx.stroke();
    y += Math.round(4 * MM);

    // Signature label
    ctx.fillStyle = "#8a8a8a";
    ctx.font = Math.round(2.8 * MM) + "px Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("SIGNATURE DU CTO :", mL, y);
    y += Math.round(4 * MM);

    // Signature image
    const sigImg = new Image();
    sigImg.src = sigDataURL;
    await new Promise(function(res) { sigImg.onload = res; sigImg.onerror = res; });
    const sigH = Math.round(20 * MM);
    const sigW = sigImg.width > 0 ? Math.round((sigImg.width / sigImg.height) * sigH) : Math.round(55 * MM);
    ctx.drawImage(sigImg, mL, y, sigW, sigH);
    y += sigH + Math.round(2 * MM);

    // Signer name & role
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold " + Math.round(4.2 * MM) + "px Georgia, serif";
    ctx.textBaseline = "top";
    ctx.fillText("Geoffroy Detrousselle", mL, y);
    y += Math.round(6 * MM);
    ctx.fillStyle = "#555555";
    ctx.font = Math.round(3.3 * MM) + "px Arial, sans-serif";
    ctx.fillText("Chief Technology Officer (CTO)  -  SpidR", mL, y);

    // Stamp bottom-right (above footer)
    const footerH = Math.round(7 * MM);
    const stampR  = Math.round(15 * MM);
    drawStamp(ctx, cW - mR - stampR, cH - footerH - stampR - Math.round(4 * MM), stampR);

    // Footer bar
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, cH - footerH, cW, footerH);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = Math.round(2.4 * MM) + "px Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("(c) 2026 SpidR - Document confidentiel - Signe electroniquement via SignDoc", cW / 2, cH - footerH / 2);
    ctx.textAlign = "left";

    // Build PDF
    const imgData = c.toDataURL("image/jpeg", 0.97);
    const jspdf   = window.jspdf;
    const doc     = new jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(imgData, "JPEG", 0, 0, A4_W, A4_H);
    return doc.output("blob");
  }

  function drawStamp(ctx, cx, cy, r) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = r * 0.11; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy);
    ctx.lineTo(cx - r * 0.05, cy + r * 0.28);
    ctx.lineTo(cx + r * 0.38, cy - r * 0.28);
    ctx.stroke();
    ctx.globalAlpha = 0.17;
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold " + Math.round(r * 0.22) + "px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SIGNE", cx, cy + r * 0.55);
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  btnDownload.addEventListener("click", () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  });

  btnWhatsApp.addEventListener("click", () => {
    const text = encodeURIComponent("Bonjour, veuillez trouver ci-joint la lettre de recommandation signee de M. Ilyesse El Adaoui.\n\nFichier : Recommendation_Letter_Ilyesse_ElAdaoui.pdf");
    window.open("https://wa.me/?text=" + text, "_blank", "noopener,noreferrer");
  });

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
})();
