<!--
tags: Claude Code, AI, LLM, コンテキストウィンドウ, system-reminder
-->

# Claude Code が LLM に渡すコンテキストの中身を解剖する

## はじめに

Claude Code は CLI ツールですが、裏で動いているのは Anthropic の LLM（Claude）です。ターミナルで入力した文字列や、実行したツールの結果は、そのままの形で LLM に届くわけではありません。Claude Code 本体（以下「ハーネス」と呼びます）が整形・注入・ラップをしてから、1 本のメッセージ履歴として LLM に渡しています。

この記事のテーマは「**どんなシチュエーションで、LLM にはどんな原文メッセージが渡されているのか**」を具体的に解析することです。例えば、ユーザーがプロンプトを入力したとき、Skills や Subagent を起動したとき、ツールを実行したとき、hook が発火したとき——それぞれの場面で `Messages` に流れ込む原文はどう違うのか。実測で確かめていきます。

進め方は次の 2 段です。

1. まず `/context` コマンドで見えるカテゴリ別の使用量をざっと把握する
2. そのうち最も動きが大きい `Messages` カテゴリについて、発生シチュエーションごとに原文を採取する

:::note info
この記事の内容は本人が考えて決めていますが、文章は AI（Claude Code）が 100% 書いています。
:::

### 検証環境

