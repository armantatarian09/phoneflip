# PhoneFlip

PhoneFlip scores repairable phone listings by comparing asking price, likely repair cost, resale value, seller text, and risk keywords.

## Node.js deployment

This app now includes a simple Node.js server that serves the production build from `dist/`.

Run the following after installing dependencies:

```powershell
npm install
npm run build
npm start
```

Then open `http://localhost:3000`.

## Blocket Live Feed

Install the Python feed dependency:

```powershell
python -m pip install -r requirements.txt
```

Start the local Blocket feed:

```powershell
npm run blocket
```

In another terminal, start Vite with the Blocket endpoint:

```powershell
npm run dev:blocket
```

Open `http://127.0.0.1:5173/`.

The feed runs at `http://127.0.0.1:8787/deals` and supports optional query params:

```text
q=iphone sprucken
limit=20
pages=2
details=0
locations=STOCKHOLM,UPPSALA
```

By default the feed uses a fast focused iPhone damage search, checks at least six high-yield searches, skips slow per-ad detail requests, and stops waiting when enough candidates are found. For more seller text but slower imports, set `details=true` in the URL. For a broader but slower search, start it with:

```powershell
$env:PHONEFLIP_BLOCKET_QUERY_MODE="exhaustive"; npm run blocket
```
