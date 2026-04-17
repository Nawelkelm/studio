"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, type Quotation } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value || 0);

const statusConfig = {
  pendiente: { label: "Pendiente", icon: Clock, variant: "outline" as const, color: "text-yellow-400" },
  aprobada: { label: "Aprobada", icon: CheckCircle2, variant: "default" as const, color: "text-green-400" },
  rechazada: { label: "Rechazada", icon: XCircle, variant: "destructive" as const, color: "text-red-400" },
};

export default function QuotationRegistry() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todas");

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("quotations")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "todas") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las cotizaciones." });
    } else {
      setQuotations(data || []);
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => {
    if (user) fetchQuotations();
  }, [user, fetchQuotations]);

  const updateStatus = async (id: string, status: Quotation["status"]) => {
    const { error } = await supabase
      .from("quotations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado." });
    } else {
      toast({ title: "Estado actualizado" });
      fetchQuotations();
    }
  };

  const handleExportRegistryPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" }) as any;

    try {
      const logoRes = await fetch("/logo.png");
      const logoBlob = await logoRes.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      doc.addImage(logoBase64, "PNG", 14, 5, 22, 22);
    } catch { /* skip */ }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REGISTRO DE COTIZACIONES", 42, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 80, 160);
    doc.text("Doji Print - Impresiones 3D", 42, 23);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR")}`, 230, 16);
    doc.text(`Total: ${quotations.length} cotizaciones`, 230, 22);

    doc.line(14, 30, 283, 30);

    const tableData = quotations.map((q) => [
      new Date(q.created_at).toLocaleDateString("es-AR"),
      q.client_name,
      q.printer_name,
      q.material_used,
      `${q.quantity}`,
      formatCurrency(q.total_cost),
      formatCurrency(q.selling_price),
      q.user_name,
      q.status.charAt(0).toUpperCase() + q.status.slice(1),
    ]);

    doc.autoTable({
      startY: 34,
      head: [["Fecha", "Cliente", "Impresora", "Material", "Cant.", "Costo", "Precio", "Responsable", "Estado"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [30, 16, 84], fontSize: 8 },
      styles: { fontSize: 7.5 },
      columnStyles: {
        4: { halign: "center" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.text("Documento generado automáticamente - Doji Print", 148, pageHeight - 8, { align: "center" });

    doc.save(`Registro-Cotizaciones-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Registro de Cotizaciones</CardTitle>
            <CardDescription>
              Historial de todas las cotizaciones realizadas.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobada">Aprobadas</SelectItem>
                <SelectItem value="rechazada">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchQuotations}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportRegistryPdf} disabled={quotations.length === 0}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No hay cotizaciones</p>
            <p className="text-sm">Las cotizaciones que generes aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Impresora</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Precio Venta</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => {
                  const cfg = statusConfig[q.status];
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(q.created_at).toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell className="font-medium">{q.client_name}</TableCell>
                      <TableCell className="text-xs">{q.printer_name}</TableCell>
                      <TableCell>{q.material_used}</TableCell>
                      <TableCell className="text-center">{q.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(q.total_cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatCurrency(q.selling_price)}
                      </TableCell>
                      <TableCell className="text-xs">{q.user_name}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className={`gap-1 ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          {q.status !== "aprobada" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-green-400 hover:text-green-300"
                              onClick={() => updateStatus(q.id, "aprobada")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {q.status !== "rechazada" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-red-400 hover:text-red-300"
                              onClick={() => updateStatus(q.id, "rechazada")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {q.status !== "pendiente" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-yellow-400 hover:text-yellow-300"
                              onClick={() => updateStatus(q.id, "pendiente")}
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
