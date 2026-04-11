# -*- mode: python ; coding: utf-8 -*-

import os, site
# escpos package path
escpos_dir = None
for sp in site.getsitepackages():
    candidate = os.path.join(sp, 'escpos')
    if os.path.isdir(candidate):
        escpos_dir = candidate
        break

a = Analysis(
    ['print_server.py'],
    pathex=[],
    binaries=[],
    datas=[
        # capabilities.json — escpos runtime mein load karta hai, bundle zaroori hai
        (os.path.join(escpos_dir, 'capabilities.json'), 'escpos'),
    ],
    hiddenimports=[
        'escpos',
        'escpos.printer',
        'escpos.printer.win32raw',
        'escpos.capabilities',
        'escpos.constants',
        'escpos.exceptions',
        'escpos.magicencode',
        'escpos.codepages',
        'escpos.image',
        'escpos.katakana',
        'escpos.config',
        'win32print',
        'win32api',
        'pycparser',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='print_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
