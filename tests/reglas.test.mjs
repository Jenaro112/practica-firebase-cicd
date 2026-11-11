// tests/reglas.test.mjs — Práctica 4. Se ejecuta contra el emulador de Firestore:
//   npm run test:reglas   (= firebase emulators:exec --only firestore "node --test tests/")
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let env;
const CURSO = "seguridad-web";
const resena = (extra = {}) => ({ puntaje: 5, texto: "Muy bueno", autor: "Ana", creadaEn: serverTimestamp(), ...extra });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-resenas",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

/** Crea la reseña de Ana salteando las reglas (como haría un admin), para probar ediciones ajenas. */
async function sembrarResenaDeAna() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "cursos", CURSO, "resenas", "ana"), {
      puntaje: 5,
      texto: "Muy bueno",
      autor: "Ana",
      creadaEn: Timestamp.now(),
    });
  });
}

// ── Los 8 casos del enunciado ────────────────────────────────────────────────

test("cualquiera puede leer reseñas, incluso sin login", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anon, "cursos", CURSO, "resenas", "ana")));
});

test("Ana puede crear SU reseña", async () => {
  const db = env.authenticatedContext("ana").firestore();
  await assertSucceeds(setDoc(doc(db, "cursos", CURSO, "resenas", "ana"), resena()));
});

test("Ana NO puede crear una reseña a nombre de Bruno", async () => {
  const db = env.authenticatedContext("ana").firestore();
  await assertFails(setDoc(doc(db, "cursos", CURSO, "resenas", "bruno"), resena()));
});

test("sin login no se puede escribir", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "cursos", CURSO, "resenas", "ana"), resena()));
});

test("puntaje fuera de rango o con decimales se rechaza", async () => {
  const db = env.authenticatedContext("ana").firestore();
  const ref = doc(db, "cursos", CURSO, "resenas", "ana");
  await assertFails(setDoc(ref, resena({ puntaje: 6 })));
  await assertFails(setDoc(ref, resena({ puntaje: 4.5 })));
});

test("no se pueden agregar campos extra (p. ej. destacada: true)", async () => {
  const db = env.authenticatedContext("ana").firestore();
  await assertFails(setDoc(doc(db, "cursos", CURSO, "resenas", "ana"), resena({ destacada: true })));
});

test("la fecha de creación la pone el servidor y no se puede cambiar", async () => {
  const db = env.authenticatedContext("ana").firestore();
  const ref = doc(db, "cursos", CURSO, "resenas", "ana");
  await assertFails(setDoc(ref, resena({ creadaEn: Timestamp.fromDate(new Date(2020, 0, 1)) })));
  await assertSucceeds(setDoc(ref, resena()));
  await assertFails(updateDoc(ref, { creadaEn: Timestamp.now() }));
  await assertSucceeds(updateDoc(ref, { puntaje: 4 }));
});

test("el cliente no puede escribir el documento del curso", async () => {
  const db = env.authenticatedContext("ana").firestore();
  await assertFails(setDoc(doc(db, "cursos", CURSO), { resumen: { cantidad: 999, promedio: 5 } }));
});

// ── Tests adicionales propios ────────────────────────────────────────────────

test("Bruno NO puede editar la reseña de Ana", async () => {
  await sembrarResenaDeAna();
  const db = env.authenticatedContext("bruno").firestore();
  await assertFails(updateDoc(doc(db, "cursos", CURSO, "resenas", "ana"), { puntaje: 1, texto: "Malísimo" }));
});

test("Bruno NO puede borrar la reseña de Ana, pero Ana sí puede borrar la suya", async () => {
  await sembrarResenaDeAna();
  const bruno = env.authenticatedContext("bruno").firestore();
  await assertFails(deleteDoc(doc(bruno, "cursos", CURSO, "resenas", "ana")));
  const ana = env.authenticatedContext("ana").firestore();
  await assertSucceeds(deleteDoc(doc(ana, "cursos", CURSO, "resenas", "ana")));
});

test("sin login no se puede borrar", async () => {
  await sembrarResenaDeAna();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(deleteDoc(doc(anon, "cursos", CURSO, "resenas", "ana")));
});

test("tipos y tamaños: puntaje como texto, texto > 500, autor > 80 o vacío se rechazan", async () => {
  const db = env.authenticatedContext("ana").firestore();
  const ref = doc(db, "cursos", CURSO, "resenas", "ana");
  await assertFails(setDoc(ref, resena({ puntaje: "5" })));
  await assertFails(setDoc(ref, resena({ texto: "x".repeat(501) })));
  await assertFails(setDoc(ref, resena({ autor: "x".repeat(81) })));
  await assertFails(setDoc(ref, resena({ autor: "" })));
  await assertSucceeds(setDoc(ref, resena({ texto: "x".repeat(500), autor: "x".repeat(80) })));
});

test("faltar un campo obligatorio se rechaza", async () => {
  const db = env.authenticatedContext("ana").firestore();
  const { texto, ...sinTexto } = resena();
  await assertFails(setDoc(doc(db, "cursos", CURSO, "resenas", "ana"), sinTexto));
});

test("una edición no puede agregar campos extra", async () => {
  await sembrarResenaDeAna();
  const db = env.authenticatedContext("ana").firestore();
  await assertFails(updateDoc(doc(db, "cursos", CURSO, "resenas", "ana"), { verificada: true }));
});

test("cualquier otra colección está cerrada", async () => {
  const db = env.authenticatedContext("ana").firestore();
  await assertFails(getDocs(collection(db, "usuarios")));
  await assertFails(setDoc(doc(db, "usuarios", "ana"), { admin: true }));
});
