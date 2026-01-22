import os

assets = {
    'player_orig': 'excavator.b64',
    'squirrel_normal': 'squirrel.b64',
    'squirrel_vulnerable': 'squirrel_vulnerable.b64',
    'acorn': 'acorn.b64',
    'start_screen': 'start_screen.b64'
}

placeholders = {
    'player_orig': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iI2Y3OWYwMCIvPjxwb2x5Z29uIHBvaW50cz0iMzAsNjAgNzAsNjAgNTAsMjAiIGZpbGw9IiMwMDRjY2YiLz48L3N2Zz4=",
    'squirrel_normal': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iIzgyNTUwMCIvPjxjaXJjbGUgY3g9IjM1IiBjeT0iNDAiIHI9IjUiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iNjUiIGN5PSI0MCIgcj0iNSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
    'squirrel_vulnerable': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iI2ZmNGE0YyIvPjxjaXJjbGUgY3g9IjM1IiBjeT0iNDAiIHI9IjUiIGZpbGw9ImJsYWNrIi8+PGNpcmNsZSBjeD0iNjUiIGN5PSI0MCIgcj0iNSIgZmlsbD0iYmxhY2siLz48L3N2Zz4=",
    'acorn': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAsMTBMMTAsOTBoODBMMTAsOTBWMTAiIGZpbGw9IiM4YjQ1MTMiLz48L3N2Zz4=",
    'start_screen': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzE0MTQyZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPkxPTkwgU1VSVkJWQkUgU1BSSU5UIDwvdGV4dD48dGV4dCB4PSI1MCIgeT0iNzAiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNGRkQ3MDAiPlBBU1RFIElNIEJBU0U2NCBUTyBXUks8L3R0dD48L3N2Zz4g"
}

with open('index.html', 'r') as f:
    content = f.read()

count = 0
for key, filename in assets.items():
    if not os.path.exists(filename):
        print(f"Warning: {filename} not found")
        continue
        
    with open(filename, 'r') as f:
        b64_data = f.read().replace('\n', '').strip()
        
    if key in placeholders:
        placeholder = placeholders[key]
        new_uri = f'data:image/svg+xml;base64,{b64_data}'
        if placeholder in content:
            content = content.replace(placeholder, new_uri)
            print(f"Replaced {key}")
            count += 1
        else:
            print(f"Placeholder for {key} not found in content")

with open('index.html', 'w') as f:
    f.write(content)

print(f"Total replacements: {count}")
