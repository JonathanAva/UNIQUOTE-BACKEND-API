// src/modules/cotizaciones/engine/tarifario-nacional.ts
//
// Motor del tarifario para cobertura "Nacional" (Casa por casa).
// Modela la tabla NACIONAL del Excel:
//
//  - Porcentaje urbano / rural por departamento
//  - Distribución de entrevistas (urbano, rural, total)
//  - Horas efectivas y tiempo efectivo
//  - Rendimiento (entrevistas por encuestador por día)
//  - Encuestadores y supervisores
//  - Días campo Encuest
//  - Viáticos, Transporte Microbus y Hotel (precios unitarios fijos)
//  - Precio de boleta
//  - Totales de viáticos, transporte, hotel
//  - Pago encuestadores y pago supervisores
//
// Esta capa es "pura TypeScript": no depende de Nest, Prisma ni HTTP.
// Recibe parámetros, calcula y devuelve estructuras de datos.

export type DepartamentoNacional =
  | 'Ahuachapán'
  | 'Santa Ana'
  | 'Sonsonate'
  | 'Chalatenango'
  | 'La Libertad'
  | 'San Salvador'
  | 'Cuscatlán'
  | 'La Paz'
  | 'Cabañas'
  | 'San Vicente'
  | 'Usulután'
  | 'San Miguel'
  | 'Morazán'
  | 'La Unión';

interface DepartamentoConfig {
  nombre: DepartamentoNacional;

  // Porcentajes de la tabla NACIONAL (urbano/rural).
  // Se calibran en base a la tabla de 1050 entrevistas para
  // reproducir los enteros de la hoja Excel original.
  pctUrbano: number;
  pctRural: number;

  // Horas efectivas de trabajo por día (columna "Horas efectivas")
  horasEfectivas: number;

  // Tiempo efectivo en minutos (columna "Tiempo efectivo")
  tiempoEfectivoMin: number;

  // Precios unitarios fijos por departamento:
  // columnas: "Viáticos", "T. Microbus", "Hotel"
  viaticosUnit: number;
  tMicrobusUnit: number;
  hotelUnit: number;
}

/**
 * Config estático de la tabla NACIONAL (solo lectura).
 *
 * Los valores 39, 20, 68, 33, ... son la distribución de entrevistas
 * del caso base de 1050 entrevistas (714 urbano, 336 rural).
 *
 * Dividimos entre 1050 para obtener porcentajes que luego se escalan
 * a cualquier H4 que ingrese el cliente.
 */
const DEPARTAMENTOS_NACIONAL: DepartamentoConfig[] = [
  {
    nombre: 'Ahuachapán',
    pctUrbano: 39 / 1050,
    pctRural: 20 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 125,
    hotelUnit: 0,
  },
  {
    nombre: 'Santa Ana',
    pctUrbano: 68 / 1050,
    pctRural: 33 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'Sonsonate',
    pctUrbano: 55 / 1050,
    pctRural: 23 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'Chalatenango',
    pctUrbano: 9 / 1050,
    pctRural: 30 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 135,
    hotelUnit: 0,
  },
  {
    nombre: 'La Libertad',
    pctUrbano: 104 / 1050,
    pctRural: 27 / 1050,
    horasEfectivas: 8,
    tiempoEfectivoMin: 480,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'San Salvador',
    pctUrbano: 245 / 1050,
    pctRural: 10 / 1050,
    horasEfectivas: 8,
    tiempoEfectivoMin: 480,
    viaticosUnit: 3,
    tMicrobusUnit: 60,
    hotelUnit: 0,
  },
  {
    nombre: 'Cuscatlán',
    pctUrbano: 30 / 1050,
    pctRural: 10 / 1050,
    horasEfectivas: 8,
    tiempoEfectivoMin: 480,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'La Paz',
    pctUrbano: 35 / 1050,
    pctRural: 23 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'Cabañas',
    pctUrbano: 9 / 1050,
    pctRural: 16 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 125,
    hotelUnit: 0,
  },
  {
    nombre: 'San Vicente',
    pctUrbano: 18 / 1050,
    pctRural: 13 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 100,
    hotelUnit: 0,
  },
  {
    nombre: 'Usulután',
    pctUrbano: 32 / 1050,
    pctRural: 34 / 1050,
    horasEfectivas: 7,
    tiempoEfectivoMin: 420,
    viaticosUnit: 6,
    tMicrobusUnit: 135,
    hotelUnit: 0,
  },
  {
    nombre: 'San Miguel',
    pctUrbano: 53 / 1050,
    pctRural: 34 / 1050,
    horasEfectivas: 6,
    tiempoEfectivoMin: 360,
    viaticosUnit: 10,
    tMicrobusUnit: 180,
    hotelUnit: 12,
  },
  {
    nombre: 'Morazán',
    pctUrbano: 7 / 1050,
    pctRural: 26 / 1050,
    horasEfectivas: 5,
    tiempoEfectivoMin: 300,
    viaticosUnit: 10,
    tMicrobusUnit: 180,
    hotelUnit: 12,
  },
  {
    nombre: 'La Unión',
    pctUrbano: 10 / 1050,
    pctRural: 37 / 1050,
    horasEfectivas: 5,
    tiempoEfectivoMin: 300,
    viaticosUnit: 10,
    tMicrobusUnit: 180,
    hotelUnit: 12,
  },
];

