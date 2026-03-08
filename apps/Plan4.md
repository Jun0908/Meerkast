# Meerkat Workshop - Plan 4 (OpenClaw LLM概念統合版)

## 1. 目的
- Plan 3 の「分散型意思決定デモ」に、OpenClaw の LLM 概念を追加する。
- 重点は「LLMが何を決めるか」と「何を決めないか」を明確化し、Judge に実運用イメージを伝えること。

## 2. OpenClaw × LLM の基本メッセージ
- LLM は **中央司令官** ではなく、各エージェントの **ローカル推論器**。
- 最終確定は従来どおり `support - attack >= threshold` の分散合意で行う。
- つまり「LLMが勝手に命令する」のではなく、「現場ごとの提案精度を上げる」用途で使う。

## 3. Plan 3 からの追加ポイント
- ルールベース判定に加えて、LLM が `candidate/support/attack/reason` を返す経路を追加。
- UIで「なぜそのsignalを出したか（reason）」を表示し、ブラックボックス感を減らす。
- デモ中に `Rule Mode` と `OpenClaw(LLM) Mode` を切り替え、判断の違いを見せる。

## 4. 追加 Build Tasks

### P0（必須）
1. `Task 19`: LLM入力コンテキスト定義
   - 内容: 各エージェントの入力を `localArea(load/risk) + recentEvents + recentLogs` に固定する。
   - 完了条件: 各tickで agent ごとに同じ構造の context packet が生成される。
   - 目安: 25分

2. `Task 20`: OpenClaw推論アダプタ追加
   - 内容: LLM呼び出し層を実装し、失敗時は既存ルールへフォールバックする。
   - 完了条件: APIエラー時でもデモが止まらない。
   - 目安: 40分

3. `Task 21`: 構造化出力スキーマ導入
   - 内容: LLM出力を `candidate`, `support`, `attack`, `reason` のJSONに制約。
   - 完了条件: 不正形式は破棄し、ログにバリデーション結果を表示。
   - 目安: 30分

4. `Task 22`: Reason可視化UI追加
   - 内容: Decision Board かログに「Agent -> reason」を短文表示する。
   - 完了条件: Judgeが「その判断根拠」を画面だけで追える。
   - 目安: 30分

5. `Task 23`: モード切替（Rule / OpenClaw）
   - 内容: トグルで推論モードを切り替え、同じシナリオを比較可能にする。
   - 完了条件: 同一イベント列で挙動差が再現できる。
   - 目安: 25分

### P1（余力があれば）
1. `Task 24`: 遅延とコストの可視化
   - 内容: 推論時間(ms) と token 使用量を簡易表示。
   - 完了条件: 「運用可能性」の説明材料になる。
   - 目安: 20分

2. `Task 25`: 中央LLMモード（比較用）追加
   - 内容: 1つの中央LLMが全体判断する baseline を追加。
   - 完了条件: 分散LLMとの比較がデモ上で可能。
   - 目安: 35分

## 5. デモ運用タスク（発表向け）
1. `Pitch 07`: 3文で OpenClaw 概念を固定
   - 「LLMは中央命令ではなく、現場ごとの推論器です」
   - 「出力は構造化され、support/attackとして合算されます」
   - 「最終決定は閾値ルールで確定し、説明可能性を担保します」

2. `Pitch 08`: Judge向け比較導線を固定
   - 手順: `Rule Mode` 実行 -> `OpenClaw Mode` 実行 -> `decision time / confirmed数 / reason` を比較

3. `Pitch 09`: リスク説明を先回り
   - 内容: 「LLM単独決定はしない」「スキーマ検証」「フォールバックあり」を必ず口頭で明言。

## 6. Definition of Done（Plan 4）
- 観客が「OpenClawにおけるLLMの役割」を 20秒以内で理解できる。
- Rule と OpenClaw の比較を同一画面・同一シナリオで示せる。
- 判断根拠（reason）が UI またはログで追跡可能で、ブラックボックス批判に答えられる。
