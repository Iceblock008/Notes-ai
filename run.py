# ─── FILE: run.py ─────────────────────────────────────────────────────────────
# Legacy wrapper — delegates to the notes_ai package

from dotenv import load_dotenv
from notes_ai.agent import run_agent

load_dotenv()


def main():
    print("\n" + "=" * 50)
    print("  Video Notes AI")
    print("  Paste any video URL -> get structured notes")
    print("=" * 50 + "\n")
    print("Supports: YouTube, Twitter/X, Reddit, Vimeo, and more.")
    print("Type 'quit' to exit.\n")
    print("TIP: Install the CLI globally:  pip install -e .")
    print("     Then use:  notes-ai process <url>\n")

    while True:
        try:
            url = input("Video URL: ").strip()

            if url.lower() in ("quit", "exit", "q", ""):
                print("\nBye! Your notes are in the outputs/ folder.\n")
                break

            print(f"\n[Processing]: {url}")
            print("-" * 60)

            result = run_agent(url)

            print("\n[Done]\n")
            print(result)
            print("\n" + "-" * 60 + "\n")

        except KeyboardInterrupt:
            print("\n\nInterrupted. Bye!\n")
            break
        except Exception as e:
            print(f"\n[Error]: {e}\n")


if __name__ == "__main__":
    main()