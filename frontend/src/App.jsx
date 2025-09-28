import { useState, useEffect } from "react";

export default function App() {
  const [participantCode, setParticipantCode] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");
  const [text, setText] = useState("");
  const [gazeData, setGazeData] = useState([]);
  const [inlineSuggestion, setInlineSuggestion] = useState("");
  const [completedSections, setCompletedSections] = useState({});
  const [overallWordCount, setOverallWordCount] = useState(0);

  const sectionLimits = {
    introduction: 150,
    background: 250,
    experience: 200,
    careerGoals: 200,
    conclusion: 120,
  };

  const detectSection = (txt) => {
    const lowerText = txt.toLowerCase();
    if (lowerText.includes("name") || lowerText.includes("i am") || lowerText.includes("introduce") || lowerText.includes("about me"))
      return "introduction";
    if (lowerText.includes("background") || lowerText.includes("bachelor") || lowerText.includes("education"))
      return "background";
    if (lowerText.includes("experience") || lowerText.includes("intern") || lowerText.includes("project"))
      return "experience";
    if (lowerText.includes("goal") || lowerText.includes("aim") || lowerText.includes("plan"))
      return "careerGoals";
    if (lowerText.includes("university") || lowerText.includes("program") || lowerText.includes("course"))
      return "conclusion";
    return "";
  };

  const countSectionWords = (fullText, sectionKey) => {
    const lowerText = fullText.toLowerCase();
    let endIndex = fullText.length;
    const markers = {
      introduction: ["background", "education", "bachelor"],
      background: ["experience", "intern", "project"],
      experience: ["goal", "aim", "plan"],
      careerGoals: ["university", "program", "course"],
      conclusion: [],
    };
    if (markers[sectionKey]) {
      for (let keyword of markers[sectionKey]) {
        const pos = lowerText.indexOf(keyword);
        if (pos !== -1) {
          endIndex = Math.min(endIndex, pos);
        }
      }
    }
    const sectionText = fullText.slice(0, endIndex);
    return sectionText.trim() ? sectionText.trim().split(/\s+/).length : 0;
  };

  const fetchNextCode = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/next_code");
      const data = await res.json();
      setParticipantCode(data.code);
    } catch (err) {
      console.error("Error fetching participant code:", err);
    }
  };

  useEffect(() => {
    fetchNextCode();
  }, []);

  useEffect(() => {
    let webgazerLib;
    import("webgazer")
      .then((module) => {
        const wg = module.default || module;
        webgazerLib = wg;
        wg.setRegression("ridge")
          .setGazeListener((data, timestamp) => {
            if (data) {
              setGazeData((prev) => [...prev, { x: data.x, y: data.y, t: timestamp }]);
            }
          })
          .begin();
        wg.showVideoPreview(false).showFaceOverlay(false).showFaceFeedbackBox(false);
      })
      .catch((err) => console.error("WebGazer failed to load", err));

    return () => {
      if (webgazerLib) webgazerLib.end();
    };
  }, []);

  useEffect(() => {
    const totalWords = text.trim() ? text.trim().split(/\s+/).length : 0;
    setOverallWordCount(totalWords);

    if (!text.trim()) {
      setInlineSuggestion("");
      return;
    }

    const timer = setTimeout(async () => {
      const selectedKey = detectSection(text);
      if (!selectedKey) {
        setInlineSuggestion("");
        return;
      }

      const currentWords = countSectionWords(text, selectedKey);
      const limit = sectionLimits[selectedKey] || 150;

      if (completedSections[selectedKey]) {
        setInlineSuggestion("");
        return;
      }

      if (currentWords >= limit) {
        setCompletedSections((prev) => ({ ...prev, [selectedKey]: true }));
        setInlineSuggestion("");
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: selectedKey, text }),
        });
        const data = await res.json();
        setInlineSuggestion(data.suggestion);

        await fetch("http://127.0.0.1:8000/log_suggestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantCode,
            section: selectedKey,
            textSnapshot: text,
            timestamp: new Date().toISOString(),
            anonymous,
          }),
        });
      } catch (error) {
        console.error("Error fetching suggestion or logging:", error);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [text, completedSections]);

  const handleSave = async () => {
    try {
      const payload = {
        participantCode,
        name: anonymous ? "" : name,
        ageGroup: anonymous ? "" : ageGroup,
        gender: anonymous ? "" : gender,
        text,
        gazeData,
        anonymous,
      };

      const response = await fetch("http://127.0.0.1:8000/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Saved:", result);
      alert("Final data saved for analysis");

      setAnonymous(false);
      setName("");
      setAgeGroup("");
      setGender("");
      setText("");
      setGazeData([]);
      setInlineSuggestion("");
      setCompletedSections({});
      setOverallWordCount(0);

      fetchNextCode();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-gray-50 to-blue-50">
      {/* Centered single column container */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col">
        <h1 className="text-2xl font-bold text-center mb-6 text-blue-700">
          Context-Aware SOP Writing Assistant
        </h1>

        <div className="space-y-4 mb-4">
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={anonymous}
            className="w-full p-2 border border-gray-400 rounded bg-gray-200 text-gray-900"
          />

          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            disabled={anonymous}
            className="w-full p-2 border border-gray-400 rounded bg-gray-200 text-gray-900"
          >
            <option value="">Select Age Group</option>
            <option value="18-25">18-25</option>
            <option value="26-35">26-35</option>
            <option value="36-45">36-45</option>
            <option value="46+">46+</option>
          </select>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            disabled={anonymous}
            className="w-full p-2 border border-gray-400 rounded bg-gray-200 text-gray-900"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <label className="text-gray-700">Participate Anonymously</label>
          </div>
        </div>

        <textarea
          className="w-full h-48 p-3 border border-gray-400 rounded bg-gray-200 text-gray-900 resize-none"
          placeholder="Start typing your SOP here..."
          value={text}
          onChange={(e) => {
            const newText = e.target.value;
            setText(newText);
            setInlineSuggestion("");
            const sectionKey = detectSection(newText);
            if (sectionKey && newText.split(/\s+/).length < 100) {
              setCompletedSections((prev) => ({ ...prev, [sectionKey]: false }));
            }
          }}
        />

        <div className="mt-2 text-gray-600 text-sm">
          Overall word count: {overallWordCount}/1200
        </div>

        {inlineSuggestion && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded">
            <strong className="block text-blue-800 mb-2">Suggestion:</strong>
            <p className="text-blue-700">{inlineSuggestion}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow transition"
        >
          Save and Finish
        </button>
      </div>
    </div>
  );
}
