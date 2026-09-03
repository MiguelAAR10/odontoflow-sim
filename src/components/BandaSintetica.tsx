/**
 * Banda de frontera de datos sintéticos.
 *
 * Todo lo que muestra este simulador es inventado: pacientes, doctores, citas,
 * laboratorios, montos y el comportamiento de los pacientes. Nada de eso es
 * evidencia de ninguna clínica real, y por eso la interfaz tiene que decirlo
 * sola, siempre, sin que nadie tenga que recordarlo.
 *
 * Historia de este archivo, para que no se repita:
 * el README del repo afirmaba que «toda la interfaz lleva la etiqueta visible
 * “Datos ficticios de demostración”». El commit `b57f7bc` quitó justamente esas
 * etiquetas (14 líneas en `Bienvenida`, `Estacion` —escritorio y móvil— y
 * `VistaActividad`), así que a partir de ahí la afirmación del README dejó de
 * ser cierta: tras pulsar «Iniciar demostración» no quedaba ningún aviso
 * permanente a la vista. Una captura de pantalla del simulador era
 * indistinguible de una clínica de verdad.
 *
 * Esta banda restituye ese aviso con la cobertura que el README ya prometía.
 *
 * Cuatro decisiones deliberadas:
 *
 * 1. **Vive en el shell, no en las páginas.** `Estacion` envuelve todas las
 *    vistas, así que la banda está presente por construcción y no por acordarse
 *    de añadirla en cada vista nueva. `tests/banda-sintetica.test.tsx` lo vigila.
 * 2. **No se puede cerrar.** No recibe props, no tiene estado y no expone
 *    ningún botón. La forma más segura de que algo no se apague es no darle
 *    interruptor.
 * 3. **No parece un error.** Usa los mismos tokens `wait` que el autor eligió
 *    para esta etiqueta: es una advertencia neutra y permanente sobre la
 *    naturaleza del dato, no una falla que haya que arreglar.
 * 4. **Un solo texto, igual en escritorio y en móvil.** Sin variantes
 *    responsive: una etiqueta que cambia de significado según el ancho es una
 *    etiqueta en la que no se puede confiar.
 */

/** El texto es parte del contrato: los tests lo verifican palabra por palabra. */
export const TEXTO_BANDA_SINTETICA =
  "CLÍNICA SINTÉTICA · DATOS SIMULADOS · NO SON DATOS REALES";

export function BandaSintetica() {
  return (
    <div
      data-testid="banda-sintetica"
      role="note"
      aria-label="Advertencia permanente: esta es una clínica sintética con datos simulados; no son datos reales de ninguna clínica."
      className="flex w-full shrink-0 items-center justify-center gap-2 border-b border-wait-line bg-wait-soft px-3 py-1 text-center"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-wait"
      />
      <span className="rotulo text-[10.5px] font-semibold leading-tight tracking-[0.04em] text-wait-text">
        {TEXTO_BANDA_SINTETICA}
      </span>
    </div>
  );
}
