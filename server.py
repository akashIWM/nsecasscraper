import csv
import json
import logging
import math
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

FRONTEND_DIR = BASE_DIR / "frontend"

OUTPUT_DIR = BASE_DIR / "output"

DATA_DIR = OUTPUT_DIR / "data"

CAS_LATEST_FILE = DATA_DIR / "cas_latest.json"

NIFTY_WEIGHTS_FILE = (
    BASE_DIR / "nifty50_real_weights.csv"
)

HOST = "127.0.0.1"

PORT = 8000

TIMEZONE = ZoneInfo("Asia/Kolkata")


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s | "
        "%(levelname)s | "
        "%(message)s"
    ),
)

logger = logging.getLogger("nse-dashboard")


# ============================================================
# GLOBAL CACHE
# ============================================================

NIFTY_WEIGHTS = {}


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def now_ist():
    """
    Return current Indian Standard Time.
    """

    return datetime.now(TIMEZONE)


def safe_float(value):
    """
    Safely convert a value to float.

    Returns None if conversion is impossible.
    """

    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    value = str(value).strip()

    if not value:
        return None

    if value.upper() in {
        "-",
        "--",
        "NA",
        "N/A",
        "NULL",
        "NONE",
        "NAN",
    }:
        return None

    value = (
        value
        .replace(",", "")
        .replace("%", "")
        .strip()
    )

    try:

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (
        ValueError,
        TypeError,
    ):

        return None


def normalize_symbol(symbol):
    """
    Normalize NSE symbol.
    """

    if symbol is None:
        return ""

    return (
        str(symbol)
        .strip()
        .upper()
    )


def json_safe(value):
    """
    Recursively make data JSON safe.

    Converts NaN / Infinity to None.
    """

    if isinstance(value, float):

        if not math.isfinite(value):
            return None

        return value

    if isinstance(value, dict):

        return {
            key: json_safe(val)
            for key, val in value.items()
        }

    if isinstance(value, list):

        return [
            json_safe(item)
            for item in value
        ]

    return value


# ============================================================
# LOAD NIFTY WEIGHTS
# ============================================================

def load_nifty_weights():

    global NIFTY_WEIGHTS

    NIFTY_WEIGHTS = {}

    if not NIFTY_WEIGHTS_FILE.exists():

        logger.warning(
            "NIFTY weights file not found: %s",
            NIFTY_WEIGHTS_FILE,
        )

        return

    try:

        with NIFTY_WEIGHTS_FILE.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                symbol = normalize_symbol(
                    row.get("symbol")
                )

                if not symbol:
                    continue

                weight = safe_float(
                    row.get("weight")
                )

                weight_pct = safe_float(
                    row.get("weight_pct_raw")
                )

                # ------------------------------------------------
                # If decimal weight is missing but percentage
                # weight exists.
                # ------------------------------------------------

                if (
                    weight is None
                    and weight_pct is not None
                ):

                    weight = (
                        weight_pct / 100.0
                    )

                # ------------------------------------------------
                # If percentage weight is missing but decimal
                # weight exists.
                # ------------------------------------------------

                if (
                    weight_pct is None
                    and weight is not None
                ):

                    weight_pct = (
                        weight * 100.0
                    )

                NIFTY_WEIGHTS[symbol] = {
                    "weight": weight,
                    "weight_pct": weight_pct,
                }

        logger.info(
            "Loaded %d NIFTY weights from %s",
            len(NIFTY_WEIGHTS),
            NIFTY_WEIGHTS_FILE,
        )

    except Exception as exc:

        logger.exception(
            "Failed to load NIFTY weights: %s",
            exc,
        )

        NIFTY_WEIGHTS = {}


# ============================================================
# CALCULATE CONTRIBUTION
# ============================================================

def calculate_contribution(
    percentage_change,
    weight,
):

    if (
        percentage_change is None
        or weight is None
    ):
        return None

    return (
        percentage_change
        * weight
    )


# ============================================================
# READ CAS JSON
# ============================================================

