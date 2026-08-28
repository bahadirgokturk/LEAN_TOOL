import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { hasVisibleCanvasPixels } from "../lib/s5/pdf-canvas";

declare global {
  interface Window {
    downloadS5Pdf?: (element: HTMLElement, filename: string) => Promise<void>;
  }
}

function waitForImages(element: HTMLElement): Promise<void> {
  const pending = Array.from(element.querySelectorAll("img"))
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    }));
  return Promise.all(pending).then(() => undefined);
}

window.downloadS5Pdf = async (element, filename) => {
  await waitForImages(element);
  // Chrome must paint a newly appended report at least once before capture.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const canvas = await html2canvas(element, {
    scale: 1.7,
    useCORS: true,
    backgroundColor: "#ffffff",
    imageTimeout: 20_000,
    logging: false,
  });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !hasVisibleCanvasPixels(context.getImageData(0, 0, canvas.width, canvas.height).data)) {
    throw new Error("PDF içeriği boş çizildi.");
  }

  const orientation = element.dataset.pdfOrientation === "landscape" ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation });
  const marginX = 8;
  const marginY = 9;
  const contentWidth = pdf.internal.pageSize.getWidth() - marginX * 2;
  const contentHeight = pdf.internal.pageSize.getHeight() - marginY * 2;
  const pixelsPerMm = canvas.width / contentWidth;
  const pageHeightPx = Math.max(1, Math.floor(contentHeight * pixelsPerMm));

  for (let y = 0, pageNumber = 0; y < canvas.height; y += pageHeightPx, pageNumber += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) throw new Error("PDF sayfası oluşturulamadı.");
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (pageNumber > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.94),
      "JPEG",
      marginX,
      marginY,
      contentWidth,
      sliceHeight / pixelsPerMm,
      undefined,
      "FAST"
    );
  }

  pdf.save(filename);
};

export {};
