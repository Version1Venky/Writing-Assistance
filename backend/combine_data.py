import json
import pandas as pd
from pathlib import Path

# Folder where participant JSON files are saved
DATA_FOLDER = Path("data")
OUTPUT_FILE = "combined_data.csv"

all_records = []

# Loop through each JSON file
for json_file in DATA_FOLDER.glob("*.json"):
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Flatten gazeData into a string (or keep as JSON if you prefer)
    gaze_points = json.dumps(data.get("gazeData", []))

    record = {
        "participantCode": data.get("participantCode"),
        "ageGroup": data.get("ageGroup"),
        "gender": data.get("gender"),
        "timestamp": data.get("timestamp"),
        "text": data.get("text"),
        "gazeData": gaze_points,
    }

    all_records.append(record)

# Create a DataFrame
df = pd.DataFrame(all_records)

# Save to CSV
df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8")

print(f"Combined {len(all_records)} files into {OUTPUT_FILE}")
