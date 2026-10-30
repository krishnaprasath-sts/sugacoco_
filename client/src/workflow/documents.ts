/** Mirror of server/src/workflow/documents.ts (labels only; permissions come from the API). */
export type DocumentCategory =
  | 'QUOTATION'
  | 'PI'
  | 'ADVANCE_VOUCHER'
  | 'BALANCE_VOUCHER'
  | 'CONTAINER_IMAGE'
  | 'LOADING_IMAGE'
  | 'QC_MEDIA'
  | 'PACKAGING_IMAGE'
  | 'PACKAGING_DOC'
  | 'SHIPPING_DOC'
  | 'LOADING_BILL'
  | 'OTHER';

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  QUOTATION: 'Quotation',
  PI: 'Proforma Invoice (PI)',
  ADVANCE_VOUCHER: 'Advance payment voucher',
  BALANCE_VOUCHER: 'Balance payment voucher',
  CONTAINER_IMAGE: 'Container image',
  LOADING_IMAGE: 'Loading image',
  QC_MEDIA: 'QC photo / report',
  PACKAGING_IMAGE: 'Packaging photo',
  PACKAGING_DOC: 'Packaging document',
  SHIPPING_DOC: 'Shipping document',
  LOADING_BILL: 'Container loading bill',
  OTHER: 'Other',
};

export const ACCEPT_FILES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';
export const MAX_FILE_MB = 15;
