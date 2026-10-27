#!/usr/bin/env python3
"""Dump an .xlsx itinerary as plain text, one block per day column.

Written because this machine has no openpyxl and no markitdown -- an .xlsx is
just a zip of XML, so the standard library is enough.

Two things make tour itineraries different from ordinary spreadsheets, and both
are handled here:

1. Vertical position encodes time. The first column holds hour labels and each
   spreadsheet row is a half-hour, so a block's row span gives its approximate
   start and end. Pass --anchor to say which row is which hour (default: row 3
   is 07:00, matching the Makoto template).

2. Blocks are drawn by merging cells and by stacking continuation lines in
   consecutive rows. Merges are expanded so a value is attributed to every row
   it covers; without that, a visit looks like it lasts 30 minutes.

Usage:
    read_xlsx.py FILE                 # list sheets, then dump them all
    read_xlsx.py FILE --sheet 3       # dump only sheet 3 (1-based)
    read_xlsx.py FILE --anchor 3=07:00
"""
import argparse
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def col_num(ref):
    letters = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def row_num(ref):
    return int(re.search(r'(\d+)', ref).group(1))


def load(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        shared = [''.join(t.text or '' for t in si.iter(M + 't'))
                  for si in root.findall(M + 'si')]
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target')
            for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = []
    for s in wb.find(M + 'sheets'):
        tgt = rels[s.get(R + 'id')]
        if not tgt.startswith('xl/'):
            tgt = 'xl/' + tgt
        sheets.append((s.get('name'), tgt))
    return z, shared, sheets


def read_sheet(z, shared, target):
    """Return (cells, merges). cells maps (row, col) -> text, merges expanded."""
    root = ET.fromstring(z.read(target))
    cells = {}
    for row in root.iter(M + 'row'):
        for c in row.findall(M + 'c'):
            v = c.find(M + 'v')
            is_el = c.find(M + 'is')
            t = c.get('t')
            if t == 'inlineStr' and is_el is not None:
                val = ''.join(x.text or '' for x in is_el.iter(M + 't'))
            elif v is None:
                continue
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text
            val = ' '.join(str(val).split())
            if val:
                cells[(row_num(c.get('r')), col_num(c.get('r')))] = val

    merges = []
    mc = root.find(M + 'mergeCells')
    if mc is not None:
        for m in mc.findall(M + 'mergeCell'):
            a, b = m.get('ref').split(':')
            merges.append((row_num(a), col_num(a), row_num(b), col_num(b)))

    # A merged range stores its value only in the top-left cell. Record the
    # span so callers can turn row extents into times.
    spans = {}
    for r1, c1, r2, c2 in merges:
        if (r1, c1) in cells:
            spans[(r1, c1)] = (r1, r2)
    return cells, spans


def fmt_time(row, anchor_row, anchor_min, minutes_per_row):
    mins = anchor_min + (row - anchor_row) * minutes_per_row
    if mins < 0:
        return '  ?  '
    return f'{(mins // 60) % 24:02d}:{mins % 60:02d}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--sheet', type=int, help='1-based sheet index; default all')
    ap.add_argument('--anchor', default='3=07:00',
                    help='ROW=HH:MM mapping a spreadsheet row to a clock time')
    ap.add_argument('--minutes-per-row', type=int, default=30)
    ap.add_argument('--max-row', type=int, default=40)
    args = ap.parse_args()

    arow, atime = args.anchor.split('=')
    anchor_row = int(arow)
    ah, am = atime.split(':')
    anchor_min = int(ah) * 60 + int(am)

    z, shared, sheets = load(args.file)

    print(f'FILE: {args.file}')
    print(f'SHEETS ({len(sheets)}):')
    for i, (name, _) in enumerate(sheets, 1):
        print(f'  {i}. {name}')
    if len(sheets) > 1 and args.sheet is None:
        print('\n!! More than one sheet. These are usually competing versions of the\n'
              '   same tour -- confirm which one is current before trusting any of it.\n')

    chosen = [sheets[args.sheet - 1]] if args.sheet else sheets
    for name, target in chosen:
        cells, spans = read_sheet(z, shared, target)
        print(f'\n{"=" * 68}\nSHEET: {name}\n{"=" * 68}')
        cols = sorted({c for (_, c) in cells})
        for col in cols:
            entries = [(r, v) for (r, c), v in sorted(cells.items())
                       if c == col and r <= args.max_row]
            if not entries:
                continue
            header = next((v for r, v in entries if r <= 2), f'column {col}')
            print(f'\n--- col {col}: {header} ---')
            for r, v in entries:
                if r <= 2:
                    continue
                r1, r2 = spans.get((r, col), (r, r))
                start = fmt_time(r1, anchor_row, anchor_min, args.minutes_per_row)
                end = fmt_time(r2 + 1, anchor_row, anchor_min, args.minutes_per_row)
                print(f'  {start}-{end}  {v}')


if __name__ == '__main__':
    sys.exit(main())