def load_cas_data():
    """
    Load latest CAS data.

    Returns:
        payload, raw_records
    """

    if not CAS_LATEST_FILE.exists():

        raise FileNotFoundError(
            "CAS data file does not exist yet. "
            "The NSE scraper has not created "
            "cas_latest.json."
        )

    try:

        with CAS_LATEST_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:

            payload = json.load(file)

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "cas_latest.json contains invalid JSON."
        ) from exc

    except OSError as exc:

        raise RuntimeError(
            f"Unable to read {CAS_LATEST_FILE}: {exc}"
        ) from exc

    if not isinstance(payload, dict):

        raise RuntimeError(
            "cas_latest.json must contain a JSON object."
        )

    raw_records = payload.get("data", [])

    if raw_records is None:
        raw_records = []

    if not isinstance(raw_records, list):

        raise RuntimeError(
            "The 'data' field in cas_latest.json "
            "must be a list."
        )

    return payload, raw_records


# ============================================================
# BUILD DASHBOARD RECORDS
# ============================================================

def build_dashboard_records(raw_records):

    records = []

    for row in raw_records:

        if not isinstance(row, dict):
            continue

        symbol = normalize_symbol(
            row.get("symbol")
        )

        if not symbol:
            continue

        iep = safe_float(
            row.get("iep")
        )

        change = safe_float(
            row.get("change")
        )

        percentage_change = safe_float(
            row.get("percentage_change")
        )

        final_price = safe_float(
            row.get("final_price")
        )

        last_update_time = row.get(
            "last_update_time"
        )

        weight_info = NIFTY_WEIGHTS.get(
            symbol
        )

        if weight_info:

            weight = weight_info.get(
                "weight"
            )

            weight_pct = weight_info.get(
                "weight_pct"
            )

        else:

            weight = None
            weight_pct = None

        contribution = calculate_contribution(
            percentage_change,
            weight,
        )

        records.append(
            {
                "symbol": symbol,

                "iep": iep,

                "change": change,

                "percentage_change":
                    percentage_change,

                "final_price":
                    final_price,

                "weight":
                    weight,

                "weight_pct":
                    weight_pct,

                "contribution":
                    contribution,

                "last_update_time":
                    last_update_time,

                # ------------------------------------------------
                # IMPORTANT
                #
                # This tells frontend whether this symbol is
                # a NIFTY 50 constituent.
                # ------------------------------------------------

                "is_nifty50":
                    weight_info is not None,
            }
        )

    return records


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

def calculate_summary(records):

    total_records = len(records)

    nifty_records = [
        record
        for record in records
        if record["is_nifty50"]
    ]

    positive_count = sum(
        1
        for record in records
        if (
            record["percentage_change"] is not None
            and record["percentage_change"] > 0
        )
    )

    negative_count = sum(
        1
        for record in records
        if (
            record["percentage_change"] is not None
            and record["percentage_change"] < 0
        )
    )

    unchanged_count = sum(
        1
        for record in records
        if (
            record["percentage_change"] is not None
            and record["percentage_change"] == 0
        )
    )

    contribution_values = [
        record["contribution"]
        for record in nifty_records
        if record["contribution"] is not None
    ]

    total_contribution = None

    if contribution_values:

        total_contribution = sum(
            contribution_values
        )

    positive_contribution = sum(
        value
        for value in contribution_values
        if value > 0
    )

    negative_contribution = sum(
        value
        for value in contribution_values
        if value < 0
    )

    weight_sum = sum(
        record["weight"]
        for record in nifty_records
        if record["weight"] is not None
    )

    return {
        "total_records":
            total_records,

        "nifty50_available":
            len(nifty_records),

        "nifty50_total":
            50,

        "positive":
            positive_count,

        "negative":
            negative_count,

        "unchanged":
            unchanged_count,

        "total_contribution":
            total_contribution,

        "positive_contribution":
            positive_contribution,

        "negative_contribution":
            negative_contribution,

        "available_weight":
            weight_sum,
    }


# ============================================================
# BUILD API RESPONSE
# ============================================================

