"""
Atul POS — Python Print Server
Port 9192 pe HTTP server chalta hai.
Print method: python-escpos Win32Raw (same as test_print.py)
"""

import sys
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import win32print
from escpos.printer import Win32Raw

# ─── PRINTER ───────────────────────────────────────────────────
LINE_WIDTH = 42
# ───────────────────────────────────────────────────────────────

# ─── TAX RATES ─────────────────────────────────────────────────
CGST_RATE = 2.5
SGST_RATE = 2.5
# ───────────────────────────────────────────────────────────────

# ─── ESC/POS COMMANDS ──────────────────────────────────────────
ESC        = b'\x1b'
INIT       = ESC + b'@'
ALIGN_L    = ESC + b'a\x00'
ALIGN_C    = ESC + b'a\x01'
BOLD_ON    = ESC + b'E\x01'
BOLD_OFF   = ESC + b'E\x00'
BOLD_WIDE  = ESC + b'!\x38'   # bold + double width + double height (0x38 = bit 3+4+5)
NORMAL     = ESC + b'!\x00'
CUT        = b'\x1d\x56\x41\x05'
LEFT_MARGIN = b'\x1d\x4c\x18\x00'
# ───────────────────────────────────────────────────────────────


def enc(text):
    return text.encode("cp437", errors="replace")


def two_col(left, right, width=LINE_WIDTH):
    gap = width - len(left) - len(right)
    return left + " " * max(gap, 1) + right


def three_col(left, mid, right, width=LINE_WIDTH):
    mid_w, right_w = 8, 8
    left_w = width - mid_w - right_w
    return left[:left_w].ljust(left_w) + mid.center(mid_w) + right.rjust(right_w)


def four_col(name, qty, rate, amt, width=LINE_WIDTH):
    # ITEM(18) | QTY(8) | RATE(7) | AMT(9)
    name_w, qty_w, rate_w, amt_w = 18, 8, 7, 9
    lines = []
    # If name fits in one line
    if len(name) <= name_w:
        lines.append(name.ljust(name_w) +
                     qty[:qty_w].center(qty_w) +
                     rate[:rate_w].center(rate_w) +
                     amt[:amt_w].rjust(amt_w))
    else:
        # First line: name part 1 + qty + rate + amt
        lines.append(name[:name_w].ljust(name_w) +
                     qty[:qty_w].center(qty_w) +
                     rate[:rate_w].center(rate_w) +
                     amt[:amt_w].rjust(amt_w))
        # Second line: remaining name only
        lines.append(name[name_w:name_w*2].strip())
    return "\n".join(lines)


def sep(char="-"):
    return char * LINE_WIDTH


# Variant name → display label mapping
UNIT_DISPLAY = {
    "100gm":  "1 Cup",
    "100 gm": "1 Cup",
    "100gms":  "1 Cup",
    "100 gms": "1 Cup",
    "100g":   "1 Cup",
    "200gm":  "2 Cups",
    "200 gm": "2 Cups",
    "200gms":  "2 Cups",
    "200 gms": "2 Cups",
    "250gm":  "250 Gms",
    "250 gm": "250 Gms",
    "250gms": "250 Gms",
    "250 gms":"250 Gms",
    "500gm":  "500 Gms",
    "500 gm": "500 Gms",
    "500gms": "500 Gms",
    "500 gms":"500 Gms",
    "1kg":    "1 KG",
    "1 kg":   "1 KG",
}

def normalize_unit(unit: str) -> str:
    return UNIT_DISPLAY.get(unit.strip().lower(), unit)

