Deluminate
==========

An extension for Google Chrome (and Chromium) that inverts the luminance of
websites to make them easier on the eyes.

**Warning:** because of the way this extension inverts the luminance of
rendered pages, it may cause noticeable slowdowns for some users. If this
happens, you may prefer another extension that uses custom CSS to set the
default background and text color of web pages.

Details
-------

Invert the brightness of the web without changing the colors! Useful as a night
mode to darken most bright web sites (like Google), or just for making the web
soothing black instead of glaring white. Similar to the "High Contrast"
extension by Google, but tries not to ruin images by blowing out the contrast or
changing the colors. It also tries to be intelligent about whether to invert
images or not.

In order to try presenting images as correctly as possible, this extension does
the following in addition to a straightforward luminance invert:

 * Avoid inverting videos.
 * Since PNGs and GIFs are often used as stylistic elements and logos, they are
   typically safe to invert without looking strange. These images are detected
   by their file extensions.
 * Other images (in particular JPEGs) are often photos that are often
   unrecognizable when inverted, so avoid inverting these.

Installation
------------

The latest release is always available on the Chrome Web Store. Search for
"Deluminate".
