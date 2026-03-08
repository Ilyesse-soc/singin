(function () {
  "use strict";

  const canvas          = document.getElementById("signature-canvas");
  const canvasWrapper   = document.getElementById("canvas-wrapper");
  const canvasHint      = document.getElementById("canvas-hint");
  const btnClear        = document.getElementById("btn-clear");
  const btnValidate     = document.getElementById("btn-validate");
  const btnGenerate     = document.getElementById("btn-generate");
  const btnDownload     = document.getElementById("btn-download");
  const btnWhatsApp     = document.getElementById("btn-whatsapp");
  const statusValidated = document.getElementById("status-validated");
  const statusEmpty     = document.getElementById("status-empty");
  const sigPreviewArea  = document.getElementById("sig-preview-area");
  const sigPreviewImg   = document.getElementById("sig-preview-img");
  const downloadSection = document.getElementById("download-section");
  const whatsappInline  = document.getElementById("whatsapp-inline");

  let signatureDataURL = null;
  let pdfBlob          = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /* ── Signature pad ─────────────────────────────────────── */
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
    hide(downloadSection); hide(whatsappInline);
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
    hide(downloadSection); hide(whatsappInline);
    pdfBlob = null;
  });

  btnValidate.addEventListener("click", () => {
    hide(statusEmpty); hide(statusValidated);
    if (pad.isEmpty()) { show(statusEmpty); return; }
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
     buildPDF — 3 pages
     P1 : en-tete + debut lettre
     P2 : suite lettre (liste puces + fin)
     P3 : page signature
  ================================================================ */
  async function buildPDF(sigDataURL) {
    const A4_W = 210, A4_H = 297;
    const DPI  = 180;
    const MM   = DPI / 25.4;
    const cW   = Math.round(A4_W * MM);
    const cH   = Math.round(A4_H * MM);
    const mL   = Math.round(18 * MM);
    const mR   = Math.round(14 * MM);
    const footH= Math.round(7  * MM);
    const iW   = cW - mL - mR;

    /* ── Canvas factory ──────────────────────────────────── */
    function makePage(num, total) {
      const c = document.createElement("canvas");
      c.width = cW; c.height = cH;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, cW, cH);
      x.fillStyle = "#c9a84c"; x.fillRect(0, 0, cW, Math.round(3.5 * MM));
      x.fillStyle = "#1a1a2e"; x.fillRect(0, 0, Math.round(2.5 * MM), cH);
      x.fillStyle = "#1a1a2e"; x.fillRect(0, cH - footH, cW, footH);
      x.fillStyle = "rgba(255,255,255,0.5)";
      x.font = Math.round(2.5 * MM) + "px Arial, sans-serif";
      x.textBaseline = "middle"; x.textAlign = "center";
      x.fillText("SpidR  —  Document confidentiel  —  Page " + num + " / " + total, cW / 2, cH - footH / 2);
      x.textAlign = "left"; x.textBaseline = "top";
      return { c, x };
    }

    /* ── Logo helper ─────────────────────────────────────── */
    const logoEl = document.querySelector("#letter-logo");
    function drawLogo(x, atY, h) {
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        const w = Math.round((logoEl.naturalWidth / logoEl.naturalHeight) * h);
        x.drawImage(logoEl, mL, atY, w, h);
        return w;
      }
      x.fillStyle = "#1a1a2e";
      x.font = "bold " + Math.round(6 * MM) + "px Georgia, serif";
      x.textBaseline = "middle";
      x.fillText("SpidR", mL, atY + h / 2);
      x.textBaseline = "top";
      return Math.round(20 * MM);
    }

    /* ── Text helpers ────────────────────────────────────── */
    function wrap(x, txt, maxW) {
      const words = txt.split(" "), lines = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    }

    /* ── Fonts & spacing ─────────────────────────────────── */
    const bFS  = Math.round(4.15 * MM);   // body font size px
    const lnH  = bFS * 1.72;              // line height
    const pGap = Math.round(2.5 * MM);    // gap after paragraph
    const safeBottom = cH - footH - Math.round(8 * MM);

    /* ================================================================
       PAGE 1 — header + first half of letter
    ================================================================ */
    const { c: c1, x: x1 } = makePage(1, 3);
    let y1 = Math.round(10 * MM);

    // Logo + date
    const lH1 = Math.round(13 * MM);
    drawLogo(x1, y1, lH1);
    x1.fillStyle = "#555";
    x1.font = "italic " + Math.round(3.8 * MM) + "px Georgia, serif";
    x1.textAlign = "right"; x1.textBaseline = "middle";
    x1.fillText("Paris, le 19 fevrier 2026", cW - mR, y1 + lH1 / 2);
    x1.textAlign = "left"; x1.textBaseline = "top";
    y1 += lH1 + Math.round(5 * MM);

    // Divider
    x1.strokeStyle = "#e2ddd5"; x1.lineWidth = 1;
    x1.beginPath(); x1.moveTo(mL, y1); x1.lineTo(cW - mR, y1); x1.stroke();
    y1 += Math.round(4 * MM);

    // Objet box
    const objH = Math.round(8.5 * MM);
    x1.fillStyle = "#f7f5f1"; x1.fillRect(mL, y1, iW, objH);
    x1.fillStyle = "#c9a84c"; x1.fillRect(mL, y1, Math.round(2.5 * MM), objH);
    x1.fillStyle = "#1c1c1c";
    x1.font = Math.round(3.8 * MM) + "px Arial, sans-serif";
    x1.textBaseline = "middle";
    x1.fillText("Objet : Lettre de recommandation  -  M. Ilyesse El Adaoui", mL + Math.round(5 * MM), y1 + objH / 2);
    x1.textBaseline = "top";
    y1 += objH + Math.round(6 * MM);

    // All paragraphs for pages 1 & 2 — exact text from the letter
    // Returns y after drawing; stops at safeBottom and returns remaining items
    x1.fillStyle = "#1c1c1c";
    x1.font = bFS + "px Georgia, serif";

    // Salutation
    x1.fillText("A qui de droit,", mL, y1);
    y1 += lnH + pGap;

    // P1 paragraphs — drawn on page 1 until we hit safeBottom, rest spills to p2
    const p1texts = [
      "Je soussigne Geoffroy Detrousselle, CEO de la societe Spidr, recommande vivement Ilyesse El Adaoui, avec qui j'ai eu l'opportunite de collaborer dans le cadre de ses missions au sein de notre entreprise en tant que Data Engineer.",
      "Durant sa mission chez Spidr, Ilyesse a travaille sur le developpement et l'evolution d'un projet technologique ambitieux visant a concevoir un agent intelligent connecte a WhatsApp, destine a automatiser certaines interactions professionnelles, structurer les echanges et assister les utilisateurs dans la gestion de leurs communications. Ce projet s'inscrit dans une logique de creation d'un produit SaaS scalable, combinant data, intelligence artificielle et technologies cloud.",
      "Dans ce contexte, Ilyesse a contribue a plusieurs aspects techniques majeurs du projet. Il a notamment participe a la conception et au developpement de composants backend en Python, a l'integration d'APIs externes et a la mise en place d'une architecture technique reposant sur des services cloud modernes.",
    ];

    for (const para of p1texts) {
      x1.font = bFS + "px Georgia, serif";
      x1.fillStyle = "#1c1c1c";
      for (const line of wrap(x1, para, iW)) {
        x1.fillText(line, mL, y1); y1 += lnH;
      }
      y1 += pGap;
    }

    // "Plus precisement..." intro line
    const introLine = "Plus precisement, ses travaux ont implique l'utilisation et l'integration de technologies telles que :";
    x1.font = bFS + "px Georgia, serif";
    x1.fillStyle = "#1c1c1c";
    for (const line of wrap(x1, introLine, iW)) {
      x1.fillText(line, mL, y1); y1 += lnH;
    }
    y1 += pGap;

    // Continuation arrow
    x1.fillStyle = "#aaa";
    x1.font = Math.round(3 * MM) + "px Arial, sans-serif";
    x1.textAlign = "right";
    x1.fillText("Suite \u2192", cW - mR, safeBottom + Math.round(2 * MM));
    x1.textAlign = "left";

    /* ================================================================
       PAGE 2 — bullet list + rest of letter
    ================================================================ */
    const { c: c2, x: x2 } = makePage(2, 3);
    let y2 = Math.round(10 * MM);

    // Mini header
    const lH2 = Math.round(10 * MM);
    drawLogo(x2, y2, lH2);
    x2.strokeStyle = "#e2ddd5"; x2.lineWidth = 1;
    y2 += lH2 + Math.round(4 * MM);
    x2.beginPath(); x2.moveTo(mL, y2); x2.lineTo(cW - mR, y2); x2.stroke();
    y2 += Math.round(5 * MM);

    // Bullet list
    const bullets = [
      "Python pour le developpement backend et l'automatisation de l'agent",
      "Google Cloud Platform (GCP), notamment Cloud Run pour le deploiement et l'execution des services applicatifs",
      "Google Cloud SQL (PostgreSQL) pour la conception et la structuration de la base de donnees",
      "PostgreSQL et MySQL pour la gestion et la modelisation des donnees",
      "Integration d'APIs externes, notamment GreenAPI pour WhatsApp et Google Calendar / Google Meet pour la gestion automatisee de rendez-vous",
      "Services d'intelligence artificielle pour la generation et l'analyse de messages",
      "Git et GitHub, avec mise en place de pipelines CI/CD via GitHub Actions pour automatiser les deploiements",
      "Docker et deploiement cloud, dans une logique d'architecture moderne et scalable",
    ];

    const bulletIndent = Math.round(7 * MM);
    const bulletW      = iW - bulletIndent;

    x2.fillStyle = "#1c1c1c";
    x2.font = bFS + "px Georgia, serif";
    for (const item of bullets) {
      // Gold dot
      x2.fillStyle = "#c9a84c";
      x2.beginPath();
      x2.arc(mL + Math.round(2.5 * MM), y2 + bFS * 0.6, Math.round(1.3 * MM), 0, Math.PI * 2);
      x2.fill();
      // Text
      x2.fillStyle = "#1c1c1c";
      const blines = wrap(x2, item, bulletW);
      for (let i = 0; i < blines.length; i++) {
        x2.fillText(blines[i], mL + bulletIndent, y2);
        y2 += lnH;
      }
      y2 += Math.round(1 * MM);
    }
    y2 += pGap;

    // Remaining paragraphs
    const p2texts = [
      "Au cours de ce projet, Ilyesse a egalement participe a la structuration de la base de donnees, a la reflexion autour de l'architecture du produit et a l'integration de differents services necessaires au fonctionnement d'une plateforme SaaS. Son travail a notamment consiste a relier plusieurs systemes (messagerie, base de donnees, services cloud et intelligence artificielle) afin de creer un produit coherent et fonctionnel.",
      "Au-dela de ses competences techniques, Ilyesse s'est distingue par sa capacite d'apprentissage rapide, son autonomie progressive et sa forte implication dans les missions qui lui sont confiees. Il fait preuve d'une grande curiosite pour les technologies modernes et demontre une reelle volonte de comprendre les architectures logicielles en profondeur.",
      "Je suis convaincu qu'Ilyesse possede toutes les qualites necessaires pour evoluer avec succes dans des environnements technologiques exigeants, que ce soit dans le cadre d'un stage, d'une alternance, d'un premier emploi ou de la poursuite d'etudes dans une formation specialisee dans les domaines de la data, du developpement logiciel ou du cloud computing.",
      "Je recommande donc Ilyesse El Adaoui sans reserve et reste disponible pour toute information complementaire.",
      "Veuillez agreer, Madame, Monsieur, l'expression de mes salutations distinguees.",
    ];

    x2.font = bFS + "px Georgia, serif";
    x2.fillStyle = "#1c1c1c";
    for (const para of p2texts) {
      for (const line of wrap(x2, para, iW)) {
        x2.fillText(line, mL, y2); y2 += lnH;
      }
      y2 += pGap;
    }

    /* ================================================================
       PAGE 3 — signature
    ================================================================ */
    const { c: c3, x: x3 } = makePage(3, 3);
    let y3 = Math.round(10 * MM);

    // Mini header
    const lH3 = Math.round(10 * MM);
    drawLogo(x3, y3, lH3);
    x3.fillStyle = "#555";
    x3.font = "italic " + Math.round(3.4 * MM) + "px Georgia, serif";
    x3.textAlign = "right"; x3.textBaseline = "middle";
    x3.fillText("Lettre de recommandation - M. Ilyesse El Adaoui", cW - mR, y3 + lH3 / 2);
    x3.textAlign = "left"; x3.textBaseline = "top";
    y3 += lH3 + Math.round(5 * MM);

    x3.strokeStyle = "#e2ddd5"; x3.lineWidth = 1;
    x3.beginPath(); x3.moveTo(mL, y3); x3.lineTo(cW - mR, y3); x3.stroke();
    y3 += Math.round(16 * MM);

    // Title
    x3.fillStyle = "#1a1a2e";
    x3.font = "bold " + Math.round(6 * MM) + "px Georgia, serif";
    x3.fillText("Signature du Directeur Technique", mL, y3);
    y3 += Math.round(12 * MM);

    x3.fillStyle = "#222";
    x3.font = Math.round(4.8 * MM) + "px Georgia, serif";
    x3.fillText("Geoffroy Detrousselle", mL, y3);
    y3 += Math.round(7 * MM);

    x3.fillStyle = "#666";
    x3.font = Math.round(3.8 * MM) + "px Arial, sans-serif";
    x3.fillText("Chief Technology Officer (CTO)  -  SpidR", mL, y3);
    y3 += Math.round(22 * MM);

    x3.fillStyle = "#999";
    x3.font = Math.round(2.9 * MM) + "px Arial, sans-serif";
    x3.fillText("SIGNATURE :", mL, y3);
    y3 += Math.round(5 * MM);

    // Load signature
    const sigImg = new Image();
    sigImg.src = sigDataURL;
    await new Promise(r => { sigImg.onload = r; sigImg.onerror = r; });

    const sigBoxW = Math.round(130 * MM);
    const sigBoxH = Math.round(50 * MM);

    // White box with border
    x3.fillStyle = "#ffffff";
    x3.strokeStyle = "#d0cdc8"; x3.lineWidth = 1;
    x3.beginPath();
    x3.roundRect(mL, y3, sigBoxW, sigBoxH, Math.round(3 * MM));
    x3.fill(); x3.stroke();

    // Draw sig centered inside box
    if (sigImg.width > 0 && sigImg.height > 0) {
      const ratio = Math.min(
        (sigBoxW - Math.round(10 * MM)) / sigImg.width,
        (sigBoxH - Math.round(10 * MM)) / sigImg.height
      );
      const dW = sigImg.width  * ratio;
      const dH = sigImg.height * ratio;
      x3.drawImage(sigImg, mL + (sigBoxW - dW) / 2, y3 + (sigBoxH - dH) / 2, dW, dH);
    }
    y3 += sigBoxH + Math.round(14 * MM);

    // Date
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    x3.fillStyle = "#555";
    x3.font = Math.round(3.5 * MM) + "px Arial, sans-serif";
    x3.fillText("Signe electroniquement le " + dateStr, mL, y3);

    // Stamp
    drawStamp(x3, cW - mR - Math.round(28 * MM), y3 - Math.round(8 * MM), Math.round(22 * MM));

    /* ── Build PDF ────────────────────────────────────────── */
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(c1.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    doc.addPage();
    doc.addImage(c2.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    doc.addPage();
    doc.addImage(c3.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, A4_W, A4_H);
    return doc.output("blob");
  }

  /* ── Stamp ─────────────────────────────────────────────── */
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

  /* ── Download ──────────────────────────────────────────── */
  btnDownload.addEventListener("click", () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url; a.download = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  });

  /* ── WhatsApp share ────────────────────────────────────── */
  btnWhatsApp.addEventListener("click", async () => {
    if (!pdfBlob) return;
    const fileName = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Lettre de recommandation - Ilyesse El Adaoui",
          text: "Bonjour, veuillez trouver ci-joint la lettre de recommandation signee de M. Ilyesse El Adaoui.",
          files: [file],
        });
        return;
      } catch (err) { if (err.name === "AbortError") return; }
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Lettre de recommandation - Ilyesse El Adaoui",
          text: "Voici la lettre signee.",
        });
        return;
      } catch (err) { if (err.name === "AbortError") return; }
    }
    window.open("https://wa.me/?text=Voici%20la%20lettre%20sign%C3%A9e.", "_blank", "noopener,noreferrer");
  });

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
})();
