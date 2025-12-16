// src/modules/cotizaciones/engine/casa-por-casa/amss.engine.ts
//
// Engine AMSS: un solo departamento (San Salvador) y mismos pasos conceptuales
// que Nacional, pero con reglas/constantes específicas y SIN reasignar
// encuestadores/supervisores (se muestran tal cual vienen).
//
// - 100% urbano
// - Horas efectivas = 8 → 480 min
// - Rendimiento: misma fórmula base que Nacional, pero redondeado a ENTERO (floor)
//   para evitar 12.5 → 12
// - Días de campo: CEIL( (Q / (T * U)) * 1.05 )
// - Unitarios AMSS: viáticos 3, tMicrobus 60, hotel 0
// - Precio boleta fijo AMSS: 2.5
// - Pago supervisores (AMSS): tarifa/día = 18

import {
  DistribucionNacionalResult,
  DistribucionDepartamento,
} from './nacional.engine';

type DepartamentoAMSS = 'San Salvador';

const AMSS_CONFIG = {
  nombre: 'San Salvador' as DepartamentoAMSS,
  horasEfectivas: 8,
  tiempoEfectivoMin: 8 * 60, // 480
  viaticosUnit: 3,
  tMicrobusUnit: 60,
  hotelUnit: 0,
  precioBoleta: 2.5,
  tarifaSupervisorDia: 18, // para que 8 sup * 4 días = 576
};

function ceil(n: number) {
  return Math.ceil(n);
}
function floor(n: number) {
  return Math.floor(n);
}
function round(n: number) {
  return Math.round(n);
}

/** Paso 1: distribuir entrevistas AMSS (100% urbano, 1 fila) */
export function distribuirEntrevistasAMSS(
  totalEntrevistasBase: number,
  tipoEntrevista: string,
): DistribucionNacionalResult {
  if (!Number.isFinite(totalEntrevistasBase) || totalEntrevistasBase <= 0) {
    throw new Error('totalEntrevistasBase debe ser un número positivo');
  }

  const factorAjusteMuestra = 1.05; // igual que Nacional
  const totalEntrevistasAjustado = round(totalEntrevistasBase * factorAjusteMuestra);
  const esOnline = tipoEntrevista.trim().toLowerCase() === 'online';

  // 100% urbano (si fuera online, aplica la misma regla del nacional: 15%)
  let urbano = totalEntrevistasAjustado;
  if (esOnline) urbano *= 0.15;

  const fila: DistribucionDepartamento = {
    departamento: AMSS_CONFIG.nombre,
    urbano: round(urbano),
    rural: 0,
    total: round(urbano),
    horasEfectivas: AMSS_CONFIG.horasEfectivas,
    tiempoEfectivoMin: AMSS_CONFIG.tiempoEfectivoMin,
  };

  return {
    totalEntrevistasBase,
    factorAjusteMuestra,
    totalEntrevistasAjustado,
    esOnline,
    filas: [fila],
  };
}

/** Paso 2: rendimiento (misma fórmula base que nacional, pero ENTERO) */
function aplicarRendimientoAMSS(
  distribucion: DistribucionNacionalResult,
  params: {
    duracionCuestionarioMin: number; // P120
    penetracion: number;             // p
    totalEncuestadores: number;      // Q126
    segmentSize: number;             // P124
    filterMinutes: number;           // P121
    searchMinutes: number;           // P123
    desplazamientoMin: number;       // P125
    groupSize: number;               // divisor para P126 (p.ej. 4)
  },
): DistribucionNacionalResult {
  const {
    duracionCuestionarioMin,
    penetracion,
    totalEncuestadores,
    segmentSize,
    filterMinutes,
    searchMinutes,
    desplazamientoMin,
    groupSize,
  } = params;

  // P126 = grupos (redondeo al más cercano como en nacional)
  const p126 = Math.max(1, round(totalEncuestadores / groupSize));

  // L128 = ((P123+P121)/p) + (P120-P121)
  const l128 = ((searchMinutes + filterMinutes) / penetracion) + (duracionCuestionarioMin - filterMinutes);

  // L129 = (segmentSize * L128) / P126 + P125
  const l129 = (segmentSize * l128) / p126 + desplazamientoMin;

  const filas = distribucion.filas.map((fila) => {
    const v171 = fila.tiempoEfectivoMin ?? 0;     // 480
    const w171 = ceil(v171 / l129);               // segmentos por día (usamos CEIL como en tu Excel)
    const rendimientoFloat = (w171 * segmentSize) / p126;
    const rendimientoEntero = floor(rendimientoFloat); // 👈 entero (12.5 → 12)
    return { ...fila, rendimiento: rendimientoEntero };
  });

  return { ...distribucion, filas };
}

/** Paso 3: fijar encuestadores/supervisores tal cual vienen del input */
function fijarPersonalAMSS(
  distribucion: DistribucionNacionalResult,
  encuestadores: number,
  supervisores: number,
): DistribucionNacionalResult {
  const filas = distribucion.filas.map((f) => ({
    ...f,
    encuestadores,
    supervisores,
  }));
  return { ...distribucion, filas };
}

