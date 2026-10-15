import shutil
from pathlib import Path

root = Path(__file__).parent.parent
l10n_dir = root / "l10n"
l10n_yaml = root / "l10n.yaml"

if l10n_dir.exists():
    shutil.rmtree(l10n_dir)
    print("Deleted l10n directory")

if l10n_yaml.exists():
    l10n_yaml.unlink()
    print("Deleted l10n.yaml file")
