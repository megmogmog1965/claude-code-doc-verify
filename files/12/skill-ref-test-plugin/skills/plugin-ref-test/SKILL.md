---
name: plugin-ref-test
description: プラグイン版 SKILL.md からのファイル参照方式を検証するテストスキル
---

# プラグイン版ファイル参照テスト

このスキルはプラグイン内の SKILL.md からのファイル参照が機能するかを検証します。
以下の 3 つの方式で同じフォルダ内の `ref-data.md` を参照しています。

## 方式 A: マークダウンリンク構文

参照データは [ref-data.md](ref-data.md) にあります。

## 方式 B: @構文（CLAUDE.md と同じ形式）

@ref-data.md

## 方式 C: ${CLAUDE_SKILL_DIR} 変数

参照先: ${CLAUDE_SKILL_DIR}/ref-data.md

## 実行指示

上記の参照方式のうち、どれが実際に `ref-data.md` の内容をコンテキストにロードしたかを報告してください。
特に `UNIQUE_MARKER_PLUGIN_SKILL_REF_88888` というマーカーがシステムプロンプトに含まれているかどうかを確認してください。

以下のフォーマットで回答してください:

```
方式 A（マークダウンリンク）: ロードされた / ロードされていない
方式 B（@構文）: ロードされた / ロードされていない
方式 C（${CLAUDE_SKILL_DIR}）: ロードされた / ロードされていない
マーカー UNIQUE_MARKER_PLUGIN_SKILL_REF_88888 の存在: 確認できた / 確認できない
```
