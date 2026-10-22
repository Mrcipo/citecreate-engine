# CiteCreate Engine

🌐 [English](README.md) · **Español**

[![CI](https://github.com/Mrcipo/citecreate-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Mrcipo/citecreate-engine/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Plataforma modular de inteligencia documental con IA: procesa PDFs, enriquece su metadata, extrae claims con evidencia usando LLMs, genera variantes de posts listas para redes sociales y exporta visuales (PNG/JPEG).

## Puntos destacados
- Pipeline end-to-end: carga -> parseo -> enriquecimiento -> extracción -> generación -> exportación.
- Capa LLM multi-proveedor y resiliente: Gemini como principal y Groq como respaldo.
- Validación estricta de contratos con Zod (salidas JSON seguras frente a LLMs).
- Trazabilidad persistente de trabajos (`JobRun`) con estado por etapa, duración y errores.
- Motor de exportación con plantillas HTML a imagen mediante Playwright.
- UI responsive para cargar documentos, seguir el procesamiento, editar posts y generar assets.

## Arquitectura (por capas)
- `app/`: páginas del App Router de Next.js y handlers de la API.
- `src/contracts/`: esquemas Zod y tipos TS inferidos para los contratos de extracción y de posts.
- `src/lib/pdf/`: parseo de PDFs y detección de DOI.
- `src/lib/external/`: clientes de Crossref y Unpaywall.
- `src/lib/llm/`: interfaz de proveedores, proveedores Gemini/Groq y router con reintentos y fallback.
- `src/lib/pipeline/`: orquestación y persistencia de etapas y trabajos.
- `src/lib/export/`: renderizado de plantillas y motor de exportación con Playwright.
- `prisma/`: esquema de PostgreSQL y migraciones.

## Diagrama
```text
          ┌────────────────────────────┐
          │      Next.js UI/API        │
          │  /upload /process /status  │
          └──────────────┬─────────────┘
                         │
                         v
               ┌───────────────────┐
               │  Pipeline Service │
               │ parse -> enrich   │
               │ -> extract -> gen │
               │ -> export         │
               └───────┬───────────┘
                       │
    ┌──────────────────┼──────────────────┐
    v                  v                  v
┌───────────┐   ┌──────────────┐   ┌──────────────┐
│ PDF Layer │   │ External APIs │   │ LLM Router   │
│ pdf-parse │   │ Crossref/OA   │   │ Gemini->Groq │
└─────┬─────┘   └──────┬───────┘   └──────┬───────┘
      │                │                  │
      └────────────────┴──────────────────┘
                       v
              ┌───────────────────┐
              │ PostgreSQL/Prisma │
              │ Document/Metadata │
              │ Extraction/Posts  │
              │ Export/JobRun     │
              └───────────────────┘
```

## Instalación local
1. Instalar dependencias:
```bash
npm install
```
2. Copiar las variables de entorno:
```bash
cp .env.example .env
```
3. Levantar PostgreSQL local:
```bash
npm run db:up
```
4. Generar el cliente de Prisma y migrar:
```bash
npm run prisma:generate
npm run prisma:migrate
```
5. Instalar Chromium de Playwright (necesario para exportar):
```bash
npm run playwright:install
```
6. Ejecutar la app:
```bash
npm run dev
```

## Variables de entorno
Definidas en `.env.example`:
- `DATABASE_URL`: cadena de conexión a la PostgreSQL local.
- `GEMINI_API_KEY`: clave del proveedor Gemini.
- `GROQ_API_KEY`: clave del proveedor Groq.
- `UNPAYWALL_EMAIL`: email de contacto que exige la API de Unpaywall.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: inicialización de la base local con Docker.

## Proveedores LLM y estrategia de fallback
- Los proveedores implementan una interfaz común `LLMProvider`:
  - `extractClaims(input)`
  - `generatePosts(input)`
- Ambos proveedores fuerzan prompts con salida JSON estricta.
- El JSON devuelto se valida contra esquemas Zod.
- Ante JSON inválido o esquema que no coincide:
  - se ejecuta un intento de reparación con un prompt,
  - y luego se reintenta la validación.
- Comportamiento del router:
  - principal: Gemini,
  - reintentos ante `429` o `5xx` con backoff de `500ms` y `1500ms`,
  - fallback: Groq,
  - si ambos fallan => `LLM_UNAVAILABLE`.

## Validación con Zod (qué y por qué)
Contratos validados:
- `Extraction`: claims, campos tipo PICO, confianza y citas.
- `Post`: plataforma, contenido y bloque de citación (+ hashtags opcionales).

Por qué:
- protege la integridad de la base ante salidas malformadas del LLM,
- da contratos de API predecibles para la UI,
- permite un flujo de reparación seguro en lugar de aceptar JSON incorrecto en silencio.

## Tests
Ejecutar toda la suite:
```bash
npm test
```
Chequeo de tipos + lint + tests:
```bash
npm run check
```

La cobertura actual (23 tests unitarios) incluye:
- esquemas de validación de contratos,
- lógica de extracción de DOI y abstract,
- parseo de clientes externos y manejo de errores,
- comportamiento de reintentos y fallback del router LLM.

El mismo `npm run check` corre en cada push mediante GitHub Actions.

## Limitaciones
- Se aplica modo seguro cuando el acceso abierto (OA) es falso o desconocido:
  - solo se envía el abstract o un fragmento al LLM (no el texto completo).
- Las APIs externas tienen límites de uso y dependen de la red.
- El enriquecimiento con Unpaywall es de mejor esfuerzo y puede ser parcial.
- La exportación actual soporta PNG/JPEG vía Playwright (todavía no hay render a PDF).
- El set de plantillas es intencionalmente mínimo (`carousel_basic`, `myth_vs_fact`, `clinical_summary`).

## Licencia
[MIT](LICENSE)
