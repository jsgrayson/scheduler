try:
    from PyPDF2 import PdfReader
except ImportError:
    try:
        from pypdf import PdfReader
    except ImportError:
        print("PyPDF2 and pypdf not found")
        exit(1)

reader = PdfReader("20251205154749604 copy.pdf")
print(f"Number of Pages: {len(reader.pages)}")

for i, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"--- Page {i+1} ---")
    # Print first few lines to identify headers
    lines = text.split('\n')
    for line in lines[:10]:
        print(line)
    print("...")
