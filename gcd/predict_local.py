"""
Local YOLO inference script for the Electron app.
Called as a subprocess by main.js — receives an image path as argv[1],
runs text detection + digit classification, and prints the result as JSON to stdout.
"""
import sys
import json
import os

# Force CPU-only mode (avoids needing the 2GB CUDA torch)
os.environ["CUDA_VISIBLE_DEVICES"] = ""

import cv2
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

TEXT_MODEL_PATH = os.path.join(MODELS_DIR, "grayscale_text_detect_model.pt")
DIGIT_MODEL_PATH = os.path.join(MODELS_DIR, "grayscale_digit_detect.pt")

# Load models once at module level
_text_model = None
_digit_model = None


def get_models():
    """Load models lazily and cache them."""
    global _text_model, _digit_model
    if _text_model is None:
        _text_model = YOLO(TEXT_MODEL_PATH)
    if _digit_model is None:
        _digit_model = YOLO(DIGIT_MODEL_PATH)
    return _text_model, _digit_model


def predict(image_path):
    """Run the two-stage YOLO pipeline and return the predicted weight string."""
    if not os.path.exists(image_path):
        return {"error": f"Image not found: {image_path}"}

    if not os.path.exists(TEXT_MODEL_PATH):
        return {"error": f"Text model not found: {TEXT_MODEL_PATH}"}
    if not os.path.exists(DIGIT_MODEL_PATH):
        return {"error": f"Digit model not found: {DIGIT_MODEL_PATH}"}

    # Load models (cached after first call)
    text_model, digit_model = get_models()

    # Read and prepare image
    gray_img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if gray_img is None:
        return {"error": "Could not read image"}

    gray_img = cv2.resize(gray_img, (640, 640))

    # Stage 1: Detect text/label regions
    results = text_model(image_path, device="cpu", verbose=False)

    cropped_rois = []
    for result in results:
        for box in result.boxes.xyxy:
            x1, y1, x2, y2 = map(int, box)
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(gray_img.shape[1], x2)
            y2 = min(gray_img.shape[0], y2)
            roi = gray_img[y1:y2, x1:x2]
            if roi.size == 0:
                continue
            roi = cv2.resize(roi, (640, 640))
            cropped_rois.append(roi)

    # Stage 2: Classify digits in each ROI
    predictions = []
    temp_path = os.path.join(BASE_DIR, "captures", "_temp_roi.jpg")
    os.makedirs(os.path.dirname(temp_path), exist_ok=True)

    for roi in cropped_rois:
        cv2.imwrite(temp_path, roi)
        digit_results = digit_model(temp_path, device="cpu", verbose=False)

        for digit_result in digit_results:
            digit_map = []
            d_boxes = digit_result.boxes
            for i in range(len(d_boxes)):
                x_coord = float(d_boxes[i].xyxy[0][0])
                digit_map.append((x_coord, int(d_boxes[i].cls), float(d_boxes[i].conf)))

            if digit_map:
                # Sort left-to-right by x-coordinate
                digit_map.sort(key=lambda d: d[0])
                prediction = ''.join(str(d[1]) for d in digit_map)
                predictions.append(prediction)

    # Cleanup temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)

    if predictions:
        return {"prediction": ", ".join(predictions)}
    else:
        return {"prediction": "No weight detected"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    result = predict(sys.argv[1])
    print(json.dumps(result))
