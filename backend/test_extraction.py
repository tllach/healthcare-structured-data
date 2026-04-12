"""
Standalone script: upload each file in test_docs/ to POST /extract and print a report.

Run from the backend directory:
  python test_extraction.py

Requires: httpx and optionally rich for formatted output.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError as e:
    print(
        "Missing dependencies. From the backend folder run:\n"
        "  python -m pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from e

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table

    _HAS_RICH = True
except ImportError:
    _HAS_RICH = False

# Paths relative to this file
BACKEND_DIR = Path(__file__).resolve().parent
TEST_DOCS_DIR = BACKEND_DIR / "test_docs"

DEFAULT_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

ALLOWED_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}

CONFIDENCE_KEYS = (
    "patient",
    "insurance",
    "provider",
    "diagnoses",
    "procedures",
    "medications",
    "clinical_history",
)


def truncate(text: str, max_len: int = 60) -> str:
    t = " ".join(text.split())
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def section_to_text(label: str, value: Any) -> str:
    if value is None:
        return "(null)"
    if isinstance(value, (dict, list)):
        try:
            raw = json.dumps(value, ensure_ascii=False, default=str)
        except TypeError:
            raw = str(value)
    else:
        raw = str(value)
    return truncate(raw, 60)


def confidence_bar(score: float, width: int = 8) -> str:
    try:
        s = float(score)
    except (TypeError, ValueError):
        s = 0.0
    s = max(0.0, min(1.0, s))
    filled = int(round(s * width))
    filled = max(0, min(width, filled))
    return "█" * filled + "░" * (width - filled)


def mean_confidence(conf: dict[str, Any]) -> float:
    vals: list[float] = []
    for k in CONFIDENCE_KEYS:
        v = conf.get(k)
        try:
            if v is not None:
                vals.append(float(v))
        except (TypeError, ValueError):
            pass
    if not vals:
        return 0.0
    return sum(vals) / len(vals)


def collect_files(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() in ALLOWED_SUFFIXES:
            out.append(p)
    return out


def post_extract(client: httpx.Client, base_url: str, file_path: Path) -> dict[str, Any]:
    url = f"{base_url}/extract"
    with file_path.open("rb") as f:
        files = {"file": (file_path.name, f, "application/octet-stream")}
        r = client.post(url, files=files, timeout=600.0)
    r.raise_for_status()
    return r.json()


def print_plain_header(title: str) -> None:
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def run() -> int:
    console = Console() if _HAS_RICH else None

    files = collect_files(TEST_DOCS_DIR)
    if not files:
        msg = (
            f"No test files found in {TEST_DOCS_DIR}. "
            f"Add PDF/images ({', '.join(sorted(ALLOWED_SUFFIXES))}) and run again."
        )
        if _HAS_RICH and console:
            console.print(f"[yellow]{msg}[/yellow]")
        else:
            print(msg, file=sys.stderr)
        return 1

    base_url = DEFAULT_BASE_URL

    # Accumulate for summary: list of (doc_name, mean_conf, per_section dict)
    per_doc_means: list[tuple[str, float]] = []
    section_totals: dict[str, list[float]] = {k: [] for k in CONFIDENCE_KEYS}

    with httpx.Client() as client:
        for file_path in files:
            doc_name = file_path.name
            try:
                data = post_extract(client, base_url, file_path)
                print("--------------------------------")
                print(data)
                print("--------------------------------")
            except httpx.HTTPStatusError as e:
                err = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
                if _HAS_RICH and console:
                    console.print(f"[red]{doc_name}: {err}[/red]")
                else:
                    print(f"{doc_name}: {err}", file=sys.stderr)
                continue
            except httpx.RequestError as e:
                if _HAS_RICH and console:
                    console.print(f"[red]{doc_name}: request failed: {e}[/red]")
                else:
                    print(f"{doc_name}: request failed: {e}", file=sys.stderr)
                continue

            result = data.get("result") or {}
            conf = (result.get("confidence") or {}) if isinstance(result, dict) else {}
            doc_type = data.get("document_type", "unknown")
            proc_ms = data.get("processing_time_ms", 0)
            notes = result.get("extraction_notes") or []

            for k in CONFIDENCE_KEYS:
                v = conf.get(k)
                try:
                    if v is not None:
                        section_totals[k].append(float(v))
                except (TypeError, ValueError):
                    pass

            m = mean_confidence(conf if isinstance(conf, dict) else {})
            per_doc_means.append((doc_name, m))

            # --- Report for this document ---
            if _HAS_RICH and console:
                console.print()
                console.print(
                    Panel.fit(
                        f"[bold]{doc_name}[/bold]\n"
                        f"Detected type: [cyan]{doc_type}[/cyan]\n"
                        f"Processing time: [green]{proc_ms} ms[/green]",
                        title="Document",
                    )
                )

                t = Table(show_header=True, header_style="bold")
                t.add_column("Section")
                t.add_column("Extracted (≤60 chars)")
                t.add_column("Confidence")

                patient = result.get("patient") or {}
                insurance = result.get("insurance") or {}
                provider = result.get("provider") or {}
                diagnoses = result.get("diagnoses") or []
                procedures = result.get("procedures") or []
                medications = result.get("medications") or []
                clinical = result.get("clinical_history")

                rows = [
                    ("patient", patient),
                    ("insurance", insurance),
                    ("provider", provider),
                    ("diagnoses", diagnoses),
                    ("procedures", procedures),
                    ("medications", medications),
                    ("clinical_history", clinical),
                ]
                for sec_label, sec_val in rows:
                    sc = conf.get(sec_label)
                    try:
                        pct = float(sc) if sc is not None else 0.0
                    except (TypeError, ValueError):
                        pct = 0.0
                    bar = confidence_bar(pct)
                    pct_str = f"{bar} {pct * 100:.0f}%"
                    t.add_row(
                        sec_label,
                        section_to_text(sec_label, sec_val),
                        pct_str,
                    )
                console.print(t)

                if notes:
                    console.print("[bold]extraction_notes[/bold]")
                    for n in notes:
                        console.print(f"  • {truncate(str(n), 120)}")
            else:
                print_plain_header(doc_name)
                print(f"Detected type: {doc_type}")
                print(f"Processing time: {proc_ms} ms")
                print()

                patient = result.get("patient") or {}
                insurance = result.get("insurance") or {}
                provider = result.get("provider") or {}
                diagnoses = result.get("diagnoses") or []
                procedures = result.get("procedures") or []
                medications = result.get("medications") or []
                clinical = result.get("clinical_history")

                rows = [
                    ("patient", patient),
                    ("insurance", insurance),
                    ("provider", provider),
                    ("diagnoses", diagnoses),
                    ("procedures", procedures),
                    ("medications", medications),
                    ("clinical_history", clinical),
                ]
                for sec_label, sec_val in rows:
                    sc = conf.get(sec_label)
                    try:
                        pct = float(sc) if sc is not None else 0.0
                    except (TypeError, ValueError):
                        pct = 0.0
                    bar = confidence_bar(pct)
                    print(f"  [{sec_label}]")
                    print(f"    {section_to_text(sec_label, sec_val)}")
                    print(f"    {bar} {pct * 100:.0f}%")
                    print()

                if notes:
                    print("extraction_notes:")
                    for n in notes:
                        print(f"  - {truncate(str(n), 120)}")
                    print()

    # --- Summary ---
    n_docs = len(per_doc_means)
    if n_docs == 0:
        if not _HAS_RICH:
            print("No successful extractions to summarize.", file=sys.stderr)
        return 0

    if _HAS_RICH and console:
        console.print()
        console.rule("[bold]Summary[/bold]")
        st = Table(title="Average confidence per section (all documents)")
        st.add_column("Section")
        st.add_column("Avg")
        for k in CONFIDENCE_KEYS:
            vals = section_totals[k]
            avg = sum(vals) / len(vals) if vals else 0.0
            st.add_row(k, f"{avg * 100:.1f}%")
        console.print(st)

        sorted_docs = sorted(per_doc_means, key=lambda x: x[1])
        lowest = sorted_docs[: min(5, len(sorted_docs))]
        console.print("[bold]Lowest overall confidence[/bold] (mean of section scores)")
        for name, mean_c in lowest:
            console.print(f"  [dim]{name}[/dim]  →  [yellow]{mean_c * 100:.1f}%[/yellow]")
    else:
        print()
        print("=" * 72)
        print("SUMMARY")
        print("=" * 72)
        print("Average confidence per section (all documents):")
        for k in CONFIDENCE_KEYS:
            vals = section_totals[k]
            avg = sum(vals) / len(vals) if vals else 0.0
            print(f"  {k}: {avg * 100:.1f}%")
        print()
        sorted_docs = sorted(per_doc_means, key=lambda x: x[1])
        print("Lowest overall confidence (mean of section scores):")
        for name, mean_c in sorted_docs[: min(5, len(sorted_docs))]:
            print(f"  {name}: {mean_c * 100:.1f}%")

    return 0


if __name__ == "__main__":
    raise SystemExit(run())
