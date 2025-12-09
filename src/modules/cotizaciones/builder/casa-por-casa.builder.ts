// src/modules/cotizaciones/builder/casa-por-casa.builder.ts
//
// Builder para armar los bloques de la cotización
// del tipo "Casa por casa" con cobertura NACIONAL.
//
// Aquí SOLO hay lógica de armado de bloques (sin Nest/Prisma):
//  - TRABAJO DE CAMPO
//  - RECURSOS
//  - DIRECCIÓN
//  - PROCESAMIENTO / INFORME
//  - BI
//
// El service solo llama a buildCotizacionCasaPorCasa(...).

import {
  distribuirEntrevistasNacional,
  aplicarRendimientoNacional,
  aplicarEncuestadoresYSupervisoresNacional,
  aplicarDiasCampoYCostosNacional,
  aplicarPrecioBoletaNacional,
  calcularTotalesViaticosTransporteHotelNacional,
  calcularPagosPersonalNacional,
  type DistribucionNacionalResult,
  type ParamsRendimiento,
} from '../engine/casa-por-casa/nacional.engine';

// ---------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------

/**
 * Representa la estructura que luego se mapeará a CotizacionItem
 * de Prisma. Aquí usamos number / boolean "a pelo".
 */
export interface CotizacionItemBuild {
  category: string;
  description: string;
  personas: number | null;        // "# pers/encues/grp"
  dias: number | null;            // "# días / horas"
  costoUnitario: number | null;   // "Costo US$"
  costoTotal: number | null;      // "Costo total US$"
  comisionable: boolean;          // Sí / No
  totalConComision: number | null;// "Total"
  orden: number;                  // para mantener el orden del Excel
}

/**
 * Parámetros que necesita el builder de Casa por casa / Nacional
 * una vez que ya tenemos la distribución calculada por el motor.
 */
export interface CasaPorCasaNacionalBuilderParams {
  // Inputs de la cotización
  totalEntrevistas: number;          // Ingresar!H4
  duracionCuestionarioMin: number;   // Ingresar!C12 (ej. 15 min)
  tipoEntrevista: string;            // Casa por casa / Telefónico / Online, etc.
  cobertura: string;                 // Nacional / Urbano / AMSS / Unimer...
  supervisores: number;              // Ingresar!C19
  encuestadoresTotales: number;      // Ingresar!C20

  realizamosCuestionario: boolean;   // Ingresar!C24 (¿Realizamos Cuestionario?)
  realizamosScript: boolean;         // Ingresar!C25 (¿Realizamos Script?)
  clienteSolicitaReporte: boolean;   // Ingresar!C26 (¿Reporte?)
  clienteSolicitaInformeBI: boolean; // Ingresar!C27 (¿Informe BI?)
  numeroOlasBi: number;              // Nº de olas BI (base 2, 3 = una ola extra)

  // Factores globales de la cabecera de cotización
  factorComisionable: number;        // G4 → 1.00 (100 %)
  factorNoComisionable: number;      // G7 → 0.05 (5 %)

  // Resultado del motor NACIONAL ya calculado
  distribucion: DistribucionNacionalResult;
}

/**
 * Resultado global del builder:
 *  - items: todos los CotizacionItem que se guardarán
 *  - totalCobrar: suma de "Total" de todos los items
 *  - costoPorEntrevista: totalCobrar / totalEntrevistas
 */
export interface CasaPorCasaNacionalBuildResult {
  items: CotizacionItemBuild[];
  totalCobrar: number;
  costoPorEntrevista: number;
}

/**
 * Entrada que usará el SERVICE al llamar al builder
 * (los boolean pueden venir undefined → se defaultean adentro).
 */
export interface BuildCotizacionCasaPorCasaInput {
  totalEntrevistas: number;
  duracionCuestionarioMin: number;
  tipoEntrevista: string;
  penetracionCategoria: number;
  cobertura: string;
  supervisores: number;
  encuestadoresTotales: number;

  realizamosCuestionario?: boolean;
  realizamosScript?: boolean;
  clienteSolicitaReporte?: boolean;
  clienteSolicitaInformeBI?: boolean;
  numeroOlasBi?: number; // base 2
  trabajoDeCampo: boolean;

}

// ---------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------

const round2 = (value: number): number =>
  Math.round(value * 100) / 100;

