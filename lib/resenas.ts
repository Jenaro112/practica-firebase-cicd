// lib/resenas.ts — Práctica 4 (Firestore). Capa de acceso a datos de reseñas.
// Los componentes no importan firebase/firestore directamente: todo pasa por acá.
"use client";

import {
  average,
  collection,
  connectFirestoreEmulator,
  count,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { firebase, USA_EMULADORES } from "./firebase";

export interface Resena {
  uid: string; // = id del documento
  puntaje: number; // 1..5
  texto: string;
  autor: string;
  creadaEn: Timestamp | null; // null mientras el serverTimestamp está pendiente (escritura local)
  pendiente: boolean; // true mientras la escritura local no fue confirmada por el servidor
}

// ── Paso 1 · Inicialización ────────────────────────────────────────────────
let db: Firestore | null = null;
export function firestore(): Firestore {
  if (db) return db;
  // Reutiliza la app (y por lo tanto la sesión de Auth) inicializada en lib/firebase.ts.
  db = getFirestore(firebase().app);
  if (USA_EMULADORES) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  return db;
}

const resenasDe = (cursoId: string) => collection(firestore(), "cursos", cursoId, "resenas");

// ── Paso 3 · Escribir ──────────────────────────────────────────────────────
/** Crear o editar MI reseña. El id del documento es mi UID: una reseña por persona y curso. */
export async function guardarResena(cursoId: string, puntaje: number, texto: string, esNueva: boolean): Promise<void> {
  const usuario = firebase().auth.currentUser;
  if (!usuario) throw new Error("Tenés que ingresar para dejar una reseña.");
  const ref = doc(resenasDe(cursoId), usuario.uid);
  const datos = { puntaje, texto: texto.trim(), autor: (usuario.displayName || "Anónimo").slice(0, 80) };
  if (esNueva) await setDoc(ref, { ...datos, creadaEn: serverTimestamp() });
  else await setDoc(ref, datos, { merge: true }); // conserva creadaEn (las reglas exigen que no cambie)
}

export async function borrarResena(cursoId: string): Promise<void> {
  const usuario = firebase().auth.currentUser;
  if (!usuario) return;
  await deleteDoc(doc(resenasDe(cursoId), usuario.uid));
}

// ── Paso 4 · Tiempo real ───────────────────────────────────────────────────
/** Últimas 20 reseñas en tiempo real. Devuelve la función para cancelar la suscripción. */
export function escucharResenas(
  cursoId: string,
  alCambiar: (resenas: Resena[]) => void,
  alFallar: (e: Error) => void,
  soloCincoEstrellas = false,
): Unsubscribe {
  const filtros = soloCincoEstrellas ? [where("puntaje", "==", 5)] : [];
  const q = query(resenasDe(cursoId), ...filtros, orderBy("creadaEn", "desc"), limit(20));
  return onSnapshot(
    q,
    // includeMetadataChanges: recibimos también el aviso de "el servidor confirmó",
    // para poder sacar la marca de "pendiente" de la reseña propia.
    { includeMetadataChanges: true },
    (snap) =>
      alCambiar(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return {
            uid: d.id,
            puntaje: data.puntaje,
            texto: data.texto,
            autor: data.autor,
            creadaEn: data.creadaEn ?? null,
            pendiente: d.metadata.hasPendingWrites,
          };
        }),
      ),
    alFallar,
  );
}

/**
 * Mi reseña en este curso (o null), en tiempo real. Es una lectura directa por id (= mi UID):
 * así sabemos si existe aunque no esté entre las 20 últimas o el filtro "solo 5" la oculte.
 */
export function escucharMiResena(
  cursoId: string,
  uid: string,
  alCambiar: (resena: Resena | null) => void,
  alFallar: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(resenasDe(cursoId), uid),
    (d) => {
      if (!d.exists()) return alCambiar(null);
      const data = d.data({ serverTimestamps: "estimate" });
      alCambiar({
        uid: d.id,
        puntaje: data.puntaje,
        texto: data.texto,
        autor: data.autor,
        creadaEn: data.creadaEn ?? null,
        pendiente: d.metadata.hasPendingWrites,
      });
    },
    alFallar,
  );
}

// ── Paso 5 · Agregación ────────────────────────────────────────────────────
/** Promedio y cantidad calculados por el servidor (consulta de agregación, no es en tiempo real). */
export async function resumenDe(cursoId: string): Promise<{ cantidad: number; promedio: number | null }> {
  const snap = await getAggregateFromServer(resenasDe(cursoId), { cantidad: count(), promedio: average("puntaje") });
  return snap.data();
}
