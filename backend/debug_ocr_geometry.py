import json
import sys

def analyze_geometry(target_name="Jochy"):
    with open("backend/ocr_raw_output.json", "r") as f:
        pages = json.load(f)

    print(f"Searching for '{target_name}' in {len(pages)} pages...")

    for p_idx, page in enumerate(pages):
        # Page is a list of items directly
        page_items = page

        # Find target row
        target_y = None
        target_bbox = None
        
        for item in page_items:
            # Robust unpacking
            bbox = item[0]
            text = item[1]
            
            if target_name.lower() in text.lower():
                target_y = (bbox[0][1] + bbox[2][1]) / 2
                target_bbox = bbox
                print(f"\nFOUND '{text}' on Page {p_idx+1}")
                print(f"  BBox: {bbox}")
                print(f"  Center Y: {target_y}")
                break
        
        if target_y:
            # Look for items in a wider Y-range
            y_min = target_y - 50
            y_max = target_y + 50
            
            print(f"\nItems within +/- 50px of Y={target_y}:")
            print(f"{'Text':<30} | {'Center Y':<10} | {'Diff':<10} | {'X Range'}")
            print("-" * 70)
            
            nearby_items = []
            for item in page_items:
                # Robust unpacking: take first 2 elements
                bbox = item[0]
                text = item[1]
                
                y_center = (bbox[0][1] + bbox[2][1]) / 2
                
                if y_min <= y_center <= y_max:
                    diff = y_center - target_y
                    x_start = bbox[0][0]
                    x_end = bbox[1][0]
                    nearby_items.append((text, y_center, diff, x_start, x_end))
                    print(f"{text:<30} | {y_center:<10.1f} | {diff:<10.1f} | {x_start:.0f}-{x_end:.0f}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_geometry(sys.argv[1])
    else:
        analyze_geometry()