// ---------------------------------------------------------------------------
// Tipos de resultados
// ---------------------------------------------------------------------------

export interface DistribucionDepartamento {
  departamento: DepartamentoNacional;

  // Entrevistas asignadas
  urbano: number;
  rural: number;
  total: number;

  // Horas / minutos efectivos
  horasEfectivas: number;
  tiempoEfectivoMin: number;

  /**
   * Rendimiento (entrevistas por encuestador por día).
   * Se llena en aplicarRendimientoNacional.
   */
  rendimiento?: number;

  /**
   * Número de encuestadores asignado al departamento.
   * En la tabla NACIONAL es un valor fijo (P126) repetido por fila.
   */
  encuestadores?: number;

  /**
   * Número de supervisores asignado al departamento.
   * En la tabla NACIONAL es un valor fijo (totalSupervisores / 4)
   * repetido por fila.
   */
  supervisores?: number;

  /**
   * Días de campo por encuestador en el departamento,
   * según la fórmula:
   *
   *   Días campo = (Q14 / (T14 * U14)) * 1.05
   */
  diasCampoEncuest?: number;

  /**
   * Precios unitarios fijos por departamento (solo lectura).
   * Estos vienen de la tabla de botones.
   */
  viaticosUnit?: number;
  tMicrobusUnit?: number;
  hotelUnit?: number;

  /**
   * Precio de boleta para este departamento.
   * En la práctica es el mismo valor para todos los deptos,
   * calculado según penetración y duración del cuestionario.
   */
  precioBoleta?: number;

  /**
   * Totales por departamento:
   *  - Total viáticos
   *  - Total T. Microbus
   *  - Total hotel
   */
  totalViaticos?: number;
  totalTMicrobus?: number;
  totalHotel?: number;

  /**
   * Pagos de personal:
   *  - Pago encuestadores = PrecioBoleta * TotalEntrevistasDepto
   *  - Pago supervisores  = 20 * DíasCampoEncuest
   */
  pagoEncuestadores?: number;
  pagoSupervisores?: number;
}

/**
 * Resultado global de la distribución NACIONAL.
 */
export interface DistribucionNacionalResult {
  // H4: total de entrevistas que pide el cliente
  totalEntrevistasBase: number;

  // Factor de ajuste de muestra (multiplicador sobre H4).
  // En tu Excel es 1.05 (5 % extra).
  factorAjusteMuestra: number;

  // Total de entrevistas después del ajuste H4 * factor.
  totalEntrevistasAjustado: number;

  // True si el tipo de entrevista es "Online".
  esOnline: boolean;

  // Filas por departamento
  filas: DistribucionDepartamento[];

  /**
   * Totales globales de encuestadores y supervisores
   * (fila TOTAL de la tabla).
   */
  totalEncuestadoresGlobal?: number;
  totalSupervisoresGlobal?: number;

  /**
   * Suma de Días campo Encuest a nivel nacional (fila TOTAL).
   * En tu Excel es 15.00 en el ejemplo que enviaste.
   */
  totalDiasCampoEncuestGlobal?: number;

  /**
   * Precio de boleta global usado en la tabla
   * (mismo valor que se asigna a cada departamento).
   */
  precioBoletaGlobal?: number;

  /**
   * Totales globales de:
   *  - Viáticos
   *  - T. Microbus
   *  - Hotel
   */
  totalViaticosGlobal?: number;
  totalTMicrobusGlobal?: number;
  totalHotelGlobal?: number;