def build_api_response():

    payload, raw_records = load_cas_data()

    records = build_dashboard_records(
        raw_records
    )

    summary = calculate_summary(
        records
    )

    server_timestamp = now_ist()

    # --------------------------------------------------------
    # Scraper timestamps
    # --------------------------------------------------------

    scraper_timestamp = payload.get(
        "timestamp"
    )

    scraper_timestamp_ist = payload.get(
        "timestamp_ist"
    )

    # --------------------------------------------------------
    # NEW:
    #
    # Read the actual NIFTY 50 index value (spot price) that
    # nse_cas_scraper.py now writes into cas_latest.json under
    # the "nifty50_index" key.
    #
    # This is separate from the weighted contribution computed
    # below in `summary` / `records`.
    #
    # payload.get(...) returns None if the scraper hasn't been
    # updated yet or the index fetch failed on that poll, so
    # this stays backward compatible with older cas_latest.json
    # files that don't have this key at all.
    # --------------------------------------------------------

    nifty50_index = payload.get(
        "nifty50_index"
    )

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # We expose BOTH the old/new names so app.js can consume
    # the response without ambiguity.
    # --------------------------------------------------------

    response = {
        "success": True,

        # Server timestamp
        "server_timestamp":
            server_timestamp.isoformat(),

        "server_timestamp_ist":
            server_timestamp.strftime(
                "%Y-%m-%d %H:%M:%S"
            ),

        # Scraper timestamp
        "timestamp":
            scraper_timestamp,

        "timestamp_ist":
            scraper_timestamp_ist,

        "data_timestamp":
            scraper_timestamp,

        "data_timestamp_ist":
            scraper_timestamp_ist,

        # Records
        "record_count":
            len(records),

        # NIFTY count expected by frontend
        "nifty50_count":
            50,

        "nifty50_available":
            summary[
                "nifty50_available"
            ],

        # NEW: actual NIFTY 50 index value (last, change,
        # percent_change, open, high, low, previous_close),
        # or None if unavailable.
        "nifty50_index":
            nifty50_index,

        # Summary
        "summary":
            summary,

        # Weight information
        "weights": {
            "source":
                NIFTY_WEIGHTS_FILE.name,

            "count":
                len(NIFTY_WEIGHTS),
        },

        # Actual records
        "data":
            records,
    }

    return json_safe(response)


# ============================================================
# MIME TYPES
# ============================================================

MIME_TYPES = {

    ".html":
        "text/html; charset=utf-8",

    ".css":
        "text/css; charset=utf-8",

    ".js":
        "application/javascript; charset=utf-8",

    ".json":
        "application/json; charset=utf-8",

    ".png":
        "image/png",

    ".jpg":
        "image/jpeg",

    ".jpeg":
        "image/jpeg",

    ".svg":
        "image/svg+xml",

    ".ico":
        "image/x-icon",
}


# ============================================================
# HTTP REQUEST HANDLER
# ============================================================

