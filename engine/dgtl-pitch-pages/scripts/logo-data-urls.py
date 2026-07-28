#!/usr/bin/env python3
"""Emit DGTL brand logos as data URLs, ready to paste into a page.

Usage (from anywhere):
  python3 logo-data-urls.py --marquee          # full 18-logo marquee <img> block (one set; duplicate it)
  python3 logo-data-urls.py --single canon     # one data URL on stdout
  python3 logo-data-urls.py --list             # available names
  python3 logo-data-urls.py --art-villas       # white SVG-text wordmark data URL (no bitmap exists)

Logos live in ../assets/logos relative to this script. All are pre-processed
(white-filled or grayscale-lifted, trimmed, <=300x96) for the dark marquee.
"""
import argparse, base64, os, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
LOGOS = os.path.join(HERE, '..', 'assets', 'logos')

ORDER = ['on-running','canon','dji','epidemic-sound','mercedes-benz','anker','hyundai',
         'six-senses-ibiza','arcteryx','audi','lexus','polarpro','ford','porsche',
         'corona','guilds-garage','rotary','canadream']
NAMES = {'on-running':'On Running','canon':'Canon','dji':'DJI','epidemic-sound':'Epidemic Sound',
         'mercedes-benz':'Mercedes-Benz','anker':'Anker','hyundai':'Hyundai',
         'six-senses-ibiza':'Six Senses Ibiza','arcteryx':"Arc'teryx",'audi':'Audi','lexus':'Lexus',
         'polarpro':'PolarPro','ford':'Ford','porsche':'Porsche','corona':'Corona',
         'guilds-garage':"Guild's Garage",'rotary':'Rotary','canadream':'CanaDream',
         'swae-lee-w':'Swae Lee'}

AV_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="280" height="70" viewBox="0 0 280 70">'
          '<text x="0" y="38" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="white" letter-spacing="4">ART VILLAS</text>'
          '<text x="1" y="60" font-family="Arial, sans-serif" font-size="13" fill="white" letter-spacing="7" opacity="0.75">COSTA RICA</text></svg>')

def png_url(name):
    with open(os.path.join(LOGOS, name + '.png'), 'rb') as fh:
        return 'data:image/png;base64,' + base64.b64encode(fh.read()).decode()

def svg_url(fname):
    with open(os.path.join(LOGOS, fname)) as fh:
        s = fh.read().strip()
    return 'data:image/svg+xml;charset=utf-8,' + urllib.parse.quote(s).replace('%27', "'")

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--marquee', action='store_true')
    ap.add_argument('--single')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--art-villas', action='store_true')
    ap.add_argument('--dgtl-logo', action='store_true')
    ap.add_argument('--spark', action='store_true')
    a = ap.parse_args()
    if a.list:
        print('\n'.join(ORDER + ['swae-lee-w', '(art-villas: --art-villas)', '(logo/spark: --dgtl-logo / --spark)']))
    elif a.marquee:
        print(''.join(f'<img src="{png_url(n)}" alt="{NAMES[n]}">' for n in ORDER))
    elif a.single:
        print(png_url(a.single))
    elif a.art_villas:
        print('data:image/svg+xml;charset=utf-8,' + urllib.parse.quote(AV_SVG))
    elif a.dgtl_logo:
        print(svg_url('logo-white-gold.svg'))
    elif a.spark:
        print(svg_url('spark.svg'))
    else:
        ap.print_help(); sys.exit(1)
