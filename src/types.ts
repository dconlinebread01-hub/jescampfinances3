export enum DocumentType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}

export interface DocumentItem {
  code: string;
  description: string;
  qty: number;
  unitPrice: number;
  netAmount: number;
}

export interface FinancialDocument {
  id?: string;
  date: string;
  lpoNumber: string;
  documentNumber: string; // Return Number or Delivery Note No
  storeName: string;
  subtotal: number;
  vat: number;
  orderTotal: number;
  type: DocumentType;
  items: DocumentItem[];
  createdBy: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}
