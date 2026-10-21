import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MedicineBankHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        # Clean URL route aliases matching GitHub Pages 404.html behavior
        if clean_path in ('/imagetool', '/imagetool/'):
            self.path = '/imagetool.html' + self.path[len(clean_path):]
        elif clean_path in ('/flash', '/flash/'):
            self.path = '/flash.html' + self.path[len(clean_path):]
        elif clean_path in ('/flashmake', '/flashmake/'):
            self.path = '/flashmake.html' + self.path[len(clean_path):]
        return super().do_GET()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(('127.0.0.1', PORT), MedicineBankHandler) as httpd:
            print(f"MedicineBank local server running at http://localhost:{PORT}")
            sys.stdout.flush()
            httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server on port {PORT}: {e}")
