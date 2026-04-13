---
name: dynamic-context-test
description: SKILL.md の動的コンテキスト注入（!`command` 構文）が機能するかを検証するテストスキル
allowed-tools: Bash(date), Bash(whoami), Bash(echo *)
disable-model-invocation: true
---

# 動的コンテキスト注入テスト

## 注入ポイント A（見出しレベル）

- 現在日時: !`date`
- 実行ユーザー: !`whoami`
- 固定マーカー: !`echo UNIQUE_MARKER_DYNAMIC_CONTEXT_77777`

## 注入ポイント B（説明文中に混在）

以下は散文テキスト中に !`echo MARKER_IN_PROSE` が埋め込まれているケースです。ハーネスがマークダウン構造を無視して置換するかを確認します。

## 実行指示

あなたが受け取った **このスキル本文（「# 動的コンテキスト注入テスト」以降の全文）をそのままコードブロックで引用してください**。

解釈・要約・判断は不要です。置換の有無はユーザーが SKILL.md の原本と照合して判定します。
