import os
import json
from pathlib import Path

# Match where agent.py stores notes (project-root/outputs), regardless of CWD.
OUTPUTS_DIR = Path(__file__).resolve().parent / "outputs"


def browse():
    outputs_dir = OUTPUTS_DIR

    if not outputs_dir.exists() or not list(outputs_dir.glob("*.json")):
        print("\n📭  No saved outputs yet. Run run.py first.\n")
        return

    files = sorted(outputs_dir.glob("*.json"), reverse=True)

    print(f"\n📚  Saved Outputs  ({len(files)} total)\n")
    print("─" * 60)

    for i, f in enumerate(files, 1):
        with open(f, encoding="utf-8") as fp:
            data = json.load(fp)
        url_preview = data["url"][:55] + "..." if len(data["url"]) > 55 else data["url"]
        print(f"  {i:>2}. [{data['type'].upper()}]  {data['title']}")
        print(f"      {url_preview}")
        print(f"      Saved: {data['saved_at'][:16]}\n")

    print("─" * 60)
    choice = input("\nEnter number to read (or Enter to exit): ").strip()

    if choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(files):
            with open(files[idx], encoding="utf-8") as fp:
                data = json.load(fp)

            print(f"\n{'=' * 60}")
            print(f"Title  : {data['title']}")
            print(f"Type   : {data['type']}")
            print(f"URL    : {data['url']}")
            print(f"Saved  : {data['saved_at'][:16]}")
            print(f"{'=' * 60}\n")
            print(data["output"])
            print(f"\n{'=' * 60}\n")
        else:
            print("Invalid number.")


if __name__ == "__main__":
    browse()