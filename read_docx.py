
import zipfile
import xml.etree.ElementTree as ET
import os

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
        
        tree = ET.fromstring(xml_content)
        namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text_elements = tree.findall('.//w:t', namespace)
        return '\n'.join([t.text for t in text_elements if t.text])
    except Exception as e:
        return f"Error reading docx: {str(e)}"

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

docx_path = r"C:\Users\mayan\Downloads\atul_ice_cream_pos_scope.docx"
text = extract_text_from_docx(docx_path)
print(text)
