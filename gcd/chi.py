import requests

image_path = r"E:\esg.jpg"
url = "https://ideal-snapper-42.rshare.io/predict"

with open(image_path, "rb") as image_file:
    response = requests.post(url, files={"file": image_file})

print(response.json())
