import pytest
from scripts.version_site import dequery

def test_dequery_question_mark():
    assert dequery('app.js?v=1234abcd') == 'app.js?v=VERSION'

def test_dequery_ampersand():
    assert dequery('page.html?param=value&v=5678') == 'page.html?param=value&v=VERSION'

def test_dequery_ampersand_html_escaped():
    assert dequery('page.html?param=value&amp;v=91011') == 'page.html?param=value&amp;v=VERSION'

def test_dequery_multiple_params():
    assert dequery('style.css?theme=dark&v=hash123') == 'style.css?theme=dark&v=VERSION'

def test_dequery_no_match():
    # v= is missing
    assert dequery('script.js?version=123') == 'script.js?version=123'
    # av= is present, not v=
    assert dequery('script.js?av=123') == 'script.js?av=123'
    # &amp;av= is present, not &amp;v=
    assert dequery('script.js?param=1&amp;av=123') == 'script.js?param=1&amp;av=123'

def test_dequery_multiple_versions():
    # Test multiple instances of v= param in the same string
    assert dequery('app.js?v=1234abcd & page.html?v=5678') == 'app.js?v=VERSION & page.html?v=VERSION'