/**
 * Aplica el factor comisionable / no comisionable.
 *
 * - Si comisionable = true → costoTotal * (1 + factorComisionable)
 * - Si comisionable = false → costoTotal * (1 + factorNoComisionable)
 */
function aplicarComision(
  costoTotal: number,
  comisionable: boolean,
  factorComisionable: number,
  factorNoComisionable: number,
): number {
  const factor = comisionable
    ? 1 + factorComisionable
    : 1 + factorNoComisionable;

  return round2(costoTotal * factor);
}

/**
 * Helper básico para filas cuya fórmula de costo total es:
 *
 *   costoTotal = personas * dias * costoUnitario
 */
function buildItemSimple(opts: {
  category: string;
  description: string;
  personas: number;
  dias: number;
  costoUnitario: number;
  comisionable: boolean;
  orden: number;
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const personas = opts.personas;
  const dias = opts.dias;
  const costoUnitario = opts.costoUnitario;

  const costoTotal = round2(personas * dias * costoUnitario);
  const totalConComision = aplicarComision(
    costoTotal,
    opts.comisionable,
    opts.factorComisionable,
    opts.factorNoComisionable,
  );

  return {
    category: opts.category,
    description: opts.description,
    personas,
    dias,
    costoUnitario,
    costoTotal,
    comisionable: opts.comisionable,
    totalConComision,
    orden: opts.orden,
  };
}

// ---------------------------------------------------------
// Bloque: TRABAJO DE CAMPO (Casa por casa / Nacional)
// ---------------------------------------------------------

function buildTrabajoCampoCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const {
    supervisores,
    encuestadoresTotales,
    distribucion,
    factorComisionable,
    factorNoComisionable,
  } = params;

  const items: CotizacionItemBuild[] = [];

  const totalPersonasCampo = supervisores + encuestadoresTotales;

  // Días de campo global (suma de la columna "Días campo Encuest")
  const diasCampoReal = distribucion.totalDiasCampoEncuestGlobal ?? 0;
  const diasCampo = round2(diasCampoReal || 0); // en el ejemplo queda 15.00

  // Totales globales de Viáticos / Transporte / Hotel ya calculados
  const totalViaticos = distribucion.totalViaticosGlobal ?? 0;
  const totalTransporte = distribucion.totalTMicrobusGlobal ?? 0;
  const totalHotel = distribucion.totalHotelGlobal ?? 0;

  // Totales globales de pagos de personal
  const totalPagoEncuestadores =
    distribucion.totalPagoEncuestadoresGlobal ?? 0;
  const totalPagoSupervisores =
    distribucion.totalPagoSupervisoresGlobal ?? 0;

  // === Dirección Trabajo Campo ===============================
  {
    const personas = 1;
    const costoUnitario = 50;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Dirección Trabajo Campo',
      personas,
      dias: diasCampo,
      costoUnitario,
      comisionable: true,
      orden: 10,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Capacitación =========================================
  {
    const personas = totalPersonasCampo;
    const costoUnitario = 8;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Capacitación',
      personas,
      dias: 1,
      costoUnitario,
      comisionable: true,
      orden: 11,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Supervisor ===========================================
  {
    const personas = supervisores;
    const dias = diasCampo;

    const costoTotal = round2(totalPagoSupervisores);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0;

    const totalConComision = aplicarComision(
      costoTotal,
      true, // comisionable
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Supervisor',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 12,
    });
  }

  // === Encuestadores ========================================
  {
    const personas = encuestadoresTotales;
    const dias = diasCampo;
    const costoUnitario = 3.5;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Encuestadores',
      personas,
      dias,
      costoUnitario,
      comisionable: true,
      orden: 13,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Pago de filtros ======================================
  {
    const personas = 0;
    const dias = 1;
    const costoUnitario = 0.5;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Pago de filtros',
      personas,
      dias,
      costoUnitario,
      comisionable: true,
      orden: 14,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Viáticos =============================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalViaticos);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 1.56

    const totalConComision = aplicarComision(
      costoTotal,
      true,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Viaticos',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 15,
    });
  }

  // === Transporte ===========================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalTransporte);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 5.71

    const totalConComision = aplicarComision(
      costoTotal,
      true,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Transporte',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 16,
    });
  }

  // === Hotel ================================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalHotel);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 0.62

    const totalConComision = aplicarComision(
      costoTotal,
      false, // No comisionable
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Hotel',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: false,
      totalConComision,
      orden: 17,
    });
  }

  return items;
}

