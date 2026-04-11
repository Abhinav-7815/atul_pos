from escpos.printer import Win32Raw
from datetime import datetime

# ─── PRINTER ───────────────────────────────────────────────────
PRINTER_NAME = "EPSON TM-T82 Receipt"
LINE_WIDTH   = 42
# ───────────────────────────────────────────────────────────────

# ─── SHOP INFO ─────────────────────────────────────────────────
SHOP_NAME    = "ATUL ICE CREAM"
SHOP_SUBNAME = "ATUL ICE CREAM - RAJKOT"
SHOP_ADDRESS = "Opp. Bhaktinagar Police Station,"
SHOP_ADDRESS2= "Kothariya Main Rd, nr. Nilkan Cinema,"
SHOP_PHONE   = "PH: 9825758887"
SHOP_GSTIN   = "GSTIN: 24AAAAA0000A1Z5"
# ───────────────────────────────────────────────────────────────

# ─── TAX RATES ─────────────────────────────────────────────────
CGST_RATE = 2.5
SGST_RATE = 2.5
# ───────────────────────────────────────────────────────────────

# ─── ORDER DATA ────────────────────────────────────────────────
ORDER_TYPE = "DINE"

ITEMS = [
    # (item_name, unit_label, quantity, price_per_unit)
    ("Vanilla",     "Cups",  1,   38),
    ("Kaju Katli",  "Grams", 250,  5),
    ("Lollipop",    "Candy", 10,   2),
    ("Mango Slice", "Pcs",   3,   15),
    ("Milk",        "Ltr",   2,   60),
]
# ───────────────────────────────────────────────────────────────

# ─── ESC/POS COMMANDS ──────────────────────────────────────────
ESC        = b'\x1b'
INIT       = ESC + b'@'
ALIGN_L    = ESC + b'a\x00'
ALIGN_C    = ESC + b'a\x01'
BOLD_ON    = ESC + b'E\x01'
BOLD_OFF   = ESC + b'E\x00'
DOUBLE_ON  = ESC + b'!\x11'   # double height only (not width)
DOUBLE_OFF = ESC + b'!\x00'
CUT        = b'\x1d\x56\x41\x05'
LEFT_MARGIN = b'\x1d\x4c\x18\x00'   # GS L = 24 dots (~3mm at 203 DPI)

# Rupee: switch to WPC1252, send 0x80, switch back
# (0x80 = Rs on Indian Epson firmware; change to b'' if wrong)
CP_WPC1252 = ESC + b'\x74\x10'
CP_PC437   = ESC + b'\x74\x00'
RUPEE_BYTE = CP_WPC1252 + b'\x80' + CP_PC437
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


def sep(char="-"):
    return char * LINE_WIDTH


def bill_number():
    now = datetime.now()
    return f"ORD-{now.strftime('%Y%m%d')}-{now.strftime('%H%M')}"


def print_receipt(items, order_type=ORDER_TYPE):
    now      = datetime.now()
    date_str = f"{now.day}/{now.month}/{now.year}"
    time_str = now.strftime("%I:%M").lstrip("0")
    bill_no  = bill_number()

    subtotal = sum(qty * price for _, _, qty, price in items)
    cgst_amt = round(subtotal * CGST_RATE / 100, 2)
    sgst_amt = round(subtotal * SGST_RATE / 100, 2)
    net_pay  = round(subtotal + cgst_amt + sgst_amt, 2)

    try:
        p = Win32Raw(PRINTER_NAME)
    except Exception as e:
        print(f"[ERROR] Printer nahi khuli: {e}")
        return

    try:
        p._raw(INIT)
        p._raw(LEFT_MARGIN)

        # ── HEADER ──────────────────────────────────────────
        p._raw(ALIGN_C + BOLD_ON + DOUBLE_ON)
        p._raw(enc(SHOP_NAME + "\n"))
        p._raw(DOUBLE_OFF + BOLD_OFF)

        p._raw(ALIGN_C)
        p._raw(enc(SHOP_SUBNAME + "\n"))
        p._raw(enc(SHOP_ADDRESS + "\n"))
        p._raw(enc(SHOP_ADDRESS2 + "\n"))
        p._raw(enc(SHOP_PHONE + "\n"))
        p._raw(enc(SHOP_GSTIN + "\n"))
        p._raw(enc(sep(".") + "\n"))

        # ── TAX INVOICE ─────────────────────────────────────
        p._raw(ALIGN_C + BOLD_ON)
        p._raw(enc("TAX INVOICE\n"))
        p._raw(BOLD_OFF + ALIGN_L)

        p._raw(enc(two_col(f"Bill No: {bill_no}", order_type) + "\n"))
        p._raw(enc(two_col(f"Date: {date_str}", f"Time: {time_str}") + "\n"))
        p._raw(enc(sep(".") + "\n"))

        # ── ITEMS HEADER ────────────────────────────────────
        p._raw(BOLD_ON)
        p._raw(enc(three_col("ITEM Description", "QTY", "Amt") + "\n"))
        p._raw(BOLD_OFF)
        p._raw(enc(sep(".") + "\n"))

        # ── ITEMS ───────────────────────────────────────────
        for name, unit, qty, price in items:
            amount = qty * price
            p._raw(enc(three_col(name, f"{qty:.0f} {unit}", f"{amount:.2f}/-") + "\n"))

        p._raw(enc(sep(".") + "\n"))

        # ── TOTALS ──────────────────────────────────────────
        p._raw(enc(two_col("Subtotal",             f"{subtotal:.2f}/-") + "\n"))
        p._raw(enc(two_col(f"CGST ({CGST_RATE}%)", f"{cgst_amt:.2f}/-") + "\n"))
        p._raw(enc(two_col(f"SGST ({SGST_RATE}%)", f"{sgst_amt:.2f}/-") + "\n"))
        p._raw(enc(sep(".") + "\n"))

        p._raw(BOLD_ON)
        p._raw(enc(two_col("NET PAYABLE", f"{net_pay:.2f}/-") + "\n"))
        p._raw(BOLD_OFF)
        p._raw(enc(sep(".") + "\n"))

        # ── FOOTER ──────────────────────────────────────────
        p._raw(ALIGN_C)
        p._raw(enc("THANK YOU! VISIT AGAIN\n"))
        p._raw(enc("Powered by Atul POS\n"))
        p._raw(enc("* Items price sold cannot be returned *\n"))

        p._raw(b"\n\n\n")
        p._raw(CUT)

        p.close()
        print("[OK] Receipt print ho gayi!")

    except Exception as e:
        print(f"[ERROR] Print error: {e}")


if __name__ == "__main__":
    print_receipt(ITEMS)
