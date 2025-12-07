from pypdf import PdfReader
import os

pdf_path = "20251205154749604 copy.pdf"
reader = PdfReader(pdf_path)

count = 0
for i, page in enumerate(reader.pages):
    print(f"Processing Page {i+1}...")
    for image in page.images:
        # image.name usually is 'Im0.jpg' or similar
        fname = f"extracted_page_{i+1}_{image.name}"
        with open(fname, "wb") as fp:
            fp.write(image.data)
        print(f"Saved {fname}")
        count += 1

if count == 0:
    print("No images found in PDF.")