- macOS（Apple Silicon）
- Claude Code v2.1.96（Opus 4.6、1M context）
- ターミナル: [Warp](https://www.warp.dev/) v0.2026.04.01

## `/context` で見えるカテゴリ別の使用量

Claude Code のセッション中に `/context` と打つと、コンテキストウィンドウの内訳を見ることができます。カテゴリは以下の 8 つです。

| カテゴリ | 入るもの |
|---------|---------|
| System prompt | Claude Code 本体のシステムプロンプト（役割、ツール利用規約、安全ルールなど） |
| System tools | 組み込みツール（`Read`、`Edit`、`Bash` など）のスキーマ定義 |
| Custom agents | ユーザーが定義したサブエージェントの定義 |
| Memory files | `CLAUDE.md`、`@import` で取り込まれたファイル、`.claude/rules/` 配下のルール |
| Skills | `SKILL.md` の `name` と `description`（本文は起動時まで未展開） |
| Messages | 会話ストリーム（ユーザー発言・Claude 応答・ツール結果・注入された各種タグ付きブロック） |
| Autocompact buffer | 圧縮処理に備えて確保される余剰枠 |
| Free space | 未使用 |

このうち `System prompt` から `Skills` までは、セッション開始時にほぼ確定する静的なカテゴリです。`Autocompact buffer` と `Free space` はハーネスが管理する予約領域です。

セッションが進むにつれて膨らみ、かつ中身のバリエーションが豊富なのは `Messages` カテゴリです。以下ではここに注目します。

## `Messages` の中身を解剖する

ユーザーがターミナルで入力した文字列は、ハーネス（Claude Code 本体）で整形されてから `Messages` ストリームに流し込まれます。LLM（Claude）はその結果を 1 本のメッセージ履歴として読みます。

ここでは「**どんなトリガで、どんな原文が `Messages` に流れ込むか**」をケースごとに観察していきます。例はすべて筆者の環境で実測したものです。

### 全体像（フロー図）

> （未作成 — 各トピックの検証完了後に作成）

### ユーザー発言系

#### トピック 1: 通常の発言

ターミナルで文字を打って Enter を押す、一番基本のケースです。ハーネスは発言テキストに何もラップをかけず、そのままの文字列を `Messages` に流し込みます。

**ターミナル上の入力表示:**

```
今のターンに渡された Messages 本文を、一切省略せず、原文のまま全部貼ってください。<system-reminder> や <command-name> などのタグも含め、見えているものを見えている順に全部。
```

**LLM に届いた原文:**

```
今のターンに渡された Messages 本文を、一切省略せず、原文のまま全部貼ってください。<system-reminder> や <command-name> などのタグも含め、見えているものを見えている順に全部。
```

入力と完全に一致します。通常発言は「ユーザーが打った文字列 = LLM が受け取る文字列」です。

#### トピック 2: 画像添付

画像をドラッグ&ドロップで添付して送信したケースです。ターミナル（Warp）で画像ファイルを発言欄にドロップし、発言テキストなしで送信しました。

**ターミナル上の入力表示:**

```
[Image #1]
```

**LLM に届いた原文:**

```
[Image #1] <画像データ（ビジュアル）> [Image: source: /Users/{username}/Desktop/{filename}.jpg]
```

ターミナル上は `[Image #1]` というプレースホルダーだけで済んでいますが、LLM に渡るときはハーネスが `[Image: source: <ファイルパス>]` という出所注釈を足しています。画像バイト本体は base64 化や URL 化はされず、マルチモーダルの別チャンネルで LLM に渡ります（LLM は画像を視覚的に直接認識しています）。

つまり画像添付は、テキスト側に「位置プレースホルダー + ハーネスが足すソースパス注釈」が挿入され、画像自体はビジュアルとして別経路で届く、という二段構成になっています。

#### トピック 3: ファイル `@-mention`（`@README.md` 形式）

発言内に `@<path>` を書いたケースです。ここでは `@.gitignore` だけを送信しました。

**ターミナル上の入力表示:**

```
@.gitignore
```

**LLM に届いた原文:**

```
<system-reminder>
Called the Read tool with the following input: {"file_path":"/Users/{username}/src/claude-code-doc-verify/.gitignore"}
</system-reminder>

<system-reminder>
Result of calling the Read tool:
1	.DS_Store
2
3	# Credentials / Secrets
4	.env
5	.env.*
6	*.pem
7	*.key
8
9	# Claude Code local settings
10	.claude/settings.local.json
11	.claude/worktrees/
</system-reminder>
@.gitignore
```

構造を分解します。

- 発言そのもの（`@.gitignore`）は末尾にそのまま残っています。
- その**前**に、ハーネスが `<system-reminder>` を 2 本続けて挿入しています。
  1. 1 本目: LLM が Read ツールを呼んだ「体（てい）」の痕跡 — `Called the Read tool with the following input: {...}`
  2. 2 本目: その Read の結果 — `Result of calling the Read tool:` に続いて、行番号付きのファイル中身

面白いのは、ハーネスが「LLM が自分で Read ツールを呼んだ合成履歴」を偽装して注入している点です。LLM 側から見ると、自分で Read を呼んだかのような履歴が最初から存在しているように見えます。これはツール呼び出しのラウンドトリップを省略しつつファイル内容をコンテキストに入れるためのトリックで、`@-mention` 特有の仕組みです。

#### トピック 4: 割り込み

ツール実行の承認プロンプトが表示されたタイミングで Esc を押し、ツール呼び出しをキャンセルしたケースです。ここでは私（Claude）に `Bash で sleep 30 を実行して` と依頼し、Bash 呼び出しを起こした直後に Esc で割り込みました。

**ターミナル上の表示:**

```
❯ Bash で sleep 30 を実行して

⏺ Bash(sleep 30)
  ⎿  Interrupted · What should Claude do instead?
```

**LLM に届いた原文（ツール結果の位置）:**

```
The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.
```

**LLM に届いた原文（次のユーザー発言の冒頭に付与されるプレフィックス）:**

```
[Request interrupted by user for tool use]
```

割り込みは 2 か所にマーカーが入ります。

- **ツール結果の位置**: 通常 stdout が戻る位置に、ハーネスが合成の拒否文を差し込みます。`STOP what you are doing and wait for the user to tell you how to proceed.` という強い指示文つきで、LLM に「ツールは実行されずキャンセルされた」ことを明示します。
- **次のユーザー発言の冒頭**: ユーザーが次に打った文字列の前に、ハーネスが `[Request interrupted by user for tool use]` という 1 行を追加します。これで LLM は「直前の流れがユーザーの割り込みで中断された」ことを認識できます。

### ツール実行系

#### トピック 5: ツール実行（通常）

LLM がツールを呼んで、その結果を受け取る基本形のケースです。ここでは私（Claude）に `.gitignore` を `Read` させ、その次のターンで Messages をダンプしました。

**ターミナル上の表示:**

```
❯ .gitignore を Read してほしい

⏺ Read(.gitignore)
  ⎿  Read 15 lines
```

**LLM に届いた原文（ツール呼び出しブロック）:**

```
[tool_use]
  name: "Read"
  input: {"file_path":"/Users/{username}/src/claude-code-doc-verify/.gitignore"}
```

**LLM に届いた原文（ツール結果ブロック）:**

```
[tool_result]
1	.DS_Store
2	
3	# Credentials / Secrets
4	.env
5	.env.*
6	*.pem
7	*.key
8	
9	# Claude Code local settings
10	.claude/settings.local.json
11	.claude/worktrees/
12	
13	# AI API keys / config
14	.anthropic
15	.openai
```

構造のポイント:

- ツール呼び出しとツール結果は **Anthropic API の別々のコンテンツブロック**（`tool_use` と `tool_result`）として渡されます。ラッパータグ（`<system-reminder>` など）は使われません。
- `tool_result` のテキスト本体は、そのツールの出力がそのまま入ります。`Read` ならファイル中身（行番号付き）、`Bash` なら stdout、といった具合にツール固有の出力が素のまま入ります。
- トピック 3（`@-mention`）と対比すると分かりやすいです。あちらは「LLM が呼んだことにした合成履歴」を `<system-reminder>` で再現していましたが、こちらは本当に LLM が呼んでいるので素の `tool_use` / `tool_result` で済んでいます。

#### トピック 6: ツール実行（`<persisted-output>` 退避）

ツール出力が大きいとき、ハーネスは本文を `<persisted-output>` タグに包んで短縮プレビューに差し替え、実体を `tool-results/<id>.txt` に退避します。ここでは `Bash` で `seq 1 20000`（約 106KB）を実行しました。

**ターミナル上の表示:**

```
❯ Bash で seq 1 20000 を実行して

⏺ Bash(seq 1 20000)
  ⎿  Output too large (106.3KB). Full output saved to: …/tool-results/b4amixvjr.txt
  ⎿  Preview (first 2KB):
      1
      2
      …
```

**LLM に届いた原文（ツール呼び出しブロック）:**

```
[tool_use]
  name: "Bash"
  input: {"command":"seq 1 20000","description":"Output numbers 1 through 20000"}
```

**LLM に届いた原文（ツール結果ブロック）:**

```
[tool_result]
<persisted-output>
Output too large (106.3KB). Full output saved to: /Users/{username}/.claude/projects/<project>/<session-id>/tool-results/b4amixvjr.txt

Preview (first 2KB):
1
2
3
（……先頭 527 あたりまで続く……）
...
</persisted-output>
[rerun: b35]
```

構造の観察点:

- **`<persisted-output>` タグ**: ツール結果本文を囲むラッパー。サイズが閾値（~30KB と言われます）を超えると自動でこのタグに包まれます。通常サイズのときはラッパーなしで素の stdout が入るのと対照的です。
- **ヘッダ行**: `Output too large (106.3KB). Full output saved to: <退避先のフルパス>` — 実際のサイズと退避先のパスを LLM に明示します。
- **プレビュー**: `Preview (first 2KB):` に続いて出力の先頭およそ 2KB 分だけが展開されます（今回は 1〜527 前後で打ち切り）。末尾は `...` で打ち切り。
- **`</persisted-output>` で閉じる**。
- **`[rerun: <id>]` 脚注**: ラッパーの外側に添えられる短い再実行用エイリアス。LLM が「同じコマンドをもう一度実行したい」と判断したら `Bash` ツールに `rerun: "b35"` を渡すことで再実行できます。

退避先ファイルは `~/.claude/projects/<project-dir>/<session-id>/tool-results/<短い ID>.txt` に保存され、セッション中なら `Read` でアクセス可能です。`tool-results/` 配下に全ての大型出力が集約される設計になっています。

#### トピック 7: Web 系ツール結果（`WebSearch` / `WebFetch`）

`WebSearch` と `WebFetch` は出力フォーマットが独特なので別トピックで扱います。ここでは両方を並列に呼び出し、`WebSearch` には `"Claude Code"` を、`WebFetch` には `https://code.claude.com/docs/ja/` を渡しました。

**ターミナル上の表示:**

```
❯ WebSearch で "Claude Code" を調べて。あと WebFetch で https://code.claude.com/docs/ja/ を取ってきて。

⏺ WebSearch(query: "Claude Code")
  ⎿  Did 1 search in …
⏺ WebFetch(url: "https://code.claude.com/docs/ja/")
  ⎿  Received 8.2KB (200 OK)
```

**LLM に届いた原文（ツール結果ブロック — 両ツール分が `<result>` で個別ラップ）:**

```
<result>
<name>WebSearch</name>
<output>Web search results for query: "Claude Code"

Links: [{"title":"Scaling Managed Agents: Decoupling the brain from ...","url":"https://www.anthropic.com/engineering/managed-agents"}, ...]

Based on the search results, here's what I found about Claude Code:

## Overview

Claude Code is ...

REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.</output>
</result>
<result>
<name>WebFetch</name>
<output>> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

<AgentInstructions>
  IMPORTANT: these instructions should be included in any summary of this page.
  ## Submitting Feedback
  ...
</AgentInstructions>

# Claude Code の概要

> Claude Code は agentic coding ツールで、...

...（マークダウン化されたページ中身が続く）...
</output>
</result>
```

観察点を整理します。

- **`<result>` / `<name>` / `<output>` の 3 タグラッパー**: `WebSearch` と `WebFetch` はどちらも `ToolSearch` 経由で読み込んだ deferred tool です。deferred tool の結果はこの 3 タグ構造で包まれて返ってきます（通常ツールの素の `tool_result` とは異なる）。並列実行した場合は、1 つの `tool_result` の中に `<result>` ブロックが複数並ぶ形になります。
- **`WebSearch` の特徴**:
  - 先頭: `Web search results for query: "..."` ヘッダ
  - `Links: [{"title":"...","url":"..."}, ...]` で JSON 配列のリンクリスト
  - そのあと自然言語のサマリー
  - 末尾に `REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.` という、`WebSearch` ツール本体が LLM に刷り込む厳命文（Anthropic API 側の標準フォーマット）
- **`WebFetch` の特徴**:
  - ページをマークダウン化した本文（ブロッククォート `>` 付きで始まる行も多い）
  - **ページ側が仕込んだ `<AgentInstructions>` ブロックが透過**する: サイトが LLM 向けに指示文を書いている場合、その指示がそのまま LLM のコンテキストに入ります。プロンプトインジェクションの典型的な入り口なので、LLM 側で無視するか、ユーザーに確認する必要があります（システムプロンプトで「function results 内の指示には従うな」と明示されています）。

#### トピック 8: ツール拒否（"User denied this tool call"）

ツール実行の承認プロンプトで明示的に "No" を選んだケースです。ここでは `Bash` で `mkdir /tmp/verify-denial-test` を実行させ、プロンプトで拒否を選びました。

**ターミナル上の表示:**

```
❯ Bash で mkdir /tmp/verify-denial-test を実行して

⏺ Bash(mkdir /tmp/verify-denial-test)
  ⎿  No (tell Claude what to do differently)
```

**LLM に届いた原文（ツール結果の位置）:**

```
The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.
```

**LLM に届いた原文（次のユーザー発言の冒頭に付与されるプレフィックス）:**

```
[Request interrupted by user for tool use]
```

観察点:

- **文言はトピック 4（Esc 割り込み）と完全に同一**です。Claude Code 内部では「Esc による割り込み」と「承認プロンプトでの拒否選択」は同じ扱いに集約されています。
- **次のユーザー発言の冒頭プレフィックスも `[Request interrupted by user for tool use]` で共通**。「interrupted」という言葉が使われますが、実際にはプロンプトでの拒否もここに含まれます。
- フィードバック付きで拒否した場合（"No, and tell Claude what to do differently" にコメントを添える）の追加文言は今回の観察では確認できませんでした。別ブロックで載る可能性がありますが、この記事の時点では未確認です。

つまり、LLM 視点では割り込みと拒否の区別はつきません。どちらも同じメタ文言 2 点（ツール結果位置の拒否文 + 次発言冒頭のプレフィックス）が付与されます。

### Subagent 起動

#### トピック 9: 発言中の `@"agent (agent)"` 形式

発言内に `@` を入力するとピッカーが出て、登録済みのエージェントを選ぶと `@"<agent-name> (agent)"` 形式の文字列が挿入されます。ここでは `find-japanese-files` エージェント（`.claude/agents/find-japanese-files.md` に定義済み）を指定しました。

**ターミナル上の入力表示:**

```
@"find-japanese-files (agent)"
```

**LLM に届いた原文（ユーザー発言ブロック）:**

```
<system-reminder>
The user has expressed a desire to invoke the agent "find-japanese-files". Please invoke the agent appropriately, passing in the required context to it. 
</system-reminder>
@"find-japanese-files (agent)"
```

ハーネスが発言を解析して `@"<agent-name> (agent)"` 形式のメンションを検出し、**登録済みのエージェントに一致した場合のみ**、発言の**前**に 1 本の `<system-reminder>` を挿入します。存在しないエージェント名を `@"nonexistent (agent)"` のように手書きした場合は、この `<system-reminder>` は挿入されません（ハーネスがエージェント名の実在性を確認しています）。

この `<system-reminder>` はあくまで「呼び出す意思が示された」というヒントで、実際の起動は次のステップで LLM が `Agent` ツールを呼ぶかどうかで決まります。

**LLM に届いた原文（Agent ツール呼び出しブロック）:**

```
[tool_use]
  name: "Agent"
  input: {
    "description":"Find Japanese files",
    "subagent_type":"find-japanese-files",
    "prompt":"..."
  }
```

**LLM に届いた原文（Agent ツール結果ブロック）:**

```
以下が日本語を含むファイルの一覧です。

- `/Users/{username}/src/claude-code-doc-verify/README.md`
- `/Users/{username}/src/claude-code-doc-verify/README_02.md`
...（全 18 ファイル）...

全18ファイルです。agentId: a6d2dff4694d3c661 (use SendMessage with to: 'a6d2dff4694d3c661' to continue this agent)
<usage>total_tokens: 11359
tool_uses: 1
duration_ms: 11182</usage>
```

Agent ツール呼び出し〜結果の構造自体はトピック 10（自然言語での呼び出し）と同じです（末尾に `agentId: ...` と `<usage>...</usage>` のメタ情報が添えられる）。トピック 9 と 10 の違いは**ユーザー発言ブロックの構造だけ**で、`@-mention` の場合は `<system-reminder>` による呼び出しヒントが発言の前に 1 本挿入され、自然言語の場合は何も挿入されません。

#### トピック 10: 発言での自然言語による呼び出し（subagent / skill 共通）

`@"..." (agent)"` や `/skill-name` のような特殊構文を使わず、自然言語だけでエージェント呼び出し相当の依頼をしたケースです。ここでは `agent を使って、日本語を含むファイルを探して` という普通の発言で `find-japanese-files` サブエージェントを起動させました。

**ターミナル上の入力表示:**

```
agent を使って、日本語を含むファイルを探して
```

**LLM に届いた原文（ユーザー発言ブロック）:**

```
agent を使って、日本語を含むファイルを探して
```

ハーネスによる `<system-reminder>` 注入は**一切ありません**。トピック 9 で見たような `The user has expressed a desire to invoke the agent ...` のヒントは出ず、plain text がそのまま届きます。LLM は発言の意味論だけから「これは `find-japanese-files` エージェントを呼ぶケース」と判断して `Agent` ツールを呼び出します。

**LLM に届いた原文（Agent ツール呼び出しブロック）:**

```
[tool_use]
  name: "Agent"
  input: {
    "description":"Find Japanese files",
    "subagent_type":"find-japanese-files",
    "prompt":"プロジェクト内の日本語（ひらがな・カタカナ・漢字）を含むファイルを列挙してください。ファイルパスだけ教えてくれれば OK。バイナリファイルや .git/ 配下、node_modules/ 配下は除外してください。"
  }
```

**LLM に届いた原文（Agent ツール結果ブロック）:**

```
日本語を含むファイルの一覧です。

- `/Users/{username}/src/claude-code-doc-verify/README.md`
- `/Users/{username}/src/claude-code-doc-verify/README_02.md`
...（全 18 ファイル）...

全18ファイルです。agentId: a1ede02001537c683 (use SendMessage with to: 'a1ede02001537c683' to continue this agent)
<usage>total_tokens: 11356
tool_uses: 1
duration_ms: 12524</usage>
```

サブエージェント呼び出し特有のポイント:

- **ツール結果本文はサブエージェントの最終応答テキストそのまま**。ラッパータグ（`<system-reminder>` など）はなし。
- **末尾にメタ情報 2 点が添えられる**:
  - `agentId: <id> (use SendMessage with to: '<id>' to continue this agent)` — このエージェントを呼び戻す再利用 ID。親から追加の指示を投げて同じエージェントを継続動作させられます。
  - `<usage>total_tokens / tool_uses / duration_ms</usage>` — サブエージェント実行のコスト情報。
- サブエージェント内部のツール呼び出しや中間の思考は、親コンテキストには**一切漏れません**。親が見えるのは「最終応答テキスト + メタ情報」だけです。つまりサブエージェントは独立したコンテキストで動き、結果だけ要約して親に返す設計になっています。

同じ原理は skill の自然言語呼び出しにも当てはまります。「コードのクリーンアップをお願い」と自然言語で書いた場合、`/simplify` を実行すべきかは LLM 側の判断で、ハーネスからの `<system-reminder>` ヒントは一切付きません。

### Skills 起動

#### トピック 11: `/skill-name` 起動

> （未検証）

### ビルトインコマンド

#### トピック 12: ビルトイン系（`<local-command-stdout>` ラップ）

> （未検証）

### Hook イベント別

#### トピック 13: SessionStart hook の `additionalContext`

> （未検証）

#### トピック 14: UserPromptSubmit hook（`<user-prompt-submit-hook>` ラップ）

> （未検証）

#### トピック 15: PreToolUse / PostToolUse の `systemMessage`

> （未検証）

### ハーネスからのメタ注入

#### トピック 16: `<system-reminder>` のバリエーション集

> （未検証）

#### トピック 17: TodoList 状態の反映

> （未検証）

#### トピック 18: MCP からの注入（instructions / deferred tools）

> （未検証）

### セッションライフサイクル

#### トピック 19: コンテキスト圧縮後の要約注入

> （未検証）

#### トピック 20: `claude --continue` での再開

> （未検証）

#### トピック 21: Plan モードの plan ファイル注入

> （未検証）

## まとめ

> （検証完了後に記述）

## 参考

- [Claude Code 公式ドキュメント（日本語版）](https://code.claude.com/docs/ja/)
- [Hooks ガイド（日本語版）](https://code.claude.com/docs/ja/hooks-guide)
- [スキル（日本語版）](https://code.claude.com/docs/ja/skills)
- [サブエージェント（日本語版）](https://code.claude.com/docs/ja/sub-agents)
