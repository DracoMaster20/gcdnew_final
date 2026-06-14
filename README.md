# Gas Cylinder Weight Detection System

A Raspberry Pi-powered system that uses **YOLOv8 object detection** to read gas cylinder weight labels from a camera feed and log predictions to Excel. The project includes two interfaces:

- **Electron Desktop App** — A modern GUI (HTML/CSS/JS) that captures webcam frames, sends them to a remote YOLO inference server, and logs results.
- **Tkinter Desktop App** — A Python GUI that runs YOLO inference **locally** on the Raspberry Pi using `.pt` model weights.

---

## ⚡ Quick Start (Electron App)

```bash
git clone https://github.com/DracoMaster20/gcdnew_final.git
cd gcdnew_final/gcd
npm install
npm start
```

> **Note:** You must run `npm install` before starting the app to install all Node.js dependencies (Electron, Axios, ExcelJS, etc.).

## 📁 Project Structure

```
gcdnew_final/
└── gcd/
    ├── main.js              # Electron main process (IPC, API calls, Excel export)
    ├── preload.js           # Electron preload script (context bridge)
    ├── render.js            # Electron renderer (webcam, UI logic)
    ├── main.html            # Electron UI layout
    ├── summa.css            # Electron UI styles
    ├── package.json         # Node.js dependencies (Electron, Axios, ExcelJS)
    ├── tkinter_gas.py       # Standalone Tkinter + YOLO local inference app
    ├── chi.py               # Quick test script to hit the remote prediction API
    ├── models/
    │   ├── grayscale_text_detect_model.pt   # YOLO model – detects text regions
    │   └── grayscale_digit_detect.pt        # YOLO model – classifies digits
    ├── captures/            # Saved captured images (auto-created)
    ├── gacy.xlsx            # Sample/reference data
    └── weights.xlsx         # Weight reference data
```

---

## 🔧 Prerequisites

### For the Electron App (runs on any OS)
- [Node.js](https://nodejs.org/) v16 or later
- npm (comes with Node.js)
- A webcam

### For the Tkinter App (designed for Raspberry Pi)
- Python 3.8+
- A USB webcam or Raspberry Pi Camera Module
- The following Python packages:
  - `ultralytics` (YOLOv8)
  - `opencv-python`
  - `pandas`
  - `openpyxl`
  - `Pillow`
  - `tkinter` (pre-installed on most Linux/Raspberry Pi OS)

---

## 🚀 How to Run

### Option 1 — Electron Desktop App (Remote Inference)

This option sends captured images to a remote YOLO server at `https://ideal-snapper-42.rshare.io/predict`.

```bash
# 1. Navigate to the project directory
cd gcdnew_final/gcd

# 2. Install dependencies
npm install

# 3. Start the Electron app
npm start
```

**Usage:**
1. Click **Start** → grants webcam access and shows the live feed.
2. Click **Capture** → takes a snapshot and sends it to the remote model for prediction.
3. The prediction result is displayed on screen and logged internally.
4. Click **Wait** → manually enter a weight value if the camera can't read it.
5. Click **Analyze** → exports all logged predictions to a `.xlsx` Excel file.
6. Click **Stop** → releases the webcam and closes the app.

---

### Option 2 — Tkinter App (Local Inference on Raspberry Pi)

This option runs YOLO inference **locally** using the model weights in the `models/` directory.

```bash
# 1. Navigate to the project directory
cd gcdnew_final/gcd

# 2. Install Python dependencies
pip install ultralytics opencv-python pandas openpyxl Pillow

# 3. Run the Tkinter app
python tkinter_gas.py
```

> **Raspberry Pi specific:**
> If you're on Raspberry Pi OS, `tkinter` is pre-installed. If not:
> ```bash
> sudo apt-get install python3-tk
> ```

> **Camera setup on Raspberry Pi:**
> Make sure your camera is enabled via `sudo raspi-config` → Interface Options → Camera.
> For USB webcams, they should work out of the box with OpenCV's `VideoCapture(0)`.

**Usage:**
1. Click **Start** → displays a confirmation that the system is ready.
2. Click **Capture** → captures an image from the camera, runs YOLO text detection, then digit classification, and displays the predicted weight.
3. Click **Wait** → enter a manual weight value via a dialog box.
4. Click **Analyze** → exports all predictions to `predictions_log.xlsx`.
5. Click **Stop** → closes the application.

---

### Option 3 — Quick API Test

The `chi.py` script is a minimal test to verify the remote prediction server is reachable:

```bash
# Edit chi.py to point to a valid image path, then:
python chi.py
```

---

## 🧠 How It Works

### Detection Pipeline (Tkinter / Local)

```
Camera Frame
    │
    ▼
┌──────────────────────┐
│ grayscale_text_detect │  ← Detects text/label regions on the cylinder
│     _model.pt         │
└──────────┬───────────┘
           │ Cropped ROIs
           ▼
┌──────────────────────┐
│ grayscale_digit_     │  ← Classifies individual digits in each region
│   detect.pt          │
└──────────┬───────────┘
           │
           ▼
    Predicted Weight
    (e.g., "145")
```

1. A frame is captured from the camera and converted to grayscale.
2. The **text detection model** identifies bounding boxes around weight labels.
3. Each detected region is cropped, resized to 640×640, and passed to the **digit classification model**.
4. Detected digits are sorted left-to-right by x-coordinate and concatenated into the final weight prediction.
5. Results are logged with timestamps and can be exported to Excel.

### Electron App (Remote)

The Electron app captures a frame from the webcam as a base64-encoded JPEG, sends it via HTTP POST to the remote inference API, and displays the returned prediction.

---

## 📊 Data Export

Both apps export predictions to Excel (`.xlsx`) with the following columns:

| Column    | Description                          |
|-----------|--------------------------------------|
| Date      | Date of prediction                   |
| Time      | Time of prediction                   |
| Value     | Predicted weight or manual input     |

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'ultralytics'` | Run `pip install ultralytics` |
| Camera not detected | Check `sudo raspi-config` camera settings, or try `VideoCapture(1)` for a second camera |
| `Model not found` error in Tkinter app | Ensure `.pt` files are in the `gcd/models/` directory |
| Electron app shows no prediction | The remote server at `rshare.io` may be down — check network connectivity |
| `npm start` fails | Run `npm install` first, ensure Node.js v16+ is installed |
| Tkinter not found on Raspberry Pi | Run `sudo apt-get install python3-tk` |

---

## 📜 License

MIT — See [package.json](gcd/package.json) for details.

## 👤 Author

**Sudharshan**
