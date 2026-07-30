/** Trigger a browser download, and use the Web Share API if it's available (mobile Chrome/Safari). */
export async function shareOrDownloadText(filename, contents, mimeType = "application/json") {
  const blob = new Blob([contents], { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mimeType })] })) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: mimeType })], title: filename });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet
      // fall through to download on any other failure
    }
  }
  downloadBlob(blob, filename);
}

export async function shareOrDownloadBinary(filename, base64Data, mimeType = "application/pdf") {
  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: mimeType })] })) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: mimeType })], title: filename });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open a file picker and return its text contents (for restoring a backup). */
export function pickTextFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return reject(new Error("No file selected"));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
