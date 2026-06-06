export type ReceiptFieldType = 'text' | 'date' | 'number' | 'image' | 'tel' | 'email';
export type ReceiptFieldStyle = 'bold' | 'normal' | 'italic';
export type ReceiptFieldSize = 'large' | 'medium' | 'small';

export interface ReceiptField {
  id: string;
  label: string;
  type: ReceiptFieldType;
  position: string;
  style: ReceiptFieldStyle;
  size: ReceiptFieldSize;
}

export interface ReceiptTable {
  id: string;
  position: string;
  columns: string[];
  rowFields: string[];
}

export interface ReceiptImage {
  id: string;
  type: 'logo' | 'passport' | 'signature';
  position: string;
}

export interface ReceiptLayout {
  title: string;
  layout: string;
  colors: {
    background: string;
    text: string;
    border: string;
  };
  font: {
    family: string;
    headerSize: string;
    bodySize: string;
  };
  fields: ReceiptField[];
  tables: ReceiptTable[];
  images: ReceiptImage[];
  barcode: {
    exists: boolean;
    position: string;
    sourceField: string;
  };
  footer: {
    exists: boolean;
    text: string;
  };
  sections: {
    id: string;
    position: string;
    fields: string[];
  }[];
}

export interface FormValues {
  [key: string]: string;
}

export function getEditableFields(layout: ReceiptLayout): ReceiptField[] {
  const fields = new Map<string, ReceiptField>();

  layout.fields.forEach((field) => {
    fields.set(field.id, field);
  });

  layout.images.forEach((image) => {
    if (!fields.has(image.id)) {
      fields.set(image.id, {
        id: image.id,
        label: image.type === 'passport' ? 'Passport Photo' : titleCase(image.type),
        type: 'image',
        position: image.position,
        style: 'normal',
        size: 'medium'
      });
    }
  });

  if (layout.barcode.exists && layout.barcode.sourceField && !fields.has(layout.barcode.sourceField)) {
    fields.set(layout.barcode.sourceField, {
      id: layout.barcode.sourceField,
      label: titleCase(layout.barcode.sourceField.replace(/_/g, ' ')),
      type: 'text',
      position: layout.barcode.position || 'bottom-center',
      style: 'normal',
      size: 'small'
    });
  }

  return Array.from(fields.values());
}

function titleCase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
