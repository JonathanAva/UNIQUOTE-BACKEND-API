import { ConstantesService } from '@/modules/constantes/constantes.service';
import type { BuildCasaPorCasaInput, BuildCasaPorCasaResult } from './types';


// ✅ Usa alias por si en nacional.builder el export real es `buildCotizacionCasaPorCasa`
import {
  buildCotizacionCasaPorCasa as buildCasaPorCasaNacional,
} from './nacional.builder';

// Si tu AMSS builder exporta exactamente `buildCasaPorCasaAMSS`, esto queda tal cual.
// (Si exporta con otro nombre, haz un alias similar al de nacional).
import { buildCasaPorCasaAMSS } from './amss.builder';

export async function buildCotizacionCasaPorCasa(
  input: BuildCasaPorCasaInput,
  constantes: ConstantesService,
): Promise<BuildCasaPorCasaResult> {
  const cobertura = (input.cobertura ?? '').trim().toLowerCase();

  if (cobertura === 'amss') {
    // 👇 Variante AMSS
    return buildCasaPorCasaAMSS(input, constantes);
  }

  // 👇 Variante Nacional (fallback por defecto)
  return buildCasaPorCasaNacional(input, constantes);
}
