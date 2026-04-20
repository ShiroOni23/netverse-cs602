import subprocess

REPO = "ShiroOni23/cs602-netlab-138"
START = 1
END = 138

for i in range(START, END + 1):
    branch = f"student-{i:03d}"
    subprocess.run(["git", "checkout", "-B", branch, "main"], check=True)
    subprocess.run(["git", "push", "-u", "origin", branch], check=True)
    print("pushed", branch)

subprocess.run(["git", "checkout", "main"], check=True)
print("done")
