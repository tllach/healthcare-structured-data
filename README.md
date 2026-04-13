# Healthcare Structured Data Extraction

## Overview

This project is a web application that extracts structured data from clinical documents, auto-fills a service request form, and enables human review to improve accuracy over time.

It is designed with a **human-in-the-loop** workflow, prioritizing:

- **Fast extraction** using AI
- **Clear visibility** into uncertainty
- **Easy correction and validation**
- **Feedback loops** for measuring accuracy

You can test it here: https://healthcare-structured-data.vercel.app/

## Approach

The approach focused on speed, pragmatism, and iteration, rather than over-engineering.

### 1. Understand the problem first

Analysis of sample documents identified:

- Key entities to extract (patients, insurance, providers, codes, etc.)
- Variability in formats (structured PDFs vs scanned documents)
- The final output format (service request form)

That defined the extraction schema and the UI needed for review and correction.

### 2. Choose a fast, flexible stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router) on Vercel |
| Backend | FastAPI on Railway |
| Database | Supabase |
| AI extraction | LLM-based parsing (Claude) + OCR-compatible pipeline |

Goal: ship a working product quickly, iterate on accuracy, and keep the architecture simple.

### 3. Build extraction pipeline first (core logic)

Before UI, the focus was extraction quality:

- FastAPI endpoint for document processing
- Prompt iterations to produce structured JSON
- Local test script (`test.py`) with sample documents to rapidly iterate prompts, improve consistency and field coverage, and handle edge cases and ambiguity

That validated extraction quality before building the UI.

### 4. Frontend: Human-in-the-loop UX

- **Upload flow** — upload clinical documents and trigger AI extraction
- **Review and correction** — auto-filled form with clear separation between AI-filled fields, missing/uncertain fields, and editable inputs for correction
- **Accuracy tracking** — basic view for how often fields are corrected and signals for extraction quality

### 5. Iteration mindset

Development loop: **Test → Improve prompt → Validate → Repeat → Build UI**

That kept AI output quality improving continuously and aligned the UI with real extraction behavior.

## AI tools used

AI was used to accelerate development:

| Tool | Role |
|------|------|
| Claude | Primary for extraction logic and prompt design |
| ChatGPT | Architecture, debugging, iteration |
| Cursor | AI-assisted coding and refactoring |

**Prompt engineering** — structured extraction prompts, consistent JSON output, ambiguous/missing data handling.

**Code generation** — UI scaffolding, API boilerplate, repetitive tasks.

**Debugging and iteration** — deployment issues (CORS, routing, etc.) and architecture refinements.

**Note:** AI was used as a tool, not a crutch. System design, output validation, and product decisions were driven by understanding the problem.

## Architecture

### High-level flow

```text
User Upload → FastAPI Backend → AI Extraction → Structured JSON → Frontend Form → User Review → Data Stored
```

### Stack

**Frontend**

- Next.js (App Router)
- Tailwind CSS
- Deployed on Vercel

**Backend**

- FastAPI — file ingestion, AI extraction requests, data processing
- Deployed on Railway

**Database**

- Supabase — extraction results, user corrections, accuracy metrics

## Technical decisions

**Why FastAPI?** Fast to set up, strong fit for async AI workflows, simple and readable.

**Why Next.js?** Rapid UI development, good DX, straightforward deployment on Vercel.

**Why Supabase (and not Prisma)?** Speed over abstraction. Supabase offers instant database setup, built-in APIs, and minimal configuration. Prisma would add setup overhead and an abstraction layer not needed for this scope—direct Supabase usage was the pragmatic choice under time constraints.

**Why LLM-based extraction?** LLMs handle unstructured data, format variability, and noisy OCR inputs. Tradeoff: less deterministic than rule-based systems, but much faster to implement and iterate.

## Confidence and accuracy

- Missing or uncertain fields are surfaced in the UI
- Users can correct values directly
- Corrections support measuring extraction accuracy and identifying weak fields in the pipeline

## What to improve with more time

1. **Better confidence scoring** — explicit confidence per field and visual indicators in the UI
2. **OCR improvements** — dedicated OCR (e.g. AWS Textract / Google Vision) for scanned documents
3. **Data validation layer** — validate ICD-10 / CPT codes and normalize extracted entities
4. **Analytics dashboard** — richer accuracy tracking and field-level performance metrics
5. **Background processing** — async job queue for large files and long-running document processing

## Final thoughts

This project prioritizes speed of execution, AI-first development, pragmatic architecture, and strong UX for human validation. It demonstrates going from **unstructured medical documents → structured, usable data → human-validated output** in a fast, iterative way.