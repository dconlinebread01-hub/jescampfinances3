import { GoogleGenAI, Type } from "@google/genai";

// Server-side document extraction. The Gemini API key never reaches the
// browser: this function runs in Netlify's compute environment where the
// AI Gateway injects the credentials automatically, so `new GoogleGenAI({})`
// authenticates with zero config.

const DOCUMENT_TYPES = {
  INVOICE: "invoice",
  CREDIT_NOTE: "credit_note",
} as const;

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: { base64Image?: string; mimeType?: string; type?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { base64Image, mimeType, type } = payload;
  if (!base64Image || !mimeType || !type) {
    return Response.json(
      { error: "Missing base64Image, mimeType, or type." },
      { status: 400 },
    );
  }

  const isInvoice = type === DOCUMENT_TYPES.INVOICE;
  const model = "gemini-3-flash-preview";

  const prompt = `Extract financial information from this ${isInvoice ? "Goods Received Note (GRN)" : "Goods Return Note"}.
  Return the data in the specified JSON format.
  Ensure all numbers are parsed as floats.
  The date should be in ISO 8601 format (YYYY-MM-DD).
  If a field is not found, use an empty string or 0.

  For ${isInvoice ? "GRN" : "Goods Return Note"}:
  - date: Document date
  - lpoNumber: LPO number or Return Order number
  - documentNumber: ${isInvoice ? "Delivery Note number or Invoice number (this usually starts with the word 'jes')" : "Return number (this usually starts with the letter 'P' and ends with '_1')"}
  - storeName: Name of the store (e.g., BURUBURU, KILIMANI)
  - subtotal: Subtotal amount
  - vat: VAT amount
  - orderTotal: Total order amount
  - items: List of items with code, description, qty, unitPrice, netAmount`;

  try {
    const ai = new GoogleGenAI({});

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType } },
          ],
        },
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
              description: isInvoice
                ? "Delivery Note No or Invoice No (usually starts with 'jes')"
                : "Return Number (usually starts with 'P' and ends with '_1')",
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
                  netAmount: { type: Type.NUMBER, description: "Net amount for the item" },
                },
                required: ["code", "description", "qty", "unitPrice", "netAmount"],
              },
            },
          },
          required: ["date", "lpoNumber", "documentNumber", "storeName", "subtotal", "vat", "orderTotal", "items"],
        },
      },
    });

    // `response.text` is already a JSON string matching the schema above.
    return new Response(response.text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Gemini extraction failed:", error);
    return Response.json(
      { error: "Failed to extract document data." },
      { status: 502 },
    );
  }
};

export const config = {
  path: "/api/extract-document",
};
