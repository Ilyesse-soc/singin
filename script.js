/* ─────────────────────────────────────────────────────────────
   SignDoc — script.js
   Handles: signature_pad setup, validation, PDF generation,
            WhatsApp share, responsive canvas sizing.
───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ── DOM refs ───────────────────────────────────────────── */
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
  const letterDocument  = document.getElementById("letter-document");

  /* ── State ──────────────────────────────────────────────── */
  let signatureDataURL = null;   // validated signature PNG
  let pdfBlob          = null;   // generated PDF blob

  /* ── Initialise SignaturePad ────────────────────────────── */
  const pad = new SignaturePad(canvas, {
    minWidth: 1.2,
    maxWidth: 3,
    penColor: "#1a1a2e",
    backgroundColor: "rgba(0,0,0,0)",
  });

  /* Resize canvas to match CSS size (handles DPR / mobile) */
  function resizeCanvas() {
    const ratio   = Math.max(window.devicePixelRatio || 1, 1);
    const rect    = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    pad.clear();                  // must clear after resize
    canvasHint.classList.remove("hidden");
    canvasWrapper.classList.remove("has-sig");
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  /* Show/hide the hint overlay */
  pad.addEventListener("beginStroke", () => {
    canvasHint.classList.add("hidden");
    canvasWrapper.classList.add("active");
    // Hide stale status messages when user starts signing again
    hide(statusValidated);
    hide(statusEmpty);
    btnGenerate.disabled = true;
    signatureDataURL = null;
    sigPreviewArea.classList.remove("visible");
    sigPreviewImg.src = "";
    hide(downloadSection);
    pdfBlob = null;
  });

  pad.addEventListener("endStroke", () => {
    if (!pad.isEmpty()) {
      canvasWrapper.classList.add("has-sig");
      canvasWrapper.classList.remove("active");
    }
  });

  /* ── Clear ──────────────────────────────────────────────── */
  btnClear.addEventListener("click", () => {
    pad.clear();
    canvasWrapper.classList.remove("has-sig", "active");
    canvasHint.classList.remove("hidden");
    hide(statusValidated);
    hide(statusEmpty);
    btnGenerate.disabled = true;
    signatureDataURL = null;
    sigPreviewArea.classList.remove("visible");
    sigPreviewImg.src = "";
    hide(downloadSection);
    pdfBlob = null;
  });

  /* ── Validate ───────────────────────────────────────────── */
  btnValidate.addEventListener("click", () => {
    hide(statusEmpty);
    hide(statusValidated);

    if (pad.isEmpty()) {
      show(statusEmpty);
      return;
    }

    // Capture the signature as a transparent PNG
    signatureDataURL = pad.toDataURL("image/png");

    // Show preview inside the letter
    sigPreviewImg.src = signatureDataURL;
    sigPreviewArea.classList.add("visible");

    // Unlock Generate button
    btnGenerate.disabled = false;

    show(statusValidated);
    statusValidated.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  /* ── Generate PDF ───────────────────────────────────────── */
  btnGenerate.addEventListener("click", async () => {
    if (!signatureDataURL) return;

    // Temporarily add pdf-mode class to hide UI chrome
    document.body.classList.add("pdf-mode");

    const options = {
      margin:      [10, 10, 10, 10],
      filename:    "Recommendation_Letter_Ilyesse_ElAdaoui.pdf",
      image:       { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      },
      jsPDF: {
        unit:        "mm",
        format:      "a4",
        orientation: "portrait",
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      const worker = html2pdf().set(options).from(letterDocument);
      pdfBlob = await worker.outputPdf("blob");

      show(downloadSection);
      downloadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.");
    } finally {
      document.body.classList.remove("pdf-mode");
    }
  });

  /* ── Download ───────────────────────────────────────────── */
  btnDownload.addEventListener("click", () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = "Recommendation_Letter_Ilyesse_ElAdaoui.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  /* ── WhatsApp ───────────────────────────────────────────── */
  btnWhatsApp.addEventListener("click", () => {
    const text = encodeURIComponent(
      "Bonjour, veuillez trouver ci-joint la lettre de recommandation signée de M. Ilyesse El Adaoui.\n\n" +
      "Fichier : Recommendation_Letter_Ilyesse_ElAdaoui.pdf"
    );
    // On mobile this opens the WhatsApp app; on desktop it opens WhatsApp Web
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  });

  /* ── Helpers ────────────────────────────────────────────── */
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

})();
