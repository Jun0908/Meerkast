# Modern Metal Mills - Hackathon Plan (4h MVP)

## 1. Project Overview
- **Modern Metal Mills** は、近未来の金属工場を舞台にした「分散型意思決定」デモ。
- デモでは、中央管理者が命令しなくても、エージェントの行動痕跡が環境に蓄積され、意思決定が確定する流れを見せる。
- StarOffice的な体験を、工場マップ上の「状態を持つ場所（Furnace / Rolling / QC / Warehouse / Energy）」として置き換える。
- ハッカソン向きな理由は、1画面で新規性が伝わり、1分で「見た瞬間に理解できる」見た目と動きが作れるため。

### この4時間で完成させる実物
- `localhost` で動く1ページのデモUI
- 左に工場マップ（5エリアの状態色が変化）
- 右に意思決定カード3枚（support / attack / status）
- 下にイベントボタン4つ（押すと状態が変わる）
- ログに「どの候補がいつ確定したか」が出る

## 2. Core Concept
- StarOffice由来: 仕事状態を表ではなく空間として見せる。画面全体が状況を語る。
- 分散型意思決定: 各エージェントは局所情報だけで行動し、環境に support / attack を書き込む。
- Modern Metal Millsでの意味: 工場運用の現実課題（品質、保全、電力、納期）を、会議レスに調整する仕組みとして見せる。
- 「場から決まる」: 意思決定は誰か1人の命令ではなく、エリアに蓄積した signal が閾値を超えて確定する。

## 3. Demo Story
1. 工場は通常稼働。5エリアに安定状態インジケータが表示される。
2. 観客がイベントボタンを押す（例: `electricity price ↑`）。
3. 各エージェントが局所ルールで support / attack signal をエリアへ書き込む。
4. signal が拡散・蒸発しながら、右カラムの意思決定カードに合算値が溜まる。
5. ある候補が閾値を超えると「Decision Confirmed」になりログに記録される。
6. 工場マップの状態色が変わり、ピーク回避や品質安定などの改善が見える。

## 4. MVP Scope (4時間で作る範囲)
### 今回作るもの
- 1画面のWeb UI（Next.js + TypeScript）
- シンプルな工場マップ（5エリア）
- エージェント5体の簡易ルール
- 意思決定候補3つ
- support / attack の簡易表示（数値 + バー）
- イベントボタン4つ
- 閾値到達で決定されるロジック
- 決定ログの簡易表示

### 今回作らないもの
- 複雑なAI推論
- 複雑なバックエンド
- 実データ連携
- 高度な最適化アルゴリズム
- 本格的なシミュレーション
- 複数画面構成

## 5. Simple System Design
- 前提: Next.js + TypeScript、1ページ完結、状態はローカル（`useState` + `setInterval`）。

### データモデル（最小）
- `FactoryArea`: `id`, `name`, `load`, `risk`, `signalSupport`, `signalAttack`
- `Agent`: `id`, `role`, `focusAreas`, `weights`
- `DecisionCandidate`: `id`, `title`, `targetAreas`, `support`, `attack`, `status`
- `Event`: `id`, `label`, `effects`（エリア状態への増減）
- `FieldSignal`: `areaId`, `candidateId`, `supportDelta`, `attackDelta`, `ttl`

### 更新ループ（tick = 500ms）
1. `signal update`: エージェントが局所状態を見て signal を追加
2. `diffuse`: 隣接エリアへ弱く伝播
3. `evaporate`: 古い signal を減衰
4. `evaluate`: 候補ごとに `support - attack` を計算し、閾値超えで確定

### 設計原則
- エージェントは中央判断を持たない。
- 各エージェントは局所情報だけを見る。
- 意思決定は環境に溜まった signal の結果として生まれる。

## 6. UI Layout
- **左:** 工場マップ（5エリアの状態色 + 忙しさ/リスク表示）
- **右:** 意思決定カード3枚（support / attack / status / threshold progress）
- **下:** イベントボタン4つ
- **補助:** 最新ログ（3〜6件）

画面全体で「どこが熱いか」「何が押されているか」が一目で分かる構成にし、StarOffice的に「一覧ではなく場」として状態を読む体験を優先する。

## 7. Agents
- `Scheduler`
  - 見るもの: Rolling/Warehouse の負荷・納期圧
  - 影響先: Rolling, Warehouse
  - 行動: 工程順序入れ替えを support、品質悪化時は attack
- `Maintenance`
  - 見るもの: Furnace/Rolling の振動・劣化
  - 影響先: Furnace, Rolling
  - 行動: 点検差し込みを support、納期圧が高い時は attack
- `QA`
  - 見るもの: QC の defect 率
  - 影響先: QC, Rolling
  - 行動: 点検差し込みを support、無理な高速運転を attack
- `Logistics`
  - 見るもの: Warehouse 詰まり・rush order
  - 影響先: Warehouse, Rolling
  - 行動: 工程順序入れ替えを support、点検長期化を attack
- `Energy`
  - 見るもの: Energy価格・ピーク負荷
  - 影響先: Energy, Furnace
  - 行動: 炉出力低下を support、高出力維持を attack

