from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, as_completed, wait
import json
import os
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
DEFAULT_LIMIT = 40
MAX_IMPORT_LIMIT = 1000
MAX_SEARCH_PAGES = 50
MAX_CANDIDATES = 8000
DEFAULT_MAX_PRICE = int(os.environ.get("PHONEFLIP_BLOCKET_MAX_PRICE", "2500"))
CACHE_SECONDS = int(os.environ.get("PHONEFLIP_BLOCKET_CACHE_SECONDS", "300"))
SEARCH_CACHE_SECONDS = int(os.environ.get("PHONEFLIP_BLOCKET_SEARCH_CACHE_SECONDS", "300"))
DETAIL_CACHE_SECONDS = int(os.environ.get("PHONEFLIP_BLOCKET_DETAIL_CACHE_SECONDS", "1800"))
DEFAULT_SEARCH_WORKERS = max(1, min(16, int(os.environ.get("PHONEFLIP_BLOCKET_SEARCH_WORKERS", "12"))))
DEFAULT_DETAIL_WORKERS = max(1, min(24, int(os.environ.get("PHONEFLIP_BLOCKET_DETAIL_WORKERS", "16"))))
DEFAULT_CANDIDATE_MULTIPLIER = max(1, int(os.environ.get("PHONEFLIP_BLOCKET_CANDIDATE_MULTIPLIER", "2")))
DEFAULT_MIN_SEARCH_COMPLETIONS = max(1, min(16, int(os.environ.get("PHONEFLIP_BLOCKET_MIN_SEARCHES", "6"))))
DETAIL_FETCH_PAUSE = max(0.0, float(os.environ.get("PHONEFLIP_BLOCKET_DETAIL_PAUSE", "0")))
REQUEST_TIMEOUT_SECONDS = max(1.5, float(os.environ.get("PHONEFLIP_BLOCKET_TIMEOUT_SECONDS", "4")))
LEGACY_MULTI_BRAND_QUERIES = [
    "iphone trasig",
    "iphone sprucken",
    "iphone defekt",
    "iphone skadad",
    "iphone reservdelar",
    "iphone startar inte",
    "iphone laddar inte",
    "samsung trasig",
    "samsung defekt",
    "samsung sprucken",
    "samsung skadad",
    "galaxy trasig",
    "galaxy defekt",
    "pixel trasig",
    "oneplus trasig",
    "xiaomi trasig",
    "billig trasig mobil",
    "mobil sprucken",
    "mobil defekt",
    "mobil skadad",
    "mobil reservdelar",
    "mobil startar inte",
    "mobil laddar inte",
    "sprucken skärm mobil",
    "telefon reservdelar",
    "telefon trasig",
    "telefon defekt",
    "reparationsobjekt mobil",
]
IPHONE_DAMAGE_QUERIES = [
    "trasig",
    "trasiga",
    "defekt",
    "defekta",
    "skadad",
    "skadade",
    "sprucken",
    "spricka",
    "sprickor",
    "sprucket glas",
    "sprucken skärm",
    "skärmen sprucken",
    "krossad skärm",
    "krossat glas",
    "trasig skärm",
    "skärm trasig",
    "skärmproblem",
    "displayproblem",
    "display trasig",
    "trasig display",
    "touch fungerar inte",
    "touch defekt",
    "ghost touch",
    "svart skärm",
    "grön skärm",
    "linjer i skärmen",
    "rand i skärmen",
    "döda pixlar",
    "baksida sprucken",
    "bakglas sprucket",
    "baksida trasig",
    "frontglas",
    "laddar inte",
    "tar inte laddning",
    "laddproblem",
    "laddport",
    "laddkontakt",
    "ladduttag",
    "batteriproblem",
    "dåligt batteri",
    "batteri dåligt",
    "batterihälsa",
    "service batteri",
    "startar inte",
    "går inte igång",
    "död",
    "no power",
    "bootloop",
    "fastnar på äpplet",
    "fastnar på logga",
    "äppellogo",
    "recovery mode",
    "dfu",
    "vattenskadad",
    "vattenskada",
    "fuktskada",
    "fuktskadad",
    "liquid damage",
    "water damage",
    "iCloud låst",
    "icloudlåst",
    "aktiveringslås",
    "activation lock",
    "låst",
    "kodlåst",
    "lösenkod",
    "glömt kod",
    "avaktiverad",
    "operatörslåst",
    "simlåst",
    "locked",
    "passcode locked",
    "Face ID fungerar inte",
    "Face ID defekt",
    "Face ID trasig",
    "faceid",
    "kamera trasig",
    "kameraproblem",
    "högtalare trasig",
    "mikrofon trasig",
    "wifi fungerar inte",
    "bluetooth fungerar inte",
    "ingen service",
    "ingen täckning",
    "baseband",
    "moderkort",
    "moderkortsproblem",
    "kretskort",
    "reservdelar",
    "reservdel",
    "endast delar",
    "parts only",
    "parts",
    "reparationsobjekt",
    "repair object",
    "rep objekt",
    "renoveringsobjekt",
    "ej fungerande",
    "fungerar ej",
    "fungerar inte",
    "not working",
    "broken",
    "cracked",
    "cracked screen",
    "damaged",
    "defective",
]
IPHONE_MODEL_QUERIES = [
    "iphone se",
    "iphone se 2020",
    "iphone se 2022",
    "iphone 8",
    "iphone x",
    "iphone xr",
    "iphone xs",
    "iphone xs max",
    "iphone 11",
    "iphone 11 pro",
    "iphone 11 pro max",
    "iphone 12",
    "iphone 12 mini",
    "iphone 12 pro",
    "iphone 12 pro max",
    "iphone 13",
    "iphone 13 mini",
    "iphone 13 pro",
    "iphone 13 pro max",
    "iphone 14",
    "iphone 14 plus",
    "iphone 14 pro",
    "iphone 14 pro max",
    "iphone 15",
    "iphone 15 plus",
    "iphone 15 pro",
    "iphone 15 pro max",
    "iphone 16",
    "iphone 16 plus",
    "iphone 16 pro",
    "iphone 16 pro max",
]
HIGH_YIELD_DAMAGE_TERMS = [
    "trasig",
    "defekt",
    "skadad",
    "sprucken",
    "sprucken skärm",
    "displayproblem",
    "baksida sprucken",
    "laddar inte",
    "batteriproblem",
    "startar inte",
    "iCloud låst",
    "låst",
    "vattenskadad",
    "reservdelar",
    "reparationsobjekt",
]
EXHAUSTIVE_QUERIES = list(dict.fromkeys(
    ["iphone", "i phone", "iphon", "iphone säljes", "iphone billigt", "billig iphone"]
    + [f"iphone {term}" for term in IPHONE_DAMAGE_QUERIES]
    + [f"{model} {term}" for model in IPHONE_MODEL_QUERIES for term in HIGH_YIELD_DAMAGE_TERMS]
))
FAST_DEFAULT_QUERIES = list(dict.fromkeys(
    [
        "iphone trasig",
        "iphone sprucken",
        "iphone defekt",
        "iphone skadad",
        "iphone laddar inte",
        "iphone startar inte",
        "iphone batteriproblem",
        "iphone baksida sprucken",
        "iphone reservdelar",
        "iphone reparationsobjekt",
    ]
))
BROAD_BACKFILL_QUERIES = list(dict.fromkeys(
    [
        "iphone",
        "iphone billigt",
        "iphone säljes",
        "iphone se",
        "iphone xr",
        "iphone xs",
        "iphone 11",
        "iphone 11 pro",
        "iphone 12",
        "iphone 12 mini",
        "iphone 12 pro",
        "iphone 13",
        "iphone 13 mini",
        "iphone 13 pro",
        "iphone 14",
        "iphone 14 pro",
        "iphone 15",
        "iphone 15 pro",
        "iphone 16",
        "iphone 16 pro",
    ]
))
DEFAULT_QUERIES = (
    EXHAUSTIVE_QUERIES
    if os.environ.get("PHONEFLIP_BLOCKET_QUERY_MODE", "fast").strip().lower() == "exhaustive"
    else FAST_DEFAULT_QUERIES
)
PHONE_BRANDS = ["Apple"]
BLOCKET_API_BASE = os.environ.get("PHONEFLIP_BLOCKET_API_BASE", "https://blocket-api.se")
USER_AGENT = os.environ.get(
    "PHONEFLIP_USER_AGENT",
    "PhoneFlip/0.1 local development (contact: local)",
)
CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
SEARCH_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
DETAIL_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
CACHE_LOCK = threading.Lock()
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