// ---------------------------------------------------------
// Bloque: RECURSOS (Casa por casa / Nacional)
// ---------------------------------------------------------

/**
 * Config específica para recursos de Casa por casa / Nacional.
 * Equivale a lo que hoy saca la hoja "Botones".
 */
const RECURSOS_CONFIG_NACIONAL = {
  diasRecursos: 15,            // XLOOKUP(Ingresar!C18, Botones!K:L)
  telefonoUnimeresUnit: 0.6,
  telefonoCelularCampoUnit: 0.36,
  internetEncuestadoresUnit: 3,
  usbUnit: 3.1,
  papelUnit: 0.3,
  usoDispositivosUnit: 5,
  plataformaStgUnit: 0.26,
};

function buildRecursosCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const {
    supervisores,
    encuestadoresTotales,
    distribucion,
    factorComisionable,
    factorNoComisionable,
    tipoEntrevista,
    totalEntrevistas,
  } = params;

  const items: CotizacionItemBuild[] = [];

  const totalPersonasCampo = supervisores + encuestadoresTotales;
  const diasRecursos = RECURSOS_CONFIG_NACIONAL.diasRecursos;

  // Para la plataforma STG se usa el total de entrevistas ajustado (H4 * 1.05)
  const totalEntrevistasAjustado =
    distribucion.totalEntrevistasAjustado || totalEntrevistas;

  const isTelefonico =
    tipoEntrevista.trim().toLowerCase() === 'telefónico';

  // Teléfono (UNIMERES)
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Teléfono (UNIMERES)',
      personas: 1,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.telefonoUnimeresUnit,
      comisionable: false,
      orden: 20,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Teléfono celular (campo)
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Teléfono celular (campo)',
      personas: totalPersonasCampo,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.telefonoCelularCampoUnit,
      comisionable: false,
      orden: 21,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Internet a encuestadores
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Internet a encuestadores',
      personas: encuestadoresTotales,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.internetEncuestadoresUnit,
      comisionable: false,
      orden: 22,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // USB
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'USB',
      personas: 1,
      dias: 1,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.usbUnit,
      comisionable: true,
      orden: 23,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Papel
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Papel',
      personas: totalPersonasCampo,
      dias: 1,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.papelUnit,
      comisionable: true,
      orden: 24,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Uso de dispositivos
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Uso de dispositivos',
      personas: totalPersonasCampo,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.usoDispositivosUnit,
      comisionable: false,
      orden: 25,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Plataforma de Captura STG
  {
    const personas = totalEntrevistasAjustado;
    const dias = 0;
    const costoUnitario = isTelefonico
      ? 0
      : RECURSOS_CONFIG_NACIONAL.plataformaStgUnit;

    const costoTotal = round2(personas * costoUnitario);
    const totalConComision = aplicarComision(
      costoTotal,
      false,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'RECURSOS',
      description: 'Plataforma de Captura STG',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: false,
      totalConComision,
      orden: 26,
    });
  }

  return items;
}

// ---------------------------------------------------------
// Bloque: DIRECCIÓN (Días director)
// ---------------------------------------------------------

function buildDireccionCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const { distribucion } = params;

  const items: CotizacionItemBuild[] = [];

  // Días director:
  //  horasBase = díasProyecto * 2
  //  horasTotales = horasBase + 4
  //  costoInterno = horasTotales * 10
  //  totalConComision = costoInterno / 0.4
  const diasProyecto = distribucion.totalDiasCampoEncuestGlobal ?? 0; // ej. 15
  const horasBase = diasProyecto * 2;
  const horasTotales = horasBase + 4;

  const COSTO_HORA_DIRECTOR = 10;
  const costoInterno = round2(horasTotales * COSTO_HORA_DIRECTOR); // ej. 340
  const totalConComision = round2(costoInterno / 0.4);             // ej. 850

  items.push({
    category: 'DIRECCIÓN',
    description: 'Días director',
    personas: 1,
    dias: horasTotales,          // 34
    costoUnitario: null,         // "-" en UI
    costoTotal: null,            // "-" en UI
    comisionable: true,
    totalConComision,            // 850.00
    orden: 30,
  });

  return items;
}

