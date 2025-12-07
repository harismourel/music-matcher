const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const mm = require("music-metadata");
const wav = require("node-wav");
const MusicTempo = require("music-tempo");
const Meyda = require("meyda");
const tmp = require("tmp");
const { exec } = require("child_process");

const app = express();
app.use(cors());

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

const LABELS = [
  { label: "Defected", genres: ["House", "Melodic House"] },
  { label: "Toolroom Records", genres: ["Tech House", "House"] },
  { label: "Hot Creations", genres: ["House", "Deep House"] },
];

// Convert to WAV
async function convertToWavIfNeeded(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return filePath;

  return new Promise((resolve, reject) => {
    const tmpFile = tmp.tmpNameSync({ postfix: ".wav" });
    exec(`ffmpeg -y -i "${filePath}" -ac 1 -ar 44100 "${tmpFile}"`, (err) => {
      if (err) return reject(err);
      resolve(tmpFile);
    });
  });
}

// Detect BPM
async function detectBPM(filePath) {
  try {
    const wavFile = await convertToWavIfNeeded(filePath);
    const buffer = await fsPromises.readFile(wavFile);
    const audioData = wav.decode(buffer);
    const channelData = audioData.channelData[0];
    const tempo = new MusicTempo(channelData);
    return Math.round(tempo.tempo);
  } catch (err) {
    console.warn("Could not detect BPM:", err);
    return null;
  }
}

// Extract audio features (for mood & instruments)
async function extractAudioFeatures(filePath) {
  try {
    const wavFile = await convertToWavIfNeeded(filePath);
    const buffer = await fsPromises.readFile(wavFile);
    const audioData = wav.decode(buffer);
    const signal = audioData.channelData[0];

    const bufferSize = 1024;
    const features = Meyda.extract(
      ["rms", "spectralCentroid", "mfcc"],
      signal.slice(0, bufferSize),
      { bufferSize, sampleRate: audioData.sampleRate }
    );

    if (!features) return null;

    const rms = features.rms ?? 0;
    const mfccMean = features.mfcc ? features.mfcc.reduce((a,b)=>a+b,0)/features.mfcc.length : 0;

    const mood = {
      Happy: mfccMean > 0 ? 0.7 : 0,
      Sad: mfccMean <= 0 ? 0.6 : 0,
      Energetic: rms > 0.05 ? 0.8 : 0,
      Calm: rms <= 0.05 ? 0.7 : 0
    };

    const instruments = ["piano", "drums", "guitar"]; // placeholder

    return { mood, instruments };
  } catch (err) {
    console.warn("Could not extract features:", err);
    return null;
  }
}

function detectGenre(metaGenre) {
  if (metaGenre && metaGenre.length) return metaGenre[0];
  return "Unknown";
}

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const metadata = await mm.parseFile(req.file.path);
    const title = metadata.common.title?.trim() || "Unknown Title";
    const genre = detectGenre(metadata.common.genre);
    const bpm = metadata.common.bpm ?? await detectBPM(req.file.path);
    const duration = metadata.format.duration ? Math.round(metadata.format.duration) : null;

    const audioFeatures = await extractAudioFeatures(req.file.path);
    const mood = audioFeatures?.mood || {};
    const instruments = audioFeatures?.instruments || [];

    const suggestedLabels = LABELS.map(l => ({
      label: l.label,
      match: l.genres.includes(genre) ? 80 : 0
    })).filter(l => l.match > 0);

    return res.json({
      filename: req.file.filename,
      title,
      metadata: { bpm, genre, duration },
      mood,
      instruments,
      suggestedLabels
    });
  } catch (err) {
    console.error("Metadata error:", err);
    return res.status(500).json({ error: "Failed to process track" });
  }
});

app.use("/uploads", express.static(UPLOADS_DIR));
app.listen(5000, () => console.log("Server running on port 5000"));
