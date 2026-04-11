import sys
import json
import win32print
from datetime import datetime

# ─── CONFIG ───────────────────────────────────────────────────
PRINTER_NAME = "EPSON TM-T82 Receipt"
LINE_WIDTH   = 42

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

def enc(text):
    return text.encode("cp437", errors="replace")

def two_col(left, right, width=LINE_WIDTH):
    gap = width - len(left) - len(right)
    return left + " " * max(gap, 1) + right

def three_col(left, mid, right, width=LINE_WIDTH):
    mid_w = 8
    right_w = 8
    left_w = width - mid_w - right_w
    left  = str(left)[:left_w].ljust(left_w)
    mid   = str(mid)[:mid_w].center(mid_w)
    right = str(right)[:right_w].rjust(right_w)
    return left + mid + right

def sep(char="-"):
    return char * LINE_WIDTH

def build_raw(data):
    # Parse data from Electron
    outlet = data.get('outlet', {})
    shop_name = outlet.get('name', "ATUL ICE CREAM")
    shop_sub  = outlet.get('sub_name', "ATUL ICE CREAM - RAJKOT")
    shop_addr = outlet.get('address', "Opp. Bhaktinagar Police Station, Kothariya")
    shop_phone = outlet.get('phone', "9825758887")
    shop_gstin = outlet.get('gstin', "24AAAAA0000A1Z5")

    order_no = data.get('order_number', '')
    order_type = (data.get('order_type', 'DINE')).upper()
    cashier = data.get('cashier', '')
    
    date_val = data.get('date', '')
    try:
        dt = datetime.fromisoformat(date_val.replace('Z', '+00:00')) if date_val else datetime.now()
    except:
        dt = datetime.now()
    
    date_str = dt.strftime("%d/%m/%Y")
    time_str = dt.strftime("%I:%M %p").lstrip("0")

    totals = data.get('totals', {})
    subtotal = float(totals.get('subtotal', 0))
    cgst_amt = float(totals.get('cgst', 0))
    sgst_amt = float(totals.get('sgst', 0))
    net_pay  = float(totals.get('total', 0))

    items = data.get('items', [])

    raw = b""
    raw += INIT

    # Header
    raw += ALIGN_C + DOUBLE_ON + BOLD_ON
    raw += enc(shop_name + "\n")
    raw += DOUBLE_OFF + BOLD_OFF

    raw += ALIGN_C
    raw += enc(shop_sub + "\n")
    for line in shop_addr.split('\n'):
        raw += enc(line.strip() + "\n")
    raw += enc(f"PH: {shop_phone}\n")
    raw += enc(f"GSTIN: {shop_gstin}\n")
    raw += enc(sep(".") + "\n")

    # Title
    raw += ALIGN_C + BOLD_ON
    raw += enc("TAX INVOICE\n")
    raw += BOLD_OFF

    # Info
    raw += ALIGN_L
    raw += enc(two_col(f"Bill No: {order_no}", order_type) + "\n")
    raw += enc(two_col(f"Date: {date_str}", f"Time: {time_str}") + "\n")
    if cashier: raw += enc(f"Cashier: {cashier}\n")
    raw += enc(sep(".") + "\n")

    # Items Header
    raw += ALIGN_L + BOLD_ON
    raw += enc(three_col("ITEM Description", "QTY", "Amt") + "\n")
    raw += BOLD_OFF
    raw += enc(sep(".") + "\n")

    # Items
    for item in items:
        name = item.get('product_name') or item.get('name') or 'Item'
        qty = float(item.get('quantity') or 1)
        price = float(item.get('unit_price') or item.get('price') or 0)
        amount = float(item.get('item_total') or (qty * price))
        
        raw += ALIGN_L
        raw += enc(three_col(name, f"{qty:.2f}", f"\x9c{amount:.0f}") + "\n")
        raw += enc(three_col(f"  {price:.2f}  Units", "", "") + "\n")

    raw += enc(sep(".") + "\n")

    # Totals
    raw += ALIGN_L
    raw += enc(two_col("Subtotal", f"\x9c{subtotal:.2f}") + "\n")
    raw += enc(two_col("CGST (2.5%)", f"\x9c{cgst_amt:.2f}") + "\n")
    raw += enc(two_col("SGST (2.5%)", f"\x9c{sgst_amt:.2f}") + "\n")
    raw += enc(sep(".") + "\n")

    raw += BOLD_ON
    raw += enc(two_col("NET PAYABLE", f"\x9c{net_pay:.2f}") + "\n")
    raw += BOLD_OFF
    raw += enc(sep(".") + "\n")

    # Footer
    raw += ALIGN_C
    raw += enc("THANK YOU! VISIT AGAIN\n")
    raw += enc("Software by Atul Ice Cream\n")
    raw += enc("* Items price sold cannot be returned *\n")

    raw += LF + LF + LF + LF + LF
    raw += CUT

    return raw

def main():
    if len(sys.argv) < 3:
        print("Usage: python print_utility.py <PrinterName> <JSON_DATA>")
        return

    printer_name = sys.argv[1]
    try:
        data = json.loads(sys.argv[2])
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        return

    raw = build_raw(data)
    
    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("POS Receipt", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)
            win32print.WritePrinter(hPrinter, raw)
            win32print.EndPagePrinter(hPrinter)
            win32print.EndDocPrinter(hPrinter)
            print("OK")
        finally:
            win32print.ClosePrinter(hPrinter)
    except Exception as e:
        print(f"Printer Error: {e}")

if __name__ == "__main__":
    main()
