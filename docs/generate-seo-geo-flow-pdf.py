"""
Build Nexora SEO/GEO Flow Guide PDF from Mermaid diagrams (proper flowcharts).

Source: seo-geo-flow-diagrams/*.mmd
Renders PNGs via @mermaid-js/mermaid-cli, then assembles PDF.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as RLImage
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent
DIAG = ROOT / "seo-geo-flow-diagrams"
OUT_PDF = ROOT / "Nexora-SEO-GEO-Flow-Guide.pdf"
def mmdc_cmd(*args: str) -> list[str]:
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        raise RuntimeError("npx not found — install Node.js to render Mermaid diagrams")
    return [npx, "-y", "@mermaid-js/mermaid-cli@11.4.0", *args]

PAGES = [
    ("01-overview", "1. End-to-end overview", "Brand → crawl → audit → recommendations; optional rank, AI visibility, and Google connect."),
    ("02-audit-engine", "2. Audit engine", "What runs on each Re-audit: crawl signals, rules, Google evidence, optional Vertex GEO suggestions."),
    ("03-crawl-job", "3. Full-site crawl job", "Async job states and how completed crawls feed the next audit."),
    ("04-rank-tracking", "4. Rank tracking", "Keywords, sync from GSC and optional SerpAPI, dashboard snapshots."),
    ("05-ai-visibility", "5. AI visibility (GEO)", "Prompts, Vertex sample runs, citation dashboard (sampled, not guaranteed)."),
    ("06-auto-fix", "6. Auto-fix", "Propose → review → approve; WordPress apply or manual CMS; rollback record."),
    ("07-ui-api", "7. UI tabs and API routes", "How each tab maps to /api/seo-geo endpoints and JSON storage."),
    ("08-google-oauth", "8. Google OAuth (optional)", "Sequence for GSC + GBP connect and evidence on re-audit."),
]


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_mermaid(stem: str) -> Path:
    mmd = DIAG / f"{stem}.mmd"
    png = DIAG / f"{stem}.png"
    if not mmd.exists():
        raise FileNotFoundError(mmd)
    config = DIAG / "mermaid-config.json"
    cmd = mmdc_cmd(
        "-i",
        str(mmd),
        "-o",
        str(png),
        "-b",
        "white",
        "-w",
        "1800",
        "-s",
        "2",
    )
    if config.exists():
        cmd.extend(["-c", str(config)])
    subprocess.run(cmd, check=True, cwd=str(DIAG))
    if not png.exists():
        raise RuntimeError(f"Failed to create {png}")
    return png


def scaled_figure(png: Path, max_w: float, max_h: float) -> RLImage:
    img = RLImage(str(png))
    iw, ih = img.imageWidth, img.imageHeight
    scale = min(max_w / iw, max_h / ih)
    img.drawWidth = iw * scale
    img.drawHeight = ih * scale
    return img


def main():
    DIAG.mkdir(parents=True, exist_ok=True)

    for stem, _, _ in PAGES:
        print(f"Rendering {stem}.mmd …")
        render_mermaid(stem)

    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
        title="Nexora SEO / GEO Flow Guide",
        author="Nexora",
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Subtitle",
            parent=styles["Normal"],
            fontSize=11,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
            leading=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#0f766e"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Caption",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#64748b"),
            spaceBefore=6,
            leading=12,
        )
    )

    max_w = letter[0] - 1.3 * inch
    max_h = letter[1] - 2.4 * inch

    story = []
    story.append(Paragraph("Nexora SEO / GEO", styles["Title"]))
    story.append(Paragraph(esc("Flow guide — Attract · SEO / GEO"), styles["Subtitle"]))
    story.append(
        Paragraph(
            esc(
                "Professional flow diagrams for product and engineering. "
                "Credentials, billing, and OAuth setup are out of scope."
            ),
            styles["Caption"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph(esc("Contents"), styles["Heading2"]))
    toc_rows = [[Paragraph(esc(f"{title}"), styles["Normal"]), Paragraph(esc(stem), styles["Caption"])] for stem, title, _ in PAGES]
    toc = Table(toc_rows, colWidths=[4.2 * inch, 2.3 * inch])
    toc.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#e2e8f0")),
            ]
        )
    )
    story.append(toc)
    story.append(PageBreak())

    for i, (stem, title, caption) in enumerate(PAGES):
        png = DIAG / f"{stem}.png"
        story.append(Paragraph(esc(title), styles["Section"]))
        story.append(scaled_figure(png, max_w, max_h))
        story.append(Paragraph(esc(caption), styles["Caption"]))
        if i < len(PAGES) - 1:
            story.append(PageBreak())
        else:
            story.append(Spacer(1, 0.2 * inch))
            story.append(
                Paragraph(
                    esc(
                        "Evidence-based SEO/GEO — not a ranking, traffic, or universal AI visibility guarantee."
                    ),
                    styles["Caption"],
                )
            )

    doc.build(story)
    print(f"Wrote {OUT_PDF}")


if __name__ == "__main__":
    main()
