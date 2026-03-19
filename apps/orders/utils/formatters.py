def format_thermal_receipt(order, outlet):
    """
    Format order data into a 32-42 column plain text string for 80mm thermal printers.
    """
    width = 32
    lines = []
    
    # Header
    lines.append(outlet.name.center(width))
    if outlet.address:
        lines.append(outlet.address.center(width))
    if outlet.phone:
        lines.append(f"PH: {outlet.phone}".center(width))
    if outlet.gstin:
        lines.append(f"GST: {outlet.gstin}".center(width))
        
    lines.append("-" * width)
    
    # Order Info
    lines.append(f"ORDER: #{order.order_number}")
    lines.append(f"DATE: {order.created_at.strftime('%d-%m-%Y %H:%M')}")
    lines.append(f"TOKEN: {order.token_number or 'N/A'}")
    
    lines.append("-" * width)
    lines.append(f"{'ITEM':<20} {'QTY':>4} {'AMT':>6}")
    lines.append("-" * width)
    
    # Items
    for item in order.items.all():
        name = item.product.name[:18]
        lines.append(f"{name:<20} {item.quantity:>4.0f} {item.item_total:>6.0f}")
        
    lines.append("-" * width)
    
    # Totals
    lines.append(f"{'SUBTOTAL':<20} {order.subtotal:>11.2f}")
    lines.append(f"{'GST':<20} {order.tax_amount:>11.2f}")
    lines.append(f"{'TOTAL':<20} {order.total_amount:>11.2f}")
    
    lines.append("-" * width)
    if outlet.receipt_footer:
        lines.append(outlet.receipt_footer.center(width))
    else:
        lines.append("THANK YOU, VISIT AGAIN!".center(width))
        
    lines.append("\n\n\n\n") 
    
    return "\n".join(lines)

def generate_escpos_bin(order, outlet):
    """
    Generate RAW ESC/POS binary data for direct-to-printer communication.
    Supports Bold headers, Drawer Kick, and Auto-Cut.
    """
    # ESC/POS Constants
    INIT = b"\x1b\x40"
    CENTER = b"\x1b\x61\x01"
    LEFT = b"\x1b\x61\x00"
    BOLD_ON = b"\x1b\x45\x01"
    BOLD_OFF = b"\x1b\x45\x00"
    DOUBLE_SIZE = b"\x1d\x21\x11"
    NORMAL_SIZE = b"\x1d\x21\x00"
    DRAWER_KICK = b"\x1b\x70\x00\x19\xfa"
    CUT = b"\x1d\x56\x01"
    
    res = INIT + DRAWER_KICK
    
    # Header (Centered & Bold)
    res += CENTER + BOLD_ON + DOUBLE_SIZE + outlet.name.encode('ascii', 'ignore') + b"\n"
    res += NORMAL_SIZE + outlet.address.encode('ascii', 'ignore') + b"\n"
    res += b"PH: " + outlet.phone.encode('ascii') + b"\n" + BOLD_OFF
    
    res += LEFT + b"-" * 32 + b"\n"
    res += BOLD_ON + b"ORDER: #" + order.order_number.encode('ascii') + BOLD_OFF + b"\n"
    res += b"TOKEN: " + (order.token_number or "N/A").encode('ascii') + b"\n"
    res += b"-" * 32 + b"\n"
    
    # Items Header
    res += b"ITEM                QTY   AMT\n"
    res += b"-" * 32 + b"\n"
    
    for item in order.items.all():
        name = item.product.name[:18].ljust(18)
        qty = str(int(item.quantity)).rjust(4)
        amt = str(int(item.item_total)).rjust(6)
        res += name.encode('ascii', 'ignore') + b" " + qty.encode('ascii') + b" " + amt.encode('ascii') + b"\n"
        
    res += b"-" * 32 + b"\n"
    res += b"SUBTOTAL: " + str(order.subtotal).rjust(22).encode('ascii') + b"\n"
    res += BOLD_ON + DOUBLE_SIZE + b"TOTAL: " + str(order.total_amount).rjust(15).encode('ascii') + b"\n" + NORMAL_SIZE + BOLD_OFF
    
    res += b"\n" + CENTER + (outlet.receipt_footer or "THANK YOU!").encode('ascii', 'ignore') + b"\n"
    res += b"\n\n\n" + CUT
    
    return res