/** Paso 4: calcular días de campo con la fórmula de Excel */
function calcularDiasCampoAMSS(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  let totalDias = 0;
  const filas = distribucion.filas.map((f) => {
    const Q = Number(f.total ?? 0);                 // Total entrevistas
    const T = Number(f.rendimiento ?? 0);          // Rendimiento (entero)
    const U = Number(f.encuestadores ?? 0);        // Encuestadores
    const dias =
      Q > 0 && T > 0 && U > 0
        ? ceil((Q / (T * U)) * 1.05)                // 👈 CEIL( (Q/(T*U)) * 1.05 )
        : 0;
    totalDias += dias;
    return { ...f, diasCampoEncuest: dias };
  });

  return { ...distribucion, filas, totalDiasCampoEncuestGlobal: totalDias };
}

/** Paso 5: unitarios AMSS */
function aplicarUnitariosAMSS(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  const filas = distribucion.filas.map((f) => ({
    ...f,
    viaticosUnit: AMSS_CONFIG.viaticosUnit,
    tMicrobusUnit: AMSS_CONFIG.tMicrobusUnit,
    hotelUnit: AMSS_CONFIG.hotelUnit,
  }));
  return { ...distribucion, filas };
}

/** Paso 6: totales de viáticos / microbús / hotel (según reglas AMSS) */
function calcularTotalesCostosAMSS(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  let totalViaticosGlobal = 0;
  let totalTMicrobusGlobal = 0;
  let totalHotelGlobal = 0;

  const filas = distribucion.filas.map((f) => {
    const dias = Number(f.diasCampoEncuest ?? 0);
    const enc = Number(f.encuestadores ?? 0);
    const sup = Number(f.supervisores ?? 0);
    const viatico = Number(f.viaticosUnit ?? 0);
    const micro = Number(f.tMicrobusUnit ?? 0);
    const hotel = Number(f.hotelUnit ?? 0);

    // AMSS (según tu hoja esperada):
    // - Viáticos: (encuestadores + supervisores) * días * viáticosUnit
    // - T. Microbús: días * tMicrobusUnit
    // - Hotel: días * hotelUnit
    const totalViaticos = (enc + sup) * dias * viatico;
    const totalTMicrobus = dias * micro;
    const totalHotel = dias * hotel;

    totalViaticosGlobal += totalViaticos;
    totalTMicrobusGlobal += totalTMicrobus;
    totalHotelGlobal += totalHotel;

    return {
      ...f,
      totalViaticos,
      totalTMicrobus,
      totalHotel,
    };
  });

  return {
    ...distribucion,
    filas,
    totalViaticosGlobal,
    totalTMicrobusGlobal,
    totalHotelGlobal,
  };
}

/** Paso 7: precio boleta y pagos (encuestadores/supervisores) */
function aplicarPagosAMSS(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  let totalPagoEncuestadoresGlobal = 0;
  let totalPagoSupervisoresGlobal = 0;

  const filas = distribucion.filas.map((f) => {
    const totalEntrevistas = Number(f.total ?? 0);
    const precioBoleta = AMSS_CONFIG.precioBoleta;
    const pagoPorBoletaEncuestador = precioBoleta; // pago directo por boleta
    const pagoEncuestadores = precioBoleta * totalEntrevistas;

    const dias = Number(f.diasCampoEncuest ?? 0);
    const sup = Number(f.supervisores ?? 0);
    const pagoSupervisores = AMSS_CONFIG.tarifaSupervisorDia * sup * dias;

    totalPagoEncuestadoresGlobal += pagoEncuestadores;
    totalPagoSupervisoresGlobal += pagoSupervisores;

    return {
      ...f,
      precioBoleta,
      pagoPorBoletaEncuestador,
      pagoEncuestadores,
      pagoSupervisores,
    };
  });

  return {
    ...distribucion,
    filas,
    totalPagoEncuestadoresGlobal,
    totalPagoSupervisoresGlobal,
  };
}

/** Build principal AMSS */
export function buildDistribucionAMSS(params: {
  totalEntrevistas: number;
  duracionCuestionarioMin: number;
  tipoEntrevista: string;
  penetracionCategoria: number; // 0–1
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
}): DistribucionNacionalResult {
  // 1) Distribución base
  let dist = distribuirEntrevistasAMSS(params.totalEntrevistas, params.tipoEntrevista);

  // 2) Rendimiento (entero)
  dist = aplicarRendimientoAMSS(dist, {
    duracionCuestionarioMin: params.duracionCuestionarioMin,
    penetracion: params.penetracionCategoria,
    totalEncuestadores: params.encuestadoresTotales,
    segmentSize: 20,
    filterMinutes: 2,
    searchMinutes: 8,
    desplazamientoMin: 60,
    groupSize: 4,
  });

  // 3) Personal tal cual input
  dist = fijarPersonalAMSS(dist, params.encuestadoresTotales, params.supervisores);

  // 4) Días de campo (CEIL Excel)
  dist = calcularDiasCampoAMSS(dist);

  // 5) Unitarios AMSS
  dist = aplicarUnitariosAMSS(dist);

  // 6) Totales de viáticos/transporte/hotel (reglas AMSS)
  dist = calcularTotalesCostosAMSS(dist);

  // 7) Pagos (precio boleta y sueldos supervisores)
  dist = aplicarPagosAMSS(dist);

  return dist;
}