  /**
   * Totales globales de pagos de personal:
   *  - Pago encuestadores
   *  - Pago supervisores
   */
  totalPagoEncuestadoresGlobal?: number;
  totalPagoSupervisoresGlobal?: number;
}

// ---------------------------------------------------------------------------
// Distribución de entrevistas (NACIONAL)
// ---------------------------------------------------------------------------

/**
 * Aplica las fórmulas de:
 *
 *   L11 = H4 * 1.05
 *
 *   Urbano = IF(C11="Online",(L11 * pctUrbano) * 0.15, L11 * pctUrbano)
 *   Rural  = IF(C11="Online",(L11 * pctRural)  * 0.15, L11 * pctRural)
 *   Total  = Urbano + Rural
 *
 * Devuelve una estructura con una fila por departamento y
 * el total ajustado.
 */
export function distribuirEntrevistasNacional(
  totalEntrevistasBase: number, // H4
  tipoEntrevista: string, // C11
): DistribucionNacionalResult {
  if (!Number.isFinite(totalEntrevistasBase) || totalEntrevistasBase <= 0) {
    throw new Error('totalEntrevistasBase debe ser un número positivo');
  }

  const factorAjusteMuestra = 1.05; // H4 * 1.05 → L11
  const totalEntrevistasAjustado = Math.round(
    totalEntrevistasBase * factorAjusteMuestra,
  );

  const esOnline = tipoEntrevista.trim().toLowerCase() === 'online';

  const filas: DistribucionDepartamento[] = [];

  for (const cfg of DEPARTAMENTOS_NACIONAL) {
    let urbano = totalEntrevistasAjustado * cfg.pctUrbano;
    let rural = totalEntrevistasAjustado * cfg.pctRural;

    // Si es online, se multiplica por 0.15
    if (esOnline) {
      urbano *= 0.15;
      rural *= 0.15;
    }

    const urbanoInt = Math.round(urbano);
    const ruralInt = Math.round(rural);
    const totalInt = urbanoInt + ruralInt;

    filas.push({
      departamento: cfg.nombre,
      urbano: urbanoInt,
      rural: ruralInt,
      total: totalInt,
      horasEfectivas: cfg.horasEfectivas,
      tiempoEfectivoMin: cfg.tiempoEfectivoMin,
    });
  }

  return {
    totalEntrevistasBase,
    factorAjusteMuestra,
    totalEntrevistasAjustado,
    esOnline,
    filas,
  };
}

// ---------------------------------------------------------------------------
// Rendimiento (Y171) por departamento
// ---------------------------------------------------------------------------

/**
 * Parámetros globales que usa la fórmula de rendimiento
 * que compartiste del Excel:
 *
 *   Y171 = (W171 * P124) / P126
 *
 * siendo:
 *   W171 = ROUND(V171 / L129, 0)
 *   V171 = tiempo efectivo en minutos por día
 *
 *   L129 = ((P124 * L128) / P126) + P125
 *   L128 = ((P123 + P121) / P122) + (P120 - P121)
 *
 *   P120 = duración cuestionario (min)
 *   P121 = duración filtro (min)
 *   P122 = penetración [0–1]
 *   P123 = tiempo de búsqueda (min)
 *   P124 = tamaño de segmento (entrevistas)
 *   P125 = minutos de desplazamiento entre segmentos
 *   P126 = ROUND(Q126 / groupSize, 0)
 *   Q126 = encuestadores totales
 */
export interface ParamsRendimiento {
  // P120
  duracionCuestionarioMin: number;

  // P122
  penetracion: number; // 0.80 = 80 %

  // Q126
  totalEncuestadores: number;

  // Casa por casa / Nacional:
  segmentSize: number; // P124
  filterMinutes: number; // P121
  searchMinutes: number; // P123
  desplazamientoMin: number; // P125
  groupSize: number; // para P126 = ROUND(Q126 / groupSize, 0)
}

/**
 * Calcula el rendimiento (entrevistas por encuestador por día)
 * por departamento, respetando la fórmula exacta del Excel.
 */
