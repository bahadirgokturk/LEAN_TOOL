import html2pdf from "html2pdf.js";

type Html2PdfWorker = {
  set(options: Record<string, unknown>): Html2PdfWorker;
  from(element: HTMLElement): Html2PdfWorker;
  save(): Promise<void>;
};

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
  const factory = html2pdf as unknown as () => Html2PdfWorker;
  await factory()
    .set({
      margin: [9, 8, 9, 8],
      filename,
      image: { type: "jpeg", quality: 0.94 },
      html2canvas: { scale: 1.7, useCORS: true, backgroundColor: "#ffffff", imageTimeout: 20_000 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["img", ".pdf-avoid-break"] },
    })
    .from(element)
    .save();
};

export {};
