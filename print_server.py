"""
Atul POS — Local Print Server
Windows pe background mein chalta hai (port 9191).

Browser (atulicecream.com) aur Django backend dono yahan POST /print karte hain.

Usage:
    python print_server.py

Dependencies:
    pip install flask pywin32
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import win32print
import json
import os
import sys
import socket
import subprocess
import time

app = Flask(__name__)

# CORS: atulicecream.com se browser requests allow karo
CORS(app, origins=["https://atulicecream.com", "http://atulicecream.com", "http://localhost:5173", "http://127.0.0.1:8000"])

# ─── PRINTER NAME — first run pe config file se load, warna default ────────
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "printer_config.json")

def load_printer_name():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                return json.load(f).get("printer_name", "EPSON TM-T82 Receipt")
    except Exception:
        pass
    return "EPSON TM-T82 Receipt"

def save_printer_name(name):
    with open(CONFIG_FILE, "w") as f:
        json.dump({"printer_name": name}, f)

PRINTER_NAME = load_printer_name()

# ─── CONFIG ────────────────────────────────────────────────────
PRINTER_NAME = "EPSON TM-T82 Receipt"
LINE_WIDTH   = 42
# ───────────────────────────────────────────────────────────────

# ─── ESC/POS COMMANDS ──────────────────────────────────────────
ESC        = b'\x1b'
INIT       = ESC + b'@'
ALIGN_L    = ESC + b'a\x00'
ALIGN_C    = ESC + b'a\x01'
BOLD_ON    = ESC + b'E\x01'
BOLD_OFF   = ESC + b'E\x00'
DOUBLE_ON  = ESC + b'!\x30'
DOUBLE_OFF = ESC + b'!\x00'
CUT        = b'\x1d\x56\x41\x05'
LF         = b'\n'
# ───────────────────────────────────────────────────────────────


def enc(text):
    return text.encode("cp437", errors="replace")


def two_col(left, right, width=LINE_WIDTH):
    gap = width - len(left) - len(right)
    return left + " " * max(gap, 1) + right


def three_col(left, mid, right, width=LINE_WIDTH):
    mid_w   = 8
    right_w = 8
    left_w  = width - mid_w - right_w
    left  = left[:left_w].ljust(left_w)
    mid   = mid[:mid_w].center(mid_w)
    right = right[:right_w].rjust(right_w)
    return left + mid + right


def sep(char="-"):
    return char * LINE_WIDTH


def build_receipt_raw(data: dict) -> bytes:
    """
    data keys (sabhi Django OrderViewSet.receipt() se aate hain):
        outlet        : { name, address, gstin, phone }
        order_number  : str
        date          : ISO datetime string
        cashier       : str
        order_type    : str  (dine_in / takeaway / ...)
        items         : [ { product_name, quantity, unit_price, item_total }, ... ]
        totals        : { subtotal, cgst, sgst, total, discount }
    """
    outlet     = data.get("outlet", {})
    shop_name  = outlet.get("name", "ATUL ICE CREAM")
    shop_addr  = outlet.get("address", "")
    shop_phone = outlet.get("phone", "")
    shop_gstin = outlet.get("gstin", "")

    order_number = data.get("order_number", "")
    order_type   = data.get("order_type", "").upper().replace("_", " ")
    cashier      = data.get("cashier", "")

    # Parse date
    try:
        dt = datetime.fromisoformat(str(data.get("date", "")).replace("Z", "+00:00"))
        date_str = dt.strftime("%d/%m/%Y")
        time_str = dt.strftime("%I:%M %p").lstrip("0")
    except Exception:
        now = datetime.now()
        date_str = now.strftime("%d/%m/%Y")
        time_str = now.strftime("%I:%M %p").lstrip("0")

    items   = data.get("items", [])
    totals  = data.get("totals", {})
    subtotal = float(totals.get("subtotal", 0))
    cgst     = float(totals.get("cgst", 0))
    sgst     = float(totals.get("sgst", 0))
    discount = float(totals.get("discount", 0))
    total    = float(totals.get("total", 0))

    raw = b""
    raw += INIT

    # ── HEADER ──────────────────────────────────────────────────
    raw += ALIGN_C + DOUBLE_ON + BOLD_ON
    raw += enc(shop_name + "\n")
    raw += DOUBLE_OFF + BOLD_OFF

    raw += ALIGN_C
    if shop_addr:
        raw += enc(shop_addr[:LINE_WIDTH].center(LINE_WIDTH) + "\n")
    if shop_phone:
        raw += enc(f"PH: {shop_phone}".center(LINE_WIDTH) + "\n")
    if shop_gstin:
        raw += enc(f"GSTIN: {shop_gstin}".center(LINE_WIDTH) + "\n")
    raw += enc(sep(".") + "\n")

    # ── TAX INVOICE ─────────────────────────────────────────────
    raw += ALIGN_C + BOLD_ON
    raw += enc("TAX INVOICE\n")
    raw += BOLD_OFF

    raw += ALIGN_L
    raw += enc(two_col(f"Bill No: {order_number}", order_type) + "\n")
    raw += enc(two_col(f"Date: {date_str}", f"Time: {time_str}") + "\n")
    if cashier:
        raw += enc(f"Cashier: {cashier}\n")
    raw += enc(sep(".") + "\n")

    # ── ITEMS HEADER ────────────────────────────────────────────
    raw += ALIGN_L + BOLD_ON
    raw += enc(three_col("ITEM Description", "QTY", "Amt") + "\n")
    raw += BOLD_OFF
    raw += enc(sep(".") + "\n")

    # ── ITEMS ───────────────────────────────────────────────────
    for item in items:
        name       = item.get("product_name", item.get("name", "Item"))
        qty        = float(item.get("quantity", 1))
        unit_price = float(item.get("unit_price", item.get("price", 0)))
        amount     = float(item.get("item_total", qty * unit_price))

        raw += ALIGN_L
        raw += enc(three_col(name, f"{qty:.0f}", f"\x9c{amount:.0f}") + "\n")
        raw += enc(three_col(f"  @ {unit_price:.2f}", "", "") + "\n")

    raw += enc(sep(".") + "\n")

    # ── TOTALS ──────────────────────────────────────────────────
    raw += ALIGN_L
    raw += enc(two_col("Subtotal", f"\x9c{subtotal:.2f}") + "\n")
    if discount > 0:
        raw += enc(two_col("Discount", f"-\x9c{discount:.2f}") + "\n")
    if cgst > 0:
        raw += enc(two_col("CGST (2.5%)", f"\x9c{cgst:.2f}") + "\n")
    if sgst > 0:
        raw += enc(two_col("SGST (2.5%)", f"\x9c{sgst:.2f}") + "\n")
    raw += enc(sep(".") + "\n")

    raw += BOLD_ON
    raw += enc(two_col("NET PAYABLE", f"\x9c{total:.2f}") + "\n")
    raw += BOLD_OFF
    raw += enc(sep(".") + "\n")

    # ── FOOTER ──────────────────────────────────────────────────
    raw += ALIGN_C
    raw += enc("THANK YOU! VISIT AGAIN\n")
    raw += enc("Powered by Atul POS\n")

    raw += LF + LF + LF
    raw += CUT

    return raw


def send_to_printer(raw: bytes, printer_name: str = None):
    name = printer_name or PRINTER_NAME
    hPrinter = win32print.OpenPrinter(name)
    try:
        hJob = win32print.StartDocPrinter(hPrinter, 1, ("Receipt", None, "RAW"))
        win32print.StartPagePrinter(hPrinter)
        win32print.WritePrinter(hPrinter, raw)
        win32print.EndPagePrinter(hPrinter)
        win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "printer": PRINTER_NAME})


@app.route("/printers", methods=["GET"])
def list_printers():
    """Windows mein installed printers ki list."""
    try:
        printers = [p[2] for p in win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        )]
    except Exception:
        printers = []
    return jsonify({"printers": printers, "selected": PRINTER_NAME})


@app.route("/set-printer", methods=["POST"])
def set_printer():
    """Settings se printer change karo."""
    global PRINTER_NAME
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("printer_name") or data.get("printerName", "")
    if not name:
        return jsonify({"error": "printer_name required"}), 400
    PRINTER_NAME = name
    save_printer_name(name)
    print(f"[Config] Printer changed to: {name}")
    return jsonify({"success": True, "printer_name": name})


@app.route("/print", methods=["POST", "OPTIONS"])
def print_receipt():
    """
    Browser (atulicecream.com) ya Django backend se call hota hai.

    Two modes:
      - 'html' field present  → HTML string hai (legacy browser path)
      - 'order_number' field  → Structured JSON → ESC/POS bytes
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    try:
        # HTML mode (browser se purana printReceipt call)
        if "html" in data:
            # HTML ko plain text mein convert karke print karo
            # Simple approach: HTML strip karke line-by-line
            import re
            html = data["html"]
            text = re.sub(r'<br\s*/?>', '\n', html)
            text = re.sub(r'<[^>]+>', '', text)
            text = re.sub(r'&nbsp;', ' ', text)
            text = re.sub(r'&amp;', '&', text)
            text = re.sub(r'  +', ' ', text)
            # Wrap in minimal receipt
            wrapped = {
                "outlet": {"name": "", "address": "", "phone": "", "gstin": ""},
                "order_number": "",
                "date": "",
                "cashier": "",
                "order_type": "",
                "items": [],
                "totals": {"subtotal": 0, "cgst": 0, "sgst": 0, "discount": 0, "total": 0},
                "_raw_text": text,
            }
            raw = build_receipt_raw(wrapped)
            send_to_printer(raw)
            print("[OK] HTML print via ESC/POS")
            return jsonify({"success": True, "method": "html_escpos"})

        # Structured JSON mode (ESC/POS)
        raw = build_receipt_raw(data)
        send_to_printer(raw)
        print(f"[OK] Printed: {data.get('order_number', '?')} on {PRINTER_NAME}")
        return jsonify({"success": True, "method": "escpos", "printer": PRINTER_NAME,
                        "order": data.get("order_number")})

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"error": str(e)}), 500