MODEL_PATTERN = re.compile(
    r"(iphone\s?(?:se(?:\s?\d{4})?|x(?:r|s(?:\s?max)?)?|\d{1,2}(?:\s?(?:pro|max|mini|plus|promax))?))",
    re.IGNORECASE,
)
REPAIRABLE_PATTERN = re.compile(
    r"(trasig|trasiga|defekt|defekta|sprucken|skadad|skadade|displayproblem|skärmproblem"
    r"|face id.{0,40}(?:fungerar inte|defekt|trasig)"
    r"|(?:fungerar inte|defekt|trasig).{0,40}face id"
    r"|laddar inte|laddport|laddproblem|batteriproblem|vattenskad|icloud"
    r"|(?<![a-zåäö])låst(?![a-zåäö])"
    r"|reservdel|reparationsobjekt|rep objekt|ej fungerande|fungerar inte|startar inte"
    r"|broken|cracked|damaged|water|(?<![a-z])locked(?![a-z])|parts|repair object)",
    re.IGNORECASE,
)
NEGATIVE_DAMAGE_PATTERN = re.compile(
    r"(utan\s+(?:sprickor?|skador?)|inga\s+(?:sprickor?|skador?)"
    r"|ingen\s+(?:sprucken|trasig|skadad)"
    r"|inte\s+(?:sprucken|trasig|skadad)|ej\s+(?:sprucken|trasig|skadad)"
    r"|skärmen\s+är\s+hel|skarm[ea]n\s+ar\s+hel)",
    re.IGNORECASE,
)
IPHONE_EXTRA_REPAIR_PATTERN = re.compile(
    r"(spricka|sprickor|krossad|krossat|glas|bakglas|frontglas|touch|ghost touch"
    r"|svart skärm|grön skärm|linjer|rand|pixlar|batterihälsa|service batteri"
    r"|går inte igång|död|no power|bootloop|äppel|logga|recovery|dfu"
    r"|fuktskada|fuktskadad|liquid damage|activation lock|kodlåst|lösenkod|glömt kod"
    r"|avaktiverad|operatörslåst|simlåst|passcode|faceid|kamera|kameraproblem"
    r"|högtalare|mikrofon|wifi|bluetooth|ingen service|ingen täckning|baseband"
    r"|moderkort|moderkortsproblem|kretskort|renoveringsobjekt)",
    re.IGNORECASE,
)
ACCESSORY_PATTERN = re.compile(
    r"(mobilskal|telefonskal|telefonfodral|pl[aÃ¥]nboksfodral|fodral|case|cover"
    r"|sk[aÃ¤]rmskydd|screen protector|tempered glass|h[aÃ¤]rdat glas"
    r"|laddare|charger|laddkabel|kabel|adapter|magsafe|powerbank"
    r"|mobilh[aÃ¥]llare|bilh[aÃ¥]llare|h[aÃ¥]llare|mount|stativ|tripod|gimbal"
    r"|selfiepinne|ring light|mikrofon|microphone|objektiv|lens"
    r"|videokit|video kit|mobile video kit|smallrig|rig|kamerarig|airpods|h[oÃ¶]rlurar|headset)",
    re.IGNORECASE,
)
ACCESSORY_CONTEXT_PATTERN = re.compile(
    r"((?:till|f[oÃ¶]r|passar|kompatibel|compatible|for).{0,45}(?:iphone|apple)"
    r"|(?:iphone|apple).{0,45}(?:skal|fodral|case|cover|sk[aÃ¤]rmskydd|videokit|video kit|smallrig|rig|kit))",
    re.IGNORECASE,
)


def main() -> None:
    host = os.environ.get("PHONEFLIP_BLOCKET_HOST", DEFAULT_HOST)
    port = int(os.environ.get("PHONEFLIP_BLOCKET_PORT", DEFAULT_PORT))
    server = ThreadingHTTPServer((host, port), BlocketFeedHandler)
    print(f"Blocket feed listening on http://{host}:{port}/deals", flush=True)
    print(
        "Using blocket-api.se REST endpoints. Confirm this data source is acceptable "
        "for your use case before using it beyond local testing.",
        flush=True,
    )
    server.serve_forever()


class BlocketFeedHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_empty(204)

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)

        if parsed_url.path == "/health":
            self.send_json({"ok": True, "source": "Blocket REST feed"})
            return

        if parsed_url.path == "/import/blocket/start":
            self.start_blocket_import(parsed_url.query)
            return

        if parsed_url.path == "/import/blocket/estimate":
            self.send_import_estimate(parsed_url.query)
            return

        if parsed_url.path == "/import/blocket/status":
            self.send_import_status(parsed_url.query)
            return

        if parsed_url.path != "/deals":
            self.send_json({"error": "Use /deals"}, status=404)
            return

        try:
            cached_payload = get_cached_payload(parsed_url.query)
            if cached_payload:
                self.send_json(cached_payload)
                return

            params = parse_qs(parsed_url.query)
            deals = load_deals(params)
            payload = {"deals": deals, "source": "Blocket", "count": len(deals)}
            set_cached_payload(parsed_url.query, payload)
            self.send_json(payload)
        except Exception as error:  # noqa: BLE001 - local feed should be debuggable in browser
            self.send_json({"error": str(error), "deals": []}, status=502)

    def start_blocket_import(self, query: str) -> None:
        params = parse_qs(query)
        job_id = str(uuid.uuid4())
        cache_key = urlencode(params, doseq=True)
        cached_payload = get_cached_payload(cache_key)
        plan = get_import_plan(params)

        with JOBS_LOCK:
            JOBS[job_id] = {
                "id": job_id,
                "status": "running",
                "percent": 0,
                "message": "Startar Blocket-import",
                "count": 0,
                "progressPhase": "start",
                "progressTotal": plan["limit"],
                "deals": [],
                "startedAt": time.time(),
                "requestedLimit": plan["limit"],
                "estimatedSeconds": plan["estimatedSeconds"],
                "remainingSeconds": plan["estimatedSeconds"],
                "plan": plan,
            }

        if cached_payload:
            update_job(
                job_id,
                status="done",
                percent=100,
                message=f"Import klar från cache: {cached_payload.get('count', 0)} annonser.",
                count=cached_payload.get("count", 0),
                progressPhase="done",
                progressTotal=plan["limit"],
                deals=cached_payload.get("deals", []),
                remainingSeconds=0,
            )
        else:
            thread = threading.Thread(
                target=run_blocket_import_job,
                args=(job_id, params, cache_key),
                daemon=True,
            )
            thread.start()

        with JOBS_LOCK:
            job = dict(JOBS.get(job_id, {}))
        self.send_json(enrich_job_status(job))

    def send_import_estimate(self, query: str) -> None:
        params = parse_qs(query)
        self.send_json(public_import_plan(get_import_plan(params)))

    def send_import_status(self, query: str) -> None:
        params = parse_qs(query)
        job_id = first_param(params, "id") or first_param(params, "jobId")

        with JOBS_LOCK:
            job = dict(JOBS.get(job_id or "", {}))

        if not job:
            self.send_json({"error": "Importjob saknas eller har gått ut."}, status=404)
            return

        self.send_json(enrich_job_status(job))

    def send_empty(self, status: int) -> None:
        self.send_response(status)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[blocket-feed] {self.address_string()} - {format % args}", flush=True)


def load_deals_legacy(
    params: dict[str, list[str]],
    progress_callback: Any | None = None,
) -> list[dict[str, Any]]:
    queries = get_queries(params)
    limit = get_int_param(params, "limit", DEFAULT_LIMIT, minimum=1, maximum=80)
    max_price = get_int_param(params, "max_price", DEFAULT_MAX_PRICE, minimum=1, maximum=20000)
    pages = get_int_param(params, "pages", 1, minimum=1, maximum=5)
    include_details = get_bool_param(params, "details", True)
    total_searches = max(1, len(queries) * pages)
    search_index = 0

    deals: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for query in queries:
        for page in range(1, pages + 1):
            search_index += 1
            report_progress(
                progress_callback,
                min(42, round((search_index - 1) / total_searches * 42)),
                f"Söker Blocket: {query}, sida {page}",
                len(deals),
                phase="deals",
                total=limit,
            )
            response = request_json(
                "/v1/search",
                {
                    "query": query,
                    "page": page,
                    "sort_order": "PUBLISHED_DESC",
                },
            )
            docs = response.get("docs", [])
            report_progress(
                progress_callback,
                min(48, round(search_index / total_searches * 48)),
                f"Läser {len(docs)} träffar för {query}",
                len(deals),
                phase="deals",
                total=limit,
            )

            for doc in docs:
                ad_id = str(doc.get("ad_id") or doc.get("id") or "")
                if not ad_id or ad_id in seen_ids:
                    continue

                if not is_sellable_phone_doc(doc):
                    continue
                if get_price(doc) > max_price:
                    continue

                seen_ids.add(ad_id)
                deal = doc_to_deal(doc, include_details)
                if deal.get("askingPrice", 0) > max_price:
                    continue

                if include_details and not looks_repairable_deal(deal):
                    continue

                deals.append(deal)
                report_progress(
                    progress_callback,
                    min(96, 48 + round((len(deals) / max(1, limit)) * 48)),
                    f"Importerar skadade billiga telefoner: {len(deals)}/{limit}",
                    len(deals),
                    phase="details",
                    total=limit,
                )

                if len(deals) >= limit:
                    report_progress(
                        progress_callback,
                        100,
                        f"Import klar: {len(deals)} annonser.",
                        len(deals),
                        phase="done",
                        total=limit,
                    )
                    return deals

    report_progress(
        progress_callback,
        100,
        f"Import klar: {len(deals)} annonser.",
        len(deals),
        phase="done",
        total=limit,
    )
    return deals


def get_import_plan(params: dict[str, list[str]]) -> dict[str, Any]:
    queries = get_queries(params)
    limit = get_int_param(params, "limit", DEFAULT_LIMIT, minimum=1, maximum=MAX_IMPORT_LIMIT)
    pages = get_pages_param(params, limit)
    search_workers = get_int_param(params, "search_workers", DEFAULT_SEARCH_WORKERS, minimum=1, maximum=16)
    detail_workers = get_int_param(params, "detail_workers", DEFAULT_DETAIL_WORKERS, minimum=1, maximum=24)
    candidate_limit = get_candidate_limit(params, limit)
    include_details = get_bool_param(params, "details", False)
    total_searches = max(1, len(queries) * pages)
    backfill_queries = get_backfill_queries(queries) if should_backfill_candidates(params) else []
    backfill_searches = len(backfill_queries) * pages
    min_searches = min(
        total_searches,
        get_int_param(params, "min_searches", DEFAULT_MIN_SEARCH_COMPLETIONS, minimum=1, maximum=16),
    )
    estimated_seconds = estimate_import_seconds(
        limit=limit,
        candidate_limit=candidate_limit,
        total_searches=total_searches,
        backfill_searches=backfill_searches,
        min_searches=min_searches,
        search_workers=search_workers,
        detail_workers=detail_workers,
        include_details=include_details,
    )

    return {
        "limit": limit,
        "maxLimit": MAX_IMPORT_LIMIT,
        "pages": pages,
        "queries": queries,
        "queryCount": len(queries),
        "totalSearches": total_searches,
        "backfillQueryCount": len(backfill_queries),
        "backfillSearches": backfill_searches,
        "minSearches": min_searches,
        "candidateLimit": candidate_limit,
        "searchWorkers": search_workers,
        "detailWorkers": detail_workers,
        "includeDetails": include_details,
        "estimatedSeconds": estimated_seconds,
    }


