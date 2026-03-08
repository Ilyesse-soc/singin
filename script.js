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

  /* ================================================================
     buildPDF — draws everything on a single A4 canvas then wraps
     it in a one-page PDF via jsPDF.
     Sizing is carefully calculated so the full letter + signature
     always fits inside the A4 frame.
  ================================================================ */
  async function buildPDF(sigDataURL) {
    const A4_W = 210;
    const A4_H = 297;
    const DPI  = 180;
    const MM   = DPI / 25.4;

    const cW = Math.round(A4_W * MM);
    const cH = Math.round(A4_H * MM);
    const mL = Math.round(20 * MM);
    const mR = Math.round(14 * MM);
    const mT = Math.round(10 * MM);
    const iW = cW - mL - mR;

    function makeCanvas() {
      const c = document.createElement("canvas");
      c.width = cW; c.height = cH;
      const ctx = c.getContext("2d");
      // white bg
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cW, cH);
      // gold top bar
      ctx.fillStyle = "#c9a84c"; ctx.fillRect(0, 0, cW, Math.round(3.5 * MM));
      // navy left accent
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, Math.round(2.5 * MM), cH);
      // navy footer bar
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, cH - Math.round(7 * MM), cW, Math.round(7 * MM));
      return { c, ctx };
    }

    // ════════════════════════════════════════════
    // PAGE 1 — Header + full letter body
    // ════════════════════════════════════════════
    const { c: c1, ctx: ctx1 } = makeCanvas();
    let y = mT + Math.round(4 * MM);

    // Logo + SpidR + date
    const lH = Math.round(13 * MM);
    const logoEl = document.querySelector("#letter-logo");
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const lW = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * lH);
      ctx1.drawImage(logoEl, mL, y, lW, lH);
    } else {
      ctx1.fillStyle = "#1a1a2e";
      ctx1.font = "bold " + Math.round(7 * MM) + "px Georgia, serif";
      ctx1.textBaseline = "middle";
      ctx1.fillText("SpidR", mL, y + lH / 2);
    }
    ctx1.fillStyle = "#555555";
    ctx1.font = "italic " + Math.round(4 * MM) + "px Georgia, serif";
    ctx1.textAlign = "right"; ctx1.textBaseline = "middle";
    ctx1.fillText("Paris, le 19 fevrier 2026", cW - mR, y + lH / 2);
    ctx1.textAlign = "left";
    y += lH + Math.round(5 * MM);

    // Divider
    ctx1.strokeStyle = "#e2ddd5"; ctx1.lineWidth = 1;
    ctx1.beginPath(); ctx1.moveTo(mL, y); ctx1.lineTo(cW - mR, y); ctx1.stroke();
    y += Math.round(5 * MM);

    // Objet box
    const objFS = Math.round(4 * MM);
    const objH  = Math.round(9 * MM);
    ctx1.fillStyle = "#f7f5f1"; ctx1.fillRect(mL, y, iW, objH);
    ctx1.fillStyle = "#c9a84c"; ctx1.fillRect(mL, y, Math.round(2.5 * MM), objH);
    ctx1.fillStyle = "#1c1c1c";
    ctx1.font = objFS + "px Arial, sans-serif";
    ctx1.textBaseline = "middle";
    ctx1.fillText("Objet : Lettre de recommandation - Ilyesse El Adaoui", mL + Math.round(5 * MM), y + objH / 2);
    y += objH + Math.round(7 * MM);

    // Body text
    const bFS = Math.round(4.2 * MM);
    const lnH = bFS * 1.75;
    const pGap = Math.round(3 * MM);

    ctx1.fillStyle = "#1c1c1c";
    ctx1.textBaseline = "top";
    ctx1.font = bFS + "px Georgia, serif";

    ctx1.fillText("A qui de droit,", mL, y);
    y += lnH + pGap;

    // paragraphs = array of strings OR {bullet: true, items: [...]}
    const paragraphs = [
      "Je soussigne Geoffroy Detrousselle, CEO de la societe Spidr, recommande vivement Ilyesse El Adaoui, avec qui j'ai eu l'opportunite de collaborer dans le cadre de ses missions au sein de notre entreprise en tant que Data Engineer.",
      "Durant sa mission chez Spidr, Ilyesse a travaille sur le developpement et l'evolution d'un projet technologique ambitieux visant a concevoir un agent intelligent connecte a WhatsApp, destine a automatiser certaines interactions professionnelles, structurer les echanges et assister les utilisateurs dans la gestion de leurs communications. Ce projet s'inscrit dans une logique de creation d'un produit SaaS scalable, combinant data, intelligence artificielle et technologies cloud.",
      "Dans ce contexte, Ilyesse a contribue a plusieurs aspects techniques majeurs du projet. Il a notamment participe a la conception et au developpement de composants backend en Python, a l'integration d'APIs externes et a la mise en place d'une architecture technique reposant sur des services cloud modernes.",
      "Plus precisement, ses travaux ont implique l'utilisation et l'integration de technologies telles que :",
      { bullet: true, items: [
        "Python pour le developpement backend et l'automatisation de l'agent",
        "Google Cloud Platform (GCP), notamment Cloud Run pour le deploiement et l'execution des services applicatifs",
        "Google Cloud SQL (PostgreSQL) pour la conception et la structuration de la base de donnees",
        "PostgreSQL et MySQL pour la gestion et la modelisation des donnees",
        "Integration d'APIs externes : GreenAPI pour WhatsApp et Google Calendar / Google Meet",
        "Services d'intelligence artificielle pour la generation et l'analyse de messages",
        "Git et GitHub, avec pipelines CI/CD via GitHub Actions pour les deploiements",
        "Docker et deploiement cloud, dans une logique d'architecture moderne et scalable",
      ]},
      "Au cours de ce projet, Ilyesse a egalement participe a la structuration de la base de donnees, a la reflexion autour de l'architecture du produit et a l'integration de differents services necessaires au fonctionnement d'une plateforme SaaS.",
      "Au-dela de ses competences techniques, Ilyesse s'est distingue par sa capacite d'apprentissage rapide, son autonomie progressive et sa forte implication dans les missions qui lui sont confiees. Il fait preuve d'une grande curiosite pour les technologies modernes et demontre une reelle volonte de comprendre les architectures logicielles en profondeur.",
      "Je suis convaincu qu'Ilyesse possede toutes les qualites necessaires pour evoluer avec succes dans des environnements technologiques exigeants, que ce soit dans le cadre d'un stage, d'une alternance, d'un premier emploi ou de la poursuite d'etudes dans une formation specialisee.",
      "Je recommande donc Ilyesse El Adaoui sans reserve et reste disponible pour toute information complementaire.",
      "Veuillez agreer, Madame, Monsieur, l'expression de mes salutations distinguees.",
    ];

    for (const para of paragraphs) {
      if (para && para.bullet) {
        const bulletX = mL + Math.round(3 * MM);
        const textX   = mL + Math.round(7 * MM);
        const bulletW = iW - Math.round(7 * MM);
        ctx1.font = bFS + "px Georgia, serif";
        for (const item of para.items) {
          ctx1.fillStyle = "#c9a84c";
          ctx1.beginPath();
          ctx1.arc(bulletX, y + bFS * 0.55, Math.round(1.2 * MM), 0, Math.PI * 2);
          ctx1.fill();
          ctx1.fillStyle = "#1c1c1c";
          const lines = wrapText(ctx1, item, bulletW);
          for (const line of lines) { ctx1.fillText(line, textX, y); y += lnH; }
          y += Math.round(0.5 * MM);
        }
        y += pGap;
      } else {
        ctx1.font = bFS + "px Georgia, serif";
        for (const line of wrapText(ctx1, para, iW)) {
          ctx1.fillText(line, mL, y); y += lnH;
        }
        y += pGap;
      }
    }

    // Page 1 footer text
    ctx1.fillStyle = "rgba(255,255,255,0.45)";
    ctx1.font = Math.round(2.5 * MM) + "px Arial, sans-serif";
    ctx1.textBaseline = "middle"; ctx1.textAlign = "center";
    ctx1.fillText("(c) 2026 SpidR - Document confidentiel - Page 1/2", cW / 2, cH - Math.round(3.5 * MM));
    ctx1.textAlign = "left";

    // ════════════════════════════════════════════
    // PAGE 2 — Signature page
    // ════════════════════════════════════════════
    const { c: c2, ctx: ctx2 } = makeCanvas();
    let y2 = mT + Math.round(10 * MM);

    // Small SpidR logo header on page 2
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const lH2 = Math.round(10 * MM);
      const lW2 = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * lH2);
      ctx2.drawImage(logoEl, mL, y2, lW2, lH2);

    }
    ctx2.fillStyle = "#555555";
    ctx2.font = "italic " + Math.round(3.5 * MM) + "px Georgia, serif";
    ctx2.textAlign = "right"; ctx2.textBaseline = "middle";
    ctx2.fillText("Lettre de recommandation - M. Ilyesse El Adaoui", cW - mR, y2 + Math.round(5 * MM));
    ctx2.textAlign = "left";
    y2 += Math.round(18 * MM);

    // Divider
    ctx2.strokeStyle = "#e2ddd5"; ctx2.lineWidth = 1;
    ctx2.beginPath(); ctx2.moveTo(mL, y2); ctx2.lineTo(cW - mR, y2); ctx2.stroke();
    y2 += Math.round(18 * MM);

    // Big "Signature" title
    ctx2.fillStyle = "#1a1a2e";
    ctx2.font = "bold " + Math.round(6 * MM) + "px Georgia, serif";
    ctx2.textBaseline = "top";
    ctx2.fillText("Signature du Directeur Technique", mL, y2);
    y2 += Math.round(12 * MM);

    // Signer info block
    ctx2.fillStyle = "#333333";
    ctx2.font = Math.round(4.5 * MM) + "px Georgia, serif";
    ctx2.fillText("Geoffroy Detrousselle", mL, y2);
    y2 += Math.round(7 * MM);
    ctx2.fillStyle = "#777777";
    ctx2.font = Math.round(3.8 * MM) + "px Arial, sans-serif";
    ctx2.fillText("CEO  —  Spidr", mL, y2);
    y2 += Math.round(20 * MM);

    // Signature box label
    ctx2.fillStyle = "#8a8a8a";
    ctx2.font = Math.round(3 * MM) + "px Arial, sans-serif";
    ctx2.fillText("SIGNATURE :", mL, y2);
    y2 += Math.round(5 * MM);

    // Signature image — drawn on white rect
    const sigImg = new Image();
    sigImg.src = sigDataURL;
    await new Promise(function(res) { sigImg.onload = res; sigImg.onerror = res; });

    const sigBoxW = Math.round(120 * MM);
    const sigBoxH = Math.round(45 * MM);
    // White rounded background for sig
    ctx2.fillStyle = "#ffffff";
    ctx2.strokeStyle = "#d0cdc8";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.roundRect(mL, y2, sigBoxW, sigBoxH, Math.round(3 * MM));
    ctx2.fill(); ctx2.stroke();

    // Draw actual signature centered in box
    if (sigImg.width > 0 && sigImg.height > 0) {
      const ratio  = Math.min((sigBoxW - Math.round(8 * MM)) / sigImg.width, (sigBoxH - Math.round(8 * MM)) / sigImg.height);
      const dW     = sigImg.width  * ratio;
      const dH     = sigImg.height * ratio;
      const dX     = mL + (sigBoxW - dW) / 2;
      const dY     = y2  + (sigBoxH - dH) / 2;
      ctx2.drawImage(sigImg, dX, dY, dW, dH);
    }
    y2 += sigBoxH + Math.round(15 * MM);

    // Date signed
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    ctx2.fillStyle = "#555555";
    ctx2.font = Math.round(3.5 * MM) + "px Arial, sans-serif";
    ctx2.fillText("Signe electroniquement le " + dateStr, mL, y2);
    y2 += Math.round(12 * MM);

    // Stamp
    drawStamp(ctx2, cW - mR - Math.round(30 * MM), y2, Math.round(22 * MM));

    // Page 2 footer text
    ctx2.fillStyle = "rgba(255,255,255,0.45)";
    ctx2.font = Math.round(2.5 * MM) + "px Arial, sans-serif";
    ctx2.textBaseline = "middle"; ctx2.textAlign = "center";
    ctx2.fillText("(c) 2026 SpidR - Document confidentiel - Page 2/2", cW / 2, cH - Math.round(3.5 * MM));
    ctx2.textAlign = "left";

    // ── Build 2-page PDF ──
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(c1.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    doc.addPage();
    doc.addImage(c2.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
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
