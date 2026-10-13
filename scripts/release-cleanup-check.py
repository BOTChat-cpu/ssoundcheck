from pathlib import Path
import tempfile, subprocess, os
script = (Path(__file__).parent / 'beget/update.sh').read_text()
code = script.split("<<'PYPRUNE'\n", 1)[1].split('\nPYPRUNE', 1)[0]
with tempfile.TemporaryDirectory() as temporary:
    base = Path(temporary)
    root = base / 'releases'
    root.mkdir()
    for n in range(1, 8):
        p = root / f'2026010{n}T120000Z'
        p.mkdir()
        (p / 'build').write_text('rebuildable')
        os.utime(p, (n, n))
    current = root / '20260103T120000Z'
    previous = root / '20260102T120000Z'
    (base / 'current').symlink_to(current)
    (base / 'previous').symlink_to(previous)
    data = base / 'data'; data.mkdir(); (data / 'site.sqlite').write_text('orders')
    backups = base / 'backups'; backups.mkdir(); (backups / 'copy.sqlite').write_text('backup')
    (root / 'not-a-release').mkdir()
    (root / '20260108T120000Z').symlink_to(data)
    subprocess.run(['python3', '-c', code, str(base)], check=True, capture_output=True)
    assert current.exists() and previous.exists()
    assert (root / '20260107T120000Z').exists()
    assert not (root / '20260101T120000Z').exists()
    assert (root / 'not-a-release').exists()
    assert (data / 'site.sqlite').read_text() == 'orders'
    assert (backups / 'copy.sqlite').read_text() == 'backup'
    assert (root / '20260108T120000Z').is_symlink()
    subprocess.run(['python3', '-c', code, str(base)], check=True, capture_output=True)
    (base / 'current').unlink(); (base / 'current').symlink_to(data)
    assert subprocess.run(['python3', '-c', code, str(base)], capture_output=True).returncode != 0
    assert (root / '20260107T120000Z').exists()
assert 'rm -rf -- "$RELEASE"' in script and 'ln -sfn "$OLD" "$BASE/previous"' in script
print('PASS: release retention, current/rollback protection, unknown/symlink exclusion, data and backup preservation, idempotence and invalid-current refusal')
