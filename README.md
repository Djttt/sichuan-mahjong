<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NYF6oKQyXXDbKsstjJFC59PGWXDGZs0j

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create Python venv and install backend deps:
   `python -m venv venv`
   `source venv/bin/activate`
   `pip install -r backend/requirements.txt`
3. Run the backend (LAN socket server):
   `python backend/app.py`
4. Run the app:
   `npm run dev`