## 8. Demo Buttons
- `vibration ↑`: Furnace/Rolling の劣化リスク上昇、Maintenance が点検 support を強める。
- `defect ↑`: QC 不良率上昇、QA が点検 support と高速運転 attack を強める。
- `rush order`: Warehouse/納期圧上昇、Scheduler/Logistics が順序入れ替え support を強める。
- `electricity price ↑`: Energyコスト上昇、Energy が炉出力低下 support を強める。

## 9. Why It Works
- **スティグマジー**: エージェント同士は会話せず、環境への書き込みを通じて間接協調する。
- **拡散**: 影響は隣接エリアにも波及し、局所判断が工場全体に伝わる。
- **蒸発**: 古い判断圧は自然に弱まり、状況変化に追従できる。
- **クオラム**: support が一定以上集まった候補だけ確定し、「場が決めた」ことを視覚的に示せる。

## 10. Timeline (4 hours)
### Hour 1
- レイアウト作成（左マップ / 右カード / 下ボタン）
- 工場マップ5エリア表示
- 右カラムの候補カード雛形
- イベントボタン配置

### Hour 2
- データ構造実装（Area / Agent / Candidate / Event / Signal）
- tick 更新ループ実装
- support / attack 集計と候補判定

### Hour 3
- エージェント5種のルール実装
- 4イベントの影響反映
- 決定ログ表示と状態変化反映

### Hour 4
- 見た目調整（色・強弱・視認性）
- 1分デモ動線の固定
- バグ修正
- 発表用シナリオ作成（押す順番を固定）

## 11. Immediate Next Actions
1. 1ページUIの骨組みを先に作る（マップ/カード/ボタン/ログ）。
2. 最小データモデルと tick ループを実装する。
3. 3つの意思決定候補に対する閾値判定を通す。
4. 5エージェント + 4イベントのルールを最小で接続する。
5. デモ用の固定シナリオ（ボタン操作順）を決めてリハーサルする。

## 12. Build Tasks (4時間でやる具体Task)
### P0（必須。これが終わればデモ成立）
1. `Task 01`: 1ページレイアウトを作る  
   - 内容: 左マップ / 右カード / 下ボタン / ログ領域を配置  
   - 完了条件: 画面を開いた時点で4ブロックが見える  
   - 目安: 25分
2. `Task 02`: 工場エリア5つを描画する  
   - 内容: Furnace / Rolling / QC / Warehouse / Energy のカード表示  
   - 完了条件: 各エリアに `load` と `risk` が表示される  
   - 目安: 20分
3. `Task 03`: 意思決定候補3枚を表示する  
   - 内容: 点検差し込み / 工程順序入れ替え / 炉出力低下  
   - 完了条件: 各カードに support / attack / status が見える  
   - 目安: 20分
4. `Task 04`: イベントボタン4つを実装する  
   - 内容: vibration / defect / rush order / electricity price  
   - 完了条件: 押下時に対象エリアの状態値が変化する  
   - 目安: 20分
5. `Task 05`: 最小データモデルを実装する  
   - 内容: FactoryArea, Agent, DecisionCandidate, Event, FieldSignal を型定義  
   - 完了条件: ハードコードデータで初期表示できる  
   - 目安: 20分
6. `Task 06`: tick更新ループを実装する  
   - 内容: `signal update -> diffuse -> evaporate -> evaluate` を500msで回す  
   - 完了条件: 数値が自動更新される  
   - 目安: 35分
7. `Task 07`: エージェント5種のルールを実装する  
   - 内容: 各エージェントが局所情報から support / attack を追加  
   - 完了条件: イベントに応じて候補優先度が変わる  
   - 目安: 35分
8. `Task 08`: 閾値判定と決定確定を実装する  
   - 内容: `support - attack >= threshold` で `confirmed` にする  
   - 完了条件: 候補が確定し、状態変化がマップに反映される  
   - 目安: 25分
9. `Task 09`: 決定ログを実装する  
   - 内容: 確定時に時刻付きログを追記（最新5件）  
   - 完了条件: 1分デモ中にログ変化が視認できる  
   - 目安: 15分

### P1（時間が余れば実施）
1. `Task 10`: 視認性調整（色・強弱・余白）  
   - 完了条件: どこが忙しいか3秒で読める  
   - 目安: 20分
2. `Task 11`: デモ固定シナリオボタンを追加（任意）  
   - 内容: 事前定義順でイベントを自動発火  
   - 完了条件: 発表時に再現性高く1分デモできる  
   - 目安: 20分

### 発表タスク（実装と並行で最低限）
1. `Pitch 01`: 口上を3文に固定  
   - 1文目: 「これは中央管理なしで意思決定が生まれる工場です」  
   - 2文目: 「今からイベントを起こすと、エージェントが環境に痕跡を書きます」  
   - 3文目: 「閾値で意思決定が確定し、場が意思を持ったように動きます」
2. `Pitch 02`: デモ操作順を固定  
   - 推奨順: `electricity price ↑ -> rush order -> defect ↑`
3. `Pitch 03`: 失敗時バックアップを準備  
   - 内容: 事前に確定しやすい状態を作った初期値プリセットを1つ用意
