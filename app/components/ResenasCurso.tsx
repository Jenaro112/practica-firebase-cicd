"use client";
// app/components/ResenasCurso.tsx — Práctica 4. Formulario + lista en tiempo real + resumen.

import { useEffect, useState, type FormEvent } from "react";
import { borrarResena, escucharMiResena, escucharResenas, guardarResena, resumenDe, type Resena } from "@/lib/resenas";

export default function ResenasCurso({ cursoId, uid }: { cursoId: string; uid: string | null }) {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [mia, setMia] = useState<Resena | null>(null);
  const [resumen, setResumen] = useState<{ cantidad: number; promedio: number | null } | null>(null);
  const [soloCinco, setSoloCinco] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Suscripción en tiempo real: React llama a la función devuelta (unsubscribe) al desmontar
  // o al cambiar de curso / filtro. Sin eso quedarían listeners huérfanos consumiendo lecturas.
  useEffect(() => {
    return escucharResenas(cursoId, setResenas, (e) => setError(e.message), soloCinco);
  }, [cursoId, soloCinco]);

  // Mi propia reseña (por id = UID): decide si el formulario crea o edita.
  useEffect(() => {
    if (!uid) {
      setMia(null);
      return;
    }
    return escucharMiResena(cursoId, uid, setMia, (e) => setError(e.message));
  }, [cursoId, uid]);

  // La agregación no admite listeners: se vuelve a pedir cuando cambia la lista.
  // La firma incluye `pendiente`: así se recalcula también cuando el servidor CONFIRMA una
  // escritura propia (si se pidiera solo mientras está pendiente, el servidor todavía
  // devolvería el promedio viejo).
  const firma = resenas.map((r) => `${r.uid}:${r.puntaje}:${r.pendiente ? "p" : "ok"}`).join(",");
  useEffect(() => {
    resumenDe(cursoId)
      .then(setResumen)
      .catch((e: Error) => setError(e.message));
  }, [cursoId, firma]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    try {
      await guardarResena(cursoId, Number(f.get("puntaje")), String(f.get("texto")), !mia);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function onBorrar() {
    try {
      await borrarResena(cursoId);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="resenas">
      <h3>
        Reseñas{" "}
        {resumen && resumen.cantidad > 0 && (
          <span className="resenas__resumen">
            · ★ {resumen.promedio?.toFixed(1)} ({resumen.cantidad})
          </span>
        )}
      </h3>
      <label className="resenas__filtro">
        <input type="checkbox" checked={soloCinco} onChange={(e) => setSoloCinco(e.target.checked)} /> Solo 5 estrellas
      </label>

      {uid ? (
        // key: re-monta el formulario cuando aparece / cambia mi reseña, para que los
        // valores por defecto (no controlados) reflejen lo guardado.
        <form key={mia ? `edit-${mia.puntaje}-${mia.texto}` : "nueva"} className="resenas__form" onSubmit={onSubmit}>
          <select name="puntaje" defaultValue={mia?.puntaje ?? 5} aria-label="Puntaje">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
          <textarea name="texto" maxLength={500} defaultValue={mia?.texto ?? ""} placeholder="¿Qué te pareció el curso?" required />
          <div className="resenas__botones">
            <button type="submit" className="button button--small" disabled={enviando}>
              {mia ? "Actualizar mi reseña" : "Publicar"}
            </button>
            {mia && (
              <button type="button" className="button button--small button--ghost" onClick={onBorrar}>
                Borrar
              </button>
            )}
          </div>
        </form>
      ) : (
        <small className="hint">Ingresá para dejar tu reseña.</small>
      )}

      {error && (
        <p className="alerta alerta--error" role="alert">
          {error}
        </p>
      )}

      {resenas.length === 0 ? (
        <small className="hint">{soloCinco ? "Todavía no hay reseñas de 5 estrellas." : "Todavía no hay reseñas."}</small>
      ) : (
        <ul className="resenas__lista">
          {resenas.map((r) => (
            <li key={r.uid} className={r.pendiente ? "resena resena--pendiente" : "resena"}>
              <strong aria-label={`${r.puntaje} de 5`}>{"★".repeat(r.puntaje)}</strong> {r.texto} — <em>{r.autor}</em>
              {r.pendiente && <small className="hint"> · enviando…</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