export function aplicarRendimientoNacional(
  distribucion: DistribucionNacionalResult,
  params: ParamsRendimiento,
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

  if (!Number.isFinite(duracionCuestionarioMin) || duracionCuestionarioMin <= 0) {
    throw new Error('duracionCuestionarioMin debe ser > 0');
  }
  if (!Number.isFinite(penetracion) || penetracion <= 0 || penetracion > 1) {
    throw new Error('penetracion debe estar en (0,1]');
  }
  if (!Number.isFinite(totalEncuestadores) || totalEncuestadores <= 0) {
    throw new Error('totalEncuestadores debe ser > 0');
  }

  // P126 = ROUND(Q126 / groupSize, 0)
  const p126 = Math.round(totalEncuestadores / groupSize);

  // L128 = ((P123 + P121) / P122) + (P120 - P121)
  const l128 =
    (searchMinutes + filterMinutes) / penetracion +
    (duracionCuestionarioMin - filterMinutes);

  // L129 = ((P124 * L128) / P126) + P125
  const l129 = (segmentSize * l128) / p126 + desplazamientoMin;

  const filas = distribucion.filas.map((fila) => {
    const v171 = fila.tiempoEfectivoMin; // V171: minutos efectivos por día

    // W171 = ROUND(V171 / L129, 0) → segmentos por día
    const w171 = Math.round(v171 / l129);

    // Y171 = (W171 * P124) / P126 → entrevistas por encuestador por día
    const rendimiento = (w171 * segmentSize) / p126;

    return {
      ...fila,
      rendimiento,
    };
  });

  return {
    ...distribucion,
    filas,
  };
}

// ---------------------------------------------------------------------------
// Encuestadores y supervisores (P126, total supervisores)
// ---------------------------------------------------------------------------

/**
 * Calcula las columnas "Encuestadores" y "Supervisores"
 * para la tabla NACIONAL, replicando la lógica:
 *
 *   P126 = ROUND(Q126 / groupSize, 0)      → columna Encuestadores
 *   totalSupervisores = P126
 *   Supervisores (por fila) = totalSupervisores / supervisorSplit
 *
 * En tu ejemplo:
 *   Q126 = 30 encuestadores totales
 *   groupSize = 4         → P126 = ROUND(30/4) = 8
 *   supervisorSplit = 4   → 8 / 4 = 2 supervisores por fila
 *   Fila TOTAL → encuestadores = 30, supervisores = 8
 *
 * (Los totales de la fila TOTAL no se calculan sumando filas,
 *  sino aparte con Q126 y P126).
 */
export function aplicarEncuestadoresYSupervisoresNacional(
  distribucion: DistribucionNacionalResult,
  totalEncuestadores: number,
  options?: {
    groupSize?: number; // para P126
    supervisorSplit?: number; // para repartir totalSupervisores en la columna por fila
  },
): DistribucionNacionalResult {
  if (!Number.isFinite(totalEncuestadores) || totalEncuestadores <= 0) {
    throw new Error('totalEncuestadores debe ser un número positivo');
  }

  const groupSize = options?.groupSize ?? 4;
  const supervisorSplit = options?.supervisorSplit ?? 4;

  // P126 = ROUND(Q126 / groupSize, 0)
  const p126 = Math.round(totalEncuestadores / groupSize);

  // Total de supervisores globales (fila TOTAL)
  const totalSupervisoresGlobal = p126;

  // Valores por departamento (mismos en todas las filas)
  const encuestadoresPorDepartamento = p126;
  const supervisoresPorDepartamento = totalSupervisoresGlobal / supervisorSplit;

  const filas = distribucion.filas.map((fila) => ({
    ...fila,
    encuestadores: encuestadoresPorDepartamento,
    supervisores: supervisoresPorDepartamento,
  }));

  return {
    ...distribucion,
    filas,
    totalEncuestadoresGlobal: totalEncuestadores,
    totalSupervisoresGlobal,
  };
}

// ---------------------------------------------------------------------------
// Días campo Encuest + precios unitarios de viáticos / transporte / hotel
// ---------------------------------------------------------------------------

/**
 * Aplica la fórmula de "Días campo Encuest" por departamento:
 *
 *   Días campo = IFERROR((Q14 / (T14 * U14)) * 1.05, " ")
 *
 * donde:
 *   Q14 = total entrevistas del departamento (urbano + rural)
 *   T14 = rendimiento (entrevistas/encuestador/día)
 *   U14 = encuestadores (columna "Encuestadores")
 *
 * Además, añade a cada fila los precios unitarios fijos
 * de Viáticos, T. Microbus y Hotel tomados del config.
 */