// ---------------------------------------------------------
// Realización Cuestionario
// ---------------------------------------------------------
//
// investigacionHoras = 1.5 → 1.5 * 10 = 15
// preguntasTotales   = duracionMin * 4
// tiempoPregMin      = preguntasTotales * 5
// horasPreg          = tiempoPregMin / 60
// precioPreg         = horasPreg * 10 = 50
// precioRealizacion  = 15 + 50 = 65
// costoTotal         = 1 * 1 * 65
// totalConComision   = 65 / 0.4 = 162.50
//
function buildRealizacionCuestionario(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin, realizamosCuestionario } = params;

  const personas = realizamosCuestionario ? 1 : 0;
  const dias = 1;

  const PREGUNTAS_POR_MINUTO = 4;
  const MINUTOS_POR_PREGUNTA = 5;
  const PRECIO_HORA = 10;
  const MARGEN_COMISION = 0.4;

  const investigacionHoras = 1.5;
  const investigacionPrecio = investigacionHoras * PRECIO_HORA; // 15

  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;
  const tiempoPorPreguntaMin = preguntasTotales * MINUTOS_POR_PREGUNTA;
  const horasTiempoPorPregunta = tiempoPorPreguntaMin / 60; // 300 / 60 = 5
  const tiempoPorPreguntaPrecio =
    horasTiempoPorPregunta * PRECIO_HORA; // 5 * 10 = 50

  const precioRealizacion = investigacionPrecio + tiempoPorPreguntaPrecio; // 65

  const costoTotal = round2(personas * dias * precioRealizacion); // 65 ó 0
  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0; // 162.50

  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas,
    dias,
    costoUnitario: null, // en Excel es "-"
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 32,
  };
}

// ---------------------------------------------------------
// Supervisor (Script)
// ---------------------------------------------------------
//
// Precios internos (hora = 8):
//  - Programar pregunta: 1 min * #preguntas
//  - Definir saltos/reglas: 1 min * #preguntas
//  - Duración de prueba: duracionMin * 2
//  - Cambios: 60 min fijos
//
// Solo se cobran estas 4 filas → 28 interno → 70 con comisión.
//
function buildSupervisorScript(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin, realizamosScript } = params;

  const personas = realizamosScript ? 1 : 0;
  const dias = 1;

  const PREG_POR_MIN = 4;
  const PRECIO_HORA_SCRIPT = 8;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales = duracionCuestionarioMin * PREG_POR_MIN;

  // Programar una pregunta en Software
  const minutosProgramar = preguntasTotales * 1;
  const horasProgramar = minutosProgramar / 60;
  const precioProgramar = horasProgramar * PRECIO_HORA_SCRIPT;

  // Definir saltos y poner reglas
  const minutosDefinir = preguntasTotales * 1;
  const horasDefinir = minutosDefinir / 60;
  const precioDefinir = horasDefinir * PRECIO_HORA_SCRIPT;

  // Duración de prueba
  const minutosPrueba = duracionCuestionarioMin * 2;
  const horasPrueba = minutosPrueba / 60;
  const precioPrueba = horasPrueba * PRECIO_HORA_SCRIPT;

  // Cambios (60 min)
  const minutosCambios = 60;
  const horasCambios = minutosCambios / 60;
  const precioCambios = horasCambios * PRECIO_HORA_SCRIPT;

  const costoInterno =
    precioProgramar + precioDefinir + precioPrueba + precioCambios; // 28

  const costoTotal = round2(personas * dias * costoInterno);
  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0; // 70

  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor',
    personas,
    dias,
    costoUnitario: null,
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 34,
  };
}

