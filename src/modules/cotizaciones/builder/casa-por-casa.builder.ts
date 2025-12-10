// ===========================================================================
// BUILDER PRINCIPAL: CASA POR CASA (NACIONAL)
// Calcula bloques de costos usando constantes y el motor nacional.engine.ts
// ===========================================================================

import { ConstantesService } from '@/modules/constantes/constantes.service';

import {
  buildTrabajoCampoCasaPorCasaNacional,
  buildRecursosCasaPorCasaNacional,
  buildRealizacionCuestionario,
  buildSupervisorScript,
  buildReporteResultados,
  buildInformeBi,
  buildCodificacionProcesamiento,
  buildControlCalidadProcesamiento,
  buildBaseLimpiezaProcesamiento,
} from './bloques';

import {
  DistribucionNacionalResult,
  buildDistribucionNacional,
} from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export interface CasaPorCasaNacionalBuilderParams {
  totalEntrevistas: number;
  duracionCuestionarioMin: number;
  tipoEntrevista: string;
  penetracionCategoria: number | string; // ✅ Acepta número o string
  cobertura: string;
  supervisores: number;
  encuestadoresTotales: number;
  realizamosCuestionario: boolean;
  realizamosScript: boolean;
  clienteSolicitaReporte: boolean;
  clienteSolicitaInformeBI: boolean;
  numeroOlasBi: number;
  trabajoDeCampoRealiza: boolean;
  trabajoDeCampoTipo?: 'propio' | 'subcontratado';
  trabajoDeCampoCosto?: number;
  incentivoTotal?: number;
  factorComisionable?: number;
  factorNoComisionable?: number;
}

export interface CotizacionItemBuild {
  category: string;
  description: string;
  personas: number | null;
  dias: number | null;
  costoUnitario: number | null;
  costoTotal: number;
  comisionable: boolean;
  totalConComision: number;
  orden: number;
}

// ---------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ---------------------------------------------------------------------------

export async function buildCotizacionCasaPorCasa(
  params: CasaPorCasaNacionalBuilderParams,
  constantesService: ConstantesService,
): Promise<{
  items: CotizacionItemBuild[];
  totalCobrar: number;
  costoPorEntrevista: number;
}> {
  const factorComisionable = params.factorComisionable ?? 1;
  const factorNoComisionable = params.factorNoComisionable ?? 0.05;

  // -------------------------------------------------------------------------
  // 1. Convertir penetración a número si es necesario
  // -------------------------------------------------------------------------
  let penetracion: number;

  if (typeof params.penetracionCategoria === 'string') {
    const raw = params.penetracionCategoria.trim().toLowerCase();

    if (raw === 'facil' || raw === 'fácil') {
      penetracion = 0.85;
    } else if (raw === 'medio') {
      penetracion = 0.6;
    } else if (raw === 'dificil' || raw === 'difícil') {
      penetracion = 0.35;
    } else if (raw.endsWith('%')) {
      penetracion = parseFloat(raw.replace('%', '')) / 100;
    } else {
      penetracion = parseFloat(raw);
    }

    if (isNaN(penetracion) || penetracion <= 0 || penetracion > 1) {
      throw new Error(
        `penetracionCategoria inválida: "${params.penetracionCategoria}", debe ser número entre 0 y 1, o una etiqueta válida (fácil, medio, difícil)`,
      );
    }
  } else {
    penetracion = params.penetracionCategoria;
  }

  // -------------------------------------------------------------------------
  // 2. Obtener constantes desde DB
  // -------------------------------------------------------------------------
  const constantes = await constantesService.getAllAsKeyValue();

  // -------------------------------------------------------------------------
  // 3. Calcular distribución (solo si TC es propio)
  // -------------------------------------------------------------------------
  let distribucion: DistribucionNacionalResult | null = null;

  if (params.trabajoDeCampoRealiza && params.trabajoDeCampoTipo === 'propio') {
    distribucion = buildDistribucionNacional({
      totalEntrevistas: params.totalEntrevistas,
      duracionCuestionarioMin: params.duracionCuestionarioMin,
      tipoEntrevista: params.tipoEntrevista,
      penetracionCategoria: penetracion,
      cobertura: params.cobertura,
      supervisores: params.supervisores,
      encuestadoresTotales: params.encuestadoresTotales,
      realizamosCuestionario: params.realizamosCuestionario,
      realizamosScript: params.realizamosScript,
      clienteSolicitaReporte: params.clienteSolicitaReporte,
      clienteSolicitaInformeBI: params.clienteSolicitaInformeBI,
      numeroOlasBi: params.numeroOlasBi,
      trabajoDeCampoRealiza: params.trabajoDeCampoRealiza,
      trabajoDeCampoTipo: params.trabajoDeCampoTipo,
      trabajoDeCampoCosto: params.trabajoDeCampoCosto,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Construir bloques
  // -------------------------------------------------------------------------
  const items: CotizacionItemBuild[] = [];

  // ---- Trabajo de campo ----------------------------------------------------
  if (params.trabajoDeCampoRealiza) {
    if (params.trabajoDeCampoTipo === 'propio' && distribucion) {
      const campo = await buildTrabajoCampoCasaPorCasaNacional(
        {
          supervisores: params.supervisores,
          encuestadoresTotales: params.encuestadoresTotales,
          factorComisionable,
          factorNoComisionable,
          distribucion,
        },
        constantes,
      );
      items.push(...campo);
    } else {
      const costo = params.trabajoDeCampoCosto ?? 0;
      const totalConComision = Math.round(costo * (1 + factorComisionable) * 100) / 100;

      items.push({
        category: 'TRABAJO DE CAMPO',
        description: 'Trabajo de campo subcontratado',
        personas: null,
        dias: null,
        costoUnitario: null,
        costoTotal: costo,
        comisionable: true,
        totalConComision,
        orden: 9,
      });
    }
  }

  // ---- Recursos ------------------------------------------------------------
  items.push(
    ...buildRecursosCasaPorCasaNacional(
      {
        encuestadoresTotales: params.encuestadoresTotales,
        supervisores: params.supervisores,
        factorComisionable,
        factorNoComisionable,
        incentivoTotal: params.incentivoTotal,
      },
      constantes,
    ),
  );

  // ---- Dirección -----------------------------------------------------------
  if (params.realizamosCuestionario) {
    items.push(
      buildRealizacionCuestionario({
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  if (params.realizamosScript) {
    items.push(
      buildSupervisorScript({
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  if (params.clienteSolicitaReporte) {
    items.push(
      buildReporteResultados({
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  if (params.clienteSolicitaInformeBI) {
    items.push(
      buildInformeBi({
        numeroOlasBi: params.numeroOlasBi,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // ---- Procesamiento -------------------------------------------------------
  items.push(buildCodificacionProcesamiento({ factorComisionable, factorNoComisionable }));
  items.push(buildControlCalidadProcesamiento({ factorComisionable, factorNoComisionable }));
  items.push(buildBaseLimpiezaProcesamiento({ factorComisionable, factorNoComisionable }));

  // -------------------------------------------------------------------------
  // 5. Totales finales
  // -------------------------------------------------------------------------
  const totalCobrar = Math.round(
    items.reduce((sum, i) => sum + (i.totalConComision ?? 0), 0) * 100,
  ) / 100;

  const costoPorEntrevista =
    params.totalEntrevistas > 0
      ? Math.round((totalCobrar / params.totalEntrevistas) * 100) / 100
      : 0;

  return {
    items,
    totalCobrar,
    costoPorEntrevista,
  };
}
