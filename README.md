# Step 1: Create a virtual environment
python3 -m venv .venv

# Step 2: Activate it
# Linux / macOS:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Step 3: Install dependencies
pip install -r requirements.txt

# Step 4: Start the server (Terminal 1)
python server.py

# Step 5: Run the scraper (Terminal 2)
python nse_cas_scraper.py

# Step 6: Run the separate SENSEX scraper (Terminal 3)
python sensex_scraper.py

# NIFTY 50 is fetched continuously every 5 seconds.
# The dashboard refreshes the live quote every 2 seconds.
# Direct quote endpoint: http://127.0.0.1:8000/api/nifty50
# Select NSE / NIFTY 50 or BSE / SENSEX from the dashboard dropdown.
