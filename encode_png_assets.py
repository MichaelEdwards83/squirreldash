import base64
import os
import json

# Map logical names to filenames
ASSET_MAP = {
    "player_orig": "excavator.png",
    "squirrel_normal": "squirrel.png",
    "squirrel_vulnerable": "squirrel_vulnerable.png",
    "acorn": "acorn.png",
    "start_screen": "start_screen.png"
}

OUTPUT_FILE = "assets.js"

def encode_image(filename):
    with open(filename, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded_string}"

def main():
    assets = {}
    print("Encoding assets...")
    
    for key, filename in ASSET_MAP.items():
        if os.path.exists(filename):
            print(f"  Encoding {filename} as {key}...")
            assets[key] = encode_image(filename)
        else:
            print(f"  WARNING: {filename} not found!")

    # Generate JS content
    js_content = "window.ASSET_PATHS = " + json.dumps(assets, indent=4) + ";"
    
    with open(OUTPUT_FILE, "w") as f:
        f.write(js_content)
    
    print(f"Successfully wrote {len(assets)} assets to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
