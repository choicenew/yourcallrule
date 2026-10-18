from pathlib import Path
root = Path(__file__).parent
for old in (root / "regulatory_ranges.json", root / "source_configs.json"):
    if old.exists():
        old.unlink()
        print(f"Deleted {old.name}")