def get_pages_param(params: dict[str, list[str]], limit: int) -> int:
    raw_pages = first_param(params, "pages")
    if raw_pages:
        return get_int_param(params, "pages", 1, minimum=1, maximum=MAX_SEARCH_PAGES)

    if limit <= 40:
        return 1
    if limit <= 100:
        return 2
    return max(1, min(MAX_SEARCH_PAGES, (limit + 49) // 50))


def get_candidate_limit(params: dict[str, list[str]], limit: int) -> int:
    multiplier = DEFAULT_CANDIDATE_MULTIPLIER
    default_candidate_limit = max(limit, min(MAX_CANDIDATES, limit * multiplier))
    return get_int_param(
        params,
        "candidate_limit",
        default_candidate_limit,
        minimum=limit,
        maximum=MAX_CANDIDATES,
    )


def estimate_import_seconds(
    *,
    limit: int,
    candidate_limit: int,
    total_searches: int,
    backfill_searches: int,
    min_searches: int,
    search_workers: int,
    detail_workers: int,
    include_details: bool,
) -> int:
    search_divisor = 5 if backfill_searches else 30
    expected_searches = min(
        total_searches + backfill_searches,
        max(min_searches, round(candidate_limit / search_divisor)),
    )
    search_seconds = (expected_searches / max(1, search_workers)) * 0.45
    if not include_details:
        return max(1, round(0.8 + search_seconds))

    expected_detail_candidates = min(candidate_limit, max(round(limit * 1.3), limit + 40))
    detail_seconds = (expected_detail_candidates / max(1, detail_workers)) * 0.42
    return max(2, round(1.2 + search_seconds + detail_seconds))


def load_deals(
    params: dict[str, list[str]],
    progress_callback: Any | None = None,
) -> list[dict[str, Any]]:
    plan = get_import_plan(params)
    queries = plan["queries"]
    limit = plan["limit"]
    min_price = get_int_param(params, "min_price", 0, minimum=0, maximum=20000)
    max_price = get_int_param(params, "max_price", DEFAULT_MAX_PRICE, minimum=1, maximum=20000)
    pages = plan["pages"]
    include_details = plan["includeDetails"]
    search_workers = plan["searchWorkers"]
    detail_workers = plan["detailWorkers"]
    candidate_limit = plan["candidateLimit"]
    min_searches = plan["minSearches"]
    search_tasks = [(query, page) for page in range(1, pages + 1) for query in queries]
    total_searches = max(1, len(search_tasks))

    candidate_docs: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    report_progress(
        progress_callback,
        1,
        f"Soker {total_searches} Blocket-sidor med {search_workers} parallella sokningar",
        0,
        phase="search",
        total=candidate_limit,
    )

    collect_candidate_docs(
        search_tasks=search_tasks,
        seen_ids=seen_ids,
        candidate_docs=candidate_docs,
        min_price=min_price,
        max_price=max_price,
        candidate_limit=candidate_limit,
        stop_target=candidate_limit,
        search_workers=search_workers,
        min_searches=min_searches,
        require_repairable=True,
        progress_callback=progress_callback,
        progress_start=1,
        progress_span=32,
        label="reparationsannonser",
    )

    if len(candidate_docs) < limit and should_backfill_candidates(params):
        backfill_queries = get_backfill_queries(queries)
        backfill_tasks = [
            (query, page)
            for page in range(1, pages + 1)
            for query in backfill_queries
        ]
        report_progress(
            progress_callback,
            34,
            f"Fyller pa med bredare iPhone-traffar ({len(candidate_docs)}/{limit})",
            len(candidate_docs),
            phase="search",
            total=candidate_limit,
        )
        collect_candidate_docs(
            search_tasks=backfill_tasks,
            seen_ids=seen_ids,
            candidate_docs=candidate_docs,
            min_price=min_price,
            max_price=max_price,
            candidate_limit=candidate_limit,
            stop_target=max(limit, min(candidate_limit, limit + 120)),
            search_workers=search_workers,
            min_searches=min_searches,
            require_repairable=False,
            progress_callback=progress_callback,
            progress_start=34,
            progress_span=14,
            label="bredare iPhone-annonser",
        )

    if not candidate_docs:
        report_progress(progress_callback, 100, "Import klar: 0 annonser.", 0, phase="done", total=limit)
        return []

    deals = build_deals_from_candidates(
        candidate_docs,
        include_details=include_details,
        limit=limit,
        min_price=min_price,
        max_price=max_price,
        progress_callback=progress_callback,
        detail_workers=detail_workers,
    )
    report_progress(
        progress_callback,
        100,
        f"Import klar: {len(deals)} annonser.",
        len(deals),
        phase="done",
        total=limit,
    )
    return deals


def fetch_search_page(query: str, page: int) -> list[dict[str, Any]]:
    params = {
        "query": query,
        "page": page,
        "sort_order": "PUBLISHED_DESC",
    }
    cache_key = urlencode(params)
    cached_docs = get_cached_search_page(cache_key)
    if cached_docs is not None:
        return cached_docs

    response = request_json(
        "/v1/search",
        params,
    )
    docs = response.get("docs", [])
    docs = docs if isinstance(docs, list) else []
    set_cached_search_page(cache_key, docs)
    return docs


def collect_candidate_docs(
    *,
    search_tasks: list[tuple[str, int]],
    seen_ids: set[str],
    candidate_docs: list[dict[str, Any]],
    min_price: int,
    max_price: int,
    candidate_limit: int,
    stop_target: int,
    search_workers: int,
    min_searches: int,
    require_repairable: bool,
    progress_callback: Any | None,
    progress_start: int,
    progress_span: int,
    label: str,
) -> int:
    if not search_tasks:
        return 0

    completed_searches = 0
    total_searches = max(1, len(search_tasks))
    target = max(1, min(candidate_limit, stop_target))
    search_batch_size = max(1, search_workers * 2)

    for batch_start in range(0, len(search_tasks), search_batch_size):
        if len(candidate_docs) >= target and completed_searches >= min_searches:
            break

        batch = search_tasks[batch_start:batch_start + search_batch_size]
        executor = ThreadPoolExecutor(max_workers=min(search_workers, len(batch)))
        futures = {
            executor.submit(fetch_search_page, query, page): (query, page)
            for query, page in batch
        }
        pending = set(futures)

        try:
            while pending:
                done, pending = wait(
                    pending,
                    timeout=REQUEST_TIMEOUT_SECONDS + 0.25,
                    return_when=FIRST_COMPLETED,
                )
                if not done:
                    break

                for future in done:
                    query, page = futures[future]
                    completed_searches += 1

                    try:
                        docs = future.result()
                    except RuntimeError:
                        docs = []

                    added = add_candidate_docs(
                        docs,
                        seen_ids,
                        candidate_docs,
                        min_price,
                        max_price,
                        candidate_limit,
                        require_repairable=require_repairable,
                    )
                    search_percent = progress_start + round(completed_searches / total_searches * progress_span)
                    candidate_percent = progress_start + round(min(1, len(candidate_docs) / target) * progress_span)
                    report_progress(
                        progress_callback,
                        min(48, max(search_percent, candidate_percent)),
                        f"Laste {len(docs)} traffar for {query}, sida {page} (+{added} {label})",
                        len(candidate_docs),
                        phase="search",
                        total=candidate_limit,
                    )

                if len(candidate_docs) >= target and completed_searches >= min_searches:
                    break
        finally:
            for future in pending:
                future.cancel()
            executor.shutdown(wait=False, cancel_futures=True)

        if len(candidate_docs) >= target and completed_searches >= min_searches:
            report_progress(
                progress_callback,
                min(48, progress_start + progress_span),
                f"Hittade {len(candidate_docs)} kandidater efter {completed_searches} sokningar",
                len(candidate_docs),
                phase="search",
                total=candidate_limit,
            )
            break

        if completed_searches < min_searches and batch_start + search_batch_size < len(search_tasks):
            report_progress(
                progress_callback,
                min(48, progress_start + round(completed_searches / total_searches * progress_span)),
                f"Kontrollerar fler sokningar for battre tackning ({completed_searches}/{min_searches})",
                len(candidate_docs),
                phase="search",
                total=candidate_limit,
            )

    return completed_searches


def add_candidate_docs(
    docs: list[dict[str, Any]],
    seen_ids: set[str],
    candidate_docs: list[dict[str, Any]],
    min_price: int,
    max_price: int,
    candidate_limit: int,
    *,
    require_repairable: bool = True,
) -> int:
    added = 0

    for doc in docs:
        if len(candidate_docs) >= candidate_limit:
            break

        ad_id = str(doc.get("ad_id") or doc.get("id") or "")
        if not ad_id or ad_id in seen_ids:
            continue

        if not is_sellable_phone_doc(doc):
            continue
        price = get_price(doc)
        if price < min_price or price > max_price:
            continue
        if require_repairable and not looks_repairable_doc(doc):
            continue

        seen_ids.add(ad_id)
        candidate_docs.append(doc)
        added += 1

    return added


def looks_repairable_doc(doc: dict[str, Any]) -> bool:
    text = " ".join(
        str(value)
        for value in [
            doc.get("heading"),
            doc.get("subject"),
            doc.get("body"),
            doc.get("description"),
            get_extra_value(doc.get("extras"), {"condition", "skick", "defect", "damage"}),
        ]
        if value
    )
    text = NEGATIVE_DAMAGE_PATTERN.sub("", text)
    return bool(REPAIRABLE_PATTERN.search(text) or IPHONE_EXTRA_REPAIR_PATTERN.search(text))


def build_deals_from_candidates(
    candidate_docs: list[dict[str, Any]],
    *,
    include_details: bool,
    limit: int,
    min_price: int,
    max_price: int,
    progress_callback: Any | None,
    detail_workers: int,
) -> list[dict[str, Any]]:
    deals: list[dict[str, Any]] = []
    processed = 0
    batch_size = max(1, detail_workers * 2)

    report_progress(
        progress_callback,
        50,
        (
            f"Bygger {len(candidate_docs)} annonser utan detaljhamtning"
            if not include_details
            else f"Berikar {len(candidate_docs)} kandidater med {detail_workers} parallella detaljhamtningar"
        ),
        0,
        phase="details",
        total=limit,
    )

    if not include_details:
        for doc in candidate_docs:
            deal = doc_to_deal(doc, include_details=False)
            asking_price = deal.get("askingPrice", 0)
            if asking_price < min_price or asking_price > max_price:
                continue
            deals.append(deal)
            report_progress(
                progress_callback,
                min(96, 50 + round((len(deals) / max(1, limit)) * 46)),
                f"Bygger snabba annonser: {len(deals)}/{limit}",
                len(deals),
                phase="details",
                total=limit,
            )
            if len(deals) >= limit:
                report_progress(
                    progress_callback,
                    100,
                    f"Import klar: {len(deals)} annonser.",
                    len(deals),
                    phase="done",
                    total=limit,
                )
                return deals
        return deals

    for batch_start in range(0, len(candidate_docs), batch_size):
        batch = candidate_docs[batch_start:batch_start + batch_size]
        with ThreadPoolExecutor(max_workers=min(detail_workers, len(batch))) as executor:
            futures = [executor.submit(doc_to_deal, doc, include_details) for doc in batch]

            for future in as_completed(futures):
                processed += 1
                try:
                    deal = future.result()
                except RuntimeError:
                    continue

                asking_price = deal.get("askingPrice", 0)
                if asking_price < min_price or asking_price > max_price:
                    continue
                if include_details and not looks_repairable_deal(deal):
                    continue

                deals.append(deal)
                report_progress(
                    progress_callback,
                    min(96, 48 + round((len(deals) / max(1, limit)) * 48)),
                    f"Importerar skadade billiga telefoner: {len(deals)}/{limit}",
                    len(deals),
                    phase="details",
                    total=limit,
                )

                if len(deals) >= limit:
                    report_progress(
                        progress_callback,
                        100,
                        f"Import klar: {len(deals)} annonser.",
                        len(deals),
                        phase="done",
                        total=limit,
                    )
                    return deals

        if processed < len(candidate_docs):
            report_progress(
                progress_callback,
                min(96, 50 + round((processed / len(candidate_docs)) * 42)),
                f"Kontrollerade {processed}/{len(candidate_docs)} kandidater",
                len(deals),
                phase="details",
                total=limit,
            )

    return deals


def report_progress(
    progress_callback: Any | None,
    percent: int,
    message: str,
    count: int,
    *,
    phase: str = "deals",
    total: int | None = None,
) -> None:
    if not progress_callback:
        return
    progress_callback(max(0, min(100, percent)), message, count, phase, total)


def run_blocket_import_job(
    job_id: str,
    params: dict[str, list[str]],
    cache_key: str,
) -> None:
    try:
        plan = get_import_plan(params)

        def on_progress(
            percent: int,
            message: str,
            count: int,
            phase: str = "deals",
            total: int | None = None,
        ) -> None:
            updates: dict[str, Any] = {
                "percent": percent,
                "message": message,
                "count": count,
                "progressPhase": phase,
            }
            if total is not None:
                updates["progressTotal"] = total
            update_job(job_id, **updates)

        deals = load_deals(params, progress_callback=on_progress)
        payload = {"deals": deals, "source": "Blocket", "count": len(deals)}
        set_cached_payload(cache_key, payload)
        update_job(
            job_id,
            status="done",
            percent=100,
            message=f"Import klar: {len(deals)} annonser.",
            count=len(deals),
            progressPhase="done",
            progressTotal=plan["limit"],
            deals=deals,
        )
    except Exception as error:  # noqa: BLE001 - expose import failure to local UI
        update_job(
            job_id,
            status="error",
            percent=100,
            message=f"Import misslyckades: {error}",
            error=str(error),
        )


def update_job(job_id: str, **updates: Any) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        if "percent" in updates:
            updates["percent"] = max(int(job.get("percent", 0)), int(updates["percent"]))
        job.update(updates)


def enrich_job_status(job: dict[str, Any]) -> dict[str, Any]:
    if not job:
        return job

    enriched = dict(job)
    if isinstance(enriched.get("plan"), dict):
        enriched["plan"] = public_import_plan(enriched["plan"])
    enriched["jobId"] = enriched.get("id")
    started_at = float(enriched.get("startedAt") or time.time())
    elapsed_seconds = max(0, time.time() - started_at)
    percent = max(0, min(100, float(enriched.get("percent") or 0)))
    estimated_seconds = max(0, float(enriched.get("estimatedSeconds") or 0))
    status = enriched.get("status")

    if status != "running" or percent >= 100:
        remaining_seconds = 0
    else:
        remaining_seconds = estimate_remaining_seconds(enriched, percent, elapsed_seconds, estimated_seconds)

    enriched["elapsedSeconds"] = round(elapsed_seconds)
    enriched["remainingSeconds"] = round(max(0, remaining_seconds))
    return enriched


def estimate_remaining_seconds(
    job: dict[str, Any],
    percent: float,
    elapsed_seconds: float,
    estimated_seconds: float,
) -> float:
    estimate_remaining = max(0.0, estimated_seconds - elapsed_seconds)
    if estimate_remaining > 2:
        return estimate_remaining

    if percent <= 1:
        return max(3.0, estimate_remaining)

    if percent < 50:
        search_phase_progress = max(0.02, min(0.98, percent / 48))
        search_remaining = elapsed_seconds * ((1 - search_phase_progress) / search_phase_progress)
        plan = job.get("plan") if isinstance(job.get("plan"), dict) else {}
        requested_limit = float(job.get("requestedLimit") or plan.get("limit") or DEFAULT_LIMIT)
        detail_workers = float(plan.get("detailWorkers") or DEFAULT_DETAIL_WORKERS)
        detail_remaining = max(3.0, (requested_limit / max(1.0, detail_workers)) * 0.42)
        return search_remaining + detail_remaining

    return max(3.0, elapsed_seconds * ((100 - percent) / percent))


def public_import_plan(plan: dict[str, Any]) -> dict[str, Any]:
    public_plan = dict(plan)
    public_plan.pop("queries", None)
    return public_plan


def get_cached_payload(cache_key: str) -> dict[str, Any] | None:
    with CACHE_LOCK:
        cached = CACHE.get(cache_key)
    if not cached:
        return None

    cached_at, payload = cached
    if time.time() - cached_at > CACHE_SECONDS:
        with CACHE_LOCK:
            CACHE.pop(cache_key, None)
        return None

    return payload


def set_cached_payload(cache_key: str, payload: dict[str, Any]) -> None:
    with CACHE_LOCK:
        CACHE[cache_key] = (time.time(), payload)


def get_cached_search_page(cache_key: str) -> list[dict[str, Any]] | None:
    with CACHE_LOCK:
        cached = SEARCH_CACHE.get(cache_key)
    if not cached:
        return None

    cached_at, docs = cached
    if time.time() - cached_at > SEARCH_CACHE_SECONDS:
        with CACHE_LOCK:
            SEARCH_CACHE.pop(cache_key, None)
        return None

    return docs


def set_cached_search_page(cache_key: str, docs: list[dict[str, Any]]) -> None:
    with CACHE_LOCK:
        SEARCH_CACHE[cache_key] = (time.time(), docs)


def get_cached_detail(ad_id: str) -> dict[str, Any] | None:
    with CACHE_LOCK:
        cached = DETAIL_CACHE.get(ad_id)
    if not cached:
        return None

    cached_at, detail = cached
    if time.time() - cached_at > DETAIL_CACHE_SECONDS:
        with CACHE_LOCK:
            DETAIL_CACHE.pop(ad_id, None)
        return None

    return detail


def set_cached_detail(ad_id: str, detail: dict[str, Any]) -> None:
    with CACHE_LOCK:
        DETAIL_CACHE[ad_id] = (time.time(), detail)


def request_json(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    query = f"?{urlencode(params)}" if params else ""
    url = f"{BLOCKET_API_BASE.rstrip('/')}{path}{query}"
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except HTTPError as error:
        raise RuntimeError(f"Blocket API svarade med {error.code} för {path}") from error
    except URLError as error:
        raise RuntimeError(f"Kunde inte nå Blocket API: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Blocket API returnerade ogiltig JSON") from error


def get_queries(params: dict[str, list[str]]) -> list[str]:
    raw_query = first_param(params, "q") or first_param(params, "query")
    if raw_query:
        return [ensure_iphone_query(query.strip()) for query in raw_query.split("|") if query.strip()]
    return DEFAULT_QUERIES


def should_backfill_candidates(params: dict[str, list[str]]) -> bool:
    raw_query = first_param(params, "q") or first_param(params, "query")
    return not bool(raw_query)


def get_backfill_queries(primary_queries: list[str]) -> list[str]:
    primary_lookup = {normalize_key(query) for query in primary_queries}
    return [
        query
        for query in BROAD_BACKFILL_QUERIES
        if normalize_key(query) not in primary_lookup
    ]


def ensure_iphone_query(query: str) -> str:
    return query if is_iphone_text(query) else f"iphone {query}"


def get_int_param(
    params: dict[str, list[str]],
    name: str,
    default: int,
    *,
    minimum: int,
    maximum: int,
) -> int:
    try:
        value = int(first_param(params, name) or default)
    except ValueError:
        value = default

    return max(minimum, min(maximum, value))


def get_bool_param(params: dict[str, list[str]], name: str, default: bool) -> bool:
    raw_value = first_param(params, name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() not in {"0", "false", "no", "nej"}


def first_param(params: dict[str, list[str]], name: str) -> str | None:
    values = params.get(name)
    return values[0] if values else None


def is_sellable_phone_doc(doc: dict[str, Any]) -> bool:
    if doc.get("trade_type") and doc.get("trade_type") != "Säljes":
        return False

    if get_price(doc) <= 0:
        return False

    text = " ".join(
        str(value)
        for value in [
            doc.get("heading"),
            doc.get("brand"),
            get_extra_value(doc.get("extras"), {"brand", "phone_brand", "mobile_model", "model"}),
        ]
        if value
    ).lower()

    if is_service_or_buy_ad(text):
        return False
    if is_accessory_listing(text):
        return False

    return is_iphone_text(text)


def is_iphone_text(text: str) -> bool:
    normalized = normalize_key(text)
    return any(token in normalized for token in ["iphone", "iphon", "appleiphone"])


def is_accessory_listing(text: str) -> bool:
    normalized = normalize_key(text)
    accessory_tokens = {
        "mobilskal",
        "telefonskal",
        "telefonfodral",
        "planboksfodral",
        "fodral",
        "case",
        "cover",
        "skarmskydd",
        "screenprotector",
        "temperedglass",
        "hardatglas",
        "laddare",
        "charger",
        "laddkabel",
        "kabel",
        "adapter",
        "magsafe",
        "powerbank",
        "mobilhallare",
        "bilhallare",
        "hallare",
        "mount",
        "stativ",
        "tripod",
        "gimbal",
        "selfiepinne",
        "ringlight",
        "mikrofon",
        "microphone",
        "objektiv",
        "lens",
        "videokit",
        "mobilevideokit",
        "smallrig",
        "kamerarig",
        "airpods",
        "horlurar",
        "headset",
    }
    has_accessory_token = any(token in normalized for token in accessory_tokens)

    if not has_accessory_token and not ACCESSORY_PATTERN.search(text):
        return False

    starts_like_phone = bool(re.search(r"^\s*(?:apple\s+)?iphone\b", text, re.IGNORECASE))
    starts_like_phone = starts_like_phone or normalized.startswith(("iphone", "appleiphone"))
    mentions_device_sale = bool(
        re.search(
            r"\b(?:s[aÃ¤]ljer|s[aÃ¤]ljes|min|mobil|telefon)\s+(?:min\s+)?(?:apple\s+)?iphone\b",
            text,
            re.IGNORECASE,
        )
    )
    for_phone_context_tokens = [
        "tilliphone",
        "foriphone",
        "passariphone",
        "kompatibeliphone",
        "kompatibelmediphone",
        "compatibleiphone",
        "compatiblewithiphone",
    ]
    has_for_phone_context = any(
        token in normalized for token in for_phone_context_tokens
    )

    if has_for_phone_context:
        return True

    if starts_like_phone or mentions_device_sale:
        phone_detail_signal = bool(
            re.search(
                r"\b\d{2,4}\s?gb\b|batteri|batterih[aÃ¤]lsa|trasig|sprucken|defekt|skadad"
                r"|sk[aÃ¤]rm|display|ol[aÃ¥]st|fungerar|l[aÃ¥]st|icloud",
                text,
                re.IGNORECASE,
            )
        )
        if mentions_device_sale:
            return False
        return not phone_detail_signal

    return not (starts_like_phone or mentions_device_sale)


def is_service_or_buy_ad(text: str) -> bool:
    service_patterns = [
        r"\bköper\b",
        r"\bvi köper\b",
        r"\bsälj din\b",
        r"\bskärmbyte\b",
        r"\bdisplaybyte\b",
        r"\bbyt\b.*\bskärm\b",
        r"\blaga din\b",
        r"\breparerar\b",
        r"\blagar\b",
        r"\bklinik",
        r"\breparation\b.*\b(fr|från|billig|snabb|service)\b",
        r"\b(fr|från|billig|snabb|service)\b.*\breparation\b",
    ]

    return any(re.search(pattern, text) for pattern in service_patterns)


def looks_repairable_deal(deal: dict[str, Any]) -> bool:
    text = " ".join(
        str(deal.get(field) or "")
        for field in ["title", "condition", "sellerText"]
    )
    text = NEGATIVE_DAMAGE_PATTERN.sub("", text)
    return bool(REPAIRABLE_PATTERN.search(text) or IPHONE_EXTRA_REPAIR_PATTERN.search(text))


def doc_to_deal(doc: dict[str, Any], include_details: bool) -> dict[str, Any]:
    detail = get_detail(doc) if include_details else {}
    item_data = get_item_data(detail)
    title = item_data.get("title") or doc.get("heading") or "Blocket-annons"
    description = redact_contact_info(item_data.get("description") or "")
    extras = item_data.get("extras") or doc.get("extras") or []
    brand = get_extra_value(extras, {"phone_brand", "brand", "varumärke"}) or doc.get("brand") or infer_brand(title)
    model = infer_model(title) or get_extra_value(extras, {"mobile_model", "model", "modell"})
    marketplace_condition = get_extra_value(extras, {"condition", "skick"})
    damage_condition = infer_condition(f"{title} {description}")
    condition = damage_condition if damage_condition != "Okänt skick" else marketplace_condition or damage_condition
    ad_id = str(doc.get("ad_id") or doc.get("id"))
    location = get_location(item_data, doc)
    source_url = doc.get("canonical_url") or f"https://www.blocket.se/recommerce/forsale/item/{ad_id}"
    has_buy_now = has_buy_now_signal(doc, item_data, detail)

    return {
        "id": f"blocket-{ad_id}",
        "title": title,
        "marketplace": "Blocket",
        "brand": brand or "Okänt",
        "model": model or title,
        "askingPrice": get_price(item_data) or get_price(doc),
        "condition": condition,
        "location": location,
        "publishedAt": get_published_at(item_data, doc),
        "sourceUrl": source_url,
        "sellerText": description,
        "hasBuyNow": has_buy_now,
        "purchaseType": "Köp nu" if has_buy_now else "Kontakta säljare",
    }


def has_buy_now_signal(*sources: dict[str, Any]) -> bool:
    for source in sources:
        if not isinstance(source, dict):
            continue

        flags = source.get("flags")
        if isinstance(flags, list) and any(normalize_key(str(flag)) == "buynow" for flag in flags):
            return True

        labels = source.get("labels")
        if isinstance(labels, list):
            for label in labels:
                if not isinstance(label, dict):
                    continue
                label_id = normalize_key(str(label.get("id") or ""))
                label_text = normalize_key(str(label.get("text") or ""))
                if label_id == "buynow" or label_text == "kopnu":
                    return True

        if bool(source.get("buy_now") or source.get("buyNow") or source.get("hasBuyNow")):
            return True

    return False


def get_detail(doc: dict[str, Any]) -> dict[str, Any]:
    ad_id = doc.get("ad_id") or doc.get("id")
    if not ad_id:
        return {}

    ad_id = str(ad_id)
    cached_detail = get_cached_detail(ad_id)
    if cached_detail is not None:
        return cached_detail

    if DETAIL_FETCH_PAUSE:
        time.sleep(DETAIL_FETCH_PAUSE)

    try:
        detail = request_json("/v1/ad/recommerce", {"id": ad_id})
        if isinstance(detail, dict):
            set_cached_detail(ad_id, detail)
            return detail
        return {}
    except RuntimeError:
        return {}


def redact_contact_info(text: str) -> str:
    text = re.sub(
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        "[e-post dold]",
        text,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"(?<!\d)(?:\+?46|0)(?:[\s-]?\d){7,12}(?!\d)",
        "[telefon dolt]",
        text,
    )


def get_item_data(detail: dict[str, Any]) -> dict[str, Any]:
    return (
        detail.get("loaderData", {})
        .get("item-recommerce", {})
        .get("itemData", {})
    )


def get_extra_value(extras: Any, wanted_ids: set[str]) -> str:
    if not isinstance(extras, list):
        return ""

    normalized_ids = {normalize_key(item) for item in wanted_ids}
    for extra in extras:
        if not isinstance(extra, dict):
            continue

        extra_id = normalize_key(str(extra.get("id") or ""))
        label = normalize_key(str(extra.get("label") or ""))
        if extra_id not in normalized_ids and label not in normalized_ids:
            continue

        value = extra.get("value")
        if value:
            return str(value)

        values = extra.get("values")
        if isinstance(values, list) and values:
            return str(values[0])

    return ""


def normalize_key(value: str) -> str:
    return (
        value.lower()
        .replace("å", "a")
        .replace("ä", "a")
        .replace("ö", "o")
        .replace("Ã¥", "a")
        .replace("Ã¤", "a")
        .replace("Ã¶", "o")
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


def get_price(source: dict[str, Any]) -> int:
    price = source.get("price")

    if isinstance(price, dict):
        price = price.get("amount")

    try:
        return int(float(price or 0))
    except (TypeError, ValueError):
        return 0


def get_location(item_data: dict[str, Any], doc: dict[str, Any]) -> str:
    location = item_data.get("location")
    if isinstance(location, dict):
        return location.get("postalName") or location.get("area") or doc.get("location") or "Okänd plats"

    return doc.get("location") or "Okänd plats"


def get_published_at(item_data: dict[str, Any], doc: dict[str, Any]) -> str:
    meta = item_data.get("meta")
    edited = meta.get("edited") if isinstance(meta, dict) else ""
    if edited:
        return edited

    timestamp = doc.get("timestamp")
    if timestamp:
        try:
            return datetime.fromtimestamp(int(timestamp) / 1000, tz=timezone.utc).isoformat()
        except (TypeError, ValueError, OSError):
            pass

    return datetime.now(timezone.utc).isoformat()


def infer_brand(text: str) -> str:
    normalized = text.lower()
    for brand in PHONE_BRANDS:
        if brand.lower() in normalized:
            return brand

    if "iphone" in normalized:
        return "Apple"
    return "Okänt"


def infer_model(text: str) -> str:
    match = MODEL_PATTERN.search(text)
    return match.group(0) if match else ""


def infer_condition(text: str) -> str:
    normalized = NEGATIVE_DAMAGE_PATTERN.sub("", text).lower()
    damage_terms = r"(sprucken|sprick|trasig|skadad|cracked|broken|damaged)"

    if re.search(r"(kodlåst|lösenkod|glömt kod|avaktiverad|activation lock|passcode|simlåst|operatörslåst)", normalized):
        return "iCloud låst"
    if re.search(r"(moderkort|moderkortsproblem|kretskort|baseband|ingen service|ingen täckning)", normalized):
        return "Defekt"
    if re.search(r"(bootloop|recovery|dfu|äppel|fastnar.{0,20}logga|fastnar.{0,20}äpp)", normalized):
        return "Startar inte"
    if re.search(r"(touch|ghost touch|svart skärm|grön skärm|linjer|rand|pixlar|frontglas|glas)", normalized):
        return "Displayproblem"
    if re.search(r"(kamera|högtalare|mikrofon|wifi|bluetooth)", normalized):
        return "Defekt"
    if re.search(
        r"icloud.{0,30}(?:låst|locked)|(?<![a-zåäö])låst(?![a-zåäö])|(?<![a-z])locked(?![a-z])",
        normalized,
    ):
        return "iCloud låst"
    if "vatten" in normalized or "water" in normalized:
        return "Vattenskadad"
    if "startar inte" in normalized or "does not turn on" in normalized:
        return "Startar inte"
    if re.search(r"(laddar inte|laddport|laddproblem|tar inte ladd|not charging|charge port)", normalized):
        return "Laddar inte"
    if re.search(r"(batteri|battery)", normalized):
        return "Batteriproblem"
    if re.search(r"(reservdel|endast delar|parts only|parts)", normalized):
        return "Reservdelar"
    if re.search(rf"(baksid|back).{{0,50}}{damage_terms}|{damage_terms}.{{0,50}}(baksid|back)", normalized):
        return "Baksida sprucken"
    if re.search(rf"display.{{0,50}}({damage_terms}|problem)|({damage_terms}|problem).{{0,50}}display", normalized):
        return "Displayproblem"
    if re.search(rf"(skärm|screen).{{0,50}}{damage_terms}|{damage_terms}.{{0,50}}(skärm|screen)|sprucken", normalized):
        return "Sprucken skärm"
    if "defekt" in normalized or "defective" in normalized or "not working" in normalized:
        return "Defekt"
    if "skadad" in normalized or "damaged" in normalized:
        return "Skadad"
    if "trasig" in normalized or "broken" in normalized or "ej fungerande" in normalized:
        return "Trasig"
    return "Okänt skick"


if __name__ == "__main__":
    main()
