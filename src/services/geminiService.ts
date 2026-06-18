import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, DocumentItem } from "../types";

// Lazily instantiate the client. The GoogleGenAI constructor throws when no
// API key is present, so creating it at module load would crash the entire app
// (blank screen) before React renders. Defer it until extraction is requested.
let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

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

export async function extractDocumentData(
  base64Image: string,
  mimeType: string,
  type: DocumentType
): Promise<ExtractedData> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract financial information from this ${type === DocumentType.INVOICE ? 'Goods Received Note (GRN)' : 'Goods Return Note'}.
  Return the data in the specified JSON format.
  Ensure all numbers are parsed as floats.
  The date should be in ISO 8601 format (YYYY-MM-DD).
  If a field is not found, use an empty string or 0.
  
  For ${type === DocumentType.INVOICE ? 'GRN' : 'Goods Return Note'}:
  - date: Document date
  - lpoNumber: LPO number or Return Order number
  - documentNumber: ${type === DocumentType.INVOICE ? "Delivery Note number or Invoice number (this usually starts with the word 'jes')" : "Return number (this usually starts with the letter 'P' and ends with '_1')"}
  - storeName: Name of the store (e.g., BURUBURU, KILIMANI)
  - subtotal: Subtotal amount
  - vat: VAT amount
  - orderTotal: Total order amount
  - items: List of items with code, description, qty, unitPrice, netAmount`;

  const response = await getClient().models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Document date in YYYY-MM-DD format" },
          lpoNumber: { type: Type.STRING, description: "LPO number or Return Order number" },
          documentNumber: { 
            type: Type.STRING, 
            description: type === DocumentType.INVOICE 
              ? "Delivery Note No or Invoice No (usually starts with 'jes')" 
              : "Return Number (usually starts with 'P' and ends with '_1')" 
          },
          storeName: { type: Type.STRING, description: "Name of the store (e.g., BURUBURU, KILIMANI)" },
          subtotal: { type: Type.NUMBER, description: "Subtotal amount" },
          vat: { type: Type.NUMBER, description: "VAT amount" },
          orderTotal: { type: Type.NUMBER, description: "Total order amount" },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING, description: "Item code" },
                description: { type: Type.STRING, description: "Item description" },
                qty: { type: Type.NUMBER, description: "Quantity" },
                unitPrice: { type: Type.NUMBER, description: "Unit price" },
                netAmount: { type: Type.NUMBER, description: "Net amount for the item" }
              },
              required: ["code", "description", "qty", "unitPrice", "netAmount"]
            }
          }
        },
        required: ["date", "lpoNumber", "documentNumber", "storeName", "subtotal", "vat", "orderTotal", "items"]
      }
    }
  });

  return JSON.parse(response.text);
}