// ---------------------------------------------------------
// Reporte de Resultados
// ---------------------------------------------------------
//
// Usa duracionCuestionarioMin, 4 preg/min, 10 USD/hora.
//
function buildReporteResultados(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const {
    duracionCuestionarioMin,
    clienteSolicitaReporte,
  } = params;

  const personas = clienteSolicitaReporte ? 1 : 0;
  const dias = 1;

  if (!clienteSolicitaReporte) {
    return {
      category: 'DIRECCIÓN',
      description: 'Reporte de Resultados',
      personas,
      dias,
      costoUnitario: null,
      costoTotal: 0,
      comisionable: true,
      totalConComision: 0,
      orden: 35,
    };
  }

  const PREG_POR_MIN = 4;
  const PRECIO_HORA = 10;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales = duracionCuestionarioMin * PREG_POR_MIN;
  const diapositivas = preguntasTotales / 4;

  const minutosAHorasCosto = (minutos: number): number =>
    (minutos / 60) * PRECIO_HORA;

  const diseno = minutosAHorasCosto(180);                    // 3h
  const procesamiento = minutosAHorasCosto(5 * preguntasTotales);
  const graficas = minutosAHorasCosto(60 * diapositivas);
  const revisionDatos = minutosAHorasCosto(10 * diapositivas);
  const presentacionClientes = minutosAHorasCosto(120);
  const ajustes = minutosAHorasCosto(390);

  const costoInterno =
    diseno +
    procesamiento +
    graficas +
    revisionDatos +
    presentacionClientes +
    ajustes; // ej. 340

  const costoTotal = round2(personas * dias * costoInterno); // 340
  const totalConComision = round2(costoTotal / MARGEN_COMISION); // 850

  return {
    category: 'DIRECCIÓN',
    description: 'Reporte de Resultados',
    personas,
    dias,
    costoUnitario: null,
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 35,
  };
}

// ---------------------------------------------------------
// Informe BI
// ---------------------------------------------------------
//
// Fase 1 y 2: se arman con duracionCuestionarioMin, 4 preg/min, 10 USD/h.
// Fase 3: costo interno fijo 221.27 que se suma por cada ola extra
// por encima de 2 (base = 2 olas).
//
function buildInformeBi(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const {
    duracionCuestionarioMin,
    clienteSolicitaInformeBI,
    numeroOlasBi,
  } = params;

  if (!clienteSolicitaInformeBI) {
    return {
      category: 'DIRECCIÓN',
      description: 'Informe BI',
      personas: 0,
      dias: 1,
      costoUnitario: null,
      costoTotal: 0,
      comisionable: true,
      totalConComision: 0,
      orden: 36,
    };
  }

  const PREG_POR_MIN = 4;
  const PRECIO_HORA_BI = 10;
  const MIN_PREG_GRAFICAS = 60;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales = duracionCuestionarioMin * PREG_POR_MIN;
  const preguntasParaGraficas = Math.max(preguntasTotales, MIN_PREG_GRAFICAS);
  const diapositivas = preguntasParaGraficas / 4;

  const minutosAHorasCosto = (minutos: number): number =>
    (minutos / 60) * PRECIO_HORA_BI;

  // ----- Fase 1 y 2 -----
  const softwareYAlojamiento = 100;
  const diseno = minutosAHorasCosto(360);                    // 6h
  const adecuacionDatos = minutosAHorasCosto(5 * preguntasTotales);
  const identificacionSegmentadores = minutosAHorasCosto(30);
  const graficas = minutosAHorasCosto(60 * diapositivas);
  const revisionDatos = minutosAHorasCosto(10 * diapositivas);
  const revisionPreliminarClientes = minutosAHorasCosto(120);
  const presentacionClientes = minutosAHorasCosto(120);
  const ajustes = minutosAHorasCosto(360);

  let costoInterno =
    softwareYAlojamiento +
    diseno +
    adecuacionDatos +
    identificacionSegmentadores +
    graficas +
    revisionDatos +
    revisionPreliminarClientes +
    presentacionClientes +
    ajustes; // ej. 473.33

  // ----- Fase 3 (olas extras > 2) -----
  const COSTO_INTERNO_FASE3 = 221.27;

  const olas = numeroOlasBi && numeroOlasBi >= 2 ? numeroOlasBi : 2;
  const olasExtras = Math.max(0, olas - 2);

  if (olasExtras > 0) {
    costoInterno += COSTO_INTERNO_FASE3 * olasExtras;
  }

  const costoTotal = round2(costoInterno);
  const totalConComision = round2(costoTotal / MARGEN_COMISION);

  return {
    category: 'DIRECCIÓN',
    description: 'Informe BI',
    personas: 1,
    dias: olas, // 2 base, 3 si hay una ola extra, etc.
    costoUnitario: null,
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 36,
  };
}

