import pytest
import sys
import os

# Add the scripts directory to the sys path so we can import the module
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from import_notes_mcq import normalize

def test_normalize_happy_path():
    """Test standard strings with spaces and mixed casing."""
    assert normalize("Hello World") == "helloworld"
    assert normalize("This is a Test") == "thisisatest"

def test_normalize_edge_cases():
    """Test edge cases with punctuation, special characters, numbers and empty strings."""
    assert normalize("a.b,c!d@") == "abcd"
    assert normalize("TESTING") == "testing"
    assert normalize("") == ""
    assert normalize("   ") == ""
    assert normalize("12345") == "12345"
    assert normalize("user@domain.com123") == "userdomaincom123"
    assert normalize("!@#$%^&*()") == ""

def test_normalize_error_handling():
    """Test that non-strings raise AttributeError (due to .lower() being called)."""
    with pytest.raises(AttributeError):
        normalize(None)

    with pytest.raises(AttributeError):
        normalize(123)
