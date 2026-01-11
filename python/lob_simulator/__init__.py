"""
LOB Simulator - Limit Order Book simulation with Hawkes processes
"""

__version__ = "0.1.0"

# We'll import the C++ module here once it's properly installed
try:
    import lob_core
    __all__ = ['lob_core']
except ImportError:
    # Module not built yet
    pass