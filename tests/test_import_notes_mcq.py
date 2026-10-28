import unittest
import sys
import os

# Add the root directory to sys.path so we can import from scripts
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.import_notes_mcq import is_pyq

class TestIsPyq(unittest.TestCase):
    def test_id_starts_with_pyq(self):
        self.assertTrue(is_pyq({'id': 'pyq-123', 'subject': 'accounting', 'source': 'book'}))
        self.assertTrue(is_pyq({'id': 'PYQ-456', 'subject': 'costing', 'source': 'book'}))

    def test_id_not_starts_with_pyq(self):
        self.assertFalse(is_pyq({'id': '123-pyq', 'subject': 'accounting', 'source': 'book'}))
        self.assertFalse(is_pyq({'id': 'q-pyq-1', 'subject': 'costing', 'source': 'book'}))

    def test_subject_contains_pyq(self):
        self.assertTrue(is_pyq({'id': '123', 'subject': 'accounting pyq', 'source': 'book'}))
        self.assertTrue(is_pyq({'id': '456', 'subject': 'PYQ costing', 'source': 'book'}))
        self.assertTrue(is_pyq({'id': '789', 'subject': 'some-PYQ-subject', 'source': 'book'}))

    def test_source_contains_pyq_word(self):
        self.assertTrue(is_pyq({'id': '123', 'subject': 'accounting', 'source': 'This is a pyq'}))
        self.assertTrue(is_pyq({'id': '456', 'subject': 'costing', 'source': 'PYQ from 2023'}))
        self.assertTrue(is_pyq({'id': '789', 'subject': 'gst', 'source': 'some (pyq)'}))

    def test_source_contains_pyq_no_word_boundary(self):
        # Should be false because \bpyq\b requires word boundaries
        self.assertFalse(is_pyq({'id': '123', 'subject': 'accounting', 'source': 'copyq'}))
        self.assertFalse(is_pyq({'id': '456', 'subject': 'costing', 'source': 'pyq2023'}))
        self.assertFalse(is_pyq({'id': '789', 'subject': 'gst', 'source': 'my_pyq_test'}))

    def test_missing_source_key(self):
        # When source is not present, it should use q.get('source', '') and not fail
        self.assertFalse(is_pyq({'id': '123', 'subject': 'accounting'}))
        self.assertTrue(is_pyq({'id': 'pyq-123', 'subject': 'accounting'}))

    def test_missing_all_keys(self):
        # The function assumes 'id' and 'subject' are present. If we pass empty dict,
        # it will raise KeyError on 'id'. We could test this if we wanted, but the
        # function's logic is clear that it requires 'id' and 'subject'.
        with self.assertRaises(KeyError):
            is_pyq({})

if __name__ == '__main__':
    unittest.main()