// ---------------------------------------------------------
// PROCESAMIENTO: Codificación
// ---------------------------------------------------------
//
// Tabla de ayuda:
//
// Total entrevistas  → totalEntrevistas
// Duración (min)    → duracionCuestionarioMin
// Param. preg/min   → 4
// Preguntas totales → duracion * 4
// Preguntas abiertas (10%) → preguntasTotales * 0.1
//
// costoBase            = totalEntrevistas * pregAbiertas * 0.02
// costoYaComisionable  = costoBase / 0.4      → 300
// totalConComision     = costoYaComisionable / 0.4 → 750
//
// Fila final:
//   Codificación   1  1   "-"   300   Sí   750
//
function buildCodificacionProcesamiento(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { totalEntrevistas, duracionCuestionarioMin } = params;

  // Constantes de codificación
  const PREG_POR_MIN = 4;
  const PORC_PREG_ABIERTAS = 0.1;   // 10 %
  const COSTO_POR_RESPUESTA = 0.02; // 0.02 US$ por respuesta
  const MARGEN_COMISION = 0.4;      // se divide entre 0.4

  // 1) Preguntas totales
  const preguntasTotales = duracionCuestionarioMin * PREG_POR_MIN;

  // 2) Preguntas abiertas (10% del total)
  const preguntasAbiertas = preguntasTotales * PORC_PREG_ABIERTAS; // ej. 6

  // 3) Costo base interno
  const costoBase =
    totalEntrevistas * preguntasAbiertas * COSTO_POR_RESPUESTA; // ej. 120

  // 4) Costo ya comisionable (primer /0.4)
  const costoYaComisionable = round2(costoBase / MARGEN_COMISION); // ej. 300

  // 5) Total final (segundo /0.4)
  const totalConComision = round2(
    costoYaComisionable / MARGEN_COMISION,
  ); // ej. 750

  return {
    category: 'PROCESAMIENTO',
    description: 'Codificación',
    personas: 1,
    dias: 1,
    costoUnitario: null,          // en la hoja se muestra "-"
    costoTotal: costoYaComisionable,
    comisionable: true,
    totalConComision,
    orden: 50,                    // ponlo donde quieras en el orden
  };
}

// ---------------------------------------------------------
// PROCESAMIENTO: Control de Calidad
// ---------------------------------------------------------
//
// Total entrevistas  → totalEntrevistas
// Duración (min)     → duracionCuestionarioMin
//
// minutosEscucha   = totalEntrevistas * duracionCuestionarioMin  → 15000
// horasEscucha     = minutosEscucha / 60                          → 250
// costoBase        = horasEscucha * PRECIO_HORA_CC                → 500
// totalConComision = costoBase / 0.4                              → 1250
//
// Fila:
//   Control de Calidad   1   15000   "-"   500   Sí   1250
//
function buildControlCalidadProcesamiento(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { totalEntrevistas, duracionCuestionarioMin } = params;

  const PRECIO_HORA_CC = 2;   // $2 la hora de escucha
  const MARGEN_COMISION = 0.4;

  // 1) Minutos totales de escucha
  const minutosEscucha = totalEntrevistas * duracionCuestionarioMin; // ej. 15000

  // 2) Horas
  const horasEscucha = minutosEscucha / 60; // ej. 250

  // 3) Costo base interno
  const costoBase = round2(horasEscucha * PRECIO_HORA_CC); // ej. 500

  // 4) Total con comisión
  const totalConComision = round2(costoBase / MARGEN_COMISION); // ej. 1250

  return {
    category: 'PROCESAMIENTO',
    description: 'Control de Calidad',
    personas: 1,
    dias: minutosEscucha,    // en la tabla aparece 15000
    costoUnitario: null,     // se muestra "-" en el Excel
    costoTotal: costoBase,   // 500
    comisionable: true,
    totalConComision,        // 1250
    orden: 51,               // ponlo después de Codificación
  };
}



