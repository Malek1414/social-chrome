"""Paths shared by the Python helpers: output lives next to the scripts unless SOCIAL_CHROME_DATA says otherwise."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.abspath(os.environ.get("SOCIAL_CHROME_DATA") or ROOT)


def data(*parts):
    return os.path.join(DATA, *parts)
