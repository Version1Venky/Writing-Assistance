from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from datetime import datetime
from pathlib import Path

app = FastAPI()

# Allow requests from React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data model for POST request
class DataRequest(BaseModel):
    participantCode: str
    name: str
    ageGroup: str
    gender: str
    text: str
    gazeData: list


SAVE_FILE = Path("data.json")

from pathlib import Path
import json
from datetime import datetime

DATA_FOLDER = Path("data")
DATA_FOLDER.mkdir(exist_ok=True)  # Create 'data' folder if it doesn't exist

@app.get("/next_code")
def next_code():
    # Count existing JSON files
    DATA_FOLDER.mkdir(exist_ok=True)
    files = list(DATA_FOLDER.glob("*.json"))
    next_number = len(files) + 1
    # Format as 3 digits with leading zeros, e.g., 001, 002
    return {"code": f"{next_number:03}"}

@app.post("/save")
def save_data(data: DataRequest):
    # Create a unique filename based on participant code and timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = DATA_FOLDER / f"{data.participantCode}_{timestamp}.json"

    entry = {
        "participantCode": data.participantCode,
        "name": data.name,
        "ageGroup": data.ageGroup,
        "gender": data.gender,
        "timestamp": datetime.now().isoformat(),
        "text": data.text,
        "gazeData": data.gazeData,
    }

    # Save entry to a new JSON file
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(entry, f, indent=2)

    return {"status": "success", "file": str(filename)}
