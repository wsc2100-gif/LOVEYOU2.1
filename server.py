import http.server
import socketserver
import json
import urllib.request
import urllib.error
import os

# CONFIGURATION
PORT = 8000
# The API Key is stored here, server-side. It is NOT sent to the browser.
API_KEY = "AIzaSyDg3az32B3uvinRfGtphfU6Dzq9cMk4OVM" 

class TruthGuardHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/analyze':
            self.handle_analyze()
        else:
            self.send_error(404, "Not Found")

    def handle_analyze(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            # Parse the request from frontend
            request_json = json.loads(post_data.decode('utf-8'))
            user_text = request_json.get('text', '')

            if not user_text:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No text provided'}).encode('utf-8'))
                return

            # Construct the request to Google Gemini
            # We use the same prompt logic here or keep it in frontend?
            # Keeping prompt in frontend is more flexible for updates, but backend is more secure.
            # Ideally, the proxy just forwards the prompt content, but to be strictly secure 
            # and avoid "leaking" the key by simple proxying, we control the URL here.
            
            # For simplicity in this refactor, we accept the full "contents" body from frontend 
            # if we want transparency, OR we just accept "text" and build the prompt here.
            # Let's accept "text" and build the prompt here to keep the "fraud expert" instruction secure too.
            
            prompt = f"""
            You are a fraud detection expert. Analyze the following conversation text for signs of scams, social engineering, or phishing.
            
            Text to analyze:
            "{user_text}"
            
            Return ONLY a valid JSON object with the following structure (do not include markdown ticks):
            {{
                "riskScore": (integer 0-100, where 100 is definite scam),
                "riskLevel": (string, e.g., "Low", "Medium", "High", "Critical"),
                "category": (string, e.g., "Phishing", "Pig Butchering", "Emotional Blackmail", "Safe"),
                "summary": (string, a concise summary of why this is or isn't a scam, in Traditional Chinese),
                "anomalies": (array of strings, listing specific suspicious points in Traditional Chinese),
                "recommendations": (array of strings, advice for the user in Traditional Chinese)
            }}
            """

            gemini_url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}'
            
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            }

            req = urllib.request.Request(
                gemini_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )

            with urllib.request.urlopen(req) as response:
                response_data = response.read()
                
                # Forward the response back to the frontend
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"Error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

print(f"Starting TruthGuard Server at http://localhost:{PORT}")
print("Press Ctrl+C to stop.")

# Ensure we are in the script's directory so serving static files works correctly
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), TruthGuardHandler) as httpd:
    httpd.serve_forever()
