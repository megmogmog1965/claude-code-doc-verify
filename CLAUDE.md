# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Claude Code の公式ドキュメントに書かれている内容を実際に検証し、その結果を **Qiita 記事（README.md）** としてまとめるプロジェクトです。README.md の記事を完成させることがこのプロジェクトのゴールです。

## Key Files

- **README.md** — Qiita 投稿用の記事本体（プロジェクトの成果物）
- **files/** — 各検証で使用するテストファイルを検証番号ごとに格納
  - `files/<NN>/` — `README.md` の検証番号に対応（例: 検証 1 → `files/01/`）
  - テストファイルが不要な検証はフォルダを作成しなくてよい

## 記事の規約

- 記事やコードレビューは日本語で記述すること
- 文体は「ですます調」で統一
- 記事の文章は AI（Claude Code）が書き、検証内容・方針はユーザーが決定する

## ワークフロー

- 1つの検証の記事を書き終えたら、ユーザーに `/compact` の実行を促すこと

## 検証用（検証 1: `@import` の動作確認）

以下は検証 1 で使用する `@import` の記述です。

@files/01/import_test.md
