import { DocumentType, DocumentItem } from "../types";

export interface ExtractedData {
  date: string;
  lpoNumber: string;
  documentNumber: string;
  storeName: string;
  subtotal: number;
  vat: number;
  orderTotal: number;
  items: DocumentItem[];
}

// The Gemini call runs server-side in a Netlify Function so the API key is
// never shipped to the browser. This client helper just forwards the image to
// that endpoint and returns the structured result.
export async function extractDocumentData(
  base64Image: string,
  mimeType: string,
  type: DocumentType
): Promise<ExtractedData> {
  const response = await fetch("/api/extract-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType, type }),
  });

  if (!response.ok) {
    let message = "Failed to extract document data.";
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // Response body was not JSON; keep the default message.
    }
    throw new Error(message);
  }

  return response.json();
}