class DashboardHandler(
    BaseHTTPRequestHandler
):

    # ========================================================
    # LOGGING
    # ========================================================

    def log_message(
        self,
        format,
        *args,
    ):

        logger.info(
            "%s - %s",
            self.address_string(),
            format % args,
        )

    # ========================================================
    # SEND JSON
    # ========================================================

    def send_json(
        self,
        payload,
        status_code=200,
    ):

        payload = json_safe(
            payload
        )

        body = json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
        ).encode(
            "utf-8"
        )

        self.send_response(
            status_code
        )

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(body)),
        )

        self.send_header(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        )

        self.send_header(
            "Pragma",
            "no-cache",
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )

        self.end_headers()

        self.wfile.write(
            body
        )

    # ========================================================
    # SEND FILE
    # ========================================================

    def send_file(
        self,
        file_path,
    ):

        if not file_path.exists():

            self.send_error(
                404,
                "File not found",
            )

            return

        if not file_path.is_file():

            self.send_error(
                404,
                "Not a file",
            )

            return

        try:

            content = (
                file_path.read_bytes()
            )

        except Exception as exc:

            logger.exception(
                "Could not read frontend file: %s",
                exc,
            )

            self.send_error(
                500,
                "Could not read file",
            )

            return

        content_type = MIME_TYPES.get(
            file_path.suffix.lower(),
            "application/octet-stream",
        )

        self.send_response(
            200
        )

        self.send_header(
            "Content-Type",
            content_type,
        )

        self.send_header(
            "Content-Length",
            str(len(content)),
        )

        self.send_header(
            "Cache-Control",
            "no-store",
        )

        self.end_headers()

        self.wfile.write(
            content
        )

    # ========================================================
    # GET
    # ========================================================

    def do_GET(self):

        parsed_url = urlparse(
            self.path
        )

        path = parsed_url.path

        # ====================================================
        # API
        # ====================================================

        if path == "/api/cas":

            try:

                response = (
                    build_api_response()
                )

                self.send_json(
                    response,
                    200,
                )

            except FileNotFoundError as exc:

                logger.warning(
                    "CAS data not available yet: %s",
                    exc,
                )

                # ------------------------------------------------
                # Return JSON instead of HTML 404.
                #
                # This makes the frontend error handling cleaner.
                # ------------------------------------------------

                self.send_json(
                    {
                        "success": False,

                        "error":
                            str(exc),

                        "message":
                            (
                                "The scraper has not "
                                "created CAS data yet."
                            ),

                        "data": [],
                    },
                    200,
                )

            except json.JSONDecodeError as exc:

                logger.exception(
                    "Invalid CAS JSON: %s",
                    exc,
                )

                self.send_json(
                    {
                        "success": False,

                        "error":
                            "Invalid CAS JSON file.",

                        "details":
                            str(exc),

                        "data": [],
                    },
                    200,
                )

            except Exception as exc:

                logger.exception(
                    "API error: %s",
                    exc,
                )

                # ------------------------------------------------
                # IMPORTANT:
                #
                # Send the REAL exception to frontend.
                # ------------------------------------------------

                self.send_json(
                    {
                        "success": False,

                        "error":
                            str(exc),

                        "type":
                            type(exc).__name__,

                        "data": [],
                    },
                    200,
                )

            return

        # ====================================================
        # HEALTH
        # ====================================================

        if path == "/api/health":

            self.send_json(
                {
                    "success": True,

                    "server":
                        "running",

                    "time_ist":
                        now_ist().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        ),

                    "cas_file_exists":
                        CAS_LATEST_FILE.exists(),

                    "weights_file_exists":
                        NIFTY_WEIGHTS_FILE.exists(),

                    "weights_loaded":
                        len(NIFTY_WEIGHTS),

                    "cas_file":
                        str(CAS_LATEST_FILE),

                    "weights_file":
                        str(NIFTY_WEIGHTS_FILE),
                }
            )

            return

        # ====================================================
        # ROOT
        # ====================================================

        if path == "/":

            file_path = (
                FRONTEND_DIR
                / "index.html"
            )

            self.send_file(
                file_path
            )

            return

        # ====================================================
        # STATIC FILES
        # ====================================================

        relative_path = path.lstrip("/")

        file_path = (
            FRONTEND_DIR
            / relative_path
        )

        # ----------------------------------------------------
        # Security:
        #
        # Prevent ../ path traversal.
        # ----------------------------------------------------

        try:

            frontend_root = (
                FRONTEND_DIR.resolve()
            )

            requested_file = (
                file_path.resolve()
            )

            requested_file.relative_to(
                frontend_root
            )

        except ValueError:

            self.send_error(
                403,
                "Forbidden",
            )

            return

        self.send_file(
            requested_file
        )


# ============================================================
# START SERVER
# ============================================================

def run_server():

    # --------------------------------------------------------
    # Load weights
    # --------------------------------------------------------

    load_nifty_weights()

    logger.info(
        "============================================================"
    )

    logger.info(
        "NSE CAS LIVE DASHBOARD"
    )

    logger.info(
        "============================================================"
    )

    logger.info(
        "Frontend directory: %s",
        FRONTEND_DIR,
    )

    logger.info(
        "CAS data file: %s",
        CAS_LATEST_FILE,
    )

    logger.info(
        "NIFTY weights file: %s",
        NIFTY_WEIGHTS_FILE,
    )

    logger.info(
        "Loaded NIFTY weights: %d",
        len(NIFTY_WEIGHTS),
    )

    logger.info(
        "Dashboard: http://127.0.0.1:%d",
        PORT,
    )

    logger.info(
        "API: http://127.0.0.1:%d/api/cas",
        PORT,
    )

    logger.info(
        "Health: http://127.0.0.1:%d/api/health",
        PORT,
    )

    logger.info(
        "============================================================"
    )

    server = ThreadingHTTPServer(
        (
            HOST,
            PORT,
        ),
        DashboardHandler,
    )

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        logger.info(
            "Dashboard server stopped."
        )

    finally:

        server.server_close()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    run_server()