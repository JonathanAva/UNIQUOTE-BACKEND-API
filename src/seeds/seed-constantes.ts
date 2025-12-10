import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const constantes = [
    // =======================
    // TRABAJO DE CAMPO
    // =======================

    // Viáticos por departamento
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Ahuachapán', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Santa Ana', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Sonsonate', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Chalatenango', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - La Libertad', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - San Salvador', valor: 3.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Cuscatlán', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - La Paz', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Cabañas', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - San Vicente', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Usulután', valor: 6.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - San Miguel', valor: 10.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - Morazán', valor: 10.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Viático - La Unión', valor: 10.00 },

    // Transporte por departamento
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Ahuachapán', valor: 125.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Santa Ana', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Sonsonate', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Chalatenango', valor: 135.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - La Libertad', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - San Salvador', valor: 60.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Cuscatlán', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - La Paz', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Cabañas', valor: 125.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - San Vicente', valor: 100.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Usulután', valor: 135.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - San Miguel', valor: 180.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - Morazán', valor: 180.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Transporte - La Unión', valor: 180.00 },

    // Hotel por departamento
    { categoria: 'Trabajo de Campo', subcategoria: 'Hotel - San Miguel', valor: 12.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Hotel - Morazán', valor: 12.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Hotel - La Unión', valor: 12.00 },

    // Pagos diarios
    { categoria: 'Trabajo de Campo', subcategoria: 'Pago Diario - Supervisor', valor: 20.00 },
    { categoria: 'Trabajo de Campo', subcategoria: 'Pago Diario - Encuestador', valor: 18.00 },

    // =======================
    // RECURSOS
    // =======================
    { categoria: 'Recursos', subcategoria: 'Teléfono (UNIMERES)', valor: 0.60 },
    { categoria: 'Recursos', subcategoria: 'Teléfono celular (campo)', valor: 0.36 },
    { categoria: 'Recursos', subcategoria: 'Internet a encuestadores', valor: 3.00 },
    { categoria: 'Recursos', subcategoria: 'USB', valor: 3.10 },
    { categoria: 'Recursos', subcategoria: 'Papel', valor: 0.30 },
    { categoria: 'Recursos', subcategoria: 'Uso de dispositivos', valor: 5.00 },
    { categoria: 'Recursos', subcategoria: 'Plataforma de Captura STG', valor: 0.26 },
    { categoria: 'Recursos', subcategoria: 'Plataforma Call Center', valor: 0.08 },
    { categoria: 'Recursos', subcategoria: 'Telefono Call Center', valor: 0.08 },
    { categoria: 'Recursos', subcategoria: 'Plataforma Online', valor: 200.00 },
    { categoria: 'Recursos', subcategoria: 'Pauta Online', valor: 2.00 },

    // =======================
    // DIRECCIÓN
    // =======================
    { categoria: 'Dirección', subcategoria: 'Días director', valor: 10.00 },
    { categoria: 'Dirección', subcategoria: 'Realización Cuestionario', valor: 10.00 },
    { categoria: 'Dirección', subcategoria: 'Supervisor', valor: 8.00 },
    { categoria: 'Dirección', subcategoria: 'Reporte de Resultados', valor: 10.00 },
    { categoria: 'Dirección', subcategoria: 'Informe BI', valor: 10.00 },

    // =======================
    // PROCESAMIENTO
    // =======================
    { categoria: 'Procesamiento', subcategoria: 'Codificación', valor: 2.00 },
    { categoria: 'Procesamiento', subcategoria: 'Control de Calidad', valor: 2.00 },
    { categoria: 'Procesamiento', subcategoria: 'Base + Limpieza (digital)', valor: 10.00 },
  ];

  // Insertar en base de datos (upsert para evitar duplicados)
  for (const constante of constantes) {
    await prisma.constante.upsert({
      where: {
        categoria_subcategoria: {
          categoria: constante.categoria,
          subcategoria: constante.subcategoria,
        },
      },
      update: { valor: constante.valor },
      create: constante,
    });
  }

  console.log('✅ Constantes sembradas correctamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