def print_receipt(printer_name: str, data: dict):
    outlet     = data.get("outlet", {})
    shop_name  = outlet.get("name",  "ATUL ICE CREAM")
    shop_addr  = outlet.get("address", "")
    shop_city  = outlet.get("city",  "")
    shop_phone = outlet.get("phone", "")
    shop_gstin = outlet.get("gstin", "")
    shop_fssai = outlet.get("fssai", "")

    bill_no        = str(data.get("order_number", ""))
    order_type     = str(data.get("order_type",   "DINE")).upper()
    cashier        = data.get("cashier", "")
    customer_phone = data.get("customer_phone", "")
    customer_name  = data.get("customer_name", "")

    date_val = data.get("date", "")
    try:
        dt = datetime.fromisoformat(date_val.replace("Z", "+00:00")) if date_val else datetime.now()
    except Exception:
        dt = datetime.now()

    date_str = f"{dt.day}/{dt.month}/{dt.year}"
    time_str = dt.strftime("%I:%M").lstrip("0")

    totals   = data.get("totals", {})
    subtotal = float(totals.get("subtotal", 0))
    cgst_amt = float(totals.get("cgst",     0))
    sgst_amt = float(totals.get("sgst",     0))
    net_pay  = float(totals.get("total",    0))
    items    = data.get("items", [])

    p = Win32Raw(printer_name)

    p._raw(INIT)
    p._raw(LEFT_MARGIN)

    # ── HEADER ──────────────────────────────────────────────
    p._raw(ALIGN_C + BOLD_WIDE)
    p._raw(enc(shop_name + "\n"))
    p._raw(NORMAL)

    p._raw(ALIGN_C)
    if shop_addr:
        p._raw(enc(shop_addr + "\n"))
    if shop_city:
        p._raw(enc(shop_city + "\n"))
    if shop_phone:
        p._raw(enc(f"PH: {shop_phone}\n"))
    if shop_gstin:
        p._raw(enc(f"GSTIN: {shop_gstin}\n"))
    if shop_fssai:
        p._raw(enc(f"FSSAI: {shop_fssai}\n"))
    p._raw(enc(sep(".") + "\n"))

    # ── TAX INVOICE ─────────────────────────────────────────
    p._raw(ALIGN_C + BOLD_ON)
    p._raw(enc("TAX INVOICE\n"))
    p._raw(BOLD_OFF + ALIGN_L)

    p._raw(enc(two_col(f"Bill No: {bill_no}", order_type) + "\n"))
    p._raw(enc(two_col(f"Date: {date_str}", f"Time: {time_str}") + "\n"))
    if cashier:
        p._raw(enc(f"Cashier: {cashier}\n"))
    if customer_name:
        p._raw(enc(f"Customer: {customer_name}\n"))
    if customer_phone:
        p._raw(enc(f"Mobile: {customer_phone}\n"))
    p._raw(enc(sep(".") + "\n"))

    # ── ITEMS HEADER ────────────────────────────────────────
    p._raw(BOLD_ON)
    p._raw(enc(four_col("ITEM", "QTY", "RATE", "AMOUNT") + "\n"))
    p._raw(BOLD_OFF)
    p._raw(enc(sep(".") + "\n"))

    # ── ITEMS ───────────────────────────────────────────────
    for item in items:
        name   = item.get("product_name") or item.get("name") or "Item"
        unit   = normalize_unit(item.get("unit_label", ""))
        qty    = float(item.get("quantity", 1))
        price  = float(item.get("unit_price") or item.get("price") or 0)
        amount = float(item.get("item_total") or item.get("item_subtotal") or (qty * price))

        qty_int = int(qty) if qty == int(qty) else qty
        # Generic units — show only number
        generic = not unit or unit.lower() in ("pc(s)", "pcs", "pc", "units", "unit", "piece", "pieces")
        if generic:
            qty_str = str(qty_int)
        elif unit and unit[0].isdigit():
            # "250 Gms", "500 Gms", "1 Kg" — unit already has size info, skip qty prefix
            qty_str = unit
        else:
            # "Cup", "Cone" etc — prefix with qty: "1 Cup", "3 Cup"
            qty_str = f"{qty_int} {unit}"

        p._raw(ESC + b'!\x18')
        p._raw(enc(four_col(name, qty_str, f"{price:.2f}", f"{amount:.2f}/-") + "\n"))
        p._raw(NORMAL)

    p._raw(enc(sep(".") + "\n"))

    # ── TOTALS ──────────────────────────────────────────────
    p._raw(enc(two_col("Subtotal",             f"{subtotal:.2f}/-") + "\n"))
    p._raw(enc(two_col(f"CGST ({CGST_RATE}%)", f"{cgst_amt:.2f}/-") + "\n"))
    p._raw(enc(two_col(f"SGST ({SGST_RATE}%)", f"{sgst_amt:.2f}/-") + "\n"))
    p._raw(enc(sep(".") + "\n"))

    p._raw(BOLD_ON + ESC + b'!\x18')   # bold + double height + double width
    p._raw(enc(two_col("NET PAYABLE", f"{net_pay:.2f}/-") + "\n"))
    p._raw(NORMAL)
    p._raw(enc(sep(".") + "\n"))

    # ── FOOTER ──────────────────────────────────────────────
    p._raw(ALIGN_C)
    p._raw(enc("THANK YOU! VISIT AGAIN\n"))
    p._raw(enc("Powered by Atul POS\n"))
    p._raw(enc("* Items price sold cannot be returned *\n"))

    p._raw(b"\n\n\n")
    p._raw(CUT)

    p.close()
    print("[OK] Receipt print ho gayi!", flush=True)


# ─── HTTP SERVER ────────────────────────────────────────────────

class PrintHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"[Server] {format % args}", flush=True)

    def _json(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Printer-Name")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "server": "python-escpos-Win32Raw"})
        elif self.path == "/printers":
            try:
                printers = [p[2] for p in win32print.EnumPrinters(
                    win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
                )]
            except Exception:
                printers = []
            self._json(200, {"printers": printers})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/print":
            self._json(404, {"error": "not found"})
            return

        printer_name = self.headers.get("X-Printer-Name", "").strip()
        if not printer_name:
            printer_name = sys.argv[1] if len(sys.argv) > 1 else ""

        if not printer_name:
            self._json(422, {"error": "Printer name nahi mila"})
            return

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)

        try:
            data = json.loads(body)
        except Exception as e:
            self._json(400, {"error": f"JSON error: {e}"})
            return

        try:
            print_receipt(printer_name, data)
            self._json(200, {"success": True, "method": "python-escpos-Win32Raw"})
        except Exception as e:
            print(f"[ERROR] {e}", flush=True)
            self._json(500, {"error": str(e)})


def run():
    port = 9192
    server = HTTPServer(("127.0.0.1", port), PrintHandler)
    print(f"[PythonServer] Listening on 127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join()
