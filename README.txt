LEARNEX AI — OFFICIAL BUILD

FILES ARE INTENTIONALLY AT THE ROOT OF THE ZIP. No extra folder is required.

Required Render environment variable:
GEMINI_API_KEY = your Google Gemini API key
Optional:
GEMINI_MODEL = gemini-3.6-flash

Render:
Build command: npm install && npm run build
Start command: npm start

Brand assets:
icon-192.png / icon-512.png = the supplied Learnex AI logo image.
splash.png = the supplied Learnex AI loading/splash image.
No other logo/image asset is used.

The frontend sends chat history to /api/chat. The API key stays on the server and is never placed in browser code.
