import unittest
import json
from unittest.mock import MagicMock
from build_subject_banks import inline

class TestInlineFunction(unittest.TestCase):
    def test_happy_path(self):
        # Valid JSON immediately following the marker
        mock_path = MagicMock()
        mock_path.read_text.return_value = 'some prefix text= {"key": "value"}'
        result = inline(mock_path, '=')
        self.assertEqual(result, {"key": "value"})

    def test_whitespace_handling(self):
        # Leading whitespace between the marker and the JSON content
        mock_path = MagicMock()
        mock_path.read_text.return_value = 'some prefix text= \n\t  {"key": "value"}'
        result = inline(mock_path, '=')
        self.assertEqual(result, {"key": "value"})

    def test_trailing_content(self):
        # Extraneous JavaScript code following the JSON block
        mock_path = MagicMock()
        mock_path.read_text.return_value = 'some prefix text= {"key": "value"} ; console.log("done");'
        result = inline(mock_path, '=')
        self.assertEqual(result, {"key": "value"})

    def test_marker_missing(self):
        # The file content doesn't include the marker
        mock_path = MagicMock()
        mock_path.read_text.return_value = 'some prefix text without marker {"key": "value"}'
        with self.assertRaises(IndexError):
            inline(mock_path, '=')

    def test_invalid_json(self):
        # The content following the marker is not valid JSON
        mock_path = MagicMock()
        mock_path.read_text.return_value = 'some prefix text= {invalid json}'
        with self.assertRaises(json.JSONDecodeError):
            inline(mock_path, '=')

if __name__ == '__main__':
    unittest.main()