def is_port_in_use(port: int) -> bool:
    """Check karo ki port already occupied hai ya nahi."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except (ConnectionRefusedError, socket.timeout, OSError):
            return False


def get_pid_on_port(port: int) -> int | None:
    """netstat se us port pe kaun sa PID listen kar raha hai, woh dhundo."""
    try:
        result = subprocess.check_output(
            ["netstat", "-ano"],
            text=True, stderr=subprocess.DEVNULL
        )
        for line in result.splitlines():
            # Match LISTENING state on our port
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if parts:
                    try:
                        return int(parts[-1])
                    except ValueError:
                        pass
    except Exception:
        pass
    return None


def ensure_port_free(port: int):
    """Agar port busy hai to puraane process ko kill karo."""
    if not is_port_in_use(port):
        return  # Port free hai, kuch karna nahi

    print(f"[!] Port {port} already in use — puraana instance dhundh raha hoon...")
    pid = get_pid_on_port(port)

    if pid is None:
        print(f"[!] PID nahi mila. Manually port {port} free karo aur dobara try karo.")
        sys.exit(1)

    print(f"[!] PID {pid} port {port} pe chal raha hai — kill kar raha hoon...")
    try:
        subprocess.check_call(
            ["taskkill", "/PID", str(pid), "/F"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        print(f"[OK] PID {pid} successfully terminate ho gaya.")
    except subprocess.CalledProcessError:
        print(f"[ERROR] PID {pid} ko kill nahi kar paaya. Admin rights se run karo.")
        sys.exit(1)

    # Port free hone ka wait karo
    for _ in range(10):
        time.sleep(0.5)
        if not is_port_in_use(port):
            print(f"[OK] Port {port} ab free hai.\n")
            return

    print(f"[ERROR] Port {port} abhi bhi busy hai. Manually restart karo.")
    sys.exit(1)


if __name__ == "__main__":
    # ── First-run: printer select karo ──────────────────────────
    if not os.path.exists(CONFIG_FILE):
        print("\n" + "="*50)
        print("  ATUL POS — PRINTER SETUP (Pehli baar)")
        print("="*50)
        try:
            printers = [p[2] for p in win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            )]
        except Exception:
            printers = []

        if printers:
            print("\nInstalled printers:")
            for i, p in enumerate(printers):
                print(f"  {i+1}. {p}")
            try:
                choice = input(f"\nPrinter number choose karo (default 1): ").strip()
                idx = int(choice) - 1 if choice else 0
                selected = printers[max(0, min(idx, len(printers)-1))]
                PRINTER_NAME = selected
                save_printer_name(selected)
                print(f"\n[Setup] Printer saved: {selected}")
            except Exception:
                pass
        else:
            print("[Warning] Koi printer nahi mila, default use ho raha hai.")
        print("="*50 + "\n")

    # ── Port conflict resolve karo before starting Flask ────────
    ensure_port_free(9191)

    print(f"[Atul Print Server] Starting on http://127.0.0.1:9191")
    print(f"[Atul Print Server] Printer: {PRINTER_NAME}")
    print(f"[Atul Print Server] Isko band mat karna jab tak POS chal raha ho!\n")
    app.run(host="127.0.0.1", port=9191, debug=False)
