import tkinter as tk
from tkinter import messagebox, simpledialog
import cv2
import pandas as pd
import os
from datetime import datetime
from ultralytics import YOLO
from PIL import Image, ImageTk

data_log = pd.DataFrame(columns=["Timestamp", "Prediction"])

# Resolve model paths relative to this script's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
CAPTURES_DIR = os.path.join(BASE_DIR, "captures")


class CylinderWeightClassifier:
    def __init__(self, root):
        self.root = root
        self.root.title("Gas Cylinder Weight Classification")
        self.root.configure(bg="#f7f7f7")

        self.main_frame = tk.Frame(root, bg="#f7f7f7")
        self.main_frame.pack(pady=20)

        self.header_label = tk.Label(
            self.main_frame,
            text="Gas Cylinder Weight Classification",
            bg="#f7f7f7",
            font=("Helvetica", 16, "bold"),
        )
        self.header_label.pack(pady=10)

        self.btn_frame = tk.Frame(self.main_frame, bg="#f7f7f7")
        self.btn_frame.pack(pady=20)

        self.btn_start = tk.Button(
            self.btn_frame, text="Start", command=self.start_system,
            bg="#4CAF50", fg="white", width=15, font=("Helvetica", 12),
        )
        self.btn_start.grid(row=0, column=0, padx=10, pady=10)

        self.btn_capture = tk.Button(
            self.btn_frame, text="Capture", command=self.capture_image,
            bg="#2196F3", fg="white", width=15, font=("Helvetica", 12),
        )
        self.btn_capture.grid(row=0, column=1, padx=10, pady=10)

        self.btn_wait = tk.Button(
            self.btn_frame, text="Wait", command=self.wait_for_input,
            bg="#FFC107", fg="black", width=15, font=("Helvetica", 12),
        )
        self.btn_wait.grid(row=1, column=0, padx=10, pady=10)

        self.btn_analyze = tk.Button(
            self.btn_frame, text="Analyze", command=self.analyze_data,
            bg="#FF5722", fg="white", width=15, font=("Helvetica", 12),
        )
        self.btn_analyze.grid(row=1, column=1, padx=10, pady=10)

        self.btn_stop = tk.Button(
            self.btn_frame, text="Stop", command=self.stop_system,
            bg="#f44336", fg="white", width=15, font=("Helvetica", 12),
        )
        self.btn_stop.grid(row=2, columnspan=2, pady=20)

        self.image_label = tk.Label(self.main_frame, bg="#f7f7f7")
        self.image_label.pack(pady=10)

        # Use relative paths from the models/ directory
        self.model_path = os.path.join(MODELS_DIR, "grayscale_text_detect_model.pt")
        self.digit_model_path = os.path.join(MODELS_DIR, "grayscale_digit_detect.pt")

        if not os.path.exists(self.model_path):
            messagebox.showerror("Error", f"Model not found: {self.model_path}")
            return
        if not os.path.exists(self.digit_model_path):
            messagebox.showerror("Error", f"Digit model not found: {self.digit_model_path}")
            return

        self.model = YOLO(self.model_path)
        self.digit_model = YOLO(self.digit_model_path)

    def start_system(self):
        messagebox.showinfo("Info", "System started.")

    def capture_image(self):
        cam = cv2.VideoCapture(0)
        if not cam.isOpened():
            messagebox.showerror("Error", "Could not open camera.")
            return

        ret, frame = cam.read()
        cam.release()

        if ret:
            # Save captures to the captures/ directory
            os.makedirs(CAPTURES_DIR, exist_ok=True)
            img_path = os.path.join(CAPTURES_DIR, "captured_image.jpg")
            cv2.imwrite(img_path, frame)
            self.display_image(img_path)
            self.process_img(img_path)
        else:
            messagebox.showerror("Error", "Image capture failed.")

    def wait_for_input(self):
        user_input = simpledialog.askstring("Input", "Enter manual input:")
        if user_input:
            messagebox.showinfo("Info", f"You entered: {user_input}")
        else:
            messagebox.showwarning("Warning", "No input provided.")

    def display_image(self, img_path):
        img = Image.open(img_path)
        img = img.resize((320, 240), Image.LANCZOS)
        img_tk = ImageTk.PhotoImage(img)
        self.image_label.configure(image=img_tk)
        self.image_label.image = img_tk

    def process_img(self, img_path):
        try:
            gray_img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if gray_img is None:
                messagebox.showerror("Error", "Image not found or cannot be read.")
                return

            gray_img = cv2.resize(gray_img, (640, 640))
            results = self.model(img_path)

            predictions = []
            cropped_imgs = []

            for result in results:
                boxes = result.boxes
                for box in boxes.xyxy:
                    x1, y1, x2, y2 = map(int, box)
                    # Clamp coordinates to image bounds
                    x1 = max(0, x1)
                    y1 = max(0, y1)
                    x2 = min(gray_img.shape[1], x2)
                    y2 = min(gray_img.shape[0], y2)
                    roi = gray_img[y1:y2, x1:x2]
                    if roi.size == 0:
                        continue
                    roi = cv2.resize(roi, (640, 640))
                    cropped_imgs.append(roi)

            temp_path = os.path.join(CAPTURES_DIR, "temp_cropped.jpg")
            for roi in cropped_imgs:
                cv2.imwrite(temp_path, roi)
                digit_results = self.digit_model(temp_path)
                self.extract_digits(digit_results, predictions)

            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

            if predictions:
                messagebox.showinfo("Prediction", f"Predictions: {predictions}")
                self.log_prediction(predictions)
            else:
                messagebox.showinfo("Prediction", "No predictions found.")

        except Exception as e:
            messagebox.showerror("Error", str(e))

    def extract_digits(self, digit_results, predictions):
        for digit_result in digit_results:
            digit_map = []
            d_boxes = digit_result.boxes
            for i in range(len(d_boxes)):
                # Store x-coordinate for left-to-right sorting, class id, and confidence
                x_coord = float(d_boxes[i].xyxy[0][0])
                digit_map.append((x_coord, int(d_boxes[i].cls), float(d_boxes[i].conf)))

            if digit_map:
                # Sort by x-coordinate (left to right) for correct digit ordering
                digit_map.sort(key=lambda x: x[0])
                prediction = ''.join(str(d[1]) for d in digit_map)
                predictions.append(prediction)

    def log_prediction(self, predictions):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        global data_log
        new_row = pd.DataFrame([{
            "Timestamp": timestamp,
            "Prediction": ', '.join(predictions),
        }])
        data_log = pd.concat([data_log, new_row], ignore_index=True)

    def analyze_data(self):
        if not data_log.empty:
            output_path = os.path.join(BASE_DIR, "predictions_log.xlsx")
            data_log.to_excel(output_path, index=False)
            messagebox.showinfo("Info", f"Logged predictions to {output_path}")
        else:
            messagebox.showwarning("Warning", "No predictions to log.")

    def stop_system(self):
        self.root.quit()


if __name__ == "__main__":
    app_root = tk.Tk()
    app = CylinderWeightClassifier(app_root)
    app_root.mainloop()