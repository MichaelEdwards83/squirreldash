import re

with open('index.html', 'r') as f:
    content = f.read()

# Regex to capture the ASSET_PATHS object
match = re.search(r'const ASSET_PATHS = \{([\s\S]*?)\};', content)

if match:
    assets_block = match.group(1)
    
    # Create assets.js content
    assets_js_content = f"const ASSET_PATHS = {{{assets_block}}};\n"
    
    with open('assets.js', 'w') as f:
        f.write(assets_js_content)
    print("Successfully extracted assets to assets.js")
else:
    print("Could not find ASSET_PATHS in index.html")
