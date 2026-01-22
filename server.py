
import http.server
import socketserver
import json
import os

PORT = 8086
SCORE_FILE = 'highscores.json'

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/scores':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                if os.path.exists(SCORE_FILE):
                    with open(SCORE_FILE, 'r') as f:
                        self.wfile.write(f.read().encode())
                else:
                    self.wfile.write(b'[]')
            except Exception as e:
                print(f"Error reading scores: {e}")
                self.wfile.write(b'[]')
        else:
            # Add cache control headers for static files to prevent caching issues during dev
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/scores':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                new_score = json.loads(post_data.decode())
                
                # Read existing scores
                scores = []
                if os.path.exists(SCORE_FILE):
                    with open(SCORE_FILE, 'r') as f:
                        try:
                            scores = json.load(f)
                        except json.JSONDecodeError:
                            scores = []
                
                # Add new score
                scores.append(new_score)
                
                # Sort descending
                scores.sort(key=lambda x: x['score'], reverse=True)
                
                # Keep top 10
                scores = scores[:10]
                
                # Save back to file
                with open(SCORE_FILE, 'w') as f:
                    json.dump(scores, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "scores": scores}).encode())
                
            except Exception as e:
                print(f"Error saving score: {e}")
                self.send_response(500)
                self.end_headers()
        else:
            self.send_error(404)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

print(f"Starting Squirrel Dash Server at http://localhost:{PORT}")
print("Press Ctrl+C to stop")

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
