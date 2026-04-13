<!--
tags: Claude Code, AI, LLM, コンテキストウィンドウ, system-reminder
-->

# Claude Code が LLM に渡すコンテキストの中身を整理する

## はじめに

[前記事「(小ネタ) Claude Code のドキュメントを読んで気になったことを検証してみた」](./README.md)（以下「前記事」）では、Claude Code の公式ドキュメントを読んで気になった点を 16 個検証しました。その過程で、Claude Code が LLM（Claude 本体）に渡しているコンテキストの中身が断片的に見えてきました。

この記事では、それらの検証結果を踏まえて、コンテキストの全体像を 2 つの切り口で整理します。

1. `/context` コマンドで見えるカテゴリ別の使用量
2. そのうち最も動きが大きい `Messages` カテゴリの中身

表中の「関連検証」列は、前記事の検証番号を指しています。

:::note info
この記事の内容は本人が考えて決めてますが、文章は AI (Claude Code) が 100% 書いています。
:::

### 検証環境

- macOS（Apple Silicon）
- Claude Code v2.1.96（Opus 4.6、1M context）
- ターミナル: [Warp](https://www.warp.dev/) v0.2026.04.01

## `/context` で見えるカテゴリ別の使用量

`/context` コマンドで、現在のコンテキストウィンドウがどのカテゴリにどれだけトークンを消費しているかを確認できます。各カテゴリに入るものと関連する検証は以下の通りです。

| カテゴリ | 入るもの | 関連検証 |
|---------|---------|--------|
| System prompt | Claude Code 本体のシステムプロンプト | — |
| System tools | 組み込みツールのスキーマ | — |
| Custom agents | カスタムエージェント定義 | — |
| Memory files | `CLAUDE.md`、`@import` 先、`.claude/rules/`（`paths` なしのもの） | 検証 1, 2, 3 |
| Skills | `SKILL.md` の `name` と `description`（本文は未展開） | 検証 13 |
| Messages | 会話ストリーム（ユーザー発言・Claude 応答・注入された各種タグ付きブロック） | 検証 8, 16 |
| Autocompact buffer | 圧縮に備える余剰枠 | — |
| Free space | 未使用 | — |

## `Messages` に含まれるもの

上の表のうち `Messages` は、単純なユーザー発言や Claude の応答以外にも、ハーネスがさまざまなメタタグ付きブロックを差し込んでくる「主戦場」です。前記事の検証中に実測で観測したタグは以下の通りです。

| タグ | 用途 | 関連検証 |
|------|------|---------|
| `<system-reminder>` | ハーネスから LLM への内部指示。セキュリティルール、auto mode 告知、`@-mention` によるエージェント呼び出しヒント、hook の `additionalContext`、TodoList 促し、MCP サーバの指示など | 検証 8, 16 |
| `<persisted-output>` | hook やツール出力が大きすぎた際、先頭プレビュー＋退避先ファイルパスに置き換えるラッパー（`<system-reminder>` の内側に現れることがある） | 検証 16 |
| `<local-command-stdout>` / `<local-command-caveat>` / `<command-name>` など | スラッシュコマンドの入出力メタ情報 | — |

### 実例: `/do-nothing-1` スキル実行時に Claude が受け取った Messages 全文

実際に LLM が受け取る `Messages` ストリームがどんな見た目かは、ひとつ実物を眺めるのが一番早いです。以下は、前記事の検証 8 で用意した `/do-nothing-1` スキルを起動したときに、Claude がこのターンの入力として受け取った文字列そのものです。

````
<system-reminder>
The user has expressed a desire to invoke the agent "find-japanese-files". Please invoke the agent appropriately, passing in the required context to it. 
</system-reminder>
<command-message>do-nothing-1</command-message>
<command-name>/do-nothing-1</command-name>
Base directory for this skill: /Users/{username}/src/claude-code-doc-verify/.claude/skills/do-nothing-1

# 何もしないスキル1

以下のメッセージをそのまま表示してください。

```
The quick brown fox jumps over the lazy dog.
@"find-japanese-files (agent)"
@"nonexistent-agent-12345 (agent)"
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
```
````

ユーザーがターミナルで打ったのは `/do-nothing-1` の一度きりですが、LLM の目線ではこのように分解されてメッセージに流れ込んできます。

- **`<system-reminder>`**: ハーネスが SKILL.md 本文中の `@"find-japanese-files (agent)"` を検出し、エージェント呼び出しを促すために自動生成したブロック。スキル本文が届く**前**に注入されている点に注目してください。もう 1 つの `@"nonexistent-agent-12345 (agent)"` に対応する `<system-reminder>` が無いのは、存在しないエージェントだからです（詳細は前記事の検証 8）
- **`<command-message>` / `<command-name>`**: 実行されたスラッシュコマンドのメタ情報
- **`Base directory for this skill: ...` 以降**: ハーネスがスキル起動時に `SKILL.md` 本文の先頭にベースパスヘッダを付けて注入した部分

`Messages` カテゴリの実体はこういった**メタタグ付きブロックの積み重ね**で、Claude はこれら全体を 1 本のメッセージ履歴として読みます。

## 参考

- [前記事: (小ネタ) Claude Code のドキュメントを読んで気になったことを検証してみた](./README.md)
- [Claude Code 公式ドキュメント（日本語版）](https://code.claude.com/docs/ja/)
- [Hooks ガイド（日本語版）](https://code.claude.com/docs/ja/hooks-guide)
- [スキル（日本語版）](https://code.claude.com/docs/ja/skills)