export function aplicarDiasCampoYCostosNacional(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  let totalDiasCampo = 0;

  const filas = distribucion.filas.map((filaBase) => {
    const cfg = DEPARTAMENTOS_NACIONAL.find(
      (c) => c.nombre === filaBase.departamento,
    );
    if (!cfg) {
      throw new Error(
        `No se encontró configuración de NACIONAL para el departamento "${filaBase.departamento}"`,
      );
    }

    const totalEntrevistasDepto = filaBase.total;
    const rendimiento = filaBase.rendimiento;
    const encuestadores = filaBase.encuestadores;

    let diasCampoEncuest: number | undefined = undefined;

    // IFERROR((Q14 / (T14 * U14)) * 1.05, " ")
    if (
      Number.isFinite(totalEntrevistasDepto) &&
      Number.isFinite(rendimiento ?? NaN) &&
      Number.isFinite(encuestadores ?? NaN) &&
      rendimiento! > 0 &&
      encuestadores! > 0
    ) {
      diasCampoEncuest =
        (totalEntrevistasDepto / (rendimiento! * encuestadores!)) * 1.05;

      totalDiasCampo += diasCampoEncuest;
    }

    return {
      ...filaBase,
      diasCampoEncuest,
      viaticosUnit: cfg.viaticosUnit,
      tMicrobusUnit: cfg.tMicrobusUnit,
      hotelUnit: cfg.hotelUnit,
    };
  });

  return {
    ...distribucion,
    filas,
    totalDiasCampoEncuestGlobal: Math.ceil(totalDiasCampo),
  };

}

// ---------------------------------------------------------------------------
// Precio de boleta (tabla por penetración y duración)
// ---------------------------------------------------------------------------

/**
 * Parámetros para calcular el precio de boleta.
 *
 * Depende de:
 *  - P120 = duración del cuestionario en minutos
 *  - P122 = penetración (0–1)
 *
 * Se usa la tabla:
 *
 *  Penetración > 50%            Penetración < 50%
 *  10–15 min → 1.50            10–15 min → 2.00
 *  16–25 min → 2.00            16–25 min → 2.50
 *  26–45 min → 3.00            26–45 min → 3.50
 *  45+ min   → 4.00            45+ min   → 4.50
 */
export interface ParamsPrecioBoleta {
  duracionCuestionarioMin: number; // P120
  penetracion: number; // P122 como fracción (0.80 = 80 %)
}

/**
 * Devuelve el precio unitario de boleta según duración y penetración.
 */
export function calcularPrecioBoleta(params: ParamsPrecioBoleta): number {
  const { duracionCuestionarioMin, penetracion } = params;

  if (!Number.isFinite(duracionCuestionarioMin) || duracionCuestionarioMin <= 0) {
    throw new Error(
      'duracionCuestionarioMin debe ser > 0 para calcular precio de boleta',
    );
  }
  if (!Number.isFinite(penetracion) || penetracion <= 0 || penetracion > 1) {
    throw new Error(
      'penetracion debe estar en (0,1] para calcular precio de boleta',
    );
  }

  const esAltaPenetracion = penetracion > 0.5; // >50 %

  let precio: number;

  if (duracionCuestionarioMin >= 10 && duracionCuestionarioMin <= 15) {
    precio = esAltaPenetracion ? 1.5 : 2.0;
  } else if (duracionCuestionarioMin >= 16 && duracionCuestionarioMin <= 25) {
    precio = esAltaPenetracion ? 2.0 : 2.5;
  } else if (duracionCuestionarioMin >= 26 && duracionCuestionarioMin <= 45) {
    precio = esAltaPenetracion ? 3.0 : 3.5;
  } else if (duracionCuestionarioMin > 45) {
    precio = esAltaPenetracion ? 4.0 : 4.5;
  } else {
    // Si algún día ponen cuestionarios de <10 min,
    // se puede definir otra regla. Por ahora fallamos explícito.
    throw new Error(
      'La duración del cuestionario debe ser al menos 10 minutos para la tabla de precio de boleta',
    );
  }

  return precio;
}

/**
 * Asigna el precio de boleta calculado a cada departamento
 * y guarda también el valor global.
 */
export function aplicarPrecioBoletaNacional(
  distribucion: DistribucionNacionalResult,
  params: ParamsPrecioBoleta,
): DistribucionNacionalResult {
  const precioBoleta = calcularPrecioBoleta(params);

  const filas = distribucion.filas.map((fila) => ({
    ...fila,
    precioBoleta,
  }));

  return {
    ...distribucion,
    filas,
    precioBoletaGlobal: precioBoleta, // ✅ corregido
  };
}

