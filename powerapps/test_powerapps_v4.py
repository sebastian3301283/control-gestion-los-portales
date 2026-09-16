import os
from collections import defaultdict
from pathlib import Path
import re
import unittest
import yaml

SRC = Path(os.environ['POWERAPPS_SRC_DIR'])

CONTROL_DEF = re.compile(r'^\s*-\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$', re.M)

class V4RegressionTests(unittest.TestCase):
    def read(self, name):
        return (SRC / name).read_text(encoding='utf-8')

    def test_all_yaml_is_valid(self):
        for p in SRC.glob('*.pa.yaml'):
            yaml.safe_load(p.read_text(encoding='utf-8'))

    def test_control_names_are_unique_across_all_screens(self):
        seen = defaultdict(list)
        for p in sorted(SRC.glob('scr*.pa.yaml')):
            text = p.read_text(encoding='utf-8')
            for name in CONTROL_DEF.findall(text):
                seen[name].append(p.name)
        dupes = {name: files for name, files in seen.items() if len(files) > 1}
        self.assertEqual({}, dupes, f'Duplicate app-wide control names: {dupes}')

    def test_each_screen_uses_its_prefix(self):
        prefixes = {
            'scrInicio.pa.yaml': 'ini_',
            'scrPeriodos.pa.yaml': 'per_',
            'scrUnidades.pa.yaml': 'uni_',
            'scrLineamientos.pa.yaml': 'lin_',
            'scrMatriz.pa.yaml': 'mat_',
            'scrSoportes.pa.yaml': 'sop_',
            'scrPermisos.pa.yaml': 'perm_',
        }
        for file_name, prefix in prefixes.items():
            names = CONTROL_DEF.findall(self.read(file_name))
            self.assertTrue(names, f'No controls found in {file_name}')
            self.assertTrue(all(n.startswith(prefix) for n in names), (file_name, [n for n in names if not n.startswith(prefix)][:10]))

    def test_visual_v3_features_are_preserved(self):
        inicio = self.read('scrInicio.pa.yaml')
        matriz = self.read('scrMatriz.pa.yaml')
        lineamientos = self.read('scrLineamientos.pa.yaml')
        self.assertIn('Bienvenido a Control de Gestión', inicio)
        self.assertIn('Accesos rápidos', inicio)
        self.assertIn('Lineamientos Estratégicos', lineamientos)
        self.assertIn('Ir a matriz', lineamientos)
        self.assertIn('EDITOR DE FILA', matriz)
        self.assertIn('HITOS / FECHAS', matriz)
        self.assertIn('ModernDatePicker@1.0.1', matriz)
        self.assertIn('Format: ="dd/mm/yyyy"', matriz)

if __name__ == '__main__':
    unittest.main()
