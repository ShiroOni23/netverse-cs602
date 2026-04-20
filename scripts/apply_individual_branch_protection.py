import argparse
import csv
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--mapping", required=True, help="CSV with columns: branch,github_username")
args = parser.parse_args()

ORG = "ShiroOni23"
REPO = "cs602-netlab-138"

rows = list(csv.DictReader(Path(args.mapping).read_text(encoding="utf-8").splitlines()))

for row in rows:
    branch = row["branch"].strip()
    user = row["github_username"].strip()
    payload = {
        "required_status_checks": {"strict": True, "contexts": []},
        "enforce_admins": True,
        "required_pull_request_reviews": None,
        "restrictions": {"users": [user], "teams": [], "apps": []}
    }
    fp = Path(f".tmp-protect-{branch}.json")
    fp.write_text(json.dumps(payload), encoding="utf-8")
    subprocess.run([
        "gh", "api", "-X", "PUT",
        f"/repos/{ORG}/{REPO}/branches/{branch}/protection",
        "--input", str(fp),
        "-H", "Accept: application/vnd.github+json"
    ], check=True)
    print("protected", branch, "for", user)

print("all protections applied")
