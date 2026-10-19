import zipfile
import xml.etree.ElementTree as ET
import os
import re

DOWNLOADS = r"c:\Users\miniOrange\Downloads"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "company", "source")
os.makedirs(OUT, exist_ok=True)

FILES = [
    "Tecavy_Agent_Safety_and_Autonomy_Framework_v1.0.docx",
    "Tecavy_Growth_OS_Single_Source_of_Truth_v1.0.docx",
    "Tecavy_Engagement_Lead_Engine_Developer_Execution_Spec_Khyati(1).docx",
]

def extract_docx(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    root = ET.fromstring(xml)
    paras = []
    for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        parts = [n.text or "" for n in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")]
        line = "".join(parts).strip()
        if line:
            paras.append(line)
    return "\n\n".join(paras)

def extract_pages(path):
    with zipfile.ZipFile(path) as z:
        data = z.read("Index/Document.iwa")
    runs = re.findall(rb"[A-Za-z][\x20-\x7e]{20,}", data)
    seen = set()
    out = []
    for r in runs:
        s = r.decode("utf-8", errors="ignore").strip()
        if len(s) < 25 or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return "\n\n".join(out)

for name in FILES:
    src = os.path.join(DOWNLOADS, name)
    if not os.path.exists(src):
        print("skip missing", name)
        continue
    text = extract_docx(src)
    dest = os.path.join(OUT, name.rsplit(".", 1)[0] + ".txt")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(text)
    print("docx", name, len(text))

pages = os.path.join(DOWNLOADS, "TecAvy_Marketing_OS_Limitations_and_Guardrails_v2.0.pages")
if os.path.exists(pages):
    text = extract_pages(pages)
    dest = os.path.join(OUT, "TecAvy_Marketing_OS_Limitations_and_Guardrails_v2.0.txt")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(text)
    print("pages", len(text))
