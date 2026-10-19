import type { UserOptions } from "jspdf-autotable";

// jspdf-autotable attaches `autoTable` and `lastAutoTable` to the jsPDF instance at runtime
// (after `await import("jspdf-autotable")`); this declares them for TypeScript.
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}
