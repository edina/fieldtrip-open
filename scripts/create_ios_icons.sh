#!/bin/bash

# Create the recommended icons for iOS from a .svg file, it requires the svg2png
# package

SVG2PNG=svg2png
command -v ${SVG2PNG} >/dev/null 2>&1 || { echo >&2 "${SVG2PNG} not found, please try first:\nnpm install -g ${SVG2PNG}"; exit 1; }

SVGFILE=$1
SIZES="29 40 50 57 60 72 76 120 152 180"

for SIZE in $SIZES
do
    SIZE2X=$(($SIZE*2))
    SVG2PNG ${SVGFILE} --output icon-${SIZE}.png --width=${SIZE} --height=${SIZE}
    SVG2PNG ${SVGFILE} --output icon-${SIZE}@2x.png --width=${SIZE2X} --height=${SIZE2X}
done

mv icon-29.png icon-small.png
mv icon-29@2x.png icon-small@2x.png
mv icon-57.png icon.png
mv icon-57@2x.png icon@2x.png
cp icon-180.png icon-60@3x.png

# Clearing unused icons (180 was jusc created for the icon-60@3x)
rm icon-180.png
rm icon-180@2x.png
