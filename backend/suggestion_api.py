from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow frontend to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Directories and master files
DATA_DIR = Path("participants_data")
DATA_DIR.mkdir(exist_ok=True)

PARTICIPANT_MASTER = Path("participants_master.json")
GAZE_MASTER = Path("gaze_master.json")
SECTION_MASTER = Path("section_difficulty.json")

# Data models
class SuggestRequest(BaseModel):
    section: str
    text: str

class LogRequest(BaseModel):
    participantCode: str
    section: str
    textSnapshot: str
    timestamp: str
    anonymous: bool

class SaveRequest(BaseModel):
    participantCode: str
    name: str
    ageGroup: str
    gender: str
    text: str
    gazeData: list
    anonymous: bool


# Utility function to append to JSON master files
def append_to_master(file_path: Path, entry: dict):
    if file_path.exists():
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            data = []
    else:
        data = []

    data.append(entry)

    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)


# Endpoint: next participant code (robust)
@app.get("/next_code")
async def next_code():
    max_num = 0
    for f in DATA_DIR.glob("*.json"):
        try:
            num = int(f.stem)
            if num > max_num:
                max_num = num
        except ValueError:
            continue

    next_num = max_num + 1
    return {"code": f"{next_num:03d}"}


# Endpoint: suggestions
@app.post("/suggest")
async def suggest(data: SuggestRequest):
    try:
        prompt = f"""
        You are an assistant helping students write their Statement of Purpose.
        The user is currently writing the '{data.section}' section.
        Current text:
        {data.text}

        Based on this, suggest 2-3 sentences to continue, keeping it personal, relevant and professional.
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        )

        suggestion = response.choices[0].message.content.strip()
        return {"suggestion": suggestion}
    except Exception as e:
        return {"suggestion": f"Error: {str(e)}"}


# Endpoint: log suggestion events
@app.post("/log_suggestion")
async def log_suggestion(data: LogRequest):
    """
    Logs a pause where a suggestion was given.
    """
    section_word_count = len(data.textSnapshot.strip().split())

    log_entry = {
        "participantCode": data.participantCode,
        "section": data.section,
        "timestamp": data.timestamp,
        "sectionWordCount": section_word_count,
        "anonymous": data.anonymous,
    }

    append_to_master(SECTION_MASTER, log_entry)

    return {"status": "logged"}


# Endpoint: save participant data
@app.post("/save")
async def save_data(data: SaveRequest):
    """
    Saves final participant data and updates master files.
    """
    print("=== SAVE ENDPOINT CALLED ===")

    # Save participant-specific JSON file
    filename = DATA_DIR / f"{data.participantCode}.json"
    payload = data.dict()
    payload["timestamp"] = datetime.utcnow().isoformat()

    with open(filename, "w") as f:
        json.dump(payload, f, indent=2)

    # Append participant details
    participant_entry = {
        "participantCode": data.participantCode,
        "name": "" if data.anonymous else data.name,
        "ageGroup": "" if data.anonymous else data.ageGroup,
        "gender": "" if data.anonymous else data.gender,
        "anonymous": data.anonymous,
        "timestamp": datetime.utcnow().isoformat(),
    }
    append_to_master(PARTICIPANT_MASTER, participant_entry)

    # Append gaze data
    gaze_entry = {
        "participantCode": data.participantCode,
        "gazeData": data.gazeData,
    }
    append_to_master(GAZE_MASTER, gaze_entry)

    return {"status": "saved", "file": str(filename)}
