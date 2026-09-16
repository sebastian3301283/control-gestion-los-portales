import os
from pathlib import Path
import unittest
import yaml

SRC = Path(os.environ["POWERAPPS_SRC_DIR"])

class VisualParityTests(unittest.TestCase):
    def read(self, name):
        return (SRC / name).read_text(encoding="utf-8")

    def test_all_yaml_is_valid(self):
        for p in SRC.glob("*.pa.yaml"):
            yaml.safe_load(p.read_text(encoding="utf-8"))

    def test_dashboard_uses_web_shell(self):
        s = self.read("scrInicio.pa.yaml")
        self.assertIn("cntSidebar", s)
        self.assertIn("Width: =230", s)
        self.assertIn("cntTopbar", s)
        self.assertIn("Height: =68", s)
        self.assertIn("Bienvenido a Control de Gestión", s)
        self.assertIn("Accesos rápidos", s)
        self.assertIn("Unidades de negocio", s)
        self.assertIn("RGBA(238, 247, 255, 1)", s)

    def test_unit_cards_use_web_unit_accents(self):
        s = self.read("scrUnidades.pa.yaml") + self.read("scrInicio.pa.yaml")
        for rgba in [
            "RGBA(23, 105, 170, 1)",
            "RGBA(46, 155, 95, 1)",
            "RGBA(232, 131, 36, 1)",
            "RGBA(66, 191, 232, 1)",
            "RGBA(23, 23, 23, 1)",
        ]:
            self.assertIn(rgba, s)

    def test_lineamientos_look_like_platform_table(self):
        s = self.read("scrLineamientos.pa.yaml")
        for label in ["N°", "Lineamientos Estratégicos", "Gerencia Responsable", "Gerente Responsable", "Acciones"]:
            self.assertIn(label, s)
        for action in ["Ir a matriz", "Pantalla completa", "Importar lineamientos", "Nuevo lineamiento"]:
            self.assertIn(action, s)
        self.assertIn("Switch(varUnidad", s)

    def test_matrix_has_web_toolbar_editor_and_table(self):
        s = self.read("scrMatriz.pa.yaml")
        for label in ["+ Nueva fila", "Guardar", "Pantalla completa", "Historial", "Generar Excel actualizado"]:
            self.assertIn(label, s)
        for label in ["EDITOR DE FILA", "OBJETIVO", "PLAN DE ACCIÓN", "RESPONSABLE", "PRIORIDAD", "HITOS / FECHAS", "KPI / OBJETIVO"]:
            self.assertIn(label, s)
        self.assertIn("ModernDatePicker@1.0.1", s)
        self.assertIn('Format: ="dd/mm/yyyy"', s)
        self.assertNotIn("CustomFormat:", s)
        self.assertNotIn("ModernTextInput@1.0.0", s)

    def test_matrix_fullscreen_collapses_shell_chrome(self):
        s = self.read("scrMatriz.pa.yaml")
        self.assertGreaterEqual(s.count("!Coalesce(varPantallaCompleta, false)"), 2)

    def test_permissions_preserve_central_and_guideline_models(self):
        s = self.read("scrPermisos.pa.yaml")
        self.assertIn("CENTRAL · permisos por área", s)
        self.assertIn("Permiso por lineamiento", s)
        self.assertIn("Filter(colLineamientos, Unidad = drpPermUnit.Selected.Value)", s)
        self.assertIn("Acceso · activado", s)
        self.assertIn("Edición · activada", s)

    def test_app_keeps_roles_and_fixed_responsibles(self):
        s = self.read("App.pa.yaml")
        for name in ["J.P. Le Bienvenu V.", "Juan Carlos Campana", "Diego Abarca", "Lucienne Freundt"]:
            self.assertIn(name, s)
        self.assertIn('Set(varRol, "Gestión Estratégica")', s)
        self.assertIn("GuidelineId:402", s)

if __name__ == "__main__":
    unittest.main()
