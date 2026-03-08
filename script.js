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
  const downloadSection  = document.getElementById("download-section");
  const whatsappInline   = document.getElementById("whatsapp-inline");

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
    hide(whatsappInline);
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
    hide(whatsappInline);
    pdfBlob = null;
  });

  btnValidate.addEventListener("click", () => {
    hide(statusEmpty); hide(statusValidated);
    if (pad.isEmpty()) { show(statusEmpty); return; }
    // Export signature onto a white background canvas so it's visible in the PDF
    const tmpC = document.createElement("canvas");
    tmpC.width  = canvas.width;
    tmpC.height = canvas.height;
    const tmpX  = tmpC.getContext("2d");
    tmpX.fillStyle = "#ffffff";
    tmpX.fillRect(0, 0, tmpC.width, tmpC.height);
    tmpX.drawImage(canvas, 0, 0);
    signatureDataURL = tmpC.toDataURL("image/png");
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
      show(whatsappInline);
      whatsappInline.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    const DPI  = 180;
    const MM   = DPI / 25.4;
    const cW   = Math.round(A4_W * MM);
    const cH   = Math.round(A4_H * MM);
    const mL   = Math.round(18 * MM);
    const mR   = Math.round(14 * MM);
    const mT   = Math.round(10 * MM);
    const mB   = Math.round(14 * MM);   // bottom safe zone (above footer)
    const footH= Math.round(7  * MM);
    const iW   = cW - mL - mR;
    const maxY = cH - footH - mB;       // last y allowed before footer

    // ── Shared canvas factory ─────────────────────────────────
    function makeCanvas(pageNum, total) {
      const c   = document.createElement("canvas");
      c.width   = cW; c.height = cH;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cW, cH);
      ctx.fillStyle = "#c9a84c"; ctx.fillRect(0, 0, cW, Math.round(3.5 * MM));
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, Math.round(2.5 * MM), cH);
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, cH - footH, cW, footH);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = Math.round(2.5 * MM) + "px Arial, sans-serif";
      ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.fillText("(c) 2026 SpidR - Document confidentiel - Page " + pageNum + "/" + total, cW / 2, cH - footH / 2);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      return { c, ctx };
    }

    const logoEl = document.querySelector("#letter-logo");
    const lH     = Math.round(12 * MM);

    // ── Shared mini-header (logo + date) for pages 1 & 2 ─────
    function drawHeader(ctx, dateRight) {
      let hY = mT + Math.round(2 * MM);
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        const lW = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * lH);
        ctx.drawImage(logoEl, mL, hY, lW, lH);
      } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.font = "bold " + Math.round(6 * MM) + "px Georgia, serif";
        ctx.textBaseline = "middle";
        ctx.fillText("SpidR", mL, hY + lH / 2);
        ctx.textBaseline = "top";
      }
      if (dateRight) {
        ctx.fillStyle = "#555555";
        ctx.font = "italic " + Math.round(3.7 * MM) + "px Georgia, serif";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText("Paris, le 19 fevrier 2026", cW - mR, hY + lH / 2);
        ctx.textAlign = "left"; ctx.textBaseline = "top";
      }
      return hY + lH + Math.round(5 * MM);
    }

    // ── Body font settings ────────────────────────────────────
    const bFS  = Math.round(4.3 * MM);
    const lnH  = bFS * 1.72;
    const pGap = Math.round(2.8 * MM);

    // ── All paragraphs of the letter ──────────────────────────
    const paragraphs = [
      { type: "salut",  text: "Madame, Monsieur," },
      { type: "text",   text: "J'ai l'honneur de vous adresser la presente lettre afin de recommander chaleureusement M. Ilyesse El Adaoui, qui effectue actuellement un stage de 5 mois au sein de notre entreprise SpidR en tant que stagiaire Data Engineer, sous ma supervision directe en qualite de CTO." },
      { type: "text",   text: "Depuis son arrivee, M. El Adaoui a fait preuve d'une rigueur, d'une curiosite intellectuelle et d'une capacite d'adaptation remarquables. Il a ete implique dans des projets concrets lies a la gestion et au traitement de la donnee, et a su s'integrer pleinement a notre equipe technique." },
      { type: "text",   text: "Sur le plan technique, M. El Adaoui maitrise un ensemble de competences solides et adaptees aux exigences du metier : Python, SQL, NoSQL, MongoDB, Google Cloud Platform (GCP), ainsi que les technologies d'intelligence artificielle telles que LLaMA. Il a su mobiliser ces outils de maniere professionnelle dans le cadre de ses missions, contribuant ainsi directement a la valeur ajoutee de nos projets data." },
      { type: "text",   text: "Au-dela de ses competences techniques, nous avons particulierement apprecie ses qualites humaines : sens des responsabilites, esprit d'equipe, proactivite et capacite a proposer des solutions innovantes face aux problematiques rencontrees." },
      { type: "text",   text: "C'est sans reserve que je recommande M. Ilyesse El Adaoui pour l'integration d'un Master 1 dans le domaine de la Data. Son profil, alliant competences techniques pointues et qualites personnelles avouees, est un atout certain pour toute formation d'excellence." },
      { type: "text",   text: "Je reste a votre disposition pour tout renseignement complementaire." },
      { type: "text",   text: "Veuillez agreer, Madame, Monsieur, l'expression de mes salutations distinguees." },
    ];

    // ── Measure helper: how many px does a paragraph need? ───
    function measurePara(ctx, para, width) {
      ctx.font = bFS + "px Georgia, serif";
      if (para.type === "salut") {
        return lnH + pGap;
      }
      const lines = wrapText(ctx, para.text, width);
      return lines.length * lnH + pGap;
    }

    // ── Flow paragraphs across pages 1 & 2 ───────────────────
    // We'll dry-run to split the paragraphs
    const tmpC   = document.createElement("canvas");
    const tmpCtx = tmpC.getContext("2d");

    // Page 1 has: header + divider + objet box + body start
    // Page 2 has: mini-header + body continuation
    // We simulate the first-page available height
    const objBoxH  = Math.round(9 * MM);
    const page1StartY = mT + Math.round(2 * MM) + lH + Math.round(5 * MM)   // header
                      + Math.round(5 * MM) + Math.round(5 * MM)              // divider gaps
                      + objBoxH + Math.round(7 * MM)                         // objet box
                      + lnH + pGap;                                           // salutation line
    const page1MaxY = maxY;
    const page2StartY = mT + Math.round(2 * MM) + lH + Math.round(8 * MM);   // mini header p2
    const page2MaxY  = maxY;

    let availP1 = page1MaxY - page1StartY;
    let availP2 = page2MaxY - page2StartY;

    // Skip salutation in flow (drawn separately below)
    const bodyParas = paragraphs.filter(p => p.type === "text");
    const page1Paras = [], page2Paras = [];

    let rem = availP1;
    let onPage1 = true;
    for (const para of bodyParas) {
      const h = measurePara(tmpCtx, para, iW);
      if (onPage1) {
        if (rem >= h) { page1Paras.push(para); rem -= h; }
        else { onPage1 = false; page2Paras.push(para); rem = availP2 - h; }
      } else {
        page2Paras.push(para);
      }
    }

    // ════════════════════════════════════════════════════════
    // PAGE 1
    // ════════════════════════════════════════════════════════
    const { c: c1, ctx: ctx1 } = makeCanvas(1, 3);
    let y1 = drawHeader(ctx1, true);

    // Divider
    ctx1.strokeStyle = "#e2ddd5"; ctx1.lineWidth = 1;
    ctx1.beginPath(); ctx1.moveTo(mL, y1); ctx1.lineTo(cW - mR, y1); ctx1.stroke();
    y1 += Math.round(5 * MM);

    // Objet box
    ctx1.fillStyle = "#f7f5f1"; ctx1.fillRect(mL, y1, iW, objBoxH);
    ctx1.fillStyle = "#c9a84c"; ctx1.fillRect(mL, y1, Math.round(2.5 * MM), objBoxH);
    ctx1.fillStyle = "#1c1c1c";
    ctx1.font = Math.round(3.9 * MM) + "px Arial, sans-serif";
    ctx1.textBaseline = "middle";
    ctx1.fillText("Objet : Lettre de recommandation - M. Ilyesse El Adaoui", mL + Math.round(5 * MM), y1 + objBoxH / 2);
    y1 += objBoxH + Math.round(7 * MM);

    // Salutation
    ctx1.fillStyle = "#1c1c1c";
    ctx1.font = bFS + "px Georgia, serif";
    ctx1.textBaseline = "top";
    ctx1.fillText("Madame, Monsieur,", mL, y1);
    y1 += lnH + pGap;

    // Page 1 body paragraphs
    for (const para of page1Paras) {
      for (const line of wrapText(ctx1, para.text, iW)) {
        ctx1.fillText(line, mL, y1); y1 += lnH;
      }
      y1 += pGap;
    }

    // Continuation arrow hint at bottom
    if (page2Paras.length > 0) {
      ctx1.fillStyle = "#aaaaaa";
      ctx1.font = Math.round(3 * MM) + "px Arial, sans-serif";
      ctx1.textAlign = "right";
      ctx1.fillText("Suite page suivante →", cW - mR, maxY + Math.round(3 * MM));
      ctx1.textAlign = "left";
    }

    // ════════════════════════════════════════════════════════
    // PAGE 2
    // ════════════════════════════════════════════════════════
    const { c: c2, ctx: ctx2 } = makeCanvas(2, 3);
    let y2 = drawHeader(ctx2, false);

    // Thin reference line
    ctx2.strokeStyle = "#e2ddd5"; ctx2.lineWidth = 1;
    ctx2.beginPath(); ctx2.moveTo(mL, y2); ctx2.lineTo(cW - mR, y2); ctx2.stroke();
    y2 += Math.round(6 * MM);

    // Page 2 body paragraphs (continuation)
    ctx2.fillStyle = "#1c1c1c";
    ctx2.font = bFS + "px Georgia, serif";
    ctx2.textBaseline = "top";
    for (const para of page2Paras) {
      for (const line of wrapText(ctx2, para.text, iW)) {
        ctx2.fillText(line, mL, y2); y2 += lnH;
      }
      y2 += pGap;
    }

    // ════════════════════════════════════════════════════════
    // PAGE 3 — Signature
    // ════════════════════════════════════════════════════════
    const { c: c3, ctx: ctx3 } = makeCanvas(3, 3);
    let y3 = mT + Math.round(10 * MM);

    // Mini header
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const lW3 = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * Math.round(10 * MM));
      ctx3.drawImage(logoEl, mL, y3, lW3, Math.round(10 * MM));
    }
    ctx3.fillStyle = "#555555";
    ctx3.font = "italic " + Math.round(3.5 * MM) + "px Georgia, serif";
    ctx3.textAlign = "right"; ctx3.textBaseline = "middle";
    ctx3.fillText("Lettre de recommandation - M. Ilyesse El Adaoui", cW - mR, y3 + Math.round(5 * MM));
    ctx3.textAlign = "left"; ctx3.textBaseline = "top";
    y3 += Math.round(18 * MM);

    ctx3.strokeStyle = "#e2ddd5"; ctx3.lineWidth = 1;
    ctx3.beginPath(); ctx3.moveTo(mL, y3); ctx3.lineTo(cW - mR, y3); ctx3.stroke();
    y3 += Math.round(18 * MM);

    ctx3.fillStyle = "#1a1a2e";
    ctx3.font = "bold " + Math.round(6 * MM) + "px Georgia, serif";
    ctx3.fillText("Signature du Directeur Technique", mL, y3);
    y3 += Math.round(12 * MM);

    ctx3.fillStyle = "#333333";
    ctx3.font = Math.round(4.5 * MM) + "px Georgia, serif";
    ctx3.fillText("Geoffroy Detrousselle", mL, y3);
    y3 += Math.round(7 * MM);
    ctx3.fillStyle = "#777777";
    ctx3.font = Math.round(3.8 * MM) + "px Arial, sans-serif";
    ctx3.fillText("Chief Technology Officer (CTO)  -  SpidR", mL, y3);
    y3 += Math.round(20 * MM);

    ctx3.fillStyle = "#8a8a8a";
    ctx3.font = Math.round(3 * MM) + "px Arial, sans-serif";
    ctx3.fillText("SIGNATURE :", mL, y3);
    y3 += Math.round(5 * MM);

    // Signature image
    const sigImg = new Image();
    sigImg.src = sigDataURL;
    await new Promise(function(res) { sigImg.onload = res; sigImg.onerror = res; });

    const sigBoxW = Math.round(120 * MM);
    const sigBoxH = Math.round(45 * MM);
    ctx3.fillStyle = "#ffffff";
    ctx3.strokeStyle = "#d0cdc8"; ctx3.lineWidth = 1;
    ctx3.beginPath();
    ctx3.roundRect(mL, y3, sigBoxW, sigBoxH, Math.round(3 * MM));
    ctx3.fill(); ctx3.stroke();

    if (sigImg.width > 0 && sigImg.height > 0) {
      const ratio = Math.min((sigBoxW - Math.round(8 * MM)) / sigImg.width, (sigBoxH - Math.round(8 * MM)) / sigImg.height);
      const dW = sigImg.width  * ratio;
      const dH = sigImg.height * ratio;
      ctx3.drawImage(sigImg, mL + (sigBoxW - dW) / 2, y3 + (sigBoxH - dH) / 2, dW, dH);
    }
    y3 += sigBoxH + Math.round(15 * MM);

    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    ctx3.fillStyle = "#555555";
    ctx3.font = Math.round(3.5 * MM) + "px Arial, sans-serif";
    ctx3.fillText("Signe electroniquement le " + dateStr, mL, y3);
    y3 += Math.round(12 * MM);

    drawStamp(ctx3, cW - mR - Math.round(30 * MM), y3, Math.round(22 * MM));

    // ── Build 3-page PDF ──────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(c1.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    doc.addPage();
    doc.addImage(c2.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    doc.addPage();
    doc.addImage(c3.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
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

  btnWhatsApp.addEventListener("click", async () => {
    if (!pdfBlob) return;

    const fileName = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });

    // Web Share API with file — works on mobile (Android/iOS) and shares via WhatsApp etc.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Lettre de recommandation — Ilyesse El Adaoui",
          text: "Bonjour, veuillez trouver ci-joint la lettre de recommandation signee de M. Ilyesse El Adaoui.",
          files: [file],
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // user cancelled — do nothing
        // fallthrough to next method
      }
    }

    // Fallback: Web Share API text-only (no file, still opens native share sheet on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Lettre de recommandation — Ilyesse El Adaoui",
          text: "Bonjour, veuillez trouver ci-joint la lettre de recommandation signee de M. Ilyesse El Adaoui.\n\nFichier : " + fileName,
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    // Last resort for desktop: download the file and show an alert
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    alert("Le PDF a ete telecharge. Partagez-le manuellement via WhatsApp sur votre telephone.");
  });

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
})();
