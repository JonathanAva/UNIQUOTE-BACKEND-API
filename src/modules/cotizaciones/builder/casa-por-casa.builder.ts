// ===========================================================================
// BUILDER PRINCIPAL: CASA POR CASA (NACIONAL)
// Calcula bloques de costos usando constantes y el motor nacional.engine.ts
//
// ✅ Cambios clave frente a tu versión anterior:
//  1) Se cargan las CONSTANTES desde DB y se pasan a Recursos y Dirección.
//  2) Se inserta el ítem **Días director** antes de “Realización Cuestionario”.
//  3) Se mantiene el uso de los **días del engine (W14 TOTAL)** para todos
//     los ítems que dependen de días (coincidiendo con el Excel).

import { ConstantesService } from '@/modules/constantes/constantes.service';

import {
  buildTrabajoCampoCasaPorCasaNacional,
  buildRecursosCasaPorCasaNacional,
  buildDiasDirector,                 
  buildRealizacionCuestionario,
  buildSupervisorScript,
  buildReporteResultados,
  buildInformeBi,
  buildCodificacionProcesamiento,
  buildControlCalidadProcesamiento,
  buildBaseLimpiezaProcesamiento,
  buildTablasProcesamiento,
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
  penetracionCategoria: number | string; // Acepta número o string (%, fácil/medio/difícil)
  cobertura: string;
  supervisores: number;
  encuestadoresTotales: number;
  realizamosCuestionario: boolean;
  realizamosScript: boolean;
  clienteSolicitaReporte: boolean;
  clienteSolicitaInformeBI: boolean;
  numeroOlasBi: number;
  clienteSolicitaTablas?: boolean;
  trabajoDeCampoRealiza: boolean;
  trabajoDeCampoTipo?: 'propio' | 'subcontratado';
  trabajoDeCampoCosto?: number;
  incentivoTotal?: number;
  factorComisionable?: number;     // p.ej. 1 = 100%
  factorNoComisionable?: number;   // p.ej. 0.05 = 5%
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
// FUNCIÓN PRINCIPAL (COMPLETA)
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

  // 1) Normalizar penetración
  let penetracion: number;
  if (typeof params.penetracionCategoria === 'string') {
    const raw = params.penetracionCategoria.trim().toLowerCase();
    if (raw === 'facil' || raw === 'fácil') penetracion = 0.85;
    else if (raw === 'medio') penetracion = 0.6;
    else if (raw === 'dificil' || raw === 'difícil') penetracion = 0.35;
    else if (raw.endsWith('%')) penetracion = parseFloat(raw.replace('%', '')) / 100;
    else penetracion = parseFloat(raw);
    if (isNaN(penetracion) || penetracion <= 0 || penetracion > 1) {
      throw new Error(`penetracionCategoria inválida: "${params.penetracionCategoria}"`);
    }
  } else {
    penetracion = params.penetracionCategoria;
  }

  // 2) Constantes
  const constantes = await constantesService.getAllAsKeyValue();

  // 3) Distribución (engine)
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

  // 4) Bloques
  const items: CotizacionItemBuild[] = [];

  // TRABAJO DE CAMPO
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

  // RECURSOS
  items.push(
    ...buildRecursosCasaPorCasaNacional(
      {
        encuestadoresTotales: params.encuestadoresTotales,
        supervisores: params.supervisores,
        factorComisionable,
        factorNoComisionable,
        incentivoTotal: params.incentivoTotal,
        distribucion: distribucion!, // días del engine
        tipoEntrevista: params.tipoEntrevista, // (opcional, por si filtras plataformas)
      },
      constantes,
    ),
  );

  // DIRECCIÓN
  items.push(
    buildDiasDirector(
      { factorComisionable, factorNoComisionable, distribucion: distribucion! },
      constantes,
    ),
  );

  if (params.realizamosCuestionario) {
    items.push(
      buildRealizacionCuestionario(
        { factorComisionable, factorNoComisionable, duracionCuestionarioMin: params.duracionCuestionarioMin },
        constantes,
      ),
    );
  }

  if (params.realizamosScript) {
    items.push(
      buildSupervisorScript(
        { factorComisionable, factorNoComisionable, duracionCuestionarioMin: params.duracionCuestionarioMin },
        constantes,
      ),
    );
  }

  if (params.clienteSolicitaReporte) {
    items.push(
      buildReporteResultados(
        { factorComisionable, factorNoComisionable },
        constantes,
        { duracionCuestionarioMin: params.duracionCuestionarioMin },
      ),
    );
  }

  if (params.clienteSolicitaInformeBI) {
    items.push(
      buildInformeBi(
        {
          numeroOlasBi: params.numeroOlasBi,
          factorComisionable,
          factorNoComisionable,
          duracionCuestionarioMin: params.duracionCuestionarioMin,
        },
        constantes,
      ),
    );
  }

  // PROCESAMIENTO
  items.push(
    buildCodificacionProcesamiento(
      {
        totalEntrevistas: params.totalEntrevistas,
        duracionCuestionarioMin: params.duracionCuestionarioMin,
        factorComisionable,
        factorNoComisionable,
      },
      constantes,
    ),
  );

  
  items.push(
    buildControlCalidadProcesamiento(
      {
        totalEntrevistas: params.totalEntrevistas,
        duracionCuestionarioMin: params.duracionCuestionarioMin,
        factorComisionable,
        factorNoComisionable,
      },
      constantes,
    ),
  );

  items.push(
    buildBaseLimpiezaProcesamiento(
      {
        factorComisionable,
        factorNoComisionable,
        duracionCuestionarioMin: params.duracionCuestionarioMin,
      },
      constantes,
    ),
  );

    if (params.clienteSolicitaTablas) {
    items.push(
      buildTablasProcesamiento(
        {
          factorComisionable,
          factorNoComisionable,
          duracionCuestionarioMin: params.duracionCuestionarioMin,
        },
        constantes,
      ),
    );
  }

  // 5) Totales
  const totalCobrar = Math.round(items.reduce((s, i) => s + (i.totalConComision ?? 0), 0) * 100) / 100;
  const costoPorEntrevista =
    params.totalEntrevistas > 0 ? Math.round((totalCobrar / params.totalEntrevistas) * 100) / 100 : 0;

  return { items, totalCobrar, costoPorEntrevista };
}