// ---------------------------------------------------------
// PROCESAMIENTO: Base + Limpieza (digital)
// ---------------------------------------------------------
function buildBaseLimpiezaProcesamiento(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin } = params;

  // Constantes según tu explicación
  const PREGUNTAS_POR_MINUTO = 4;      // 4 preguntas por minuto
  const MINUTOS_BASE_POR_PREGUNTA = 10; // 10 min por pregunta
  const PRECIO_HORA = 10;             // 10 USD/hora
  const MARGEN_COMISION = 0.4;        // dividir entre 0.4

  // Preguntas totales = duración * 4
  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;

  // Minutos totales = preguntasTotales * 10
  const minutosTotales = preguntasTotales * MINUTOS_BASE_POR_PREGUNTA;

  // Horas = minutosTotales / 60
  const horas = minutosTotales / 60;

  // Precio interno = horas * 10
  const costoTotal = round2(horas * PRECIO_HORA); // ej. 66.67 si dur = 10

  // Como es comisionable → dividir entre 0.4
  const totalConComision = round2(costoTotal / MARGEN_COMISION); // ej. 166.67

  return {
    category: 'PROCESAMIENTO',
    description: 'Base + Limpieza (digital)',
    personas: 1,
    dias: 0,                // en la tabla se muestra 0.00
    costoUnitario: PRECIO_HORA, // 10 (referencia, aunque el total no sale de B*C*D)
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 52,              // después de Control de Calidad
  };
}


// ---------------------------------------------------------
// Builder principal: Casa por casa / Nacional (interno)
// ---------------------------------------------------------
export function buildCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CasaPorCasaNacionalBuildResult {
  const trabajoCampo = buildTrabajoCampoCasaPorCasaNacional(params);
  const recursos = buildRecursosCasaPorCasaNacional(params);
  const direccion = buildDireccionCasaPorCasaNacional(params);
  const realizacionCuestionario = buildRealizacionCuestionario(params);
  const supervisorScript = buildSupervisorScript(params);
  const reporteResultados = buildReporteResultados(params);
  const informeBi = buildInformeBi(params);
  const codificacion = buildCodificacionProcesamiento(params);
  const controlCalidad = buildControlCalidadProcesamiento(params);
  const baseLimpieza = buildBaseLimpiezaProcesamiento(params);

  const items: CotizacionItemBuild[] = [
    // TRABAJO DE CAMPO
    ...trabajoCampo,

    // RECURSOS
    ...recursos,

    // DIRECCIÓN
    ...direccion,
    realizacionCuestionario,
    supervisorScript,
    reporteResultados,
    informeBi,

    // PROCESAMIENTO
    codificacion,
    controlCalidad,
    baseLimpieza,
  ];

  // 1) Suma de todos los "Total" (totalConComision)
  const sumaTotal = items.reduce(
    (acc, it) => acc + (it.totalConComision ?? 0),
    0,
  );

  // 2) Aplicar CEILING(SUM(tCoti[Total]), 10)
  //    → redondear SIEMPRE hacia arriba al siguiente múltiplo de 10
  const totalCobrar = Math.ceil(sumaTotal / 10) * 10;

  // 3) Costo por entrevista = A COBRAR / totalEntrevistas
  const costoPorEntrevista =
    params.totalEntrevistas > 0
      ? round2(totalCobrar / params.totalEntrevistas)
      : 0;

  return {
    items,
    totalCobrar,
    costoPorEntrevista,
  };
}


// ---------------------------------------------------------
// FUNCIÓN QUE USA EL SERVICE
// ---------------------------------------------------------

