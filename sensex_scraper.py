import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, time as dt_time
from pathlib import Path
from zoneinfo import ZoneInfo

from curl_cffi import requests


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
DATA_DIR = OUTPUT_DIR / "data"
LOG_DIR = OUTPUT_DIR / "logs"

SENSEX_LATEST_FILE = DATA_DIR / "sensex_latest.json"
SENSEX_CAS_FILE = DATA_DIR / "sensex_cas_latest.json"

BSE_BASE_URL = "https://www.bseindia.com"
BSE_API_BASE_URL = "https://api.bseindia.com/BseIndiaAPI/api"
BSE_INDEX_API = (
    BSE_API_BASE_URL
    + "/IndexSensexData1/w?indexcode=16"
)
BSE_CAS_API = BSE_API_BASE_URL + "/GetCASData/w?scripCode="

POLL_INTERVAL_SECONDS = 5
REQUEST_TIMEOUT_SECONDS = 10
REFERENCE_TIME = dt_time(15, 15)
TIMEZONE = ZoneInfo("Asia/Kolkata")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("sensex-scraper")
logger.setLevel(logging.INFO)
logger.handlers.clear()
formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
file_handler = logging.FileHandler(
    LOG_DIR / "sensex_scraper.log",
    encoding="utf-8",
)
file_handler.setFormatter(formatter)
logger.addHandler(console_handler)
logger.addHandler(file_handler)


@dataclass
class SensexRecord:
    symbol: str
    iep: float | None
    change: float | None
    percentage_change: float | None
    final_price: float | None
    last_update_time: str | None

    def as_dict(self):
        return {
            "symbol": self.symbol,
            "iep": self.iep,
            "change": self.change,
            "percentage_change": self.percentage_change,
            "final_price": self.final_price,
            "last_update_time": self.last_update_time,
        }


def now_ist():
    return datetime.now(TIMEZONE)


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(str(value).replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def write_json(path, payload):
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def bse_session():
    session = requests.Session(impersonate="chrome")
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-IN,en;q=0.9",
    })
    return session


def warm_up(session):
    response = session.get(
        BSE_BASE_URL + "/markets/equity/equitysensexstream?flag=c",
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()


def fetch_index(session):
    response = session.get(
        BSE_INDEX_API,
        headers={
            "Accept": "application/json, text/plain, */*",
            "Origin": BSE_BASE_URL,
            "Referer": BSE_BASE_URL + "/",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("BSE SENSEX index response is not an object.")

    def first(*names):
        for name in names:
            if payload.get(name) is not None:
                return payload.get(name)
        return None

    last = number(first("LatestVal", "CurrentValue", "LTP", "Price"))
    previous_close = number(first("PrevClose", "PreviousClose"))
    change = number(first("Change", "Variation"))

    if change is None and last is not None and previous_close is not None:
        change = last - previous_close

    percent_change = number(first("PercentChange", "ChangePerc"))

    if percent_change is None and change is not None and previous_close:
        percent_change = change / previous_close * 100

    return {
        "last": last,
        "change": change,
        "percent_change": percent_change,
        "open": number(first("Open")),
        "high": number(first("High", "MaxLow")),
        "low": number(first("Low", "MinLow")),
        "previous_close": previous_close,
        "last_update_time": now_ist().strftime("%Y-%m-%d %H:%M:%S"),
    }


def fetch_cas(session):
    response = session.get(
        BSE_CAS_API,
        headers={
            "Accept": "application/json, text/plain, */*",
            "Origin": BSE_BASE_URL,
            "Referer": BSE_BASE_URL + "/markets/equity/equitysensexstream?flag=c",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    rows = payload.get("Table", []) if isinstance(payload, dict) else []
    records = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        records.append(SensexRecord(
            symbol=str(row.get("scrip_id") or row.get("ScripName") or "").strip(),
            iep=number(row.get("IndEq_Price")),
            change=number(row.get("Change")),
            percentage_change=number(row.get("ChangePerc")),
            final_price=number(row.get("ClosePrice")),
            last_update_time=str(row.get("dt_tm") or "").strip() or None,
        ))

    return records


def save_snapshot(records, index, reference_price, reference_timestamp):
    timestamp = now_ist()
    write_json(
        SENSEX_CAS_FILE,
        {
            "timestamp": timestamp.isoformat(),
            "timestamp_ist": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "record_count": len(records),
            "data": [record.as_dict() for record in records],
        },
    )
    write_json(
        SENSEX_LATEST_FILE,
        {
            "timestamp": timestamp.isoformat(),
            "timestamp_ist": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "nifty50_index": {
                **index,
                "reference_price": reference_price,
                "reference_timestamp": reference_timestamp,
            },
        },
    )


def save_index_snapshot(index, reference_price, reference_timestamp):
    timestamp = now_ist()
    write_json(
        SENSEX_LATEST_FILE,
        {
            "timestamp": timestamp.isoformat(),
            "timestamp_ist": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "nifty50_index": {
                **index,
                "reference_price": reference_price,
                "reference_timestamp": reference_timestamp,
            },
        },
    )


def run():
    reference_date = None
    reference_price = None
    reference_timestamp = None
    session = bse_session()

    try:
        warm_up(session)
        logger.info("SENSEX collector started; polling every %d seconds.", POLL_INTERVAL_SECONDS)

        while True:
            try:
                index = fetch_index(session)
                current_time = now_ist()

                if (
                    current_time.time() >= REFERENCE_TIME
                    and reference_date != current_time.date()
                ):
                    reference_date = current_time.date()
                    reference_price = index["last"]
                    reference_timestamp = current_time.strftime("%Y-%m-%d %H:%M:%S")

                if (
                    current_time.time() >= REFERENCE_TIME
                    and current_time.time() < dt_time(15, 30)
                ):
                    records = fetch_cas(session)
                    save_snapshot(
                        records,
                        index,
                        reference_price,
                        reference_timestamp,
                    )
                else:
                    save_index_snapshot(
                        index,
                        reference_price,
                        reference_timestamp,
                    )

                logger.info(
                    "SENSEX: %.2f (%+.2f / %+.2f%%)",
                    index["last"] or 0,
                    index["change"] or 0,
                    index["percent_change"] or 0,
                )
                time.sleep(POLL_INTERVAL_SECONDS)

            except Exception as exc:
                logger.warning("SENSEX update failed: %s", exc)
                time.sleep(POLL_INTERVAL_SECONDS)

    finally:
        session.close()


if __name__ == "__main__":
    run()
