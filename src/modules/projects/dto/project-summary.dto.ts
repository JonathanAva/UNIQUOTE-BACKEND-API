// DTO de salida opcional, usado solo para tipado en servicios/controllers
export class ProjectSummaryDto {
  id: number;
  name: string;
  projectType: string;
  studyType: string;
  cliente: {
    id: number;
    empresa: string;
    razonSocial: string;
  };
  contacto?: {
    id: number;
    nombre: string;
    email: string;
  } | null;
  createdBy: {
    id: number;
    name: string;
    lastName: string;
  };
  cotizacionesCount: number;
  createdAt: Date;
  updatedAt: Date;
}