export function buildCotizacionCasaPorCasa(
  input: BuildCotizacionCasaPorCasaInput,
): CasaPorCasaNacionalBuildResult {
  const coberturaLower = input.cobertura.trim().toLowerCase();
  if (coberturaLower !== 'nacional') {
    throw new Error(
      `Por ahora el builder "Casa por casa" solo soporta cobertura "Nacional" (recibido: "${input.cobertura}")`,
    );
  }

  // Mapear penetración a fracción
  const rawPen = (input.penetracionCategoria ?? '').toString();
  const value = rawPen.trim().toLowerCase();
  const numeric = Number(value.replace('%', ''));
  let penetracion: number;

  if (!Number.isNaN(numeric) && numeric > 0) {
    penetracion = numeric > 1 ? numeric / 100 : numeric;
  } else {
    switch (value) {
      case 'facil':
      case 'fácil':
        penetracion = 0.85;
        break;
      case 'medio':
        penetracion = 0.6;
        break;
      case 'dificil':
      case 'difícil':
        penetracion = 0.35;
        break;
      default:
        throw new Error(
          `penetracionCategoria inválida: "${rawPen}", envía porcentaje (ej. "80%" o "0.8") o etiquetas facil/medio/dificil`,
        );
    }
  }

  // 1) Distribución base
  let distribucion = distribuirEntrevistasNacional(
    input.totalEntrevistas,
    input.tipoEntrevista,
  );

  // 2) Rendimiento
  const paramsRendimiento: ParamsRendimiento = {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
    totalEncuestadores: input.encuestadoresTotales,
    segmentSize: 20,
    filterMinutes: 2,
    searchMinutes: 8,
    desplazamientoMin: 60,
    groupSize: 4,
  };

  distribucion = aplicarRendimientoNacional(distribucion, paramsRendimiento);

  // 3) Encuestadores / supervisores
  distribucion = aplicarEncuestadoresYSupervisoresNacional(
    distribucion,
    input.encuestadoresTotales,
    { groupSize: 4, supervisorSplit: 4 },
  );

  // 4) Días campo + costos unitarios
  distribucion = aplicarDiasCampoYCostosNacional(distribucion);

  // 5) Precio de boleta
  distribucion = aplicarPrecioBoletaNacional(distribucion, {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
  });

  // 6) Viáticos / transporte / hotel
  distribucion =
    calcularTotalesViaticosTransporteHotelNacional(distribucion);

  // 7) Pagos personal
  distribucion = calcularPagosPersonalNacional(distribucion);

  // 8) Construir los bloques con factores de cabecera
  const builderParams: CasaPorCasaNacionalBuilderParams = {
    totalEntrevistas: input.totalEntrevistas,
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    tipoEntrevista: input.tipoEntrevista,
    cobertura: input.cobertura,
    supervisores: input.supervisores,
    encuestadoresTotales: input.encuestadoresTotales,

    realizamosCuestionario: input.realizamosCuestionario ?? false,
    realizamosScript: input.realizamosScript ?? false,
    clienteSolicitaReporte: input.clienteSolicitaReporte ?? false,
    clienteSolicitaInformeBI: input.clienteSolicitaInformeBI ?? false,
    numeroOlasBi: input.numeroOlasBi ?? 2,

    factorComisionable: 1,      // 100 %
    factorNoComisionable: 0.05, // 5 %
    distribucion,
  };

  return buildCasaPorCasaNacional(builderParams);

  

}

/**
 * Devuelve solo la distribución nacional (por departamento)
 * sin generar la cotización completa.
 *
 * Útil para endpoints de depuración o para mostrar la tabla intermedia.
 */
export function buildDistribucionNacional(
  input: BuildCotizacionCasaPorCasaInput,
): DistribucionNacionalResult {
  const coberturaLower = input.cobertura.trim().toLowerCase();
  if (coberturaLower !== 'nacional') {
    throw new Error(
      `buildDistribucionNacional solo soporta cobertura "Nacional" (recibido: "${input.cobertura}")`,
    );
  }

  // Mapear penetración
  const rawPen = (input.penetracionCategoria ?? '').toString();
  const value = rawPen.trim().toLowerCase();
  const numeric = Number(value.replace('%', ''));
  let penetracion: number;

  if (!Number.isNaN(numeric) && numeric > 0) {
    penetracion = numeric > 1 ? numeric / 100 : numeric;
  } else {
    switch (value) {
      case 'facil':
      case 'fácil':
        penetracion = 0.85;
        break;
      case 'medio':
        penetracion = 0.6;
        break;
      case 'dificil':
      case 'difícil':
        penetracion = 0.35;
        break;
      default:
        throw new Error(
          `penetracionCategoria inválida: "${rawPen}", envía porcentaje (ej. "80%" o "0.8") o etiquetas facil/medio/dificil`,
        );
    }
  }

  // Paso a paso del motor de distribución nacional
  let distribucion = distribuirEntrevistasNacional(
    input.totalEntrevistas,
    input.tipoEntrevista,
  );

  distribucion = aplicarRendimientoNacional(distribucion, {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
    totalEncuestadores: input.encuestadoresTotales,
    segmentSize: 20,
    filterMinutes: 2,
    searchMinutes: 8,
    desplazamientoMin: 60,
    groupSize: 4,
  });

  distribucion = aplicarEncuestadoresYSupervisoresNacional(
    distribucion,
    input.encuestadoresTotales,
    { groupSize: 4, supervisorSplit: 4 },
  );

  distribucion = aplicarDiasCampoYCostosNacional(distribucion);

  distribucion = aplicarPrecioBoletaNacional(distribucion, {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
  });

  distribucion = calcularTotalesViaticosTransporteHotelNacional(distribucion);

  distribucion = calcularPagosPersonalNacional(distribucion);

  return distribucion;
}

