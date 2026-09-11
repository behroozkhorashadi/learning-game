# Heads up: `main` history was rewritten (Git LFS migration)

All 69 binary assets (audio, images, models) were migrated into **Git LFS**. That
rewrote every commit on `main` — all 36 commits got new SHAs — and the result was
force-pushed to `origin`.

**Your existing clone's `main` has diverged entirely from `origin/main`.** Git sees
two unrelated histories, not "behind by N commits", so a normal `git pull` will not
work cleanly. Follow the steps below.

Tracked extensions (see `.gitattributes`): `.wav .mp3 .png .jpg .jpeg .gif .glb .gltf .mp4`

> These steps were run end-to-end on a real stale clone (macOS, git-lfs 3.8.0). The
> commands and expected output below are what actually happened, not a sketch.

---

## 1. Install Git LFS (one-time, per machine)

```sh
brew install git-lfs        # or: apt-get install git-lfs — see git-lfs.github.com
git lfs install             # <- required; the package install does NOT do this
```

`git lfs install` is a separate step — Homebrew even prints a caveat reminding you.
It registers the smudge/clean filters in your **global** git config:

```sh
git config --global --get-regexp '^filter\.lfs'
# filter.lfs.smudge  git-lfs smudge -- %f
# filter.lfs.process git-lfs filter-process
# filter.lfs.required true
# filter.lfs.clean   git-lfs clean -- %f
```

**Do this before you clone or reset.** Without the filters, LFS-tracked files check
out as ~130-byte pointer-text stubs instead of real audio/images/models. There is no
error at checkout time — the app just breaks later with missing/corrupt media.

## 2. Get onto the new history

### Option A — fresh clone (easiest and safest)

If you have no uncommitted local work worth keeping:

```sh
mv learning-game learning-game-old      # keep the old one around just in case
git clone https://github.com/behroozkhorashadi/learning-game.git
# or, if you use SSH:
# git clone git@github.com:behroozkhorashadi/learning-game.git
```

### Option B — keep the existing folder

Use this if you have local branches or stashed work you care about.

**First, a 30-second pre-flight** so you know exactly what you're about to discard:

```sh
git fetch origin
git branch -vv          # any local branches besides main?
git stash list          # anything stashed?
git status --short      # anything uncommitted?

# Is any local commit on main actually unpushed? If this prints nothing,
# every commit you have was preserved by the rewrite (under a new SHA):
diff <(git log --format=%s main) <(git log --format=%s origin/main)
```

Then:

```sh
git stash                       # if you had uncommitted changes
git branch main-pre-lfs main    # cheap safety net — see note below
git checkout main
git reset --hard origin/main    # discards old (pre-LFS) main, adopts the new history
git lfs pull                    # belt-and-braces; see note below
```

> ⚠️ `git reset --hard` is destructive to **your local `main` specifically**. Anything
> you committed locally on `main` and never pushed will be orphaned. It's recoverable
> for a while via `git reflog`, but recover it *before* you run `git gc`.
>
> `git branch main-pre-lfs main` is a lighter alternative to copying the whole folder:
> it pins the old history under a name you can inspect, and you delete it when you're
> satisfied (`git branch -D main-pre-lfs`).

**On `git lfs pull`:** if you did step 1 first, the `reset --hard` already downloads
the real content — you'll see `Filtering content: 100% (69/69), 89.34 MiB` scroll by.
In that case `git lfs pull` is a no-op confirmation. Run it anyway; it's the fix if
you reset *before* installing LFS.

### Verify it worked

```sh
git lfs ls-files | wc -l     # expect: 69
file frontend/public/audio/words/banana.mp3
file frontend/public/images/avatars/rami.png
```

Expected:

```
frontend/public/audio/words/banana.mp3: MPEG ADTS, layer III, v2, 160 kbps, 24 kHz, Monaural
frontend/public/images/avatars/rami.png: PNG image data, 1254 x 1254, 8-bit/color RGB, non-interlaced
```

If `file` says **"ASCII text"**, you got a pointer stub — go back to step 1, then run
`git lfs pull`. In `git lfs ls-files` output, a `*` between the OID and the path means
the object is present locally; a `-` means you only have the pointer.

Finally, confirm you're actually in sync:

```sh
git rev-list --left-right --count HEAD...origin/main    # expect: 0   0
```

## 3. Anything else that was local

- **Other local branches.** Branches based on the old `main` will still diverge — they
  were forked from commits that no longer exist upstream. Either
  `git rebase --onto main <old-main-sha> <your-branch>`, or recreate the branch off the
  fresh `main` and re-apply your work. The `main-pre-lfs` backup from step 2 is handy
  here: it keeps those old base commits reachable while you rebase.
- **Open PRs.** None exist right now, so this isn't a live problem — but in general a PR
  based on rewritten commits needs its branch rebased onto the new `main`.
- **Disk.** Expect `.git` to roughly double for a while — on the reference run it landed
  at 199 MB, of which 114 MB is the legitimate `.git/lfs` object cache and most of the
  rest is the orphaned pre-LFS packs. It won't shrink on its own. Once you're confident
  you need nothing from the old history:

  ```sh
  git branch -D main-pre-lfs     # unpin the old commits first, or gc keeps them
  git gc --prune=now
  ```

  Not urgent. Only do this once you're sure you don't need `reflog` to recover anything.
