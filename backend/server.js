const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mm = require("music-metadata");
const fsPromises = require("fs/promises");
const wav = require("node-wav");
const MusicTempo = require("music-tempo");
const { exec } = require("child_process");
const tmp = require("tmp");

const app = express();
app.use(cors());

// Φάκελος uploads
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Labels (παραμένουν ίδια)
const LABELS = [
  { label: "Defected", genres: ["House", "Melodic House"] },
  { label: "Toolroom Records", genres: ["Tech House", "House"] },
  { label: "Hot Creations", genres: ["House", "Deep House"] },
];

// Fallback genre
function detectGenre(metaGenre) {
  if (metaGenre && metaGenre !== "Unknown Genre") return metaGenre;
  const genres = ["House", "Tech House", "Melodic House", "Deep House"];
  return genres[Math.floor(Math.random() * genres.length)];
}

// Μετατροπή σε WAV PCM μόνο αν δεν είναι WAV
async function convertToWavIfNeeded(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return filePath; // αν είναι WAV, δεν κάνουμε τίποτα

  return new Promise((resolve, reject) => {
    const tmpFile = tmp.tmpNameSync({ postfix: ".wav" });
    exec(`ffmpeg -y -i "${filePath}" -ac 1 -ar 44100 "${tmpFile}"`, (err) => {
      if (err) return reject(err);
      resolve(tmpFile);
    });
  });
}

// Υπολογισμός BPM
async function detectBPM(filePath) {
  try {
    const wavFile = await convertToWavIfNeeded(filePath);
    const buffer = await fsPromises.readFile(wavFile);
    const audioData = wav.decode(buffer);
    const channelData = audioData.channelData[0];
    const tempo = new MusicTempo(channelData);
    return Math.round(tempo.tempo);
  } catch (err) {
    console.warn("Could not detect BPM from audio:", err);
    return null;
  }
}

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const metadata = await mm.parseFile(req.file.path);
    const title = metadata.common.title?.trim() || "Unknown Title";
    const metaGenre = metadata.common.genre?.[0] || null;

    // BPM
    let bpm = metadata.common.bpm;
    if (!bpm) bpm = await detectBPM(req.file.path);

    // Genre
    const genre = detectGenre(metaGenre);

    // Duration
    const duration = metadata.format.duration ? Math.round(metadata.format.duration) : null;

    // Suggested labels
    const suggestedLabels = LABELS.map((l) => {
      let match = 0;
      if (l.genres.includes(genre)) match += 80;
      return { label: l.label, match };
    })
      .filter((l) => l.match > 0)
      .sort((a, b) => b.match - a.match);

    return res.json({
      filename: req.file.filename,
      title,
      metadata: { bpm, genre, duration },
      suggestedLabels,
    });
  } catch (err) {
    console.error("Metadata error:", err);
    return res.status(500).json({ error: "Failed to process track" });
  }
});

// Serve uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

