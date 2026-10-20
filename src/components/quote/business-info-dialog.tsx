"use client";

import { useEffect, useState } from "react";

import type { BusinessInfo } from "@/lib/quotation-pdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessInfo: BusinessInfo;
  onSave: (info: BusinessInfo) => void;
};

const FIELDS: { key: keyof BusinessInfo; label: string; placeholder?: string }[] = [
  { key: "businessName", label: "Nombre del emprendimiento" },
  { key: "cuit", label: "CUIT (opcional)", placeholder: "XX-XXXXXXXX-X" },
  { key: "address", label: "Dirección (opcional)", placeholder: "Tu dirección" },
  { key: "phone", label: "Teléfono (opcional)", placeholder: "Tu teléfono" },
];

/** Business data printed on the client's quotation. Stored in this browser only. */
export function BusinessInfoDialog({ open, onOpenChange, businessInfo, onSave }: Props) {
  const [info, setInfo] = useState(businessInfo);
  useEffect(() => { setInfo(businessInfo); }, [businessInfo, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Datos del negocio</DialogTitle>
          <DialogDescription>Salen en el encabezado del PDF. Se guardan en este navegador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`business-${f.key}`}>{f.label}</Label>
              <Input
                id={`business-${f.key}`}
                placeholder={f.placeholder}
                value={info[f.key]}
                onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onSave({ ...info, businessName: info.businessName.trim() || businessInfo.businessName })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
