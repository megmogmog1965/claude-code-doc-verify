---
name: find-japanese-files
description: プロジェクト内の日本語を含むファイルを検索し、ファイルパスを一覧表示する
skills:
  - find-japanese-files
hooks:
  PreToolUse:
    - matcher: "Grep"
      hooks:
        - type: command
          command: "echo 'Grep tool was invoked' >&2"
---

Follow the skill instructions.