// ---------------------------------------------------------------------------
// Totales: Viáticos, T. Microbus, Hotel
// ---------------------------------------------------------------------------

/**
 * Calcula los totales por departamento y globales para:
 *
 *  - Total viáticos      = (U14 + V14) * W14 * Y14
 *  - Total T. Microbus   = AA14 * (AB6 * CEILING((AB4 + AB5) / AB3, 1)) * W14
 *  - Total hotel         = (U14 + V14) * W14 * AB25
 *
 * En este motor, simplificamos algunos parámetros como constantes
 * (AB3, AB4, AB5, AB6, AB25) o se podrían parametrizar si cambia
 * por proyecto.
 */
/**
 * Calcula los totales por departamento y globales para:
 *
 *  - Total viáticos      = (encuestadores + supervisores) * días * viáticosUnit
 *  - Total T. Microbus   = viajesPorDia * tMicrobusUnit * días
 *  - Total hotel         = (encuestadores + supervisores) * días * hotelUnit
 */
export function calcularTotalesViaticosTransporteHotelNacional(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  let totalViaticosGlobal = 0;
  let totalTMicrobusGlobal = 0;
  let totalHotelGlobal = 0;

  const GRUPOS_POR_DEPTO = 2; // AB6
  const ENCUENTADORES_POR_GRUPO = 8; // AB4
  const SUPERVISORES_POR_GRUPO = 2; // AB5
  const CAPACIDAD_MICROBUS = 12; // AB3
  const FACTOR_HOTEL = 1; // AB25

  const filas = distribucion.filas.map((fila) => {
    const encuestadores = fila.encuestadores ?? 0;
    const supervisores = fila.supervisores ?? 0;
    const totalPersonas = encuestadores + supervisores;

    const diasCampo = fila.diasCampoEncuest ?? 0;
    const viaticosUnit = fila.viaticosUnit ?? 0;
    const tMicrobusUnit = fila.tMicrobusUnit ?? 0;
    const hotelUnit = fila.hotelUnit ?? 0;

    // === Viáticos ===
    const totalViaticos = totalPersonas * diasCampo * viaticosUnit;

    // === Transporte (microbuses) usando fórmula corregida ===
    const personasPorGrupo = ENCUENTADORES_POR_GRUPO + SUPERVISORES_POR_GRUPO;
    const microbusesPorGrupo = Math.ceil(personasPorGrupo / CAPACIDAD_MICROBUS);
    const totalMicrobusesPorDia = GRUPOS_POR_DEPTO * microbusesPorGrupo;
    const totalTMicrobus = tMicrobusUnit * totalMicrobusesPorDia * diasCampo;

    // === Hotel ===
    const totalHotel = totalPersonas * diasCampo * FACTOR_HOTEL * hotelUnit;

    totalViaticosGlobal += totalViaticos;
    totalTMicrobusGlobal += totalTMicrobus;
    totalHotelGlobal += totalHotel;

    return {
      ...fila,
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



// ---------------------------------------------------------------------------
// Pagos de personal: encuestadores y supervisores
// ---------------------------------------------------------------------------

/**
 * Calcula los pagos de:
 *
 *  - Pago encuestadores = PrecioBoleta * TotalEntrevistasDepto
 *      (AF14 * Q14 en tu Excel)
 *
 *  - Pago supervisores  = 20 * DíasCampoEncuest
 *      (20 * W14 en tu Excel)
 *
 * y también los totales globales.
 */
export function calcularPagosPersonalNacional(
  distribucion: DistribucionNacionalResult,
): DistribucionNacionalResult {
  const TARIFA_SUPERVISOR_DIA = 20; // 20 US$ por día de campo (constante de tu Excel)

  let totalPagoEncuestadoresGlobal = 0;
  let totalPagoSupervisoresGlobal = 0;

  const filas = distribucion.filas.map((fila) => {
    const precioBoleta = fila.precioBoleta ?? 0;
    const totalEntrevistasDepto = fila.total ?? 0;
    const diasCampo = fila.diasCampoEncuest ?? 0;

    // AF14 * Q14
    const pagoEncuestadores = precioBoleta * totalEntrevistasDepto;

    // 20 * W14
    const pagoSupervisores = TARIFA_SUPERVISOR_DIA * diasCampo;

    totalPagoEncuestadoresGlobal += pagoEncuestadores;
    totalPagoSupervisoresGlobal += pagoSupervisores;

    return {
      ...fila,
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
