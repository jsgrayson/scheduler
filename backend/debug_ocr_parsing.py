import json
import re
import sys

# Mock Constants
KNOWN_LOCATIONS = [
    "LOT 1", "LOT 2", "LOT 3", "LOT 4", 
    "PLAZA", "CONRAC", "OFFICE", "MAINTENANCE", 
    "SUPERVISORS", "CUSTOMER LOTS", "CASHIER"
]

LOCATION_MAPPINGS = {
    "SUP3": "Supervisors",
    "FLOAT": "Office", 
    "OFF: MGD": "Office",
    "RECPTAR": "Office",
    "ADIAU": "Office",
    "ADMIN": "Office",
    "AFM": "Office",
    "AD": "Office",
    "SUP-MGR": "Maintenance",
    "C-LOT": "Customer Lots",
    "CLOT": "Customer Lots",
    "CUSTOMER LOT": "Customer Lots",
}

def debug_parsing():
    try:
        with open("ocr_raw_output.json", "r") as f:
            lines_data = json.load(f)
    except FileNotFoundError:
        print("Error: ocr_raw_output.json not found.")
        return

    print(f"Loaded {len(lines_data)} lines.")

    day_columns = []
    current_location = "General"

    for i, line_items in enumerate(lines_data):
        # Construct full text
        full_line_text = " ".join([t[1] for t in line_items])
        print(f"\n--- Line {i}: {full_line_text} ---")
        
        # 0. Check Location
        line_upper = full_line_text.upper()
        
        location_found = False
        for loc in KNOWN_LOCATIONS + list(LOCATION_MAPPINGS.keys()):
            loc_pattern = re.escape(loc)
            pattern = rf"\b{loc_pattern}\b(?!\s*[:.])"
            
            if re.search(pattern, line_upper):
                if loc in LOCATION_MAPPINGS:
                    current_location = LOCATION_MAPPINGS[loc]
                else:
                    current_location = loc.title()
                    if loc == "CONRAC": current_location = "Conrac"
                    if loc == "PLAZA": current_location = "Plaza"
                    if loc == "LOT 1": current_location = "Lot 1"
                    if loc == "LOT 2": current_location = "Lot 2"
                    if loc == "LOT 3": current_location = "Lot 3"
                    if loc == "LOT 4": current_location = "Lot 4"
                
                print(f"DEBUG: Found Location Header: {current_location}")
                location_found = True
                break
        
        # 1. Check Header (Define Columns)
        days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        day_matches = []
        
        print(f"DEBUG: Checking {len(line_items)} blocks for header...")
        for (bbox, text) in line_items:
            found_days = [d for d in days if d in text.lower()]
            
            print(f"DEBUG: Checking Block: '{text}' -> Found: {found_days}")

            if found_days:
                print(f"DEBUG: Header Candidate Block: '{text}' -> Found Days: {found_days}")
                
                if len(found_days) == 1:
                    x_center = (bbox[0][0] + bbox[1][0]) / 2
                    day_matches.append((x_center, text))
                else:
                    # Multiple days merged
                    print(f"DEBUG: Merged Days detected: {text}")
                    words = text.split()
                    if len(words) < len(found_days):
                        box_width = bbox[1][0] - bbox[0][0]
                        start_x = bbox[0][0]
                        segment_width = box_width / len(found_days)
                        for k, day_name in enumerate(found_days):
                            seg_center = start_x + (segment_width * k) + (segment_width / 2)
                            day_matches.append((seg_center, day_name))
                    else:
                        box_width = bbox[1][0] - bbox[0][0]
                        start_x = bbox[0][0]
                        segment_width = box_width / len(found_days)
                        for k, day_name in enumerate(found_days):
                            seg_center = start_x + (segment_width * k) + (segment_width / 2)
                            day_matches.append((seg_center, day_name))
        
        if len(day_matches) >= 3:
            day_columns = sorted(day_matches, key=lambda x: x[0])
            print(f"DEBUG: Defined {len(day_columns)} columns: {[d[1] for d in day_columns]}")
            continue # Skip processing this line as employee
        
        # 2. Process Row (if we have columns defined)
        if day_columns:
            print(f"DEBUG: Processing Row with {len(day_columns)} columns defined.")
            # We have columns, try to map items to them
            # Identify Name (Leftmost) vs Time Slots
            
            # Heuristic: Name is usually far left, before the first column starts
            # First column X
            first_col_x = day_columns[0][0]
            margin = 50 
            
            name_parts = []
            time_slots = {} 
            
            # Calculate average column width
            col_xs = [d[0] for d in day_columns]
            if len(col_xs) > 1:
                avg_col_gap = (col_xs[-1] - col_xs[0]) / (len(col_xs) - 1)
            else:
                avg_col_gap = 200 # Fallback
            
            print(f"DEBUG: Avg Column Gap: {avg_col_gap:.1f}")

            for (bbox, text) in line_items:
                x_center = (bbox[0][0] + bbox[1][0]) / 2
                width = bbox[1][0] - bbox[0][0]
                
                if x_center < (first_col_x - margin):
                    name_parts.append(text)
                else:
                    # Check if block is wide (spans multiple columns)
                    # If width is > 1.5 * gap, it's likely merged
                    if width > (avg_col_gap * 1.2): # 1.2 safety factor
                        print(f"DEBUG: Detected Merged Block '{text}' (Width: {width:.1f}, Gap: {avg_col_gap:.1f})")
                        
                        # Split text based on column overlap
                        # Simple approach: Check which columns fall within the bbox X range
                        start_x = bbox[0][0]
                        end_x = bbox[1][0]
                        
                        covered_cols = []
                        for k, (col_x, col_name) in enumerate(day_columns):
                            # Check if column center is within the block (with some padding)
                            if start_x - (avg_col_gap/2) <= col_x <= end_x + (avg_col_gap/2):
                                covered_cols.append(k)
                        
                        if covered_cols:
                            print(f"DEBUG: Block covers columns: {covered_cols}")
                            # Distribute text chunks
                            # If text has spaces, split by space? 
                            # Or just duplicate the text if it looks like "OFF OFF OFF"?
                            # Or try to regex split?
                            
                            # Heuristic: If text length is long, try to split by space
                            # If not enough spaces, we might need to just assign to all?
                            # For now, let's try splitting by space if count matches
                            words = text.split()
                            
                            if len(words) >= len(covered_cols):
                                # We have enough words, distribute them
                                # This assumes 1 word per column roughly
                                # If more words than columns, we might need to group them?
                                # Simple distribution:
                                chunk_size = len(words) / len(covered_cols)
                                for i, col_idx in enumerate(covered_cols):
                                    # Take slice of words
                                    s = int(i * chunk_size)
                                    e = int((i + 1) * chunk_size)
                                    chunk = " ".join(words[s:e])
                                    
                                    if col_idx in time_slots:
                                        time_slots[col_idx] += " " + chunk
                                    else:
                                        time_slots[col_idx] = chunk
                            else:
                                # Not enough word breaks - evenly divide the text
                                # and extract time patterns from each segment
                                char_len = len(text)
                                chunk_size = char_len // len(covered_cols)
                                
                                # Pattern to extract time strings (including OCR errors)
                                time_pattern = r'[0-9IO]{1,2}[:.]?[0-9IO]{0,2}[APMS]{0,3}[-–][0-9IO]{1,2}[:.]?[0-9IO]{0,2}[APMS]{0,3}'
                                
                                for i, col_idx in enumerate(covered_cols):
                                    # Extract segment
                                    start = i * chunk_size
                                    end = (i + 1) * chunk_size if i < len(covered_cols) - 1 else char_len
                                    segment = text[start:end]
                                    
                                    # Try to find a time pattern within this segment
                                    match = re.search(time_pattern, segment, re.IGNORECASE)
                                    if match:
                                        chunk = match.group()
                                    else:
                                        # No pattern found, use raw segment but clean it
                                        chunk = segment.strip()
                                    
                                    if col_idx in time_slots:
                                        time_slots[col_idx] += " " + chunk
                                    else:
                                        time_slots[col_idx] = chunk
                        else:
                            # Fallback to center mapping
                            closest_col_idx = -1
                            min_dist = float('inf')
                            for k, (col_x, col_name) in enumerate(day_columns):
                                dist = abs(x_center - col_x)
                                if dist < min_dist:
                                    min_dist = dist
                                    closest_col_idx = k
                            if closest_col_idx != -1:
                                if closest_col_idx in time_slots:
                                    time_slots[closest_col_idx] += " " + text
                                else:
                                    time_slots[closest_col_idx] = text

                    else:
                        # Normal mapping (not wide)
                        # Map to nearest column
                        # Find closest day column
                        closest_col_idx = -1
                        min_dist = float('inf')
                        
                        for k, (col_x, col_name) in enumerate(day_columns):
                            dist = abs(x_center - col_x)
                            if dist < min_dist:
                                min_dist = dist
                                closest_col_idx = k
                        
                        if closest_col_idx != -1:
                            # Check if it's within reasonable distance (e.g. half gap)
                            if min_dist < (avg_col_gap * 0.6):
                                print(f"DEBUG: Mapped '{text}' (x={x_center:.1f}) to Column {closest_col_idx} ({day_columns[closest_col_idx][1]}) (dist={min_dist:.1f})")
                                if closest_col_idx in time_slots:
                                    time_slots[closest_col_idx] += " " + text
                                else:
                                    time_slots[closest_col_idx] = text
                            else:
                                print(f"DEBUG: Ignored '{text}' (x={x_center:.1f}) - too far from Col {closest_col_idx} (dist={min_dist:.1f}, gap={avg_col_gap:.1f})")
            
            full_name = " ".join(name_parts).strip()
            print(f"DEBUG: Extracted Name: '{full_name}'")
            print(f"DEBUG: Extracted Slots: {time_slots}")
        else:
            print("DEBUG: Skipping row (no columns defined yet)")

if __name__ == "__main__":
    debug_parsing()
