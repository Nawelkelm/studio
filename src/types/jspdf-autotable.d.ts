// `autoTable(doc, options)` stores the drawn table on the document; only that property needs typing.
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

export {};
