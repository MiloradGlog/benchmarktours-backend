#!/usr/bin/env python3
"""Dump a .pptx as plain text, slide by slide, including tables.

Written because this machine has no python-pptx and no markitdown -- a .pptx is
just a zip of XML, so the standard library is enough.

Proposal decks put the useful content in three places: ordinary text boxes,
tables (a schedule grid), and sometimes only in a picture. This prints the
first two and, with --audit, reports per slide whether there are images or
diagrams whose content it cannot see -- worth knowing before concluding "the
deck doesn't contain a schedule".

Usage:
    read_pptx.py FILE
    read_pptx.py FILE --slides 4,13-19
    read_pptx.py FILE --audit
"""
import argparse
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'


def para_lines(node):
    """Text of each paragraph under a node, blank paragraphs dropped."""
    out = []
    for para in node.iter(A + 'p'):
        line = ''.join(t.text or '' for t in para.iter(A + 't')).strip()
        if line:
            out.append(line)
    return out


def parse_ranges(spec):
    want = set()
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-')
            want.update(range(int(a), int(b) + 1))
        elif part:
            want.add(int(part))
    return want


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--slides', help='e.g. 4,13-19; default all')
    ap.add_argument('--audit', action='store_true',
                    help='also report images/diagrams whose content is not readable as text')
    args = ap.parse_args()

    want = parse_ranges(args.slides) if args.slides else None
    z = zipfile.ZipFile(args.file)
    names = [n for n in z.namelist()
             if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]
    names.sort(key=lambda n: int(re.search(r'slide(\d+)', n).group(1)))

    print(f'FILE: {args.file}   slides: {len(names)}')
    for n in names:
        num = int(re.search(r'slide(\d+)', n).group(1))
        if want and num not in want:
            continue
        raw = z.read(n)
        root = ET.fromstring(raw)
        print(f'\n{"=" * 68}\nSLIDE {num}\n{"=" * 68}')

        for tbl in root.iter(A + 'tbl'):
            print('  [TABLE]')
            for tr in tbl.findall(A + 'tr'):
                cells = [' / '.join(para_lines(tc)) for tc in tr.findall(A + 'tc')]
                if any(c.strip() for c in cells):
                    print('   | ' + ' | '.join(cells))

        for sp in root.iter(P + 'sp'):
            lines = para_lines(sp)
            if lines:
                print('  [TEXT] ' + ' / '.join(lines))

        if args.audit:
            txt = raw.decode('utf8', 'replace')
            pics = txt.count('<p:pic')
            diagrams = txt.count('dgm')
            charts = txt.count('<c:chart')
            if pics or diagrams or charts:
                print(f'  [UNREADABLE] pictures={pics} smartart/diagram={diagrams} charts={charts}'
                      '  <- content may live here; ask for it another way')


if __name__ == '__main__':
    sys.exit(main())
