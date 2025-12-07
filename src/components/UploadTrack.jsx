import React, { useState } from "react";
import "./UploadTrack.scss";

function UploadTrack() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      alert("Παρακαλώ ανέβασε μόνο mp3 ή wav");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedFile(data);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      alert("Σφάλμα στο upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container p-4 border rounded">
      <h2>Upload & Analyze Your Track</h2>

      <input type="file" accept="audio/*" onChange={handleFileChange} />

      {selectedFile && (
        <div className="fileBox">
          <p><strong>Επιλεγμένο:</strong> {selectedFile.name}</p>
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Analyzing..." : "Ανάλυση Track"}
          </button>
        </div>
      )}

      {uploadedFile && (
        <div className="fileBox" style={{ marginTop: "20px" }}>
          <p><strong>Title:</strong> {uploadedFile.title}</p>
          <audio controls style={{ width: "100%", marginTop: "15px" }}>
            <source src={`http://localhost:5000/uploads/${uploadedFile.filename}`} type="audio/mpeg" />
          </audio>

          <h4>Metadata</h4>
          <ul>
            <li><strong>BPM:</strong> {uploadedFile.metadata?.bpm ?? "N/A"}</li>
            <li><strong>Genre:</strong> {uploadedFile.metadata?.genre ?? "Unknown"}</li>
            <li><strong>Duration:</strong> {uploadedFile.metadata?.duration ?? "N/A"}s</li>
          </ul>

          <h4>Mood</h4>
          <ul>
            {uploadedFile.mood && Object.entries(uploadedFile.mood).map(([k,v]) => (
              <li key={k}><strong>{k}:</strong> {v}</li>
            ))}
          </ul>

          <h4>Instruments</h4>
          <p>{uploadedFile.instruments.join(", ")}</p>

          <h4>Suggested Labels</h4>
          {uploadedFile.suggestedLabels?.length > 0 ? (
            uploadedFile.suggestedLabels.map((l,i) => (
              <div key={i} style={{ marginBottom: "10px" }}>
                <span>{l.label} - {l.match}% match</span>
              </div>
            ))
          ) : (<p>No matching labels found.</p>)}
        </div>
      )}
    </div>
  );
}

export default UploadTrack;
