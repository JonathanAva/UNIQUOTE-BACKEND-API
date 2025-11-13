export class CotizacionItemDto {
  id: number;
  category: string;
  description: string;
  personas: string | null;        // Prisma Decimal -> string
  dias: string | null;
  costoUnitario: string | null;
  costoTotal: string | null;
  comisionable: boolean;
  totalConComision: string | null;
  orden: number;
}
